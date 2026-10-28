"""H12: train-only out-of-fold logistic recalibration; explicit demo threshold."""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve, log_loss
from .common import need
from .audit_groups import group_metrics


class LogitSigmoidCalibrator:
    """p_cal = sigmoid(intercept + slope * logit(p_raw)). Not sklearn's sigmoid-on-p.

    Fit only on out-of-fold TRAIN predictions. Weak fixed L2 regularization;
    no class weighting, no oversampling. A positive slope is required.
    """
    @staticmethod
    def inputs(probability):
        p = np.asarray(probability, dtype=float)
        need(p.ndim == 1 and len(p) > 0 and np.isfinite(p).all() and ((p >= 0) & (p <= 1)).all(), "Invalid calibration scores.")
        p = np.clip(p, 1e-12, 1-1e-12)
        return (np.log(p) - np.log1p(-p)).reshape(-1, 1)

    def fit(self, probability, y):
        X = self.inputs(probability)
        y = np.asarray(y)
        need(len(y) == len(X) and set(np.unique(y)) == {0, 1}, "Invalid calibration labels.")
        self.estimator_ = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000, tol=1e-9, random_state=42)
        self.estimator_.fit(X, y)
        self.slope_ = float(self.estimator_.coef_[0, 0])
        self.intercept_ = float(self.estimator_.intercept_[0])
        self.fit_rows_ = len(y)
        need(self.slope_ > 0, "Calibration would reverse risk ranking; stop for investigation.")
        return self

    def transform(self, probability):
        return self.estimator_.predict_proba(self.inputs(probability))[:, 1]


class CalibratedRiskPipeline:
    """Portable inference bundle, keeping the original train-fitted H10 pipeline."""
    def __init__(self, base_pipeline, calibrator):
        self.base_pipeline = base_pipeline
        self.calibrator = calibrator

    @property
    def named_steps(self):
        return self.base_pipeline.named_steps

    @property
    def classes_(self):
        return np.asarray([0, 1])

    def predict_proba(self, X):
        positive_index = list(self.base_pipeline.classes_).index(1)
        raw = self.base_pipeline.predict_proba(X)[:, positive_index]
        p = self.calibrator.transform(raw)
        return np.column_stack([1-p, p])


def probability_metrics(y, p):
    result = group_metrics(y, p)
    result["log_loss"] = float(log_loss(y, p, labels=[0, 1]))
    result["gini"] = 2*result["roc_auc"]-1
    return result


def reliability_bins(y, p, variant):
    """Fixed 10 equal-width bins, INCLUDING empty bins; ECE is descriptive only."""
    y, p = np.asarray(y), np.asarray(p)
    bins = np.minimum((p*10).astype(int), 9)
    records = []
    ece = 0.
    for i in range(10):
        mask = bins == i
        n = int(mask.sum())
        mean, frequency = (float(p[mask].mean()), float(y[mask].mean())) if n else (None, None)
        gap = abs(mean-frequency) if n else None
        if n:
            ece += n/len(y)*gap
        records.append({"variant": variant, "bin": i, "lower": i/10, "upper": (i+1)/10,
                        "rows": n, "mean_score": mean, "observed_positive_rate": frequency, "absolute_gap": gap})
    return records, float(ece)


def choose_probability_variant(raw, calibrated):
    # Predeclared selection, no adaptive extra methods when the candidate loses.
    improves = calibrated["brier"] < raw["brier"]-1e-8 and calibrated["log_loss"] < raw["log_loss"]-1e-8
    stable_rank = calibrated["roc_auc"] >= raw["roc_auc"]-1e-6 and calibrated["average_precision"] >= raw["average_precision"]-1e-6
    return "oof_logit_sigmoid" if improves and stable_rank else "raw_h10"


def threshold_table(y, p):
    """One row per distinct score, with >= tie handling and vectorized counts."""
    y, p = np.asarray(y, dtype=int), np.asarray(p, dtype=float)
    # Validate including binary labels and finite probabilities.
    group_metrics(y, p)
    order = np.argsort(-p, kind="stable")
    yy, pp = y[order], p[order]
    ends = np.r_[np.flatnonzero(pp[:-1] != pp[1:]), len(pp)-1]
    tp = np.cumsum(yy)[ends]
    selected = ends+1
    fp = selected-tp
    pos, neg = int(y.sum()), int(len(y)-y.sum())
    need(pos > 0 and neg > 0, "Threshold selection requires both target classes.")
    precision = tp/selected
    recall = tp/pos
    f1 = 2*tp/(pos+selected)
    return pd.DataFrame({"threshold": pp[ends], "tp": tp, "fp": fp, "fn": pos-tp, "tn": neg-fp,
                         "precision": precision, "recall": recall, "f1": f1,
                         "false_positive_rate": fp/neg, "review_fraction": selected/len(y)})


def choose_demo_threshold(y, p):
    table = threshold_table(y, p)
    best = table.loc[np.isclose(table["f1"], table["f1"].max(), rtol=0, atol=1e-12)]
    row = best.sort_values("threshold", ascending=False).iloc[0]
    return {key: (int(value) if key in {"tp", "fp", "fn", "tn"} else float(value)) for key, value in row.items()}, table

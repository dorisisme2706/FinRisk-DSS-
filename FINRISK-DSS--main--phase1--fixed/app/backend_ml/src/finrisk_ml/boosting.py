from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from .common import need, read_json, sha256, PARQUET_HASH

LOCKED_SPLIT_HASH = "1992247193e6eab1d895732bc8c9350fd70fac641e1b4773ad0331a151a88417"

class NativeCategoryEncoder(TransformerMixin, BaseEstimator):
    """Learn categorical levels on train; retain numeric NaN; unseen levels become NaN."""
    def __init__(self, categorical):
        self.categorical = categorical

    def fit(self, X, y=None):
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        self.n_features_in_ = len(X.columns)
        self.fit_rows_ = len(X)
        self.categories_ = {col: sorted(X[col].dropna().unique().tolist()) for col in self.categorical}
        return self

    def transform(self, X):
        need(list(X.columns) == self.feature_names_in_.tolist(), "SCHEMA_MISMATCH: native input columns differ.")
        out = X.copy()
        for col in self.categorical:
            known_or_missing = out[col].where(out[col].isin(self.categories_[col]), other=np.nan)
            out[col] = pd.Categorical(known_or_missing, categories=self.categories_[col])
        return out

    def get_feature_names_out(self, input_features=None):
        return self.feature_names_in_

def training_positive_weight(y):
    values = np.asarray(y)
    need(set(np.unique(values)) == {0, 1}, "Both target classes are required in train.")
    return float((values == 0).sum() / (values == 1).sum())

def configurations():
    # Declared before any experiment. Exactly four configurations, one split, no test use.
    return [
        {"id": "lgbm_leaves15_unweighted", "num_leaves": 15, "positive_weighted": False},
        {"id": "lgbm_leaves31_unweighted", "num_leaves": 31, "positive_weighted": False},
        {"id": "lgbm_leaves15_posweighted", "num_leaves": 15, "positive_weighted": True},
        {"id": "lgbm_leaves31_posweighted", "num_leaves": 31, "positive_weighted": True},
    ]

def validate_baseline(run):
    run = Path(run)
    summary = read_json(run / "reports/run_summary.json")
    metadata = read_json(run / "model/metadata.json")
    need(summary["status"] == "PASS_BASELINE_VALIDATION_ONLY", "Baseline is not PASS.")
    need(summary["test_scored_rows"] == 0 and not summary["test_performance_evaluated"], "Baseline test independence changed.")
    need(metadata["data_hash"] == PARQUET_HASH, "DATA_VERSION_MISMATCH")
    need(sha256(run / "splits/split_manifest.csv") == metadata["split_hash"] == summary["split_hash"] == LOCKED_SPLIT_HASH,
         "SPLIT_VERSION_MISMATCH: H10 must use the original locked split.")
    need(sha256(run / "model/pipeline.joblib") == metadata["model_sha256"], "Baseline model checksum differs.")
    need(read_json(run / "reports/baseline_metrics.json") == summary["validation_metrics"], "Baseline metrics disagree.")
    return summary, metadata

def resolve_baseline(project, explicit=None):
    project = Path(project)
    pointer = project / "reports/LATEST_HK_BASELINE.txt"
    if explicit is not None:
        path = Path(explicit).resolve()
        validate_baseline(path)
        return path, "explicit"
    if pointer.is_file():
        value = pointer.read_text(encoding="utf-8-sig").strip()
        if value:
            path = Path(value)
            validate_baseline(path)
            return path, "baseline_pointer"
    # Recover only a missing/empty pointer. Existing nonempty pointers are never silently overridden.
    candidates = sorted((project / "artifacts").glob("hk_lr_baseline_*"), reverse=True)
    for path in candidates:
        try:
            validate_baseline(path)
        except (OSError, ValueError, KeyError):
            continue
        pointer.parent.mkdir(parents=True, exist_ok=True)
        pointer.write_text(str(path.resolve()) + "\n", encoding="utf-8")
        return path.resolve(), "verified_PASS_scan_and_pointer_recovery"
    raise ValueError("No verified PASS LR baseline found. Run 02 or provide --baseline-run.")

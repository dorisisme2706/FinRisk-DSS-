"""LightGBM native contributions, in raw-margin/log-odds units, never causal reasons."""
from __future__ import annotations
from numbers import Integral, Real
import numpy as np
import pandas as pd
from scipy.special import expit
from threadpoolctl import threadpool_limits
from .common import need

EXPLANATION_VERSION = "lightgbm_native_contrib_raw_margin_v1"


def json_value(value):
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, Real):
        need(np.isfinite(value), "Nonfinite feature value.")
        return float(value)
    need(isinstance(value, str), "Unsupported feature value.")
    return value


def explain_profile(pipeline, X, top_k=10):
    need(isinstance(X, pd.DataFrame) and len(X) == 1, "Explanations require exactly one profile.")
    need(isinstance(top_k, int) and not isinstance(top_k, bool) and 1 <= top_k <= 169, "Invalid top_k.")
    base = getattr(pipeline, "base_pipeline", pipeline)
    need(set(base.named_steps) == {"schema", "native_categories", "model"}, "Unsupported explanation pipeline.")
    features = base.named_steps["schema"].features
    need(not set(features) & {"target", "sk_id_curr", "code_gender", "days_birth"}, "Forbidden explanatory predictor.")
    normalized = base.named_steps["schema"].transform(X)
    encoded = base.named_steps["native_categories"].transform(normalized)
    model = base.named_steps["model"]
    need(list(model.classes_) == [0, 1] and model.get_params()["objective"] == "binary", "Binary model required.")
    need(features == model.booster_.feature_name(), "Explanation feature order mismatch.")
    need(float(model.booster_.params.get("sigmoid", 1.)) == 1., "Nonstandard binary link requires separate validation.")
    iteration = int(model.best_iteration_ or model.n_estimators_)
    with threadpool_limits(limits=2):
        contributions = np.asarray(model.booster_.predict(encoded, num_iteration=iteration, pred_contrib=True, validate_features=True), dtype=float)
        raw = float(model.booster_.predict(encoded, num_iteration=iteration, raw_score=True, validate_features=True)[0])
        probability = float(base.predict_proba(X)[0, 1])
    need(contributions.shape == (1, len(features)+1) and np.isfinite(contributions).all(), "Invalid native contribution matrix.")
    values, bias = contributions[0, :-1], float(contributions[0, -1])
    rebuilt = bias+float(values.sum())
    need(abs(rebuilt-raw) <= 1e-7 and abs(float(expit(rebuilt))-probability) <= 1e-10, "Contribution reconstruction failed.")
    order = sorted(range(len(features)), key=lambda i: (-abs(float(values[i])), features[i]))[:top_k]
    top = [{"feature": features[i], "observed_value": json_value(normalized.iloc[0][features[i]]),
            "contribution": float(values[i]), "direction": "increases_model_score" if values[i] > 0 else "decreases_model_score" if values[i] < 0 else "neutral",
            "scale": "raw_margin_log_odds"} for i in order]
    displayed = sum(item["contribution"] for item in top)
    details = {"version": EXPLANATION_VERSION, "method": "LightGBM native pred_contrib", "scale": "raw_margin_log_odds",
               "base_margin": bias, "all_feature_contributions_sum": float(values.sum()),
               "displayed_contributions_sum": displayed, "other_features_sum": float(values.sum())-displayed,
               "raw_margin": raw, "raw_base_probability": probability,
               "reconstruction_error_margin": abs(rebuilt-raw), "feature_count": len(features), "displayed_count": len(top),
               "number_of_trees_used": iteration, "explanation_is_causal": False, "contribution_is_probability_point_change": False,
               "calibrated_pipeline": hasattr(pipeline, "calibrator"),
               "scope": "Contributions explain the base LightGBM margin. They are not loan decisions or a guarantee of actionable causal effects."}
    return top, details


def global_gain_importance(pipeline):
    base = getattr(pipeline, "base_pipeline", pipeline)
    model = base.named_steps["model"]
    features = base.named_steps["schema"].features
    need(features == model.booster_.feature_name(), "Importance feature order mismatch.")
    iteration = int(model.best_iteration_ or model.n_estimators_)
    gain = model.booster_.feature_importance("gain", iteration=iteration)
    count = model.booster_.feature_importance("split", iteration=iteration)
    total = float(gain.sum())
    return sorted([{"feature": name, "gain": float(g), "split_count": int(n), "gain_fraction": float(g/total) if total else 0.}
                   for name, g, n in zip(features, gain, count)], key=lambda r: (-r["gain"], r["feature"]))

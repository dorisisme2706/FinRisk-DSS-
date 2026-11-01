from __future__ import annotations
from numbers import Integral
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from .common import read_json, sha256, PARQUET_HASH, need

class ProfileScorer:
    """Read-only scoring for existing profiles. Reserved test profiles remain blocked."""
    def __init__(self, snapshot, run):
        self.snapshot, self.run = Path(snapshot), Path(run)
        self.metadata = read_json(self.run / "model/metadata.json")
        self.policy = None
        if self.metadata.get("threshold_policy_version") is not None:
            policy_path = self.run / "model/threshold_policy.json"
            need(sha256(policy_path) == self.metadata.get("threshold_policy_sha256"), "POLICY_VERSION_MISMATCH")
            self.policy = read_json(policy_path)
            need(self.policy["threshold_policy_version"] == self.metadata["threshold_policy_version"], "POLICY_VERSION_MISMATCH")
            need(self.policy["comparator"] == ">=" and 0 <= self.policy["threshold"] <= 1, "Invalid threshold policy.")
        need(sha256(self.snapshot / "data/feature_matrix.parquet") == self.metadata["data_hash"] == PARQUET_HASH,
             "DATA_VERSION_MISMATCH")
        model_path = self.run / "model/pipeline.joblib"
        need(sha256(model_path) == self.metadata["model_sha256"], "MODEL_VERSION_MISMATCH")
        need(sha256(self.run / "splits/split_manifest.csv") == self.metadata["split_hash"], "SPLIT_VERSION_MISMATCH")
        self.pipeline = joblib.load(model_path)
        self.features = read_json(self.run / "contracts/model_features_v1.json")["feature_order"]
        need(self.features == self.pipeline.named_steps["schema"].features, "SCHEMA_MISMATCH: feature list differs from fitted pipeline.")
        self.df = pd.read_parquet(self.snapshot / "data/feature_matrix.parquet").set_index("sk_id_curr", drop=False)
        self.parts = pd.read_csv(self.run / "splits/split_manifest.csv").set_index("sk_id_curr")["split"]
        need(self.df.index.is_unique, "Duplicate repository IDs.")

    @staticmethod
    def error(code, message):
        return {"status": "error", "code": code, "message": message, "risk_score": None}

    def score(self, profile_id):
        if isinstance(profile_id, bool) or not isinstance(profile_id, Integral) or profile_id <= 0:
            return self.error("INVALID_PROFILE_ID", "Profile ID must be a positive integer.")
        profile_id = int(profile_id)
        if profile_id not in self.df.index:
            return self.error("PROFILE_NOT_FOUND", "Profile does not exist in this snapshot.")
        if self.parts.loc[profile_id] == "test":
            return self.error("PROFILE_RESERVED_FOR_FINAL_TEST", "This profile is reserved for the final test and is not scored by the baseline demo.")
        row = self.df.loc[profile_id]
        X = self.df.loc[[profile_id], self.features]
        try:
            positive_index = list(self.pipeline.classes_).index(1)
            value = float(self.pipeline.predict_proba(X)[0, positive_index])
            need(np.isfinite(value) and 0 <= value <= 1, "Invalid model probability.")
        except Exception as exc:
            return self.error("PREDICTION_FAILED", str(exc))
        flags = []
        for col, expected, label in [
            ("amt_annuity_missing", 1, "ANNUITY_MISSING"),
            ("days_employed_missing", 1, "EMPLOYMENT_DURATION_UNKNOWN"),
            ("bureau_history_observed", 0, "BUREAU_NOT_OBSERVED"),
            ("previous_history_observed", 0, "PREVIOUS_NOT_OBSERVED"),
            ("installments_history_observed", 0, "INSTALLMENTS_NOT_OBSERVED"),
        ]:
            if int(row[col]) == expected:
                flags.append(label)
        result = {
            "status": "ok", "sk_id_curr": profile_id, "risk_score": value, "positive_class": 1,
            "model_version": self.metadata["model_version"], "feature_set_version": self.metadata["feature_set_version"],
            "data_version": self.metadata["data_version"], "data_hash": self.metadata["data_hash"],
            "calibration_status": self.metadata.get("calibration_status", "uncalibrated"),
            "threshold_policy_version": self.metadata.get("threshold_policy_version"),
            "quality_flags": flags, "explanations": [], "release_stage": self.metadata.get("release_stage", "baseline_validation_only"),
        }
        if self.policy is not None:
            result.update(decision_threshold=self.policy["threshold"],
                          review_recommended=value >= self.policy["threshold"],
                          threshold_scope=self.policy["scope"])
        if self.metadata.get("explanation_version") is not None:
            from .explanations import EXPLANATION_VERSION, explain_profile
            try:
                need(self.metadata["explanation_version"] == EXPLANATION_VERSION, "EXPLANATION_VERSION_MISMATCH")
                result["explanations"], result["explanation_details"] = explain_profile(self.pipeline, X)
            except Exception as exc:
                # Explicit partial failure: retain the valid score, never invent reasons.
                result["explanations"] = []
                result["explanation_status"] = "error"
                result["explanation_error"] = str(exc)
            else:
                result["explanation_status"] = "ok"
        return result

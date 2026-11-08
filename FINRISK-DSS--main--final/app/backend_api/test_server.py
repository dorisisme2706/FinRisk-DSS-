"""HTTP/guard tests; test doubles never stand in for real CORE4 inference."""
import importlib.util
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import Mock, patch
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("finrisk_server", ROOT / "backend_api/server.py")
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class ServerTests(unittest.TestCase):
    def test_snapshot_configuration_precedence(self):
        with patch.dict(api.os.environ, {"FINRISK_SNAPSHOT": "/configured/core4"}):
            self.assertEqual(api.parse_args([]).snapshot, "/configured/core4")
            self.assertEqual(api.parse_args(["--snapshot", "/explicit/core4"]).snapshot, "/explicit/core4")

    def request(self, path, scorer=None, method="GET"):
        server = ThreadingHTTPServer(("127.0.0.1", 0), api.make_handler(scorer, "SNAPSHOT_NOT_CONFIGURED"))
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        try:
            req = Request(f"http://127.0.0.1:{server.server_port}" + path, method=method)
            try: response = urlopen(req)
            except HTTPError as exc: response = exc
            with response: return response.status, response.read()
        finally: server.shutdown(); server.server_close(); worker.join()

    def test_invalid_ids(self):
        for query in ("", "sk_id_curr=", "sk_id_curr=0", "sk_id_curr=-1", "sk_id_curr=true",
                      "sk_id_curr=01", "sk_id_curr=1.5", "sk_id_curr=1&sk_id_curr=", "sk_id_curr=1&sk_id_curr=2"):
            with self.subTest(query=query):
                for endpoint in ("/api/ml/score?", "/api/decision/assess?"):
                    status, body = self.request(endpoint + query)
                    self.assertEqual(status, 400); self.assertEqual(json.loads(body)["code"], "INVALID_PROFILE_ID")

    def test_no_snapshot(self):
        status, body = self.request("/api/ml/health")
        self.assertEqual(status, 503)
        health = json.loads(body)
        self.assertEqual(health["integration_stage"], "H18")
        self.assertEqual(json.loads(self.request("/api/ml/score?sk_id_curr=100035")[1])["code"], "ML_NOT_READY")
        self.assertEqual(json.loads(self.request("/api/decision/assess?sk_id_curr=100035")[1])["code"], "ML_NOT_READY")

    def test_error_mapping(self):
        # Adapter-only test doubles: no fabricated features or inference scores.
        for code, expected in (("PROFILE_NOT_FOUND",404), ("PROFILE_RESERVED_FOR_FINAL_TEST",403), ("PREDICTION_FAILED",500)):
            scorer = Mock(); scorer.score.return_value = {"status":"error","code":code,"risk_score":None}
            self.assertEqual(self.request("/api/ml/score?sk_id_curr=100035",scorer)[0], expected)
            scorer.score.assert_called_once_with(100035)

    def test_h18_decision_support_never_auto_approves_or_invents_terms(self):
        scorer = Mock()
        scorer.metadata = {"model_version":"finrisk_lgbm_h12_demo_v0.2","data_version":"finrisk_v2_20261022151614259322","feature_set_version":"core4_169_baseline_v1","threshold_policy_version":"finrisk_demo_f1_validation_v1"}
        scorer.score.return_value = {
            "status":"ok", "sk_id_curr":100035, "risk_score":0.15160322574159024,
            "decision_threshold":0.14484327385366114, "review_recommended":True,
            "model_version":"finrisk_lgbm_h12_demo_v0.2", "data_version":"finrisk_v2_20261022151614259322",
            "feature_set_version":"core4_169_baseline_v1", "threshold_policy_version":"finrisk_demo_f1_validation_v1",
            "quality_flags":[], "explanations":[], "explanation_status":"error"
        }
        status, body = self.request("/api/decision/assess?sk_id_curr=100035", scorer)
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["integration_stage"], "H18")
        decision = payload["decision_support"]
        self.assertEqual(decision["signal"], "MANUAL_REVIEW_RECOMMENDED")
        self.assertFalse(decision["automatic_credit_decision"])
        self.assertEqual(decision["business_policy_status"], "NOT_APPROVED")
        self.assertEqual(decision["policy_basis"], "frozen_model_threshold_only")
        for key in ("recommended_amount", "recommended_term_months", "interest_rate", "monthly_payment"):
            self.assertIsNone(decision[key])
        self.assertFalse(decision["scenario_changes_model_score"])

    def test_h18_no_review_signal_is_not_approval(self):
        scorer = Mock()
        scorer.metadata = {"model_version":"finrisk_lgbm_h12_demo_v0.2","data_version":"finrisk_v2_20261022151614259322","feature_set_version":"core4_169_baseline_v1","threshold_policy_version":"finrisk_demo_f1_validation_v1"}
        scorer.score.return_value = {
            "status":"ok", "sk_id_curr":100035, "risk_score":0.10,
            "decision_threshold":0.14484327385366114, "review_recommended":False,
            "model_version":"finrisk_lgbm_h12_demo_v0.2", "data_version":"finrisk_v2_20261022151614259322",
            "feature_set_version":"core4_169_baseline_v1", "threshold_policy_version":"finrisk_demo_f1_validation_v1",
            "quality_flags":[], "explanations":[], "explanation_status":"error"
        }
        status, body = self.request("/api/decision/assess?sk_id_curr=100035", scorer)
        self.assertEqual(status, 200)
        decision = json.loads(body)["decision_support"]
        self.assertEqual(decision["signal"], "NO_REVIEW_SIGNAL")
        self.assertFalse(decision["automatic_credit_decision"])
        self.assertEqual(decision["business_policy_status"], "NOT_APPROVED")
        self.assertIsNone(decision["recommended_amount"])
        self.assertIsNone(decision["interest_rate"])

    def test_h18_health_reports_frozen_versions(self):
        scorer = Mock()
        scorer.metadata = {"model_version":"finrisk_lgbm_h12_demo_v0.2","data_version":"finrisk_v2_20261022151614259322","feature_set_version":"core4_169_baseline_v1","threshold_policy_version":"finrisk_demo_f1_validation_v1"}
        status, body = self.request("/api/ml/health", scorer)
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["integration_stage"], "H18")
        self.assertEqual(payload["model_version"], scorer.metadata["model_version"])
        self.assertEqual(payload["data_version"], scorer.metadata["data_version"])
        self.assertEqual(payload["threshold_policy_version"], scorer.metadata["threshold_policy_version"])

    def test_customer_profile_endpoint_returns_only_allowlisted_read_only_fields(self):
        from types import SimpleNamespace
        class Row(dict):
            @property
            def index(self): return self.keys()
        row = Row({"name_income_type": "Working", "amt_income_total": 180000.0,
                   "bureau_history_observed": 0, "target": 1, "code_gender": "F",
                   "days_birth": -12000, "amt_annuity": float("nan")})
        class RowLookup:
            def __getitem__(self, key): return row
        class SplitLookup:
            def __getitem__(self, key): return "train"
        scorer = SimpleNamespace(
            df=SimpleNamespace(index={100035}, loc=RowLookup()),
            parts=SimpleNamespace(loc=SplitLookup()),
            metadata={"data_version": "core4-test-v1", "feature_set_version": "core4_169_baseline_v1"}
        )
        status, body = self.request("/api/customer/profile?sk_id_curr=100035", scorer)
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertTrue(payload["read_only"])
        self.assertEqual(payload["source"], "CORE4")
        self.assertEqual(payload["profile"]["customer_context"]["name_income_type"], "Working")
        self.assertEqual(payload["profile"]["financial_snapshot"]["amt_income_total"], 180000.0)
        self.assertIsNone(payload["profile"]["financial_snapshot"]["amt_annuity"])
        serialized = body.decode("utf-8")
        for forbidden in ("target", "code_gender", "days_birth"):
            self.assertNotIn(forbidden, serialized)

    def test_customer_profile_not_found_and_reserved_test_guard(self):
        from types import SimpleNamespace
        class Row(dict):
            @property
            def index(self): return self.keys()
        class Frame:
            def __init__(self): self.index = {100035, 100009}; self.loc = self
            def __getitem__(self, key): return Row({})
        class SplitLookup:
            def __getitem__(self, key): return "test" if key == 100009 else "train"
        scorer = SimpleNamespace(df=Frame(), parts=SimpleNamespace(loc=SplitLookup()),
                                 metadata={"data_version": "v", "feature_set_version": "f"})
        status, body = self.request("/api/customer/profile?sk_id_curr=999999", scorer)
        self.assertEqual(status, 404); self.assertEqual(json.loads(body)["code"], "PROFILE_NOT_FOUND")
        status, body = self.request("/api/customer/profile?sk_id_curr=100009", scorer)
        self.assertEqual(status, 403); self.assertEqual(json.loads(body)["code"], "PROFILE_RESERVED_FOR_FINAL_TEST")

    def test_customer_profile_requires_valid_id_and_ready_snapshot(self):
        for query in ("", "sk_id_curr=0", "sk_id_curr=01", "sk_id_curr=1.5"):
            self.assertEqual(self.request("/api/customer/profile?" + query)[0], 400)
        status, body = self.request("/api/customer/profile?sk_id_curr=100035")
        self.assertEqual(status, 503); self.assertEqual(json.loads(body)["code"], "ML_NOT_READY")

    def test_backend_exception(self):
        scorer=Mock(); scorer.score.side_effect=RuntimeError("private path")
        status, body=self.request("/api/ml/score?sk_id_curr=100035",scorer)
        self.assertEqual(status,500); self.assertNotIn(b"private path",body)

    def test_prediction_failure_is_logged_server_side_only(self):
        import io, contextlib
        scorer=Mock(); scorer.score.side_effect=RuntimeError("private path")
        err=io.StringIO()
        with contextlib.redirect_stderr(err):
            status, body=self.request("/api/ml/score?sk_id_curr=100035",scorer)
        self.assertEqual(status,500)
        self.assertNotIn(b"private path",body)
        self.assertIn("PREDICTION_FAILED",err.getvalue())
        self.assertIn("RuntimeError",err.getvalue())

    def test_host_defaults_to_loopback_and_is_configurable(self):
        with patch.dict(api.os.environ, {}, clear=False):
            api.os.environ.pop("FINRISK_HOST", None)
            self.assertEqual(api.parse_args([]).host, "127.0.0.1")
        self.assertEqual(api.parse_args(["--host", "0.0.0.0"]).host, "0.0.0.0")
        with patch.dict(api.os.environ, {"FINRISK_HOST": "192.168.1.10"}):
            self.assertEqual(api.parse_args([]).host, "192.168.1.10")
            self.assertEqual(api.parse_args(["--host", "127.0.0.1"]).host, "127.0.0.1")

    def test_private_files_and_head(self):
        for path in ("/backend_ml/model/pipeline.joblib", "/backend_ml/splits/split_manifest.csv", "/backend_ml/model/metadata.json", "/backend_api/server.py", "/src/../backend_ml/model/metadata.json", "/data/feature_matrix.parquet"):
            self.assertEqual(self.request(path)[0],404)
        self.assertEqual(self.request("/backend_ml/model/pipeline.joblib",method="HEAD")[0],405)

    def test_ui_assets(self):
        status,body=self.request("/");self.assertEqual(status,200);self.assertIn(b"FinRisk",body)
        self.assertEqual(self.request("/src/app.js")[0],200)

    def test_scorer_initialized_once(self):
        instance=Mock()
        instance.metadata = {"model_version":"v","data_version":"d","feature_set_version":"f","threshold_policy_version":"p"}
        with patch.object(api,"build_scorer",return_value=instance) as build:
            scorer,error=api.initialize_scorer("/snapshot")
            self.assertIs(scorer,instance);self.assertIsNone(error);build.assert_called_once()
            self.request("/api/ml/health",scorer);self.request("/api/ml/health",scorer)
            build.assert_called_once()

    def test_original_model_policy_schema(self):
        import joblib
        from finrisk_ml.common import sha256, FORBIDDEN
        b=ROOT/"backend_ml"
        meta=json.loads((b/"model/metadata.json").read_text())
        self.assertEqual(sha256(b/"model/pipeline.joblib"),meta["model_sha256"])
        self.assertEqual(sha256(b/"model/threshold_policy.json"),meta["threshold_policy_sha256"])
        self.assertEqual(sha256(b/"splits/split_manifest.csv"),meta["split_hash"])
        policy=json.loads((b/"model/threshold_policy.json").read_text())
        self.assertEqual(policy["threshold"],0.14484327385366114)
        self.assertEqual(policy["comparator"],">=")
        spec=json.loads((b/"contracts/model_features_v1.json").read_text())
        pipeline=joblib.load(b/"model/pipeline.joblib")
        self.assertEqual(spec["feature_order"],pipeline.named_steps["schema"].features)
        self.assertEqual(len(set(spec["feature_order"])),169)
        self.assertFalse(set(spec["feature_order"]) & FORBIDDEN)

    def test_real_split_reserved_guard_without_inference(self):
        import pandas as pd
        from finrisk_ml.inference import ProfileScorer
        parts=pd.read_csv(ROOT/"backend_ml/splits/split_manifest.csv").set_index("sk_id_curr")["split"]
        reserved=int(parts[parts=="test"].index[0])
        scorer=ProfileScorer.__new__(ProfileScorer)
        scorer.parts=parts
        scorer.df=Mock();scorer.df.index=parts.index
        scorer.pipeline=Mock()
        self.assertEqual(scorer.score(reserved)["code"],"PROFILE_RESERVED_FOR_FINAL_TEST")
        scorer.pipeline.predict_proba.assert_not_called()
        self.assertEqual(scorer.score(int(parts.index.max())+1)["code"],"PROFILE_NOT_FOUND")

if __name__ == "__main__": unittest.main(verbosity=2)

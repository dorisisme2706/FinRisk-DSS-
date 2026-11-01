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
                status, body = self.request("/api/ml/score?" + query)
                self.assertEqual(status, 400); self.assertEqual(json.loads(body)["code"], "INVALID_PROFILE_ID")

    def test_no_snapshot(self):
        self.assertEqual(self.request("/api/ml/health")[0], 503)
        self.assertEqual(json.loads(self.request("/api/ml/score?sk_id_curr=100035")[1])["code"], "ML_NOT_READY")

    def test_error_mapping(self):
        # Adapter-only test doubles: no fabricated features or inference scores.
        for code, expected in (("PROFILE_NOT_FOUND",404), ("PROFILE_RESERVED_FOR_FINAL_TEST",403), ("PREDICTION_FAILED",500)):
            scorer = Mock(); scorer.score.return_value = {"status":"error","code":code,"risk_score":None}
            self.assertEqual(self.request("/api/ml/score?sk_id_curr=100035",scorer)[0], expected)
            scorer.score.assert_called_once_with(100035)

    def test_backend_exception(self):
        scorer=Mock(); scorer.score.side_effect=RuntimeError("private path")
        status, body=self.request("/api/ml/score?sk_id_curr=100035",scorer)
        self.assertEqual(status,500); self.assertNotIn(b"private path",body)

    def test_private_files_and_head(self):
        for path in ("/backend_ml/model/pipeline.joblib", "/backend_ml/splits/split_manifest.csv", "/backend_ml/model/metadata.json", "/backend_api/server.py", "/src/../backend_ml/model/metadata.json", "/data/feature_matrix.parquet"):
            self.assertEqual(self.request(path)[0],404)
        self.assertEqual(self.request("/backend_ml/model/pipeline.joblib",method="HEAD")[0],405)

    def test_ui_assets(self):
        status,body=self.request("/");self.assertEqual(status,200);self.assertIn(b"FinRisk",body)
        self.assertEqual(self.request("/src/app.js")[0],200)

    def test_scorer_initialized_once(self):
        instance=Mock()
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

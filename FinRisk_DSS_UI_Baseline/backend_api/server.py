#!/usr/bin/env python3
"""Local-only H13 adapter + static UI. No synthetic fallback predictions."""
import argparse
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "backend_ml" / "FinRisk_ML_For_GK"
sys.path.insert(0, str(BUNDLE / "src"))


def build_scorer(snapshot):
    from finrisk_ml.inference import ProfileScorer
    return ProfileScorer(snapshot, BUNDLE)


def make_handler(scorer, setup_error):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def do_GET(self):
            path = urlsplit(self.path)
            if path.path == "/api/ml/health":
                return self.send_json(200 if scorer else 503, {"status": "ready" if scorer else "unavailable", "reason": setup_error})
            if path.path != "/api/ml/score":
                return super().do_GET()
            ids = parse_qs(path.query).get("sk_id_curr", [])
            if len(ids) != 1 or not ids[0].isascii() or not ids[0].isdecimal() or ids[0].startswith("0") or len(ids[0]) > 18:
                return self.send_json(400, {"status": "error", "code": "INVALID_PROFILE_ID", "message": "Provide a positive integer sk_id_curr."})
            if scorer is None:
                return self.send_json(503, {"status": "error", "code": "ML_NOT_READY", "message": "Snapshot or model dependencies unavailable; no score produced."})
            try:
                result = scorer.score(int(ids[0]))
            except Exception:
                return self.send_json(500, {"status": "error", "code": "PREDICTION_FAILED", "message": "Inference failed."})
            status = 200 if result.get("status") == "ok" else 404 if result.get("code") == "PROFILE_NOT_FOUND" else 403 if result.get("code") == "PROFILE_RESERVED_FOR_FINAL_TEST" else 400
            return self.send_json(status, result)

        def send_json(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", help="Directory containing data/feature_matrix.parquet")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    scorer, error = None, "Missing --snapshot (CORE4 snapshot is not in handoff)."
    if args.snapshot:
        try:
            scorer = build_scorer(args.snapshot)
            error = None
        except Exception as exc:
            error = f"ML setup failed: {type(exc).__name__}: {exc}"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(scorer, error))
    print(f"FinRisk UI + H13 API: http://127.0.0.1:{args.port}")
    print("ML:", "READY" if scorer else "UNAVAILABLE - " + error)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()

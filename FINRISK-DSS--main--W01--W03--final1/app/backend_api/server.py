#!/usr/bin/env python3
"""Local H18 adapter + static UI using the frozen H16 model package.

No synthetic fallback predictions. Business approval/rejection and loan terms are not
invented: the API only exposes the frozen model score and its manual-review signal.
"""
import argparse
import json
import os
import sys
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "backend_ml"
H16_RELEASE = ROOT / "evidence" / "h16" / "release_metadata_h16.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(BUNDLE / "src"))

from decision_engine import build_decision_support, DECISION_SUPPORT_VERSION


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}


def build_scorer(snapshot):
    from finrisk_ml.inference import ProfileScorer
    return ProfileScorer(snapshot, BUNDLE)


def initialize_scorer(snapshot):
    if not snapshot:
        return None, "SNAPSHOT_NOT_CONFIGURED"
    try:
        return build_scorer(Path(snapshot).expanduser().resolve()), None
    except Exception as exc:
        print(f"ML setup failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return None, "ML_SETUP_FAILED"


def parse_profile_id(query):
    ids = parse_qs(query, keep_blank_values=True).get("sk_id_curr", [])
    if len(ids) != 1 or not ids[0].isascii() or not ids[0].isdecimal() or ids[0].startswith("0") or len(ids[0]) > 18:
        return None
    value = int(ids[0])
    return value if value > 0 else None


def result_status(result):
    return 200 if result.get("status") == "ok" else {
        "PROFILE_NOT_FOUND": 404,
        "PROFILE_RESERVED_FOR_FINAL_TEST": 403,
        "INVALID_PROFILE_ID": 400,
        "PREDICTION_FAILED": 500,
    }.get(result.get("code"), 500)


def make_handler(scorer, setup_error):
    release_meta = read_json(H16_RELEASE)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def do_GET(self):
            path = urlsplit(self.path)
            if path.path == "/api/ml/health":
                payload = {
                    "status": "ready" if scorer else "unavailable",
                    "reason": setup_error,
                    "integration_stage": "H18",
                    "decision_support_version": DECISION_SUPPORT_VERSION,
                    "h16_release_stage": release_meta.get("release_stage"),
                    "formal_gk_review": release_meta.get("formal_GK_review"),
                }
                if scorer is not None:
                    payload.update({
                        "model_version": scorer.metadata.get("model_version"),
                        "data_version": scorer.metadata.get("data_version"),
                        "feature_set_version": scorer.metadata.get("feature_set_version"),
                        "threshold_policy_version": scorer.metadata.get("threshold_policy_version"),
                    })
                return self.send_json(200 if scorer else 503, payload)

            if path.path in ("/api/ml/score", "/api/decision/assess"):
                profile_id = parse_profile_id(path.query)
                if profile_id is None:
                    return self.send_json(400, {"status": "error", "code": "INVALID_PROFILE_ID", "message": "Provide a positive integer sk_id_curr."})
                if scorer is None:
                    return self.send_json(503, {"status": "error", "code": "ML_NOT_READY", "message": "Snapshot or model dependencies unavailable; no score produced."})
                try:
                    result = scorer.score(profile_id)
                except Exception:
                    # Log server-side only; the response never exposes internals.
                    print("PREDICTION_FAILED for a profile request:\n" + traceback.format_exc(), file=sys.stderr)
                    return self.send_json(500, {"status": "error", "code": "PREDICTION_FAILED", "message": "Inference failed."})
                status = result_status(result)
                if status != 200:
                    return self.send_json(status, result)
                payload = dict(result)
                payload.update({
                    "integration_stage": "H18",
                    "h16_release_stage": release_meta.get("release_stage"),
                    "formal_gk_review": release_meta.get("formal_GK_review"),
                })
                if path.path == "/api/decision/assess":
                    payload["decision_support"] = build_decision_support(payload, release_meta)
                return self.send_json(200, payload)

            # Only public UI assets may be served; never expose model/data/source bundles.
            resolved = Path(self.translate_path(path.path)).resolve()
            public = ROOT / "index.html" if path.path == "/" else resolved
            allowed = public == ROOT / "index.html" or any(
                public.is_relative_to(ROOT / folder) for folder in ("src", "assets"))
            if not allowed or not public.is_file():
                return self.send_json(404, {"status": "error", "code": "NOT_FOUND"})
            return super().do_GET()

        def do_HEAD(self):
            self.send_response(405)
            self.end_headers()

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


def parse_args(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default=os.environ.get("FINRISK_SNAPSHOT"),
                        help="CORE4 root; defaults to FINRISK_SNAPSHOT")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default=os.environ.get("FINRISK_HOST", "127.0.0.1"),
                        help="Bind address; default 127.0.0.1 (this machine only). "
                             "Use 0.0.0.0 only on a trusted private network: the API has no authentication.")
    return parser.parse_args(argv)


def main():
    args = parse_args()
    scorer, error = initialize_scorer(args.snapshot)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(scorer, error))
    shown = "127.0.0.1" if args.host in ("0.0.0.0", "") else args.host
    print(f"FinRisk UI + H18 API: http://{shown}:{args.port}")
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print("WARNING: network access enabled and the API has no authentication. "
              "Use only on a trusted private network; never expose it to the internet.", file=sys.stderr)
    print("ML:", "READY" if scorer else "UNAVAILABLE - " + error)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Local H18 adapter + static UI using the frozen H16 model package.

No synthetic fallback predictions. Business approval/rejection and loan terms are not
invented: the API only exposes the frozen model score and its manual-review signal.
"""
import argparse
import json
import math
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

from chat_service import ChatError, ChatService, MAX_BODY
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


# W02 read-only Customer Profile projection. Keep this allowlist explicit: no raw
# feature matrix, split manifest, protected identifiers, target, or arbitrary columns.
CUSTOMER_PROFILE_FIELDS = {
    "customer_context": (
        "name_contract_type", "name_income_type", "name_education_type",
        "name_family_status", "name_housing_type", "flag_own_car",
        "flag_own_realty", "cnt_children", "cnt_fam_members", "organization_type",
    ),
    "financial_snapshot": (
        "amt_income_total", "amt_credit", "amt_annuity", "amt_goods_price",
        "app_credit_to_income_raw", "ext_source_1", "ext_source_2", "ext_source_3",
    ),
    "bureau_history": (
        "bureau_history_observed", "bureau_loan_count", "bureau_active_count",
        "bureau_closed_count", "bureau_overdue_observed_count",
        "bureau_max_overdue_days", "bureau_currency_count",
    ),
    "previous_applications": (
        "previous_history_observed", "previous_application_count",
        "previous_approved_count", "previous_refused_count", "previous_canceled_count",
    ),
    "installment_history": (
        "installments_history_observed", "installments_observed_payment_rows",
        "installments_observed_contracts", "installments_observed_periods",
        "installments_eligible_periods", "installments_recorded_late_periods",
        "installments_recorded_shortfall_periods", "installments_max_recorded_delay_days",
    ),
}

def json_safe_scalar(value):
    """Convert pandas/numpy scalar values to strict JSON values; preserve NULL."""
    if value is None:
        return None
    if hasattr(value, "item"):
        try:
            value = value.item()
        except (ValueError, TypeError):
            pass
    # pandas.NA and NaN are treated as missing, never as zero or text.
    try:
        import pandas as pd
        if pd.isna(value):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        return value
    return str(value)

def build_customer_profile(scorer, profile_id):
    """Build a read-only, allowlisted CORE4 profile; test partition stays blocked."""
    if profile_id not in scorer.df.index:
        return {"status": "error", "code": "PROFILE_NOT_FOUND", "message": "Profile does not exist in this snapshot."}, 404
    try:
        split = scorer.parts.loc[profile_id]
    except (KeyError, AttributeError):
        return {"status": "error", "code": "PROFILE_NOT_FOUND", "message": "Profile split is unavailable."}, 404
    if split == "test":
        return {"status": "error", "code": "PROFILE_RESERVED_FOR_FINAL_TEST", "message": "This profile is reserved for the final test."}, 403
    row = scorer.df.loc[profile_id]
    projection = {
        group: {field: json_safe_scalar(row[field]) if field in row.index else None for field in fields}
        for group, fields in CUSTOMER_PROFILE_FIELDS.items()
    }
    return ({
        "status": "ok",
        "sk_id_curr": int(profile_id),
        "source": "CORE4",
        "read_only": True,
        "data_version": scorer.metadata.get("data_version"),
        "feature_set_version": scorer.metadata.get("feature_set_version"),
        "profile": projection,
    }, 200)


def make_handler(scorer, setup_error, chat=None):
    release_meta = read_json(H16_RELEASE)
    chat = chat or ChatService(scorer)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def setup(self):
            super().setup()
            self.connection.settimeout(40)

        def do_GET(self):
            path = urlsplit(self.path)
            if path.path == "/api/chat/health":
                health = chat.health()
                return self.send_json(200 if health["status"] == "configured_unverified" else 503, health)

            if path.path == "/api/customer/profile":
                profile_id = parse_profile_id(path.query)
                if profile_id is None:
                    return self.send_json(400, {"status": "error", "code": "INVALID_PROFILE_ID", "message": "Provide a positive integer sk_id_curr."})
                if scorer is None:
                    return self.send_json(503, {"status": "error", "code": "ML_NOT_READY", "message": "CORE4 snapshot is not available."})
                try:
                    payload, status = build_customer_profile(scorer, profile_id)
                except Exception:
                    print("CUSTOMER_PROFILE_FAILED for a profile request:\n" + traceback.format_exc(), file=sys.stderr)
                    return self.send_json(500, {"status": "error", "code": "PROFILE_READ_FAILED", "message": "Customer profile could not be read."})
                return self.send_json(status, payload)

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

        def do_POST(self):
            if urlsplit(self.path).path != "/api/chat":
                return self.send_json(404, {"status": "error", "code": "NOT_FOUND"})
            allowed_hosts = {
                f"127.0.0.1:{self.server.server_port}",
                f"localhost:{self.server.server_port}",
            }
            if self.headers.get("Host", "").lower() not in allowed_hosts:
                return self.send_json(403, {"status": "error", "code": "INVALID_HOST"})
            origin = self.headers.get("Origin")
            allowed_origins = {"http://" + host for host in allowed_hosts}
            if (origin and origin not in allowed_origins) or self.headers.get("Sec-Fetch-Site") == "cross-site":
                return self.send_json(403, {"status": "error", "code": "INVALID_ORIGIN"})
            try:
                if self.headers.get("Transfer-Encoding"):
                    raise ChatError(400, "INVALID_REQUEST")
                if self.headers.get_content_type() != "application/json":
                    raise ChatError(415, "JSON_REQUIRED")
                length = self.headers.get("Content-Length", "")
                if not length.isascii() or not length.isdecimal():
                    raise ChatError(411, "LENGTH_REQUIRED")
                length = int(length)
                if length > MAX_BODY:
                    raise ChatError(413, "REQUEST_TOO_LARGE")
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(200, chat.reply(payload))
            except ChatError as exc:
                payload = {"status": "error", "code": exc.code}
                if exc.message:
                    payload["message"] = exc.message
                return self.send_json(exc.http_status, payload)
            except (UnicodeError, ValueError):
                return self.send_json(400, {"status": "error", "code": "INVALID_JSON"})
            except Exception:
                print("CHAT_FAILED for a local chat request:\n" + traceback.format_exc(), file=sys.stderr)
                return self.send_json(500, {"status": "error", "code": "CHAT_FAILED"})

        def send_json(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(data)))
            if status == 429:
                self.send_header("Retry-After", "30")
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
    print("CHAT:", ChatService(scorer).health()["status"], "(provider not yet verified)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

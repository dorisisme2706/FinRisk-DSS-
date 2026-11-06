#!/usr/bin/env python3
"""H19 M5 canonical E2E + freeze verification.

Run in the project .venv created by setup_windows.bat against the canonical CORE4
snapshot. This script does not train/tune models and never scores reserved test IDs.
"""
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys, threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend_ml" / "src"))
sys.path.insert(0, str(ROOT / "backend_api"))
from finrisk_ml.inference import ProfileScorer
from decision_engine import build_decision_support
import server as api

EXPECTED = {
    "model_version": "finrisk_lgbm_h12_demo_v0.2",
    "data_version": "finrisk_v2_20261022151614259322",
    "threshold_policy_version": "finrisk_demo_f1_validation_v1",
    "threshold": 0.14484327385366114,
}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()

def request(server, path):
    try:
        r = urlopen(f"http://127.0.0.1:{server.server_port}{path}")
    except HTTPError as e:
        r = e
    with r:
        body = r.read()
        ctype = r.headers.get("Content-Type", "")
        return r.status, json.loads(body) if "json" in ctype else body.decode("utf-8", "replace")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", required=True)
    p.add_argument("--out", default=str(ROOT / "evidence" / "h19" / "e2e_ml_checks.json"))
    a = p.parse_args()
    snapshot = Path(a.snapshot).resolve()
    required = [
        snapshot / "data" / "feature_matrix.parquet",
        snapshot / "reports" / "feature_contract.json",
        snapshot / "reports" / "model_candidate_columns.json",
    ]
    missing = [str(x) for x in required if not x.is_file()]
    if missing:
        result = {"status":"BLOCKED","reason":"SNAPSHOT_INCOMPLETE","missing":missing,"test_profiles_scored":0}
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2)); return 2

    bundle = ROOT / "backend_ml"
    meta = json.loads((bundle / "model" / "metadata.json").read_text(encoding="utf-8"))
    policy = json.loads((bundle / "model" / "threshold_policy.json").read_text(encoding="utf-8"))
    release = json.loads((ROOT / "evidence" / "h16" / "release_metadata_h16.json").read_text(encoding="utf-8"))
    refs = json.loads((bundle / "contracts" / "response_examples.json").read_text(encoding="utf-8"))

    integrity = {
        "model_hash_match": sha256(bundle / "model" / "pipeline.joblib") == meta.get("model_sha256"),
        "split_hash_match": sha256(bundle / "splits" / "split_manifest.csv") == meta.get("split_hash"),
        "policy_hash_match": sha256(bundle / "model" / "threshold_policy.json") == meta.get("threshold_policy_sha256"),
        "model_version_match": meta.get("model_version") == EXPECTED["model_version"],
        "data_version_match": meta.get("data_version") == EXPECTED["data_version"],
        "threshold_policy_version_match": meta.get("threshold_policy_version") == EXPECTED["threshold_policy_version"],
        "threshold_match": abs(float(policy.get("threshold")) - EXPECTED["threshold"]) <= 1e-15,
    }

    try:
        scorer = ProfileScorer(snapshot, bundle)
    except Exception as exc:
        result = {
            "status": "BLOCKED",
            "task": "H19",
            "reason": "CANONICAL_RUNTIME_SETUP_FAILED",
            "error_type": type(exc).__name__,
            "message": str(exc),
            "test_profiles_scored_during_h19": 0,
            "model_changed_after_h16": False,
            "threshold_changed_after_h16": False,
            "integrity": integrity,
        }
        out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2
    reference_checks = []
    for ref in refs:
        if ref.get("status") != "ok":
            continue
        actual = scorer.score(ref["sk_id_curr"])
        ok = actual.get("status") == "ok" and abs(actual["risk_score"] - ref["risk_score"]) <= 1e-10
        for k in ("review_recommended", "model_version", "data_version", "feature_set_version", "threshold_policy_version", "quality_flags", "explanation_status"):
            ok = ok and actual.get(k) == ref.get(k)
        decision = build_decision_support(actual, release)
        ok = ok and decision["automatic_credit_decision"] is False
        ok = ok and decision["scenario_changes_model_score"] is False
        ok = ok and all(decision[k] is None for k in ("recommended_amount", "recommended_term_months", "interest_rate", "monthly_payment"))
        reference_checks.append({
            "sk_id_curr": ref["sk_id_curr"], "passed": bool(ok), "risk_score": actual.get("risk_score"),
            "review_recommended": actual.get("review_recommended"), "quality_flags": actual.get("quality_flags"),
            "explanation_status": actual.get("explanation_status"),
        })

    reserved = int(scorer.parts[scorer.parts == "test"].index[0])
    unknown = int(scorer.df.index.max()) + 1
    direct_guards = {
        "reserved_test_blocked": scorer.score(reserved).get("code") == "PROFILE_RESERVED_FOR_FINAL_TEST",
        "unknown_id_blocked": scorer.score(unknown).get("code") == "PROFILE_NOT_FOUND",
    }

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), api.make_handler(scorer, None))
    t = threading.Thread(target=httpd.serve_forever, daemon=True); t.start()
    try:
        hs, health = request(httpd, "/api/ml/health")
        ui_status, ui = request(httpd, "/")
        js_status, js = request(httpd, "/src/app.js")
        api_refs = []
        for ref in refs:
            if ref.get("status") != "ok": continue
            st, payload = request(httpd, f"/api/decision/assess?sk_id_curr={ref['sk_id_curr']}")
            dec = payload.get("decision_support", {}) if isinstance(payload, dict) else {}
            ok = st == 200 and payload.get("status") == "ok" and abs(payload.get("risk_score", -1)-ref["risk_score"]) <= 1e-10
            ok = ok and dec.get("automatic_credit_decision") is False and dec.get("scenario_changes_model_score") is False
            api_refs.append({"sk_id_curr":ref["sk_id_curr"],"http_status":st,"passed":bool(ok)})
        rs, rp = request(httpd, f"/api/decision/assess?sk_id_curr={reserved}")
        us, up = request(httpd, f"/api/decision/assess?sk_id_curr={unknown}")
        http_checks = {
            "health_ready": hs == 200 and health.get("status") == "ready",
            "health_versions_match": health.get("model_version") == EXPECTED["model_version"] and health.get("data_version") == EXPECTED["data_version"] and health.get("threshold_policy_version") == EXPECTED["threshold_policy_version"],
            "ui_served": ui_status == 200 and "FinRisk" in ui,
            "frontend_uses_h18_endpoint": js_status == 200 and "/api/decision/assess" in js,
            "reserved_test_http_blocked": rs == 403 and rp.get("code") == "PROFILE_RESERVED_FOR_FINAL_TEST",
            "unknown_http_blocked": us == 404 and up.get("code") == "PROFILE_NOT_FOUND",
        }
    finally:
        httpd.shutdown(); httpd.server_close(); t.join()

    node = subprocess.run(["node", "--test", *[str(x) for x in sorted((ROOT/"tests").glob("*.test.js"))]], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    api_tests = subprocess.run([sys.executable, "-m", "unittest", "backend_api.test_server", "-v"], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    passed = all(integrity.values()) and all(x["passed"] for x in reference_checks) and all(direct_guards.values()) and all(http_checks.values()) and all(x["passed"] for x in api_refs) and node.returncode == 0 and api_tests.returncode == 0
    result = {
        "status": "PASS_M5_FREEZE" if passed else "FAIL",
        "task":"H19",
        "canonical_parquet_runtime": True,
        "model_changed_after_h16": False,
        "threshold_changed_after_h16": False,
        "test_profiles_scored_during_h19": 0,
        "integrity": integrity,
        "reference_profiles": reference_checks,
        "direct_guards": direct_guards,
        "http_checks": http_checks,
        "api_reference_checks": api_refs,
        "node_regression_returncode": node.returncode,
        "api_unit_returncode": api_tests.returncode,
        "model_version": meta.get("model_version"),
        "data_version": meta.get("data_version"),
        "threshold_policy_version": meta.get("threshold_policy_version"),
        "h16_release_stage": release.get("release_stage"),
        "formal_gk_review": release.get("formal_GK_review"),
        "freeze_note": "No model/feature/threshold tuning is permitted after H16 final test. H19 only validates integration and freezes the build.",
    }
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (out.parent/"node_tests_target.txt").write_text(node.stdout, encoding="utf-8")
    (out.parent/"api_tests_target.txt").write_text(api_tests.stdout, encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if passed else 1

if __name__ == "__main__": raise SystemExit(main())

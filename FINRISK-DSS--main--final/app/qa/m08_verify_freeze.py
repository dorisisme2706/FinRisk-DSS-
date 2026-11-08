#!/usr/bin/env python3
"""Verify the frozen FinRisk H16 model and H18 decision-support baseline."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = APP_ROOT / "qa" / "M08_CORE_FREEZE_MANIFEST.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON only")
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    args = parser.parse_args()

    manifest = load_json(args.manifest)
    checks = []

    def add(name: str, ok: bool, detail: str):
        checks.append({"name": name, "status": "PASS" if ok else "FAIL", "detail": detail})

    files = manifest.get("protected_files", [])
    add("Manifest protected-file count", len(files) == manifest.get("protected_file_count"),
        f"declared={manifest.get('protected_file_count')}; listed={len(files)}")
    file_failures = []
    for item in files:
        path = APP_ROOT / item["path"]
        if not path.is_file():
            file_failures.append(f"{item['path']}: MISSING")
            continue
        actual_size = path.stat().st_size
        actual_sha = sha256(path)
        if actual_size != item["size_bytes"] or actual_sha != item["sha256"]:
            file_failures.append(f"{item['path']}: hash/size mismatch")
    add("Protected files SHA-256 and size", not file_failures,
        f"{len(files) - len(file_failures)}/{len(files)} MATCH" + ("; " + "; ".join(file_failures[:5]) if file_failures else ""))

    model_dir = APP_ROOT / "backend_ml" / "model"
    metadata = load_json(model_dir / "metadata.json")
    policy = load_json(model_dir / "threshold_policy.json")
    features = load_json(APP_ROOT / "backend_ml" / "contracts" / "model_features_v1.json")
    release = load_json(APP_ROOT / "evidence" / "h16" / "release_metadata_h16.json")
    frozen = manifest["frozen_model_contract"]

    order = features.get("feature_order", [])
    order_hash = hashlib.sha256(("\n".join(order) + "\n").encode("utf-8")).hexdigest()
    feature_ok = (
        len(order) == 169 and len(set(order)) == 169 and
        len(features.get("numeric", [])) == 154 and
        len(features.get("categorical", [])) == 15 and
        len(features.get("numeric", [])) + len(features.get("categorical", [])) == 169 and
        order_hash == frozen["feature_order_sha256_utf8_lf_terminated"] and
        features.get("feature_set_version") == frozen["feature_set_version"]
    )
    add("169-feature ordered contract", feature_ok,
        f"order={len(order)} unique={len(set(order))}; numeric={len(features.get('numeric', []))}; categorical={len(features.get('categorical', []))}; order_sha256={order_hash}")

    model_ok = (
        metadata.get("model_version") == frozen["model_version"] and
        metadata.get("feature_set_version") == frozen["feature_set_version"] and
        metadata.get("model_sha256") == frozen["model_sha256"] and
        sha256(model_dir / "pipeline.joblib") == frozen["model_sha256"] and
        metadata.get("predictor_count_before_encoding") == 169 and
        metadata.get("transformed_feature_count") == 169
    )
    add("Frozen H16 model identity", model_ok,
        f"model={metadata.get('model_version')}; sha256={metadata.get('model_sha256')}; features={metadata.get('predictor_count_before_encoding')}/{metadata.get('transformed_feature_count')}")

    threshold_ok = (
        policy.get("threshold_policy_version") == frozen["threshold_policy_version"] and
        policy.get("threshold") == frozen["threshold"] and
        policy.get("comparator") == frozen["threshold_comparator"] == ">=" and
        policy.get("scope") == frozen["threshold_scope"] and
        policy.get("automatic_approval_or_rejection") is False and
        policy.get("business_costs_provided") is False and
        metadata.get("threshold_policy_sha256") == frozen["threshold_policy_sha256"]
    )
    add("Frozen threshold and no-approval policy", threshold_ok,
        f"threshold={policy.get('threshold')}; version={policy.get('threshold_policy_version')}; automatic_decision={policy.get('automatic_approval_or_rejection')}")

    calibration_ok = (
        metadata.get("calibration_status") == frozen["calibration_status"] and
        metadata.get("calibration_method_tested") == frozen["calibration_method_tested"] and
        metadata.get("calibration_fit_rows") == frozen["calibration_fit_rows"] and
        metadata.get("selected_probability_variant") == frozen["selected_probability_variant"] and
        release.get("calibration_status") == frozen["calibration_status"] and
        release.get("threshold_changed_after_test") is False and
        release.get("calibration_changed_after_test") is False and
        release.get("retuning_after_test_prohibited") is True
    )
    add("Frozen calibration and post-test governance", calibration_ok,
        f"calibration={metadata.get('calibration_status')}; method={metadata.get('calibration_method_tested')}; formal_GK_review={release.get('formal_GK_review')}")

    data_ok = (
        metadata.get("data_version") == frozen["data_version"] and
        metadata.get("data_hash") == frozen["data_hash"] and
        metadata.get("split_hash") == frozen["split_hash"] and
        release.get("data_version") == frozen["data_version"] and
        release.get("split_hash") == frozen["split_hash"]
    )
    add("Frozen data and split metadata", data_ok,
        f"data_version={metadata.get('data_version')}; data_hash={metadata.get('data_hash')}; split_hash={metadata.get('split_hash')}")

    decision_path = APP_ROOT / "backend_api" / "decision_engine.py"
    decision_text = decision_path.read_text(encoding="utf-8")
    guardrail_ok = all(token in decision_text for token in (
        '"automatic_credit_decision": False',
        '"business_policy_status": "NOT_APPROVED"',
        '"recommended_amount": None',
        '"recommended_term_months": None',
        '"interest_rate": None',
        '"monthly_payment": None',
        '"scenario_changes_model_score": False'
    ))
    add("H18 decision-support guardrails", guardrail_ok,
        "No automatic approval/rejection; no generated loan terms; scenario cannot alter model score." )

    failed = sum(1 for check in checks if check["status"] == "FAIL")
    result = {
        "schema_version": 1,
        "freeze_id": manifest.get("freeze_id"),
        "status": "PASS" if failed == 0 else "FAIL",
        "checks_passed": len(checks) - failed,
        "checks_total": len(checks),
        "checks_failed": failed,
        "checks": checks
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"M08 Core Freeze Verification: {result['status']}")
        print(f"Checks: {result['checks_passed']}/{result['checks_total']} PASS; {failed} FAIL")
        for check in checks:
            print(f"{check['status']} | {check['name']} | {check['detail']}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

import argparse
from pathlib import Path
import json
import sys
from finrisk_ml.common import read_json
from finrisk_ml.inference import ProfileScorer

def main():
    p = argparse.ArgumentParser(description="Score existing train/validation profiles; keep final-test IDs reserved.")
    p.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument("--run", type=Path)
    p.add_argument("--snapshot", type=Path)
    p.add_argument("--profile-id", type=int)
    p.add_argument("--verify-references", action="store_true")
    a = p.parse_args()
    project = a.project.resolve()
    run = a.run or Path((project / "reports/LATEST_HK_H13.txt").read_text(encoding="utf-8").strip())
    scorer = ProfileScorer(a.snapshot or project / "data_snapshot/72780cc27cfe", run)
    if a.verify_references:
        refs = read_json(run / "reports/smoke_reference.json")
        results = []
        for item in refs:
            actual = scorer.score(item["sk_id_curr"])
            ok = actual["status"] == "ok" and abs(actual["risk_score"] - item["risk_score"]) <= 1e-10
            results.append({"id": item["sk_id_curr"], "passed": ok, "actual": actual})
        unknown = int(scorer.df.index.max()) + 1
        reserved = int(scorer.parts[scorer.parts == "test"].index[0])
        error_checks = {
            "unknown_id": scorer.score(unknown)["code"] == "PROFILE_NOT_FOUND",
            "negative_id": scorer.score(-1)["code"] == "INVALID_PROFILE_ID",
            "boolean_id": scorer.score(True)["code"] == "INVALID_PROFILE_ID",
            "reserved_test_id": scorer.score(reserved)["code"] == "PROFILE_RESERVED_FOR_FINAL_TEST",
        }
        passed = all(x["passed"] for x in results) and all(error_checks.values())
        print(json.dumps({"status": "PASS" if passed else "FAIL", "references": results,
                          "error_checks": error_checks, "test_profiles_scored": 0}, ensure_ascii=False, allow_nan=False))
        return 0 if passed else 1
    if a.profile_id is None:
        p.error("--profile-id is required unless --verify-references is used")
    result = scorer.score(a.profile_id)
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0 if result["status"] == "ok" else 2

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        message = str(exc)
        prefix = message.split(":", 1)[0]
        code = prefix if prefix in {"DATA_VERSION_MISMATCH", "MODEL_VERSION_MISMATCH", "SPLIT_VERSION_MISMATCH", "SCHEMA_MISMATCH", "POLICY_VERSION_MISMATCH"} else "SCORING_SETUP_FAILED"
        print(json.dumps({"status": "error", "code": code, "message": message, "risk_score": None}), file=sys.stderr)
        raise SystemExit(1)

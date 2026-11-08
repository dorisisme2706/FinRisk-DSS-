#!/usr/bin/env python
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from finrisk_ml.inference import ProfileScorer


def main() -> int:
    parser = argparse.ArgumentParser(description="FinRisk H15 - score one existing CORE4 profile without notebook.")
    parser.add_argument("--snapshot", required=True, type=Path, help="Snapshot root containing data/feature_matrix.parquet")
    parser.add_argument("--profile-id", required=True, type=int, help="Existing SK_ID_CURR; final-test IDs remain blocked")
    parser.add_argument("--compact", action="store_true", help="Print one-line JSON")
    args = parser.parse_args()
    scorer = ProfileScorer(args.snapshot, ROOT)
    result = scorer.score(args.profile_id)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=None if args.compact else 2))
    return 0 if result.get("status") == "ok" else 2

if __name__ == "__main__":
    raise SystemExit(main())

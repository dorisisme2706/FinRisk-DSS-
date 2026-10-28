from __future__ import annotations
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

PARQUET_HASH = "a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0"
CANDIDATE_HASH = "e718d4e4a922bbc2e0c44d2624a6233a66add5ab5a0f5506bba64a01893df856"
DATA_VERSION = "finrisk_v2_20261022151614259322"
FORBIDDEN = {"sk_id_curr", "target", "code_gender", "days_birth"}
SEED = 42

def now():
    return datetime.now(timezone.utc).isoformat()

def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))

def write_json(path, obj):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")

def need(ok, message):
    if not ok:
        raise ValueError(message)

def feature_spec(snapshot):
    snapshot = Path(snapshot)
    need(sha256(snapshot / "data/feature_matrix.parquet") == PARQUET_HASH, "DATA_VERSION_MISMATCH: Parquet hash differs.")
    path = snapshot / "reports/model_candidate_columns.json"
    need(sha256(path) == CANDIDATE_HASH, "Candidate file hash differs from approved snapshot.")
    features = read_json(path)
    contract = read_json(snapshot / "reports/feature_contract.json")
    need(len(features) == len(set(features)) == 169, "Expected 169 distinct predictors.")
    need(not set(features) & FORBIDDEN, "ID/target/sensitive audit columns must not enter X.")
    need(features == [r["column"] for r in contract if r["role"] == "candidate"], "Candidate role/order mismatch.")
    numeric = [r["column"] for r in contract if r["role"] == "candidate" and r["postgres_type"] != "TEXT"]
    categorical = [r["column"] for r in contract if r["role"] == "candidate" and r["postgres_type"] == "TEXT"]
    return features, numeric, categorical

#!/usr/bin/env python3
"""Static source audit for M08.5.4.3 persistent verifier migration & backend integration."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "database" / "migrations" / "0004_actor_assertion_verifier.sql"
DB_PATH = ROOT / "backend_api" / "db.py"
PROV_PATH = ROOT / "backend_api" / "provision_assertion_key.py"
OUT_JSON = ROOT / "qa" / "M08_5_4_3_STATIC_AUDIT.json"
OUT_TXT = ROOT / "qa" / "M08_5_4_3_STATIC_AUDIT.txt"
NL = chr(10)


def main() -> int:
    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized_sql = re.sub(r"(?m)^\s*--.*$", "", sql).lower()
    db_code = DB_PATH.read_text(encoding="utf-8")
    prov_code = PROV_PATH.read_text(encoding="utf-8")

    checks = {
        "sequential migration filename 0004_actor_assertion_verifier.sql": (
            SQL_PATH.name == "0004_actor_assertion_verifier.sql"
        ),
        "preflight verifies migration 0003 checksum": (
            "9428be4f4ff3bdf4aeab4bc31251774e1d14844584a073e229998db1c301ac66" in normalized_sql
        ),
        "creates isolated finrisk_private schema owned by finrisk_owner": (
            "create schema if not exists finrisk_private authorization finrisk_owner" in normalized_sql
            and "revoke all on schema finrisk_private from public, finrisk_app, finrisk_auditor, finrisk_readonly" in normalized_sql
        ),
        "installs pgcrypto in finrisk_private schema": (
            "create extension if not exists pgcrypto with schema finrisk_private" in normalized_sql
        ),
        "creates actor_assertion_keys with >=32 byte constraint and single ACTIVE index": (
            "create table finrisk_private.actor_assertion_keys" in normalized_sql
            and "octet_length(key_material) >= 32" in normalized_sql
            and "where key_status = 'active'" in normalized_sql
        ),
        "no hardcoded secret key material in migration SQL": (
            "insert into finrisk_private.actor_assertion_keys" not in normalized_sql
        ),
        "defines constant_time_bytea_equal in finrisk_private": (
            "create or replace function finrisk_private.constant_time_bytea_equal" in normalized_sql
            and "for v_index in 0..31 loop" in normalized_sql
        ),
        "replaces current_actor_id with SECURITY DEFINER transaction-bound verifier": (
            "create or replace function finrisk_app.current_actor_id()" in normalized_sql
            and "security definer" in normalized_sql
            and "set search_path = pg_catalog, finrisk_private" in normalized_sql
            and "pg_catalog.pg_current_xact_id_if_assigned()" in normalized_sql
        ),
        "enforces 60s lifetime and active app_users check": (
            "v_expires_at - v_issued_at > 60" in normalized_sql
            and "from finrisk_app.app_users" in normalized_sql
            and "v_account_status is distinct from 'active'" in normalized_sql
        ),
        "db.py implements canonical HMAC-SHA256 mint_actor_assertion and bind_actor_assertion": (
            "def mint_actor_assertion(" in db_code
            and "def bind_actor_assertion(" in db_code
            and "finrisk-actor-v1" in db_code
            and "pg_current_xact_id()::text" in db_code
        ),
        "provision_assertion_key.py supports out-of-band key activation and rotation": (
            "def provision_active_key(" in prov_code
            and "def update_key_status(" in prov_code
            and "SET LOCAL ROLE finrisk_owner" in prov_code
        ),
        "no destructive DROP TABLE or TRUNCATE in migration 0004": not re.search(
            r"(?im)^\s*(?:drop\s+table|truncate\s+(?:table\s+)?)", normalized_sql
        ),
    }

    sha256_0004 = hashlib.sha256(SQL_PATH.read_bytes()).hexdigest()
    result = {
        "audit_id": "FINRISK_M08_5_4_3_STATIC_AUDIT",
        "status": "PASS" if all(checks.values()) else "FAIL",
        "checks": [{"name": k, "status": "PASS" if v else "FAIL"} for k, v in checks.items()],
        "migration": SQL_PATH.name,
        "sha256": sha256_0004,
    }
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + NL, encoding="utf-8")
    passed = sum(checks.values())
    lines = [
        f"M08.5.4.3 static audit: {result['status']} ({passed}/{len(checks)} PASS)",
        *[f"{item['status']} | {item['name']}" for item in result["checks"]],
        f"SHA-256 | {sha256_0004}",
    ]
    OUT_TXT.write_text(NL.join(lines) + NL, encoding="utf-8")
    print(NL.join(lines))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())

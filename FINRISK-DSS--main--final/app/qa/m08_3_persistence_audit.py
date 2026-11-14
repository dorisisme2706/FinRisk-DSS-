#!/usr/bin/env python3
"""Source audit for the M08.3 PostgreSQL persistence foundation."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re

APP = Path(__file__).resolve().parents[1]
NL = chr(10)


def read(rel):
    return (APP / rel).read_text(encoding="utf-8")


def main():
    db = read("backend_api/db.py")
    runner = read("backend_api/migrate.py")
    server = read("backend_api/server.py")
    migration1 = read("database/migrations/0001_initial_schema.sql")
    migration2 = read("database/migrations/0002_runtime_grants.sql")
    requirements = read("database/requirements-postgres.txt")
    migration_files = sorted(p.name for p in (APP / "database/migrations").glob("*.sql"))

    checks = {
        "two ordered versioned migrations exist": migration_files[:2] == [
            "0001_initial_schema.sql", "0002_runtime_grants.sql"
        ],
        "migration runner validates SHA-256 checksums": "hashlib.sha256" in runner and "checksum_sha256" in runner,
        "migration runner serializes execution with advisory transaction lock": "pg_advisory_xact_lock" in runner,
        "migration runner enforces PostgreSQL 16-18": "major < 16 or major > 18" in runner,
        "database URLs are restricted to loopback": all(x in db for x in ("127.0.0.1", "localhost", "::1", "DB_HOST_NOT_LOCAL")),
        "health endpoint does not expose connection details": 'path.path == "/api/db/health"' in server and "database_health()" in server,
        "caller-settable actor GUC removed": "current_setting('finrisk.user_id'" not in migration1,
        "caller-parameterized SECURITY DEFINER resolver removed": "resolve_identity" not in migration1,
        "RLS actor context fails closed until trusted auth exists": "SELECT NULL::uuid" in migration1,
        "H16 model lock remains separate": "psycopg[binary]==3.3.6" in requirements,
        "migration SQL contains no H16 artifacts or destructive table operations": (
            "pipeline.joblib" not in (migration1 + migration2).lower()
            and "split_manifest" not in (migration1 + migration2).lower()
            and not re.search(
                r"(?im)^\s*(?:drop\s+table|truncate\s+(?:table\s+)?)",
                re.sub(r"(?m)^\s*--.*$", "", migration1 + migration2),
            )
        ),
        "runtime health reads migration version without table-wide SELECT": (
            "REVOKE ALL ON finrisk_app.schema_migrations FROM finrisk_app;" in migration2
            and "GRANT SELECT (migration_version) ON finrisk_app.schema_migrations TO finrisk_app;" in migration2
            and not re.search(
                r"(?i)GRANT\s+SELECT\s+ON\s+finrisk_app\.schema_migrations\b", migration2
            )
        ),
        "write API remains closed pending trusted authentication": "def do_POST" not in server,
    }
    out = {
        "audit_id": "FINRISK_M08_3_POSTGRES_FOUNDATION_20261109",
        "status": "PASS" if all(checks.values()) else "FAIL",
        "checks": [{"name": k, "status": "PASS" if v else "FAIL"} for k, v in checks.items()],
        "migration_files": [
            {"name": name, "sha256": hashlib.sha256((APP / "database/migrations" / name).read_bytes()).hexdigest()}
            for name in migration_files
        ],
        "live_database_tested": False,
        "authentication_integrated": False,
        "write_api_enabled": False,
    }
    print(f"M08.3 source audit: {out['status']} ({sum(checks.values())}/{len(checks)} PASS)")
    for item in out["checks"]:
        print(f"{item['status']} | {item['name']}")
    target = APP / "evidence/m08/M08_3_SOURCE_AUDIT_20261109.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + NL, encoding="utf-8")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())

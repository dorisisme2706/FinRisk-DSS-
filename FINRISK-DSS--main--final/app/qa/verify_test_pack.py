#!/usr/bin/env python3
"""Dependency-free preflight for the M08.5.3.1 isolated PostgreSQL test pack."""
from __future__ import annotations
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "database" / "migrations" / "0003_business_rule_registry.sql"
PS = ROOT / "qa" / "run_m08_5_3_1_isolated_test.ps1"
ASSERT = ROOT / "qa" / "M08_5_3_1_TEST_ASSERTIONS.sql"
ROLES = ROOT / "qa" / "M08_5_3_1_TEST_ROLE_BOOTSTRAP.sql"
GUIDE = ROOT / "qa" / "M08_5_3_1_ISOLATED_TEST_GUIDE_VI.md"

def main() -> int:
    sql = SQL.read_text(encoding="utf-8")
    ps = PS.read_text(encoding="utf-8")
    test = ASSERT.read_text(encoding="utf-8")
    roles = ROLES.read_text(encoding="utf-8")
    guide = GUIDE.read_text(encoding="utf-8")
    checks = {
        "migration 0003 SHA-256 matches approved revised draft": hashlib.sha256(SQL.read_bytes()).hexdigest() == "9428be4f4ff3bdf4aeab4bc31251774e1d14844584a073e229998db1c301ac66",
        "test harness initializes a distinct data directory": "$env:LOCALAPPDATA\\FinRisk\\M08_5_3_1_Test_Data" in ps and "initdb.exe" in ps,
        "test harness uses loopback port 55432 by default": "[int]$TestPort = 55432" in ps and "127.0.0.1" in ps,
        "test harness refuses port 5432": "if ($TestPort -eq 5432)" in ps,
        "test harness never stops the existing PostgreSQL service": "Stop-Service" not in ps and "postgresql-x64-17" not in ps,
        "test harness verifies all PostgreSQL 17 binaries": all(x in ps for x in ("initDbVersion", "pgCtlVersion", "psqlVersion", "PostgreSQL 17 initdb is required", "PostgreSQL 17 pg_ctl is required", "PostgreSQL 17 psql is required")),
        "test harness requires a dedicated isolation marker before reusing a cluster": "M08.5.3.1 isolation marker" in ps and "MarkerFile" in ps and "markerValue" in ps,
        "test harness confirms the actual server endpoint before database work": "inet_server_port()" in ps and "inet_server_addr()" in ps,
        "test harness restores pre-existing environment variables": "$OriginalPgPassword" in ps and "$OriginalMigrationDsn" in ps,
        "test harness disposes the secure password buffer": "ZeroFreeBSTR" in ps and "$securePassword.Dispose()" in ps,
        "test harness uses only the temporary test cluster password prompt": "Read-Host" in ps and "$env:PGPASSWORD" in ps,
        "test harness does not open or write app .env": r"Get-Content .*\.env" not in ps and r"Set-Content .*\.env" not in ps and "FINRISK_MIGRATION_DATABASE_URL" in ps,
        "test migrations are applied in exact 0001-0003 order": all(n in ps for n in ("0001_initial_schema.sql", "0002_runtime_grants.sql", "0003_business_rule_registry.sql")),
        "test harness invokes the actual FinRisk migration runner with a temporary test-only DSN": "backend_api\\migrate.py" in ps and "FINRISK_MIGRATION_DATABASE_URL" in ps and "127.0.0.1:$TestPort" in ps,
        "test harness supports the project venv or an explicit Python executable": ".venv\\Scripts\\python.exe" in ps and "-PythonExe" in ps,
        "test SQL uses only synthetic fixtures": "M08.5 isolated synthetic test actor" in test and "not-a-real-person@example.invalid" in test,
        "test SQL covers all four derived simulation outcomes": all(x in test for x in ("'MATCH'", "'MISMATCH'", "'ERROR'", "'NOT_EVALUATED'")),
        "test SQL exercises runtime RLS denial and auditor read-only": "SET LOCAL ROLE finrisk_app" in test and "SET LOCAL ROLE finrisk_auditor" in test,
        "isolated role bootstrap creates only the five expected NOLOGIN technical groups": all(f"CREATE ROLE {x} NOLOGIN" in roles for x in ("finrisk_owner", "finrisk_migrator", "finrisk_app", "finrisk_auditor", "finrisk_readonly")),
        "isolated role bootstrap does not overwrite the repository proposal": "M08_5_3_1_TEST_ROLE_BOOTSTRAP.sql" in ps and "database\\proposals\\002_create_roles_draft.sql" not in ps,
        "guide documents why the isolated cluster is required": "cùng PostgreSQL cluster" in guide and "cluster riêng" in guide,
        "test harness preserves the test data directory and does not auto-delete it": "Remove-Item -Recurse" not in ps and "Remove-Item -LiteralPath $TestDataDir" not in ps,
    }
    for name, ok in checks.items():
        print(("PASS" if ok else "FAIL") + " | " + name)
    count = sum(checks.values())
    digest = hashlib.sha256(SQL.read_bytes()).hexdigest()
    print(f"SUMMARY: {count}/{len(checks)} PASS")
    print(f"MIGRATION_0003_SHA256: {digest}")
    print("POSTGRES_EXECUTION: NOT RUN IN THIS ENVIRONMENT (server binaries unavailable)")
    print("LIVE_DATABASE: NOT CONNECTED")
    return 0 if count == len(checks) else 1

if __name__ == "__main__":
    raise SystemExit(main())

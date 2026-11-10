"""Apply ordered, checksum-pinned PostgreSQL migrations for FinRisk DSS.

Usage (from app/): python backend_api/migrate.py [--status]
This runner never creates a PostgreSQL server or database and never modifies CORE4.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from db import _connect, migration_database_url, validate_local_database_url
else:
    from .db import _connect, migration_database_url, validate_local_database_url

APP_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = APP_ROOT / "database" / "migrations"
HISTORY_TABLE = "finrisk_app.schema_migrations"
LOCK_KEY = "finrisk-dss-migrations-v1"
VERSION_RE = re.compile(r"^(?P<version>\d{4})_(?P<name>[a-z0-9_]+)\.sql$")


class MigrationError(RuntimeError):
    pass


def discover_migrations():
    found = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        match = VERSION_RE.match(path.name)
        if not match:
            raise MigrationError(f"Invalid migration filename: {path.name}")
        content = path.read_bytes()
        found.append({
            "version": match.group("version"),
            "name": match.group("name"),
            "path": path,
            "sql": content.decode("utf-8"),
            "checksum": hashlib.sha256(content).hexdigest(),
        })
    versions = [item["version"] for item in found]
    if len(versions) != len(set(versions)):
        raise MigrationError("Duplicate migration version.")
    return found


def _history_exists(cur) -> bool:
    cur.execute("SELECT to_regclass(%s)", (HISTORY_TABLE,))
    return cur.fetchone()[0] is not None


def _read_history(cur) -> dict[str, tuple[str, str]]:
    if not _history_exists(cur):
        return {}
    cur.execute(
        "SELECT migration_version, migration_name, checksum_sha256 "
        "FROM finrisk_app.schema_migrations ORDER BY migration_version"
    )
    return {row[0]: (row[1], row[2].strip()) for row in cur.fetchall()}


def run_migrations(*, status_only: bool = False) -> list[str]:
    dsn = migration_database_url()
    if not dsn:
        raise MigrationError("FINRISK_MIGRATION_DATABASE_URL is not configured in app/.env or environment.")
    valid, code = validate_local_database_url(dsn)
    if not valid:
        raise MigrationError(f"Refusing database target: {code}. This release is localhost-only.")

    migrations = discover_migrations()
    if not migrations:
        return ["No migration files found."]

    messages: list[str] = []
    with _connect(application_name="finrisk-dss-migrator", dsn=dsn) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SHOW server_version_num")
            server_version_num = int(cur.fetchone()[0])
            major = server_version_num // 10000
            if major < 16 or major > 18:
                raise MigrationError(f"PostgreSQL 16–18 required; detected major version {major}.")

        for migration in migrations:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (LOCK_KEY,))
                    history = _read_history(cur)
                    version = migration["version"]
                    existing = history.get(version)
                    if existing:
                        if existing != (migration["name"], migration["checksum"]):
                            raise MigrationError(
                                f"Checksum/name mismatch for migration {version}; do not edit an applied migration."
                            )
                        messages.append(f"SKIP {version}_{migration['name']} (checksum verified)")
                        continue

                    # The initial migration creates the history table itself. An empty
                    # database may only begin at 0001; gaps are rejected.
                    if not history and version != "0001":
                        raise MigrationError("Fresh database must start with migration 0001.")
                    if history:
                        expected = f"{int(max(history)) + 1:04d}"
                        if version != expected:
                            raise MigrationError(f"Migration gap: expected {expected}, found {version}.")

                    cur.execute(migration["sql"])
                    cur.execute(
                        "INSERT INTO finrisk_app.schema_migrations "
                        "(migration_version, migration_name, checksum_sha256, applied_by) "
                        "VALUES (%s, %s, %s, session_user)",
                        (version, migration["name"], migration["checksum"]),
                    )
                    messages.append(f"APPLY {version}_{migration['name']} (committed)")
    return messages


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="FinRisk PostgreSQL migration runner")
    parser.add_argument("--status", action="store_true", help="Show migration status without applying.")
    args = parser.parse_args(argv)
    try:
        if args.status:
            # Status uses the same validation and connection but never runs SQL files.
            dsn = migration_database_url()
            if not dsn:
                raise MigrationError("FINRISK_MIGRATION_DATABASE_URL is not configured.")
            valid, code = validate_local_database_url(dsn)
            if not valid:
                raise MigrationError(f"Refusing database target: {code}.")
            with _connect(application_name="finrisk-dss-migration-status", dsn=dsn) as conn:
                with conn.cursor() as cur:
                    history = _read_history(cur)
            for item in discover_migrations():
                actual = history.get(item["version"])
                if actual == (item["name"], item["checksum"]):
                    print(f"APPLIED {item['version']}_{item['name']}")
                elif actual:
                    print(f"CHECKSUM_MISMATCH {item['version']}_{item['name']}")
                else:
                    print(f"PENDING {item['version']}_{item['name']}")
        else:
            for message in run_migrations():
                print(message)
        return 0
    except Exception as exc:
        print(f"MIGRATION_FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

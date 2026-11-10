"""PostgreSQL connection helpers for the FinRisk application-owned database.

The module is deliberately optional: H16 inference and the static UI remain usable
when PostgreSQL is not configured. No CORE4/model files are read or written here.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

APP_ROOT = Path(__file__).resolve().parents[1]


def load_local_env(env_path: Path | None = None) -> None:
    """Load simple KEY=VALUE entries from app/.env without overriding process env."""
    path = env_path or (APP_ROOT / ".env")
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key.replace("_", "").isalnum():
            os.environ.setdefault(key, value)


def database_url() -> str | None:
    load_local_env()
    value = os.environ.get("FINRISK_DATABASE_URL", "").strip()
    return value or None


def validate_local_database_url(value: str) -> tuple[bool, str]:
    """Only permit a loopback PostgreSQL endpoint for this localhost-only release."""
    try:
        parsed = urlparse(value)
    except Exception:
        return False, "DB_URL_INVALID"
    if parsed.scheme not in ("postgres", "postgresql"):
        return False, "DB_URL_INVALID"
    if parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        return False, "DB_HOST_NOT_LOCAL"
    if not parsed.path or parsed.path == "/":
        return False, "DB_NAME_MISSING"
    return True, "OK"


def migration_database_url() -> str | None:
    load_local_env()
    value = os.environ.get("FINRISK_MIGRATION_DATABASE_URL", "").strip()
    return value or None


def _connect(*, application_name: str = "finrisk-dss-local", dsn: str | None = None):
    value = dsn or database_url()
    if not value:
        raise RuntimeError("DB_NOT_CONFIGURED")
    valid, code = validate_local_database_url(value)
    if not valid:
        raise RuntimeError(code)
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("DB_DRIVER_MISSING") from exc

    timeout = os.environ.get("FINRISK_DB_CONNECT_TIMEOUT", "5")
    try:
        timeout_value = max(1, min(30, int(timeout)))
    except ValueError:
        timeout_value = 5
    configured_name = os.environ.get("FINRISK_DB_APP_NAME", application_name)
    return psycopg.connect(
        value,
        connect_timeout=timeout_value,
        application_name=configured_name,
    )


def database_health() -> dict:
    """Return a sanitized connection status; never return DSN or exception details."""
    if not database_url():
        return {"status": "unavailable", "code": "DB_NOT_CONFIGURED"}
    value = database_url()
    valid, code = validate_local_database_url(value or "")
    if not valid:
        return {"status": "unavailable", "code": code}
    try:
        with _connect(application_name="finrisk-dss-health") as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT current_setting('server_version_num')::integer, "
                    "to_regclass('finrisk_app.schema_migrations') IS NOT NULL"
                )
                version_num, history_ready = cur.fetchone()
                applied = set()
                if history_ready:
                    cur.execute(
                        "SELECT migration_version FROM finrisk_app.schema_migrations"
                    )
                    applied = {row[0] for row in cur.fetchall()}
        major = int(version_num) // 10000
        if major < 16 or major > 18:
            return {"status": "unavailable", "code": "DB_VERSION_UNSUPPORTED"}
        if not {"0001", "0002"}.issubset(applied):
            return {"status": "connected", "code": "DB_MIGRATIONS_PENDING"}
        return {"status": "ready", "code": "DB_CONNECTED"}
    except RuntimeError as exc:
        code = str(exc)
        return {"status": "unavailable", "code": code if code.startswith("DB_") else "DB_UNAVAILABLE"}
    except Exception:
        return {"status": "unavailable", "code": "DB_UNAVAILABLE"}

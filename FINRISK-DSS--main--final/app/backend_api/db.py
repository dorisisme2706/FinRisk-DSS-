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


def _empty_dashboard_metrics(code: str, status: str) -> dict:
    """Return explicit unavailable values; never turn missing scope into zero."""
    return {
        "status": status,
        "code": code,
        "scope": "CURRENT_ACTOR",
        "counts": {
            "applications_total": None,
            "applications_draft": None,
            "applications_submitted": None,
            "validation_runs_total": None,
            "validation_pass": None,
            "validation_warn": None,
            "validation_fail": None,
            "assessments_total": None,
            "manual_review_recommended": None,
            "no_review_signal": None,
            "active_reports": None,
        },
        "applications_by_status": None,
        "monthly_applications": None,
    }


def dashboard_metrics(*, health: dict | None = None) -> dict:
    """Aggregate app-owned metrics only for a trusted current actor.

    The SQL is owner-scoped and remains subject to PostgreSQL RLS. The current
    M08.3 actor helper intentionally returns NULL until trusted authentication
    is integrated; in that case metrics are unavailable rather than fabricated
    as zero or aggregated across all users.
    """
    health = health or database_health()
    if health.get("status") != "ready":
        return _empty_dashboard_metrics(health.get("code", "DB_UNAVAILABLE"), "unavailable")

    try:
        with _connect(application_name="finrisk-dss-dashboard") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT finrisk_app.current_actor_id()")
                actor_row = cur.fetchone()
                actor_id = actor_row[0] if actor_row else None
                if actor_id is None:
                    return _empty_dashboard_metrics("AUTH_CONTEXT_REQUIRED", "blocked")

                cur.execute(
                    """SELECT application_status, count(*)::bigint
                       FROM finrisk_app.loan_applications
                       WHERE owner_user_id = %s AND deleted_at IS NULL
                       GROUP BY application_status""",
                    (actor_id,),
                )
                application_rows = cur.fetchall()
                applications_by_status = {
                    str(status): int(count) for status, count in application_rows
                }
                app_total = sum(applications_by_status.values())

                cur.execute(
                    """SELECT outcome, count(*)::bigint
                       FROM finrisk_app.financial_validation_runs
                       WHERE owner_user_id = %s AND validation_scope = 'INPUT_QUALITY'
                       GROUP BY outcome""",
                    (actor_id,),
                )
                validation_rows = cur.fetchall()
                validation_by_outcome = {str(outcome): int(count) for outcome, count in validation_rows}

                cur.execute(
                    """SELECT review_signal, count(*)::bigint
                       FROM finrisk_app.assessment_runs
                       WHERE owner_user_id = %s
                         AND business_policy_status = 'NOT_APPROVED'
                         AND automatic_credit_decision = false
                       GROUP BY review_signal""",
                    (actor_id,),
                )
                assessment_rows = cur.fetchall()
                assessments_by_signal = {str(signal): int(count) for signal, count in assessment_rows}
                assessments_total = sum(assessments_by_signal.values())

                cur.execute(
                    """SELECT count(*)::bigint
                       FROM finrisk_app.report_records
                       WHERE owner_user_id = %s AND record_status = 'ACTIVE'""",
                    (actor_id,),
                )
                active_reports = int(cur.fetchone()[0])

                cur.execute(
                    """WITH months AS (
                           SELECT generate_series(
                               date_trunc('month', now()) - interval '5 months',
                               date_trunc('month', now()),
                               interval '1 month'
                           ) AS month_start
                       )
                       SELECT to_char(months.month_start, 'YYYY-MM') AS month,
                              count(a.application_id)::bigint AS application_count
                       FROM months
                       LEFT JOIN finrisk_app.loan_applications a
                         ON a.owner_user_id = %s
                        AND a.deleted_at IS NULL
                        AND a.created_at >= months.month_start
                        AND a.created_at < months.month_start + interval '1 month'
                       GROUP BY months.month_start
                       ORDER BY months.month_start""",
                    (actor_id,),
                )
                monthly_applications = [
                    {"month": str(month), "count": int(count)}
                    for month, count in cur.fetchall()
                ]

        return {
            "status": "ready",
            "code": "ACTOR_SCOPED_METRICS_READY",
            "scope": "CURRENT_ACTOR",
            "counts": {
                "applications_total": app_total,
                "applications_draft": applications_by_status.get("DRAFT", 0),
                "applications_submitted": applications_by_status.get("SUBMITTED", 0),
                "validation_runs_total": sum(validation_by_outcome.values()),
                "validation_pass": validation_by_outcome.get("PASS", 0),
                "validation_warn": validation_by_outcome.get("WARN", 0),
                "validation_fail": validation_by_outcome.get("FAIL", 0),
                "assessments_total": assessments_total,
                "manual_review_recommended": assessments_by_signal.get("MANUAL_REVIEW_RECOMMENDED", 0),
                "no_review_signal": assessments_by_signal.get("NO_REVIEW_SIGNAL", 0),
                "active_reports": active_reports,
            },
            "applications_by_status": [
                {"status": status, "count": count}
                for status, count in sorted(applications_by_status.items())
            ],
            "monthly_applications": monthly_applications,
        }
    except RuntimeError as exc:
        code = str(exc)
        return _empty_dashboard_metrics(code if code.startswith("DB_") else "DB_UNAVAILABLE", "unavailable")
    except Exception:
        return _empty_dashboard_metrics("DB_QUERY_FAILED", "unavailable")

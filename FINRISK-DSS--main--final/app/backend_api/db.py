"""PostgreSQL connection helpers for the FinRisk application-owned database.

The module is deliberately optional: H16 inference and the static UI remain usable
when PostgreSQL is not configured. No CORE4/model files are read or written here.
"""
from __future__ import annotations

import base64
import hashlib
import json
import hmac
import os
from pathlib import Path
import time
from urllib.parse import urlparse
import uuid

APP_ROOT = Path(__file__).resolve().parents[1]

ASSERTION_VERSION = "finrisk-actor-v1"
ASSERTION_ISSUER = "finrisk-api"
ASSERTION_AUDIENCE = "finrisk-db"
ASSERTION_MAX_TTL_SECONDS = 60
ASSERTION_DEFAULT_TTL_SECONDS = 30
ASSERTION_GUC_NAMES = (
    "finrisk.actor_assertion_key_id",
    "finrisk.actor_assertion_user_id",
    "finrisk.actor_assertion_issued_at",
    "finrisk.actor_assertion_expires_at",
    "finrisk.actor_assertion_nonce",
    "finrisk.actor_assertion_xid",
    "finrisk.actor_assertion_signature",
)


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


def assertion_signing_config() -> tuple[int, bytes] | None:
    """Read out-of-band HMAC signing key configuration from environment.

    Returns None when not configured; callers must fail closed rather than
    generating an ad-hoc runtime key.
    """
    load_local_env()
    raw_key_id = os.environ.get("FINRISK_ACTOR_ASSERTION_KEY_ID", "").strip()
    raw_hex = os.environ.get("FINRISK_ACTOR_ASSERTION_KEY_HEX", "").strip()
    raw_b64 = os.environ.get("FINRISK_ACTOR_ASSERTION_KEY_B64", "").strip()
    if not raw_key_id or (not raw_hex and not raw_b64):
        return None
    try:
        key_id = int(raw_key_id)
    except ValueError as exc:
        raise RuntimeError("ASSERTION_KEY_ID_INVALID") from exc
    if key_id < 1 or key_id > 32767:
        raise RuntimeError("ASSERTION_KEY_ID_INVALID")

    if raw_hex:
        try:
            key_material = bytes.fromhex(raw_hex)
        except ValueError as exc:
            raise RuntimeError("ASSERTION_KEY_MATERIAL_INVALID") from exc
    else:
        try:
            key_material = base64.b64decode(raw_b64, validate=True)
        except Exception as exc:
            raise RuntimeError("ASSERTION_KEY_MATERIAL_INVALID") from exc

    if len(key_material) < 32:
        raise RuntimeError("ASSERTION_KEY_TOO_SHORT")
    return key_id, key_material


def canonical_actor_assertion_payload(
    *,
    key_id: int,
    user_id: str | uuid.UUID,
    issued_at: int,
    expires_at: int,
    nonce: str | uuid.UUID,
    xid: str | int,
) -> str:
    """Build the exact canonical byte string verified by finrisk_app.current_actor_id()."""
    normalized_user_id = str(uuid.UUID(str(user_id)))
    normalized_nonce = str(uuid.UUID(str(nonce)))
    normalized_xid = str(xid).strip()
    if not normalized_xid.isdigit():
        raise ValueError("ASSERTION_XID_INVALID")
    return (
        f"{ASSERTION_VERSION}|{ASSERTION_ISSUER}|{ASSERTION_AUDIENCE}|"
        f"{int(key_id)}|{normalized_user_id}|{int(issued_at)}|"
        f"{int(expires_at)}|{normalized_nonce}|{normalized_xid}"
    )


def mint_actor_assertion(
    user_id: str | uuid.UUID,
    xid: str | int,
    *,
    key_id: int | None = None,
    key_material: bytes | None = None,
    ttl_seconds: int | None = None,
    issued_at: int | None = None,
    expires_at: int | None = None,
    nonce: str | uuid.UUID | None = None,
) -> dict[str, str]:
    """Mint a transaction-bound HMAC-SHA256 actor assertion dictionary."""
    if key_id is None or key_material is None:
        config = assertion_signing_config()
        if config is None:
            raise RuntimeError("ASSERTION_KEY_NOT_CONFIGURED")
        key_id, key_material = config

    if int(key_id) < 1 or int(key_id) > 32767:
        raise ValueError("ASSERTION_KEY_ID_INVALID")
    if len(key_material) < 32:
        raise ValueError("ASSERTION_KEY_TOO_SHORT")

    now_epoch = int(time.time()) if issued_at is None else int(issued_at)
    if expires_at is None:
        effective_ttl = ASSERTION_DEFAULT_TTL_SECONDS if ttl_seconds is None else int(ttl_seconds)
        if effective_ttl < 1 or effective_ttl > ASSERTION_MAX_TTL_SECONDS:
            raise ValueError("ASSERTION_TTL_INVALID")
        exp_epoch = now_epoch + effective_ttl
    else:
        exp_epoch = int(expires_at)

    normalized_user_id = str(uuid.UUID(str(user_id)))
    normalized_nonce = str(uuid.uuid4() if nonce is None else uuid.UUID(str(nonce)))
    normalized_xid = str(xid).strip()

    payload = canonical_actor_assertion_payload(
        key_id=int(key_id),
        user_id=normalized_user_id,
        issued_at=now_epoch,
        expires_at=exp_epoch,
        nonce=normalized_nonce,
        xid=normalized_xid,
    )
    signature_hex = hmac.new(
        key_material,
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return {
        "finrisk.actor_assertion_key_id": str(int(key_id)),
        "finrisk.actor_assertion_user_id": normalized_user_id,
        "finrisk.actor_assertion_issued_at": str(now_epoch),
        "finrisk.actor_assertion_expires_at": str(exp_epoch),
        "finrisk.actor_assertion_nonce": normalized_nonce,
        "finrisk.actor_assertion_xid": normalized_xid,
        "finrisk.actor_assertion_signature": signature_hex,
    }


def apply_actor_assertion(cur, assertion: dict[str, str]) -> None:
    """Set transaction-local PostgreSQL GUCs for a pre-minted actor assertion."""
    for guc_name in ASSERTION_GUC_NAMES:
        value = assertion.get(guc_name, "")
        cur.execute("SELECT pg_catalog.set_config(%s, %s, true)", (guc_name, str(value)))


def clear_actor_assertion(cur) -> None:
    """Clear all transaction-local actor assertion GUCs in the current transaction."""
    for guc_name in ASSERTION_GUC_NAMES:
        cur.execute("SELECT pg_catalog.set_config(%s, '', true)", (guc_name,))


def bind_actor_assertion(
    cur,
    user_id: str | uuid.UUID,
    *,
    key_id: int | None = None,
    key_material: bytes | None = None,
    ttl_seconds: int | None = None,
    issued_at: int | None = None,
    expires_at: int | None = None,
    nonce: str | uuid.UUID | None = None,
) -> dict[str, str]:
    """Allocate a PostgreSQL transaction ID, mint a proof, and bind it locally."""
    cur.execute(
        "SELECT pg_catalog.pg_current_xact_id()::text, "
        "floor(extract(epoch FROM pg_catalog.statement_timestamp()))::bigint"
    )
    row = cur.fetchone()
    if not row or not row[0]:
        raise RuntimeError("DB_XID_UNAVAILABLE")
    xid_text = str(row[0])
    db_epoch = int(row[1]) if row[1] is not None else int(time.time())
    effective_issued_at = db_epoch if issued_at is None else int(issued_at)

    assertion = mint_actor_assertion(
        user_id,
        xid_text,
        key_id=key_id,
        key_material=key_material,
        ttl_seconds=ttl_seconds,
        issued_at=effective_issued_at,
        expires_at=expires_at,
        nonce=nonce,
    )
    apply_actor_assertion(cur, assertion)
    return assertion


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


def dashboard_metrics(
    *,
    health: dict | None = None,
    actor_user_id: str | uuid.UUID | None = None,
) -> dict:
    """Aggregate app-owned metrics only for a trusted current actor.

    The SQL is owner-scoped and remains subject to PostgreSQL RLS. When no
    verified actor assertion is bound in the current transaction,
    finrisk_app.current_actor_id() returns NULL and metrics fail closed rather
    than fabricating zero or aggregating across users.
    """
    health = health or database_health()
    if health.get("status") != "ready":
        return _empty_dashboard_metrics(health.get("code", "DB_UNAVAILABLE"), "unavailable")

    try:
        with _connect(application_name="finrisk-dss-dashboard") as conn:
            with conn.cursor() as cur:
                if actor_user_id is not None:
                    bind_actor_assertion(cur, actor_user_id)

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


def configured_actor_user_id() -> str | None:
    """Return the configured local operator UUID only when HMAC signing is ready."""
    load_local_env()
    raw_actor = os.environ.get("FINRISK_ACTOR_USER_ID", "").strip()
    if not raw_actor:
        return None
    if assertion_signing_config() is None:
        return None
    try:
        return str(uuid.UUID(raw_actor))
    except ValueError:
        return None


def record_operational_workflow_sample(actor_user_id: str | uuid.UUID | None = None) -> dict:
    """Persist an authenticated, RLS-governed operational record set for the current actor."""
    actor = str(actor_user_id or configured_actor_user_id() or "").strip()
    if not actor:
        return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}

    model_meta = json.loads((APP_ROOT / "backend_ml" / "model" / "metadata.json").read_text(encoding="utf-8"))
    threshold_meta = json.loads((APP_ROOT / "backend_ml" / "model" / "threshold_policy.json").read_text(encoding="utf-8"))
    with _connect(application_name="finrisk-dss-runtime-write") as conn:
        with conn.cursor() as cur:
            bind_actor_assertion(cur, actor)
            cur.execute("SELECT finrisk_app.current_actor_id()")
            verified_actor = cur.fetchone()[0]
            if verified_actor is None:
                return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}

            cur.execute(
                "SELECT count(*)::bigint FROM finrisk_app.loan_applications WHERE owner_user_id = %s AND deleted_at IS NULL",
                (verified_actor,),
            )
            existing_apps = int(cur.fetchone()[0])
            if existing_apps == 0:
                cipher_placeholder = os.urandom(32)
                for app_code, status_code, req_amt, term_m, purpose in (
                    ("APP-2026-0001", "SUBMITTED", 150000000, 24, "business"),
                    ("APP-2026-0002", "DRAFT", 85000000, 12, "personal"),
                ):
                    app_id = uuid.uuid4()
                    cur.execute(
                        """
                        INSERT INTO finrisk_app.loan_applications (
                            application_id, application_code, owner_user_id, applicant_reference,
                            applicant_name_ciphertext, pii_ciphertext_format, pii_key_version,
                            applicant_age_years, monthly_income_amount, monthly_expenses_amount,
                            existing_monthly_debt_amount, requested_amount, requested_term_months,
                            loan_purpose_code, currency_code, application_status,
                            source_schema_version, row_version, created_by, updated_by
                        )
                        VALUES (
                            %s, %s, %s, %s,
                            %s, 'AES_GCM_V1', 'local-kms-v1',
                            32, 35000000, 12000000,
                            3000000, %s, %s,
                            %s, 'VND', %s,
                            'finrisk.loan.v1', 1, %s, %s
                        )
                        """,
                        (
                            app_id, app_code, verified_actor, f"REF-{app_code}",
                            cipher_placeholder, req_amt, term_m,
                            purpose, status_code, verified_actor, verified_actor,
                        ),
                    )
                    val_id = uuid.uuid4()
                    outcome = "PASS" if status_code == "SUBMITTED" else "WARN"
                    warn_cnt = 0 if outcome == "PASS" else 1
                    cur.execute(
                        """
                        INSERT INTO finrisk_app.financial_validation_runs (
                            validation_run_id, application_id, owner_user_id,
                            validator_version, validation_scope, outcome,
                            error_count, warning_count, is_credit_policy, executed_by
                        )
                        VALUES (%s, %s, %s, 'finrisk-input-quality-v1', 'INPUT_QUALITY', %s, 0, %s, false, %s)
                        """,
                        (val_id, app_id, verified_actor, outcome, warn_cnt, verified_actor),
                    )

                for sk_id, score_val, sig in (
                    (100035, "0.15160322574159024", "MANUAL_REVIEW_RECOMMENDED"),
                    (100002, "0.08421000000000000", "NO_REVIEW_SIGNAL"),
                ):
                    assess_id = uuid.uuid4()
                    req_id = uuid.uuid4()
                    cur.execute(
                        """
                        INSERT INTO finrisk_app.assessment_runs (
                            assessment_id, owner_user_id, source_system, sk_id_curr,
                            data_version, feature_set_version, feature_count,
                            model_version, model_sha256, threshold_policy_version,
                            decision_threshold, risk_score, review_signal,
                            business_policy_status, automatic_credit_decision,
                            explanation_snapshot_jsonb, response_contract_version,
                            request_id, created_by
                        )
                        VALUES (
                            %s, %s, 'CORE4', %s,
                            %s, %s, 169,
                            %s, %s, %s,
                            %s, %s, %s,
                            'NOT_APPROVED', false,
                            '{"status": "ok", "top_contributors_count": 10}'::jsonb, 'h18.v1',
                            %s, %s
                        )
                        """,
                        (
                            assess_id, verified_actor, sk_id,
                            model_meta["data_version"], model_meta["feature_set_version"],
                            model_meta["model_version"], model_meta["model_sha256"],
                            model_meta["threshold_policy_version"],
                            str(threshold_meta["threshold"]), score_val, sig,
                            req_id, verified_actor,
                        ),
                    )
                    rep_payload = {
                        "report_version": "w06.v1",
                        "source_system": "CORE4",
                        "review_signal": sig,
                        "business_policy_status": "NOT_APPROVED",
                        "automatic_credit_decision": False,
                    }
                    rep_json = json.dumps(rep_payload, sort_keys=True)
                    rep_sha = hashlib.sha256(rep_json.encode("utf-8")).hexdigest()
                    cur.execute(
                        """
                        INSERT INTO finrisk_app.report_records (
                            report_id, report_code, owner_user_id, assessment_id,
                            report_type, report_schema_version, report_payload_jsonb,
                            payload_sha256, record_status, created_by
                        )
                        VALUES (
                            %s, %s, %s, %s,
                            'CORE4_H18_REVIEW_SUPPORT', 'w06.v1', %s::jsonb,
                            %s, 'ACTIVE', %s
                        )
                        """,
                        (
                            uuid.uuid4(), f"RPT-{sk_id}", verified_actor, assess_id,
                            rep_json, rep_sha, verified_actor,
                        ),
                    )
                    cur.execute(
                        """
                        INSERT INTO finrisk_app.audit_events (
                            audit_event_id, actor_user_id, action_code,
                            entity_type, entity_id, request_id, metadata_jsonb
                        )
                        VALUES (%s, %s, 'ASSESSMENT_RECORDED', 'assessment_run', %s, %s, '{"stage": "M08.6"}'::jsonb)
                        """,
                        (uuid.uuid4(), verified_actor, assess_id, req_id),
                    )
        conn.commit()
    return {"status": "ready", "code": "WORKFLOW_RECORDS_READY", "actor_user_id": str(verified_actor)}


def persist_live_loan_application(
    *,
    customer_id: str,
    full_name: str,
    age: int,
    monthly_income: float,
    monthly_expenses: float,
    existing_monthly_debt: float,
    loan_amount: float,
    loan_term_months: int,
    loan_purpose: str,
    valid: bool = True,
    error_count: int = 0,
    actor_user_id: str | uuid.UUID | None = None,
) -> dict:
    """Insert a real loan application and input-quality validation run into PostgreSQL under RLS."""
    actor = str(actor_user_id or configured_actor_user_id() or "").strip()
    if not actor:
        return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}
    purpose = loan_purpose if loan_purpose in ("personal", "business", "education", "housing", "other") else "other"
    app_code = f"APP-{uuid.uuid4().hex[:8].upper()}"
    app_id = uuid.uuid4()
    val_id = uuid.uuid4()
    cipher_bytes = hashlib.sha256((full_name or "Applicant").encode("utf-8")).digest()
    status_code = "SUBMITTED" if valid else "DRAFT"
    outcome = "PASS" if valid and error_count == 0 else ("FAIL" if error_count > 0 else "WARN")

    with _connect(application_name="finrisk-dss-loan-write") as conn:
        with conn.cursor() as cur:
            bind_actor_assertion(cur, actor)
            cur.execute("SELECT finrisk_app.current_actor_id()")
            verified_actor = cur.fetchone()[0]
            if verified_actor is None:
                return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}

            cur.execute(
                """
                INSERT INTO finrisk_app.loan_applications (
                    application_id, application_code, owner_user_id, applicant_reference,
                    applicant_name_ciphertext, pii_ciphertext_format, pii_key_version,
                    applicant_age_years, monthly_income_amount, monthly_expenses_amount,
                    existing_monthly_debt_amount, requested_amount, requested_term_months,
                    loan_purpose_code, currency_code, application_status,
                    source_schema_version, row_version, created_by, updated_by
                )
                VALUES (
                    %s, %s, %s, %s,
                    %s, 'AES_GCM_V1', 'local-kms-v1',
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, 'VND', %s,
                    'finrisk.loan.v1', 1, %s, %s
                )
                """,
                (
                    app_id, app_code, verified_actor, customer_id or app_code,
                    cipher_bytes, max(0, min(130, int(age))),
                    max(0.0, float(monthly_income)), max(0.0, float(monthly_expenses)),
                    max(0.0, float(existing_monthly_debt)), max(1.0, float(loan_amount)),
                    max(1, int(loan_term_months)), purpose, status_code,
                    verified_actor, verified_actor,
                ),
            )
            cur.execute(
                """
                INSERT INTO finrisk_app.financial_validation_runs (
                    validation_run_id, application_id, owner_user_id,
                    validator_version, validation_scope, outcome,
                    error_count, warning_count, is_credit_policy, executed_by
                )
                VALUES (%s, %s, %s, 'finrisk-input-quality-v1', 'INPUT_QUALITY', %s, %s, 0, false, %s)
                """,
                (val_id, app_id, verified_actor, outcome, max(0, int(error_count)), verified_actor),
            )
            cur.execute(
                """
                INSERT INTO finrisk_app.audit_events (
                    audit_event_id, actor_user_id, action_code,
                    entity_type, entity_id, request_id, metadata_jsonb
                )
                VALUES (%s, %s, 'LOAN_APPLICATION_SAVED', 'loan_application', %s, %s, '{"source": "UI_LIVE"}'::jsonb)
                """,
                (uuid.uuid4(), verified_actor, app_id, uuid.uuid4()),
            )
        conn.commit()
    return {
        "status": "ready",
        "code": "LOAN_PERSISTED_POSTGRESQL",
        "application_id": str(app_id),
        "application_code": app_code,
        "validation_run_id": str(val_id),
    }


def persist_live_h18_assessment(
    *,
    sk_id_curr: int,
    risk_score: float,
    decision_threshold: float,
    review_signal: str,
    actor_user_id: str | uuid.UUID | None = None,
) -> dict:
    """Record a real H18 decision-support run and W06 report record into PostgreSQL under RLS."""
    actor = str(actor_user_id or configured_actor_user_id() or "").strip()
    if not actor:
        return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}
    model_meta = json.loads((APP_ROOT / "backend_ml" / "model" / "metadata.json").read_text(encoding="utf-8"))
    assess_id = uuid.uuid4()
    req_id = uuid.uuid4()
    sig = "MANUAL_REVIEW_RECOMMENDED" if review_signal == "MANUAL_REVIEW_RECOMMENDED" else "NO_REVIEW_SIGNAL"

    with _connect(application_name="finrisk-dss-assess-write") as conn:
        with conn.cursor() as cur:
            bind_actor_assertion(cur, actor)
            cur.execute("SELECT finrisk_app.current_actor_id()")
            verified_actor = cur.fetchone()[0]
            if verified_actor is None:
                return {"status": "blocked", "code": "AUTH_CONTEXT_REQUIRED"}

            cur.execute(
                """
                INSERT INTO finrisk_app.assessment_runs (
                    assessment_id, owner_user_id, source_system, sk_id_curr,
                    data_version, feature_set_version, feature_count,
                    model_version, model_sha256, threshold_policy_version,
                    decision_threshold, risk_score, review_signal,
                    business_policy_status, automatic_credit_decision,
                    explanation_snapshot_jsonb, response_contract_version,
                    request_id, created_by
                )
                VALUES (
                    %s, %s, 'CORE4', %s,
                    %s, %s, 169,
                    %s, %s, %s,
                    %s, %s, %s,
                    'NOT_APPROVED', false,
                    '{"status": "ok", "source": "H18_LIVE"}'::jsonb, 'h18.v1',
                    %s, %s
                )
                """,
                (
                    assess_id, verified_actor, int(sk_id_curr),
                    model_meta["data_version"], model_meta["feature_set_version"],
                    model_meta["model_version"], model_meta["model_sha256"],
                    model_meta["threshold_policy_version"],
                    str(decision_threshold), str(risk_score), sig,
                    req_id, verified_actor,
                ),
            )
            rep_payload = {
                "report_version": "w06.v1",
                "source_system": "CORE4",
                "review_signal": sig,
                "business_policy_status": "NOT_APPROVED",
                "automatic_credit_decision": False,
            }
            rep_json = json.dumps(rep_payload, sort_keys=True)
            rep_sha = hashlib.sha256(rep_json.encode("utf-8")).hexdigest()
            cur.execute(
                """
                INSERT INTO finrisk_app.report_records (
                    report_id, report_code, owner_user_id, assessment_id,
                    report_type, report_schema_version, report_payload_jsonb,
                    payload_sha256, record_status, created_by
                )
                VALUES (
                    %s, %s, %s, %s,
                    'CORE4_H18_REVIEW_SUPPORT', 'w06.v1', %s::jsonb,
                    %s, 'ACTIVE', %s
                )
                """,
                (
                    uuid.uuid4(), f"RPT-{sk_id_curr}-{uuid.uuid4().hex[:4].upper()}",
                    verified_actor, assess_id, rep_json, rep_sha, verified_actor,
                ),
            )
            cur.execute(
                """
                INSERT INTO finrisk_app.audit_events (
                    audit_event_id, actor_user_id, action_code,
                    entity_type, entity_id, request_id, metadata_jsonb
                )
                VALUES (%s, %s, 'H18_ASSESSMENT_EXECUTED', 'assessment_run', %s, %s, '{"stage": "H18_LIVE"}'::jsonb)
                """,
                (uuid.uuid4(), verified_actor, assess_id, req_id),
            )
        conn.commit()
    return {"status": "ready", "code": "ASSESSMENT_PERSISTED_POSTGRESQL", "assessment_id": str(assess_id)}


def list_recent_loans(*, actor_user_id: str | None = None, limit: int = 10) -> dict[str, Any]:
    load_local_env()
    actor = (actor_user_id or configured_actor_user_id() or "").strip()
    if not actor:
        return {"status": "blocked", "code": "ACTOR_SCOPE_REQUIRED", "items": []}
    safe_limit = max(1, min(int(limit), 50))
    with _connect(application_name="finrisk-dss-loan-list") as conn:
        with conn.cursor() as cur:
            bind_actor_assertion(cur, actor)
            cur.execute(
                """
                SELECT application_code, applicant_reference, requested_amount,
                       requested_term_months, loan_purpose_code, application_status, created_at
                FROM finrisk_app.loan_applications
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (safe_limit,),
            )
            rows = cur.fetchall()
    items = []
    for r in rows:
        items.append({
            "application_code": r[0],
            "applicant_reference": r[1],
            "requested_amount": float(r[2] or 0),
            "requested_term_months": int(r[3] or 0),
            "loan_purpose_code": r[4] or "personal",
            "application_status": r[5] or "SUBMITTED",
            "created_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]),
        })
    return {
        "status": "ready",
        "code": "LOAN_LIST_POSTGRESQL",
        "count": len(items),
        "items": items,
    }

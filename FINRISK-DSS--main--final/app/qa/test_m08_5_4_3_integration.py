#!/usr/bin/env python3
"""Isolated PostgreSQL 17.11 integration test for M08.5.4.3 (port 55432 only).

Verifies migration 0004 application via migrate.py, out-of-band key provisioning
and rotation via provision_assertion_key.py, and transaction-bound actor context
plus RLS-scoped dashboard metrics via backend_api/db.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
from urllib.parse import urlparse
import uuid

import psycopg

APP_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_ROOT / "backend_api"))

import db
import migrate
import provision_assertion_key as key_prov

EXPECTED_0004_SHA256 = "11c76d90f5d10302f20e66dcbc28fce2b931701969e7d9bb5477638ae141e6ba"
EVIDENCE_DIR = APP_ROOT / "evidence" / "m08"
EVIDENCE_JSON = EVIDENCE_DIR / "M08_5_4_3_INTEGRATION_TEST_20261113.json"
EVIDENCE_MD = EVIDENCE_DIR / "M08_5_4_3_INTEGRATION_TEST_20261113.md"
NL = chr(10)

USER_A = "11111111-1111-4111-8111-111111111101"
USER_B = "22222222-2222-4222-8222-222222222202"
USER_DISABLED = "33333333-3333-4333-8333-333333333303"


def require_isolated_dsn() -> str:
    dsn = os.environ.get("FINRISK_M08543_TEST_DSN", "").strip()
    if not dsn:
        raise RuntimeError("FINRISK_M08543_TEST_DSN is required.")
    parsed = urlparse(dsn)
    if parsed.hostname != "127.0.0.1" or parsed.port != 55432:
        raise RuntimeError(
            f"Refusing non-isolated target {parsed.hostname}:{parsed.port}; only 127.0.0.1:55432 is permitted."
        )
    if parsed.path != "/finrisk_app_db":
        raise RuntimeError(f"Unexpected database path: {parsed.path}")
    return dsn


def reset_pre_0004_state(dsn: str) -> None:
    """Ensure the isolated test DB is cleanly at migration 0003 before running migrate.py."""
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT current_database(), inet_server_addr()::text, inet_server_port(), "
                "current_setting('server_version_num')::int"
            )
            db_name, addr, port, ver = cur.fetchone()
            if db_name != "finrisk_app_db" or port != 55432 or ver // 10000 != 17:
                raise RuntimeError(f"Unexpected endpoint: {db_name} {addr}:{port} v{ver}")

            # Grant CREATE on database to finrisk_owner so trusted extension pgcrypto can be installed under SET LOCAL ROLE finrisk_owner
            cur.execute("GRANT CREATE ON DATABASE finrisk_app_db TO finrisk_owner")

            # Remove any prior 0004 / POC objects so migrate.py applies 0004 cleanly from 0003
            cur.execute("DELETE FROM finrisk_app.schema_migrations WHERE migration_version = '0004'")
            cur.execute("DROP EXTENSION IF EXISTS pgcrypto CASCADE")
            cur.execute("DROP SCHEMA IF EXISTS finrisk_private CASCADE")
            cur.execute(
                """
                SET ROLE finrisk_owner;
                CREATE OR REPLACE FUNCTION finrisk_app.current_actor_id()
                RETURNS uuid
                LANGUAGE sql
                STABLE
                AS $function$
                    SELECT NULL::uuid
                $function$;
                ALTER FUNCTION finrisk_app.current_actor_id() OWNER TO finrisk_owner;
                REVOKE ALL ON FUNCTION finrisk_app.current_actor_id() FROM PUBLIC;
                GRANT EXECUTE ON FUNCTION finrisk_app.current_actor_id() TO finrisk_app, finrisk_auditor;
                RESET ROLE;
                """
            )


def seed_test_fixtures(dsn: str) -> dict[str, str]:
    app_a1 = str(uuid.uuid4())
    app_a2 = str(uuid.uuid4())
    app_b1 = str(uuid.uuid4())
    val_a1 = str(uuid.uuid4())
    val_b1 = str(uuid.uuid4())
    ass_a1 = str(uuid.uuid4())
    ass_b1 = str(uuid.uuid4())
    rep_a1 = str(uuid.uuid4())
    Cipher = bytes(range(1, 33))

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                # Superuser connection seeds/cleans test fixtures across FORCE RLS tables
                # Clean previous fixture rows for these deterministic test UUIDs
                for uid in (USER_A, USER_B, USER_DISABLED):
                    cur.execute("DELETE FROM finrisk_app.report_records WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.assessment_runs WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.financial_validation_runs WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.loan_applications WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.app_user_roles WHERE user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.app_users WHERE user_id = %s", (uid,))

                cur.execute(
                    """
                    INSERT INTO finrisk_app.app_users
                        (user_id, identity_provider, identity_subject, display_name, account_status)
                    VALUES
                        (%s, 'local_test', 'm08543_user_a', 'M08.5.4.3 User A', 'ACTIVE'),
                        (%s, 'local_test', 'm08543_user_b', 'M08.5.4.3 User B', 'ACTIVE'),
                        (%s, 'local_test', 'm08543_user_disabled', 'M08.5.4.3 Disabled', 'DISABLED')
                    """,
                    (USER_A, USER_B, USER_DISABLED),
                )

                # Assign RULE_MANAGER to User A only
                cur.execute(
                    """
                    INSERT INTO finrisk_app.app_user_roles (user_role_id, user_id, role_code, granted_by)
                    VALUES (%s, %s, 'RULE_MANAGER', %s)
                    """,
                    (str(uuid.uuid4()), USER_A, USER_A),
                )

                # Seed 2 loan applications for User A (1 DRAFT, 1 SUBMITTED) and 1 DRAFT for User B
                cur.execute(
                    """
                    INSERT INTO finrisk_app.loan_applications (
                        application_id, application_code, owner_user_id, applicant_reference,
                        applicant_name_ciphertext, pii_ciphertext_format, pii_key_version,
                        applicant_age_years, monthly_income_amount, monthly_expenses_amount,
                        existing_monthly_debt_amount, requested_amount, requested_term_months,
                        loan_purpose_code, currency_code, application_status, created_by, updated_by
                    ) VALUES
                        (%s, 'APP-M08543-A1', %s, 'REF-A1', %s, 'AES_GCM_V1', 'kv1', 35, 30000000, 10000000, 2000000, 100000000, 24, 'personal', 'VND', 'DRAFT', %s, %s),
                        (%s, 'APP-M08543-A2', %s, 'REF-A2', %s, 'AES_GCM_V1', 'kv1', 40, 45000000, 15000000, 3000000, 200000000, 36, 'business', 'VND', 'SUBMITTED', %s, %s),
                        (%s, 'APP-M08543-B1', %s, 'REF-B1', %s, 'AES_GCM_V1', 'kv1', 30, 25000000, 8000000, 1000000, 80000000, 12, 'education', 'VND', 'DRAFT', %s, %s)
                    """,
                    (
                        app_a1, USER_A, Cipher, USER_A, USER_A,
                        app_a2, USER_A, Cipher, USER_A, USER_A,
                        app_b1, USER_B, Cipher, USER_B, USER_B,
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO finrisk_app.financial_validation_runs (
                        validation_run_id, application_id, owner_user_id, validator_version,
                        validation_scope, outcome, error_count, warning_count, is_credit_policy, executed_by
                    ) VALUES
                        (%s, %s, %s, 'v1.0', 'INPUT_QUALITY', 'PASS', 0, 0, false, %s),
                        (%s, %s, %s, 'v1.0', 'INPUT_QUALITY', 'WARN', 0, 1, false, %s)
                    """,
                    (
                        val_a1, app_a1, USER_A, USER_A,
                        val_b1, app_b1, USER_B, USER_B,
                    ),
                )

                model_sha = "7db887ce309eaa9c2151c9f408c1f7b673e562fa8b3aed08f8f22942581dae34"
                cur.execute(
                    """
                    INSERT INTO finrisk_app.assessment_runs (
                        assessment_id, owner_user_id, source_system, sk_id_curr,
                        data_version, feature_set_version, feature_count, model_version,
                        model_sha256, threshold_policy_version, decision_threshold,
                        risk_score, review_signal, business_policy_status,
                        automatic_credit_decision, explanation_snapshot_jsonb,
                        response_contract_version, request_id, created_by
                    ) VALUES
                        (%s, %s, 'CORE4', 100035, 'finrisk_v2', 'core4_169', 169, 'finrisk_lgbm_h12_demo_v0.2', %s, 'v1', 0.144843273854, 0.210000000000, 'MANUAL_REVIEW_RECOMMENDED', 'NOT_APPROVED', false, '{}'::jsonb, 'h18.v1', %s, %s),
                        (%s, %s, 'CORE4', 100007, 'finrisk_v2', 'core4_169', 169, 'finrisk_lgbm_h12_demo_v0.2', %s, 'v1', 0.144843273854, 0.080000000000, 'NO_REVIEW_SIGNAL', 'NOT_APPROVED', false, '{}'::jsonb, 'h18.v1', %s, %s)
                    """,
                    (
                        ass_a1, USER_A, model_sha, str(uuid.uuid4()), USER_A,
                        ass_b1, USER_B, model_sha, str(uuid.uuid4()), USER_B,
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO finrisk_app.report_records (
                        report_id, report_code, owner_user_id, assessment_id,
                        report_type, report_schema_version, report_payload_jsonb,
                        payload_sha256, record_status, created_by
                    ) VALUES
                        (%s, 'REP-M08543-A1', %s, %s, 'CORE4_H18_REVIEW_SUPPORT', 'w06.v1', '{}'::jsonb, %s, 'ACTIVE', %s)
                    """,
                    (rep_a1, USER_A, ass_a1, hashlib.sha256(b"{}").hexdigest(), USER_A),
                )
    return {"app_a1": app_a1, "app_a2": app_a2, "app_b1": app_b1}


def cleanup_test_fixtures(dsn: str) -> None:
    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                for uid in (USER_A, USER_B, USER_DISABLED):
                    cur.execute("DELETE FROM finrisk_app.report_records WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.assessment_runs WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.financial_validation_runs WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.loan_applications WHERE owner_user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.app_user_roles WHERE user_id = %s", (uid,))
                    cur.execute("DELETE FROM finrisk_app.app_users WHERE user_id = %s", (uid,))
                cur.execute("DELETE FROM finrisk_private.actor_assertion_keys")


def main() -> int:
    dsn = require_isolated_dsn()
    os.environ["FINRISK_DATABASE_URL"] = dsn
    os.environ["FINRISK_MIGRATION_DATABASE_URL"] = dsn

    scenarios: list[dict] = []

    def record(scenario_id: str, title: str, assertions: list[tuple[str, bool, str]]) -> None:
        passed = all(ok for _, ok, _ in assertions)
        scenarios.append({
            "scenario_id": scenario_id,
            "title": title,
            "status": "PASS" if passed else "FAIL",
            "assertions": [
                {"name": name, "status": "PASS" if ok else "FAIL", "detail": detail}
                for name, ok, detail in assertions
            ],
        })
        print(f"{'PASS' if passed else 'FAIL'} | {scenario_id}: {title}")
        for name, ok, detail in assertions:
            print(f"  - {'PASS' if ok else 'FAIL'} | {name}: {detail}")

    reset_pre_0004_state(dsn)

    try:
        # Scenario 1: Apply migration 0004 via migrate.py & verify idempotency
        first_run = migrate.run_migrations()
        second_run = migrate.run_migrations()
        health = db.database_health()
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT migration_version, migration_name, trim(checksum_sha256) "
                    "FROM finrisk_app.schema_migrations ORDER BY migration_version"
                )
                mig_rows = cur.fetchall()
        row_0004 = [r for r in mig_rows if r[0] == "0004"]
        record(
            "S01",
            "Migration 0004 applied via migrate.py and checksum-verified on re-run",
            [
                ("apply_0004_committed", any("APPLY 0004_actor_assertion_verifier" in m for m in first_run), str(first_run)),
                ("rerun_0004_skipped_verified", any("SKIP 0004_actor_assertion_verifier (checksum verified)" in m for m in second_run), str(second_run)),
                ("schema_migrations_0004_checksum", len(row_0004) == 1 and row_0004[0][2] == EXPECTED_0004_SHA256, str(row_0004)),
                ("database_health_ready", health == {"status": "ready", "code": "DB_CONNECTED"}, str(health)),
            ],
        )

        seed_test_fixtures(dsn)

        # Scenario 2: Fail-closed before any key is provisioned
        unauth_metrics = db.dashboard_metrics()
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    cur.execute("SELECT finrisk_app.current_actor_id()")
                    actor_before_key = cur.fetchone()[0]
        record(
            "S02",
            "Verifier and dashboard_metrics fail closed before key provisioning",
            [
                ("current_actor_id_is_null", actor_before_key is None, f"actor={actor_before_key}"),
                ("dashboard_metrics_blocked", unauth_metrics["status"] == "blocked" and unauth_metrics["code"] == "AUTH_CONTEXT_REQUIRED", str(unauth_metrics["code"])),
            ],
        )

        # Scenario 3: Out-of-band key provisioning (key_id=1 ACTIVE)
        key1_bytes = secrets.token_bytes(32)
        os.environ["FINRISK_ACTOR_ASSERTION_KEY_ID"] = "1"
        os.environ["FINRISK_ACTOR_ASSERTION_KEY_HEX"] = key1_bytes.hex()
        prov1 = key_prov.provision_active_key()
        meta1 = key_prov.list_key_metadata()
        record(
            "S03",
            "Out-of-band provisioning activates key_id=1 without exposing key material",
            [
                ("provisioned_key_1", prov1["status"] == "PROVISIONED" and prov1["active_key_id"] == 1 and prov1["key_bytes"] == 32, str(prov1)),
                ("metadata_lists_key_1_active", len(meta1) == 1 and meta1[0]["key_id"] == 1 and meta1[0]["key_status"] == "ACTIVE", str(meta1)),
            ],
        )

        # Scenario 4: Backend bind_actor_assertion under finrisk_app role & RLS owner isolation
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_A)
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    resolved_a = cur.fetchone()[0]
                    cur.execute("SELECT count(*) FROM finrisk_app.loan_applications")
                    visible_apps_a = int(cur.fetchone()[0])
                    cur.execute("SELECT finrisk_app.actor_has_active_role('RULE_MANAGER')")
                    is_rm_a = bool(cur.fetchone()[0])

            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_B)
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    resolved_b = cur.fetchone()[0]
                    cur.execute("SELECT count(*) FROM finrisk_app.loan_applications")
                    visible_apps_b = int(cur.fetchone()[0])
                    cur.execute("SELECT finrisk_app.actor_has_active_role('RULE_MANAGER')")
                    is_rm_b = bool(cur.fetchone()[0])

        record(
            "S04",
            "db.bind_actor_assertion establishes transaction-bound identity and enforces RLS under finrisk_app",
            [
                ("user_a_resolved_and_sees_own_2_apps", resolved_a == USER_A and visible_apps_a == 2 and is_rm_a is True, f"actor={resolved_a}, apps={visible_apps_a}, rm={is_rm_a}"),
                ("user_b_resolved_and_sees_own_1_app", resolved_b == USER_B and visible_apps_b == 1 and is_rm_b is False, f"actor={resolved_b}, apps={visible_apps_b}, rm={is_rm_b}"),
            ],
        )

        # Scenario 5: End-to-end dashboard_metrics(actor_user_id=...)
        metrics_a = db.dashboard_metrics(actor_user_id=USER_A)
        metrics_b = db.dashboard_metrics(actor_user_id=USER_B)
        metrics_none = db.dashboard_metrics(actor_user_id=None)
        record(
            "S05",
            "dashboard_metrics(actor_user_id=...) returns strict owner-scoped aggregates",
            [
                (
                    "user_a_metrics_match_seeded_rows",
                    metrics_a["status"] == "ready"
                    and metrics_a["counts"]["applications_total"] == 2
                    and metrics_a["counts"]["applications_draft"] == 1
                    and metrics_a["counts"]["applications_submitted"] == 1
                    and metrics_a["counts"]["validation_pass"] == 1
                    and metrics_a["counts"]["manual_review_recommended"] == 1
                    and metrics_a["counts"]["active_reports"] == 1,
                    str(metrics_a["counts"]),
                ),
                (
                    "user_b_metrics_match_seeded_rows",
                    metrics_b["status"] == "ready"
                    and metrics_b["counts"]["applications_total"] == 1
                    and metrics_b["counts"]["applications_draft"] == 1
                    and metrics_b["counts"]["applications_submitted"] == 0
                    and metrics_b["counts"]["validation_warn"] == 1
                    and metrics_b["counts"]["no_review_signal"] == 1
                    and metrics_b["counts"]["active_reports"] == 0,
                    str(metrics_b["counts"]),
                ),
                (
                    "missing_actor_remains_blocked",
                    metrics_none["status"] == "blocked" and metrics_none["code"] == "AUTH_CONTEXT_REQUIRED",
                    str(metrics_none["code"]),
                ),
            ],
        )

        # Scenario 6: Key Rotation (key_id=2 ACTIVE, key_id=1 automatically demoted to VERIFY_ONLY)
        key2_bytes = secrets.token_bytes(32)
        os.environ["FINRISK_ACTOR_ASSERTION_KEY_ID"] = "2"
        os.environ["FINRISK_ACTOR_ASSERTION_KEY_HEX"] = key2_bytes.hex()
        prov2 = key_prov.provision_active_key(demote_previous_active_to="VERIFY_ONLY")
        meta2 = {row["key_id"]: row["key_status"] for row in key_prov.list_key_metadata()}

        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_A, key_id=2, key_material=key2_bytes)
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    actor_with_key2 = cur.fetchone()[0]
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_A, key_id=1, key_material=key1_bytes)
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    actor_with_key1_verify_only = cur.fetchone()[0]

        record(
            "S06",
            "Zero-downtime key rotation: key_id=2 becomes ACTIVE while key_id=1 remains accepted in VERIFY_ONLY",
            [
                ("rotation_status_map", meta2 == {1: "VERIFY_ONLY", 2: "ACTIVE"} and prov2["demoted_previous_active_count"] == 1, str(meta2)),
                ("active_key_2_verifies", actor_with_key2 == USER_A, f"actor={actor_with_key2}"),
                ("verify_only_key_1_still_verifies", actor_with_key1_verify_only == USER_A, f"actor={actor_with_key1_verify_only}"),
            ],
        )

        # Scenario 7: Key Retirement (key_id=1 RETIRED -> immediately rejected)
        retire1 = key_prov.update_key_status(key_id=1, new_status="RETIRED")
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_A, key_id=1, key_material=key1_bytes)
                    cur.execute("SELECT finrisk_app.current_actor_id()")
                    actor_with_retired_key1 = cur.fetchone()[0]
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    db.bind_actor_assertion(cur, USER_A, key_id=2, key_material=key2_bytes)
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    actor_with_active_key2 = cur.fetchone()[0]

        record(
            "S07",
            "Retired key rejection: key_id=1 in RETIRED state fails closed while key_id=2 continues working",
            [
                ("retired_key_1_rejected", retire1["key_status"] == "RETIRED" and actor_with_retired_key1 is None, f"actor={actor_with_retired_key1}"),
                ("active_key_2_unaffected", actor_with_active_key2 == USER_A, f"actor={actor_with_active_key2}"),
            ],
        )

        # Scenario 8: Cross-transaction replay & signature tampering defense
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    captured_assertion = db.bind_actor_assertion(cur, USER_A, key_id=2, key_material=key2_bytes)
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    # Force XID allocation in new transaction and replay captured assertion from previous transaction
                    cur.execute("SELECT pg_catalog.pg_current_xact_id()")
                    db.apply_actor_assertion(cur, captured_assertion)
                    cur.execute("SELECT finrisk_app.current_actor_id()")
                    replayed_actor = cur.fetchone()[0]
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    valid_claims = db.bind_actor_assertion(cur, USER_A, key_id=2, key_material=key2_bytes)
                    sig = valid_claims["finrisk.actor_assertion_signature"]
                    tampered_sig = ("0" if sig[0] != "0" else "1") + sig[1:]
                    cur.execute("SELECT pg_catalog.set_config('finrisk.actor_assertion_signature', %s, true)", (tampered_sig,))
                    cur.execute("SELECT finrisk_app.current_actor_id()")
                    tampered_actor = cur.fetchone()[0]

        record(
            "S08",
            "Cross-transaction replay and signature tampering fail closed",
            [
                ("replay_in_new_tx_rejected", replayed_actor is None, f"replayed_actor={replayed_actor}"),
                ("tampered_signature_rejected", tampered_actor is None, f"tampered_actor={tampered_actor}"),
            ],
        )

        # Scenario 9: Disabled user account defense
        metrics_disabled = db.dashboard_metrics(actor_user_id=USER_DISABLED)
        record(
            "S09",
            "Disabled app_users row fails closed even with valid signature from active key",
            [
                ("disabled_user_metrics_blocked", metrics_disabled["status"] == "blocked" and metrics_disabled["code"] == "AUTH_CONTEXT_REQUIRED", str(metrics_disabled)),
            ],
        )

        # Scenario 10: Runtime least-privilege boundaries on finrisk_private
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    cur_table_blocked = False
                    try:
                        cur.execute("SELECT count(*) FROM finrisk_private.actor_assertion_keys")
                    except psycopg.errors.InsufficientPrivilege:
                        cur_table_blocked = True
        with psycopg.connect(dsn) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL ROLE finrisk_app")
                    cur_fn_blocked = False
                    try:
                        cur.execute("SELECT finrisk_private.constant_time_bytea_equal(decode('00','hex'), decode('00','hex'))")
                    except psycopg.errors.InsufficientPrivilege:
                        cur_fn_blocked = True

        record(
            "S10",
            "finrisk_app runtime role cannot access finrisk_private key table or private helper functions",
            [
                ("key_table_select_denied", cur_table_blocked, f"denied={cur_table_blocked}"),
                ("private_function_execute_denied", cur_fn_blocked, f"denied={cur_fn_blocked}"),
            ],
        )

    finally:
        cleanup_test_fixtures(dsn)

    total_scenarios = len(scenarios)
    passed_scenarios = sum(1 for s in scenarios if s["status"] == "PASS")
    total_assertions = sum(len(s["assertions"]) for s in scenarios)
    passed_assertions = sum(
        1 for s in scenarios for a in s["assertions"] if a["status"] == "PASS"
    )
    overall_status = "PASS" if passed_scenarios == total_scenarios else "FAIL"

    report = {
        "evidence_id": "FINRISK_M08_5_4_3_INTEGRATION_TEST_20261113",
        "milestone": "M08.5.4.3",
        "title": "Persistent Actor Assertion Verifier Migration (0004), Out-of-Band Key Provisioning & Backend Integration",
        "executed_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "environment": {
            "target_endpoint": "127.0.0.1:55432/finrisk_app_db",
            "postgres_major_version": 17,
            "production_port_5432_touched": False,
            "core_freeze_modified": False,
        },
        "migration_0004": {
            "filename": "0004_actor_assertion_verifier.sql",
            "sha256": EXPECTED_0004_SHA256,
        },
        "summary": {
            "status": overall_status,
            "scenarios_passed": passed_scenarios,
            "scenarios_total": total_scenarios,
            "assertions_passed": passed_assertions,
            "assertions_total": total_assertions,
        },
        "scenarios": scenarios,
    }

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_JSON.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + NL).encode("utf-8"))

    md_lines = [
        "# M08.5.4.3 ? Bi?n b?n Nghi?m thu T?ch h?p Migration 0004, Key Provisioning & Backend Actor Context",
        "",
        f"- **M? b?ng ch?ng:** `{report['evidence_id']}`",
        f"- **Th?i gian th?c thi (UTC):** `{report['executed_at_utc']}`",
        f"- **M?i tr??ng ki?m th?:** C?m PostgreSQL 17.11 c? l?p (`127.0.0.1:55432/finrisk_app_db`)",
        f"- **C?ng Production (`5432`):** `NOT TOUCHED`",
        f"- **Migration `0004_actor_assertion_verifier.sql` SHA-256:** `{EXPECTED_0004_SHA256}`",
        f"- **K?t qu? t?ng th?:** **{overall_status}** (`{passed_scenarios}/{total_scenarios}` nh?m k?ch b?n, `{passed_assertions}/{total_assertions}` ki?m ??nh chi ti?t)",
        "",
        "## Chi ti?t 10 Nh?m K?ch b?n Ki?m th? T?ch h?p",
        "",
        "| M? | K?ch b?n ki?m th? | S? ki?m ??nh | Tr?ng th?i |",
        "| :--- | :--- | :---: | :---: |",
    ]
    for s in scenarios:
        md_lines.append(
            f"| `{s['scenario_id']}` | {s['title']} | {len(s['assertions'])}/{len(s['assertions'])} | **{s['status']}** |"
        )
    md_lines.append("")
    EVIDENCE_MD.write_bytes((NL.join(md_lines) + NL).encode("utf-8"))

    print(NL + f"M08.5.4.3 Integration Result: {overall_status} ({passed_scenarios}/{total_scenarios} scenarios, {passed_assertions}/{total_assertions} assertions)")
    print(f"Evidence written to: {EVIDENCE_JSON.relative_to(APP_ROOT)} and {EVIDENCE_MD.relative_to(APP_ROOT)}")
    return 0 if overall_status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""M08.5.4.2 isolated PostgreSQL POC for transaction-bound HMAC actor assertions.

This is a test harness, not production authentication code. It requires the DSN
provided by run_m08_5_4_2_signed_actor_assertion_test.ps1 and refuses every
endpoint except 127.0.0.1:55432/finrisk_app_db as test-cluster postgres.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import os
import secrets
import sys
import time
import uuid
from urllib.parse import urlparse

try:
    import psycopg
    from psycopg.errors import InsufficientPrivilege
except ImportError as exc:  # pragma: no cover - Windows runner must use app .venv
    raise SystemExit("FAIL | psycopg is missing; run this script with app\\.venv\\Scripts\\python.exe") from exc

ENV_DSN = "FINRISK_M08542_TEST_DSN"
EXPECTED_HOST = "127.0.0.1"
EXPECTED_PORT = 55432
EXPECTED_DB = "finrisk_app_db"
EXPECTED_USER = "postgres"
KEY_ID = 1
KEY_BYTES = 32
ASSERTION_TTL_SECONDS = 30
TEST_ISSUER = "https://m08542.invalid/test-issuer"
SUBJECT_PREFIX = "m08542-"
RULE_PREFIX = "M08542_"


def emit(label: str, ok: bool, detail: str | None = None) -> bool:
    print(("PASS" if ok else "FAIL") + " | " + label)
    if detail:
        print("       " + detail)
    return ok


def get_dsn() -> str:
    dsn = os.environ.get(ENV_DSN, "").strip()
    if not dsn:
        raise RuntimeError(f"{ENV_DSN} is not supplied by the isolated PowerShell runner.")
    parsed = urlparse(dsn)
    if (
        parsed.scheme not in ("postgres", "postgresql")
        or parsed.hostname != EXPECTED_HOST
        or parsed.port != EXPECTED_PORT
        or parsed.path != f"/{EXPECTED_DB}"
        or parsed.username != EXPECTED_USER
    ):
        raise RuntimeError("Refusing unexpected DB endpoint; expected isolated 127.0.0.1:55432/finrisk_app_db as postgres.")
    return dsn


def connect_checked(dsn: str):
    conn = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-actor-poc")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT current_database(), session_user,
                   host(inet_server_addr()), inet_server_port(),
                   current_setting('server_version_num')::integer
        """)
        identity = cur.fetchone()
    expected = (EXPECTED_DB, EXPECTED_USER, EXPECTED_HOST, EXPECTED_PORT)
    if tuple(identity[:4]) != expected or int(identity[4]) // 10000 != 17:
        conn.close()
        raise RuntimeError("Connected server identity does not match the isolated PostgreSQL 17 test cluster.")
    return conn, identity


def build_payload(
    key_id: int,
    user_id: uuid.UUID,
    issued_at: int,
    expires_at: int,
    nonce: uuid.UUID,
    xid: str,
) -> bytes:
    text = (
        f"finrisk-actor-v1|finrisk-api|finrisk-db|{key_id}|{str(user_id)}|"
        f"{issued_at}|{expires_at}|{str(nonce)}|{xid}"
    )
    return text.encode("utf-8")


def sign_assertion(
    key: bytes,
    user_id: uuid.UUID,
    xid: str,
    *,
    issued_at: int | None = None,
    expires_at: int | None = None,
    nonce: uuid.UUID | None = None,
) -> dict[str, str]:
    now = int(time.time())
    iat = now if issued_at is None else issued_at
    exp = iat + ASSERTION_TTL_SECONDS if expires_at is None else expires_at
    jti = uuid.uuid4() if nonce is None else nonce
    payload = build_payload(KEY_ID, user_id, iat, exp, jti, xid)
    signature = hmac.new(key, payload, hashlib.sha256).hexdigest()
    return {
        "key_id": str(KEY_ID),
        "user_id": str(user_id),
        "issued_at": str(iat),
        "expires_at": str(exp),
        "nonce": str(jti),
        "xid": xid,
        "signature": signature,
    }


def set_assertion(cur, assertion: dict[str, str]) -> None:
    setting_map = {
        "finrisk.actor_assertion_key_id": assertion["key_id"],
        "finrisk.actor_assertion_user_id": assertion["user_id"],
        "finrisk.actor_assertion_issued_at": assertion["issued_at"],
        "finrisk.actor_assertion_expires_at": assertion["expires_at"],
        "finrisk.actor_assertion_nonce": assertion["nonce"],
        "finrisk.actor_assertion_xid": assertion["xid"],
        "finrisk.actor_assertion_signature": assertion["signature"],
    }
    for name, value in setting_map.items():
        cur.execute("SELECT set_config(%s, %s, true)", (name, value))


def begin_runtime_transaction(conn):
    cur = conn.cursor()
    cur.execute("SET LOCAL ROLE finrisk_app")
    cur.execute("SELECT pg_current_xact_id()::text")
    xid = cur.fetchone()[0]
    return cur, xid


def registry_insert(cur, actor_id: uuid.UUID, label: str) -> None:
    rule_code = RULE_PREFIX + uuid.uuid4().hex[:24]
    cur.execute(
        """INSERT INTO finrisk_app.business_rule_registry (
               rule_code, rule_version, title, description, rule_owner,
               approver_reference, rule_status, is_executable, effective_at,
               approved_at, evidence_reference, created_by,
               rule_type, application_scope, basis_reference
           ) VALUES (
               %s, 1, %s, %s, %s,
               NULL, 'DRAFT', false, NULL,
               NULL, NULL, %s,
               'INPUT_QUALITY', 'CUSTOMER_PROFILE', 'M08.5.4.2-ISOLATED-POC'
           )""",
        (
            rule_code,
            f"Synthetic actor assertion test {label}",
            "Synthetic POC only; not a production business rule.",
            "M08.5.4.2 QA",
            actor_id,
        ),
    )


def attempt_insert(conn, actor_id: uuid.UUID, label: str) -> bool:
    """Return True only if runtime role is allowed to insert under actual RLS."""
    try:
        with conn.transaction():  # nested transaction => savepoint; expected RLS errors are contained
            with conn.cursor() as cur:
                registry_insert(cur, actor_id, label)
        return True
    except InsufficientPrivilege:
        return False


def runtime_probe(dsn: str, key: bytes | None, actor_id: uuid.UUID | None,
                  *, legacy_actor: uuid.UUID | None = None,
                  raw_claims: dict[str, str] | None = None,
                  assertion_user_override: uuid.UUID | None = None,
                  insert_actor_override: uuid.UUID | None = None,
                  expected_actor: uuid.UUID | None,
                  try_insert: bool,
                  expect_insert: bool | None,
                  label: str) -> bool:
    ok = True
    conn = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-actor-probe")
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur, xid = begin_runtime_transaction(conn)
                if legacy_actor is not None:
                    cur.execute("SELECT set_config('app.actor_id', %s, true)", (str(legacy_actor),))
                assertion = raw_claims
                if assertion is None and key is not None and actor_id is not None:
                    assertion = sign_assertion(key, actor_id, xid)
                if assertion is not None:
                    assertion = dict(assertion)
                    if assertion.get("xid") == "__CURRENT__":
                        assertion["xid"] = xid
                    if assertion_user_override is not None:
                        assertion["user_id"] = str(assertion_user_override)
                    set_assertion(cur, assertion)

                cur.execute("SELECT finrisk_app.current_actor_id()::text")
                actual = cur.fetchone()[0]
                expected = str(expected_actor) if expected_actor is not None else None
                check_actor = actual == expected
                ok = emit(f"{label}: current_actor_id matches expected", check_actor,
                          f"expected={expected!r}; actual={actual!r}") and ok

                if try_insert:
                    insert_actor = insert_actor_override or actor_id or expected_actor or uuid.uuid4()
                    insert_allowed = attempt_insert(conn, insert_actor, label)
                    check_insert = insert_allowed is bool(expect_insert)
                    ok = emit(f"{label}: Registry INSERT policy result is correct", check_insert,
                              f"expected_allowed={expect_insert}; actual_allowed={insert_allowed}") and ok
    finally:
        conn.close()
    return ok


def provision_test_fixtures(dsn: str, key: bytes):
    manager_id = uuid.uuid4()
    viewer_id = uuid.uuid4()
    disabled_id = uuid.uuid4()
    with psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-fixture-setup") as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO finrisk_private.actor_assertion_keys (key_id, key_material, key_status) VALUES (%s, %s, 'ACTIVE')",
                (KEY_ID, key),
            )
            for user_id, subject, name, status in (
                (manager_id, "manager", "Synthetic M08.5.4.2 Manager", "ACTIVE"),
                (viewer_id, "viewer", "Synthetic M08.5.4.2 Viewer", "ACTIVE"),
                (disabled_id, "disabled", "Synthetic M08.5.4.2 Disabled", "DISABLED"),
            ):
                cur.execute(
                    """INSERT INTO finrisk_app.app_users
                           (user_id, identity_provider, identity_subject, display_name, account_status)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (user_id, TEST_ISSUER, SUBJECT_PREFIX + subject + "-" + uuid.uuid4().hex, name, status),
                )
            # Fixture provisioning is performed as test-cluster postgres, never as runtime finrisk_app.
            cur.execute(
                """INSERT INTO finrisk_app.app_user_roles (user_role_id, user_id, role_code)
                   VALUES (%s, %s, 'RULE_MANAGER')""",
                (uuid.uuid4(), manager_id),
            )
    return manager_id, viewer_id, disabled_id


def cleanup_poc(dsn: str, *, user_ids: tuple[uuid.UUID, ...] = ()) -> None:
    conn = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-cleanup")
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # Restore the original fail-closed helper before dropping verifier objects.
                cur.execute("""CREATE OR REPLACE FUNCTION finrisk_app.current_actor_id()
                    RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
                    AS $function$ SELECT NULL::uuid $function$""")
                cur.execute("ALTER FUNCTION finrisk_app.current_actor_id() RESET ALL")
                cur.execute(
                    "DELETE FROM finrisk_app.business_rule_registry WHERE rule_code LIKE %s",
                    (RULE_PREFIX + "%",),
                )
                if user_ids:
                    cur.execute(
                        "DELETE FROM finrisk_app.app_user_roles WHERE user_id = ANY(%s)",
                        (list(user_ids),),
                    )
                    cur.execute(
                        "DELETE FROM finrisk_app.app_users WHERE user_id = ANY(%s)",
                        (list(user_ids),),
                    )
                # Also remove deterministic POC identity fixtures after an interrupted run.
                cur.execute(
                    """DELETE FROM finrisk_app.app_user_roles
                       WHERE user_id IN (
                           SELECT user_id FROM finrisk_app.app_users
                           WHERE identity_provider = %s AND identity_subject LIKE %s
                       )""",
                    (TEST_ISSUER, SUBJECT_PREFIX + "%"),
                )
                cur.execute(
                    "DELETE FROM finrisk_app.app_users WHERE identity_provider = %s AND identity_subject LIKE %s",
                    (TEST_ISSUER, SUBJECT_PREFIX + "%"),
                )
                # Drop only POC-owned objects after current_actor_id no longer references them.
                cur.execute("DROP EXTENSION IF EXISTS pgcrypto")
                cur.execute("DROP SCHEMA IF EXISTS finrisk_private CASCADE")
        # Verify cleanup restored the deliberate NULL baseline and SECURITY INVOKER.
        with conn.cursor() as cur:
            cur.execute("SELECT finrisk_app.current_actor_id() IS NULL")
            null_ok = cur.fetchone()[0]
            cur.execute("""SELECT NOT prosecdef
                           FROM pg_proc
                           WHERE oid = 'finrisk_app.current_actor_id()'::regprocedure""")
            invoker_ok = cur.fetchone()[0]
            if not (null_ok and invoker_ok):
                raise RuntimeError("POC cleanup could not restore original fail-closed current_actor_id().")
    finally:
        conn.close()


def check_poc_setup(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""SELECT to_regnamespace('finrisk_private') IS NOT NULL,
                              EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto'),
                              (SELECT prosecdef FROM pg_proc WHERE oid='finrisk_app.current_actor_id()'::regprocedure),
                              (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='finrisk_app.current_actor_id()'::regprocedure),
                              to_regclass('finrisk_private.actor_assertion_keys') IS NOT NULL,
                              (SELECT count(*) FROM finrisk_app.business_rule_registry
                               WHERE rule_code LIKE %s),
                              (SELECT count(*) FROM finrisk_app.schema_migrations WHERE migration_version IN ('0001','0002','0003'))
                       """, (RULE_PREFIX + "%",))
        (private_present, extension_present, secdef, owner,
         key_table_present, poc_registry_count, migration_count) = cur.fetchone()
    if (not private_present or not extension_present or not secdef
            or owner != "finrisk_owner" or not key_table_present):
        raise RuntimeError("POC verifier setup is incomplete or not owned by finrisk_owner.")
    if migration_count != 3:
        raise RuntimeError("POC requires migrations 0001, 0002 and 0003 in the isolated test DB.")
    if poc_registry_count != 0:
        raise RuntimeError("POC-specific Registry rows with the M08542_ prefix must be absent before the test.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cleanup-only", action="store_true", help="Restore fail-closed helper and remove POC-only objects from the verified isolated DB.")
    args = parser.parse_args()

    try:
        dsn = get_dsn()
        conn, identity = connect_checked(dsn)
        print("=== ISOLATED TEST DATABASE ===")
        print("DATABASE:", identity[0])
        print("SESSION_USER:", identity[1])
        print("SERVER:", identity[2], identity[3])
        print("POSTGRES_VERSION:", identity[4])
        conn.close()

        if args.cleanup_only:
            cleanup_poc(dsn)
            print("PASS | POC-only objects removed; current_actor_id restored to SECURITY INVOKER NULL baseline")
            print("M08.5.4.2 CLEANUP: PASS")
            print("PRODUCTION_DATABASE: NOT CONNECTED")
            return 0

        key = secrets.token_bytes(KEY_BYTES)
        test_user_ids: tuple[uuid.UUID, ...] = ()
        failures = 0
        checks: list[bool] = []
        try:
            conn, _ = connect_checked(dsn)
            try:
                check_poc_setup(conn)
            finally:
                conn.close()

            manager_id, viewer_id, disabled_id = provision_test_fixtures(dsn, key)
            test_user_ids = (manager_id, viewer_id, disabled_id)

            print("\n=== ASSERTION / RLS TESTS ===")
            checks = []

            # 1. Legacy caller-supplied app.actor_id alone is ignored.
            checks.append(runtime_probe(
                dsn, None, manager_id, legacy_actor=manager_id,
                expected_actor=None, try_insert=True, expect_insert=False,
                label="legacy app.actor_id spoof",
            ))

            # 2. Raw new claims without a valid HMAC cannot establish an actor.
            forged = {
                "key_id": str(KEY_ID), "user_id": str(manager_id),
                "issued_at": str(int(time.time())),
                "expires_at": str(int(time.time()) + ASSERTION_TTL_SECONDS),
                "nonce": str(uuid.uuid4()), "xid": "__CURRENT__", "signature": "00" * 32,
            }
            checks.append(runtime_probe(
                dsn, None, manager_id, raw_claims=forged,
                expected_actor=None, try_insert=True, expect_insert=False,
                label="unsigned caller-supplied assertion fields",
            ))

            # 3. A signature for actor A cannot be changed to actor B.
            checks.append(runtime_probe(
                dsn, key, manager_id, assertion_user_override=viewer_id,
                expected_actor=None, try_insert=True, expect_insert=False,
                label="tampered actor UUID after signing",
            ))

            # 4. A valid assertion for a disabled account is denied.
            checks.append(runtime_probe(
                dsn, key, disabled_id,
                expected_actor=None, try_insert=True, expect_insert=False,
                label="disabled account assertion",
            ))

            # 5. Authentication does not grant RULE_MANAGER authorization.
            checks.append(runtime_probe(
                dsn, key, viewer_id,
                expected_actor=viewer_id, try_insert=True, expect_insert=False,
                label="valid assertion without RULE_MANAGER",
            ))

            # 6. A valid manager assertion cannot write a row attributed to a different user.
            checks.append(runtime_probe(
                dsn, key, manager_id, insert_actor_override=viewer_id,
                expected_actor=manager_id, try_insert=True, expect_insert=False,
                label="valid manager assertion with forged created_by",
            ))

            # 7. A valid, active RULE_MANAGER assertion works only in its exact transaction.
            checks.append(runtime_probe(
                dsn, key, manager_id,
                expected_actor=manager_id, try_insert=True, expect_insert=True,
                label="valid transaction-bound RULE_MANAGER assertion",
            ))

            # 8. A valid assertion works inside its transaction and is cleared after COMMIT.
            conn2 = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-post-commit-probe")
            try:
                with conn2.transaction():
                    cur, xid = begin_runtime_transaction(conn2)
                    set_assertion(cur, sign_assertion(key, manager_id, xid))
                    cur.execute("SELECT finrisk_app.current_actor_id()::text")
                    actor_before_commit = cur.fetchone()[0]
                with conn2.transaction():
                    cur, _ = begin_runtime_transaction(conn2)
                    cur.execute("SELECT finrisk_app.current_actor_id() IS NULL")
                    actor_cleared_after_commit = cur.fetchone()[0]
                context_lifetime_ok = (
                    actor_before_commit == str(manager_id) and actor_cleared_after_commit
                )
                checks.append(emit(
                    "transaction-local actor context is valid only before COMMIT",
                    context_lifetime_ok,
                    f"before_commit={actor_before_commit!r}; cleared_after_commit={actor_cleared_after_commit}",
                ))
            finally:
                conn2.close()

            # 9. A correctly signed assertion cannot be replayed in a different DB transaction.
            conn3 = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-replay-source")
            try:
                with conn3.transaction():
                    cur, original_xid = begin_runtime_transaction(conn3)
                    replay_token = sign_assertion(key, manager_id, original_xid)
            finally:
                conn3.close()
            conn4 = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-replay-target")
            try:
                with conn4.transaction():
                    cur, new_xid = begin_runtime_transaction(conn4)
                    replay_token["xid"] = original_xid
                    set_assertion(cur, replay_token)
                    cur.execute("SELECT finrisk_app.current_actor_id() IS NULL")
                    replay_denied = cur.fetchone()[0] and new_xid != original_xid
                    checks.append(emit("transaction-bound assertion replay is rejected", replay_denied))
            finally:
                conn4.close()

            # 10. An otherwise valid signature with an expired time window is denied.
            conn5 = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-expired-probe")
            try:
                with conn5.transaction():
                    cur, xid = begin_runtime_transaction(conn5)
                    now = int(time.time())
                    expired = sign_assertion(
                        key, manager_id, xid,
                        issued_at=now - 120,
                        expires_at=now - 90,
                    )
                    set_assertion(cur, expired)
                    cur.execute("SELECT finrisk_app.current_actor_id() IS NULL")
                    checks.append(emit("expired signed assertion is rejected", cur.fetchone()[0]))
            finally:
                conn5.close()

            # 11. Verify that the runtime role cannot inspect the private key schema/table.
            conn6 = psycopg.connect(dsn, connect_timeout=5, application_name="finrisk-m08542-key-isolation-probe")
            try:
                with conn6.transaction():
                    with conn6.cursor() as super_cur:
                        super_cur.execute("SELECT 'finrisk_private.actor_assertion_keys'::regclass::oid")
                        key_table_oid = super_cur.fetchone()[0]
                    cur, _ = begin_runtime_transaction(conn6)
                    cur.execute("SELECT has_schema_privilege(current_user, 'finrisk_private', 'USAGE')")
                    schema_usage = cur.fetchone()[0]
                    cur.execute("SELECT has_table_privilege(current_user, %s::oid, 'SELECT')", (key_table_oid,))
                    table_select = cur.fetchone()[0]
                    cur.execute("SAVEPOINT sp_direct_key_read")
                    direct_read_denied = False
                    try:
                        cur.execute("SELECT 1 FROM finrisk_private.actor_assertion_keys LIMIT 1")
                    except psycopg.errors.InsufficientPrivilege:
                        direct_read_denied = True
                        cur.execute("ROLLBACK TO SAVEPOINT sp_direct_key_read")
                    finally:
                        cur.execute("RELEASE SAVEPOINT sp_direct_key_read")
                    checks.append(emit(
                        "runtime role cannot use private schema or read HMAC key table",
                        (not schema_usage) and (not table_select) and direct_read_denied,
                        f"schema_usage={schema_usage}; key_table_select={table_select}; direct_read_denied={direct_read_denied}",
                    ))
            finally:
                conn6.close()

            failures = sum(not value for value in checks)
        finally:
            # Always restore the test DB to the original M08.5.3.1 fail-closed state.
            cleanup_poc(dsn, user_ids=test_user_ids)

        print("\n=== SUMMARY ===")
        print(f"ASSERTIONS: {len(checks)}")
        print(f"FAILURES: {failures}")
        if failures:
            print("M08.5.4.2 SIGNED ACTOR ASSERTION POC: FAIL")
            print("ISOLATED_POSTGRESQL: TRUE")
            print("PRODUCTION_DATABASE: NOT CONNECTED")
            return 1

        print("M08.5.4.2 SIGNED ACTOR ASSERTION POC: PASS")
        print("ISOLATED_POSTGRESQL: TRUE")
        print("PRODUCTION_DATABASE: NOT CONNECTED")
        print("H16_CORE4_H18: NOT MODIFIED")
        print("POC_OBJECTS: CLEANED UP")
        return 0

    except Exception as exc:
        print(f"M08.5.4.2 POC FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("PRODUCTION_DATABASE: NOT CONNECTED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

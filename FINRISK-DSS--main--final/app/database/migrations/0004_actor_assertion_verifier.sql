-- FINRISK DSS ? M08.5.4.3 migration 0004: transaction-bound HMAC actor assertion verifier
-- Installs the persistent private key store and replaces the M08.3 fail-closed
-- current_actor_id() stub with a transaction-bound HMAC-SHA256 verifier.
-- Key material is never stored in migrations or source control; until an active
-- key is provisioned and a valid transaction-bound assertion is presented,
-- finrisk_app.current_actor_id() continues to fail closed (returns NULL).

SET LOCAL ROLE finrisk_owner;

DO $m08_5_4_3_preflight$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM finrisk_app.schema_migrations
        WHERE migration_version = '0003'
          AND migration_name = 'business_rule_registry'
          AND checksum_sha256 = '9428be4f4ff3bdf4aeab4bc31251774e1d14844584a073e229998db1c301ac66'
    ) THEN
        RAISE EXCEPTION 'Migration 0004 preflight: expected migration 0003 (business_rule_registry) checksum is not present.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM finrisk_app.schema_migrations
        WHERE migration_version = '0004'
    ) THEN
        RAISE EXCEPTION 'Migration 0004 preflight: migration 0004 is already recorded.';
    END IF;

    IF to_regclass('finrisk_private.actor_assertion_keys') IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 0004 preflight: finrisk_private.actor_assertion_keys already exists; clean up any POC state before applying 0004.';
    END IF;
END;
$m08_5_4_3_preflight$;

CREATE SCHEMA IF NOT EXISTS finrisk_private AUTHORIZATION finrisk_owner;
REVOKE ALL ON SCHEMA finrisk_private FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_private REVOKE ALL ON TABLES FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_private REVOKE ALL ON SEQUENCES FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_private REVOKE ALL ON FUNCTIONS FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA finrisk_private;

CREATE TABLE finrisk_private.actor_assertion_keys (
    key_id smallint PRIMARY KEY CHECK (key_id > 0),
    key_material bytea NOT NULL CHECK (octet_length(key_material) >= 32),
    key_status varchar(16) NOT NULL
        CHECK (key_status IN ('ACTIVE', 'VERIFY_ONLY', 'RETIRED')),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    rotated_at timestamptz NULL,
    CHECK (rotated_at IS NULL OR rotated_at >= created_at)
);

CREATE UNIQUE INDEX actor_assertion_keys_one_active
    ON finrisk_private.actor_assertion_keys (key_status)
    WHERE key_status = 'ACTIVE';

REVOKE ALL ON finrisk_private.actor_assertion_keys FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;

-- Fixed 32-byte XOR comparison loop for SHA-256 digests.
CREATE OR REPLACE FUNCTION finrisk_private.constant_time_bytea_equal(p_left bytea, p_right bytea)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
DECLARE
    v_index integer;
    v_difference integer := 0;
BEGIN
    IF pg_catalog.octet_length(p_left) <> 32
       OR pg_catalog.octet_length(p_right) <> 32 THEN
        RETURN false;
    END IF;

    FOR v_index IN 0..31 LOOP
        v_difference := v_difference |
            (pg_catalog.get_byte(p_left, v_index) # pg_catalog.get_byte(p_right, v_index));
    END LOOP;

    RETURN v_difference = 0;
END;
$function$;

ALTER FUNCTION finrisk_private.constant_time_bytea_equal(bytea, bytea) OWNER TO finrisk_owner;
REVOKE ALL ON FUNCTION finrisk_private.constant_time_bytea_equal(bytea, bytea) FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;

-- Transaction-bound HMAC-SHA256 actor verifier.
-- Caller-settable app.actor_id / finrisk.user_id settings are ignored.
-- All 7 finrisk.actor_assertion_* claims must be present, well-formed, within
-- the 60-second validity window, bound to pg_current_xact_id_if_assigned(),
-- verified by HMAC-SHA256 against an ACTIVE or VERIFY_ONLY key, and backed by
-- an ACTIVE row in finrisk_app.app_users.
CREATE OR REPLACE FUNCTION finrisk_app.current_actor_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, finrisk_private
AS $function$
DECLARE
    v_key_id_text text;
    v_user_id_text text;
    v_issued_at_text text;
    v_expires_at_text text;
    v_nonce_text text;
    v_xid text;
    v_signature_hex text;

    v_key_id smallint;
    v_user_id uuid;
    v_issued_at bigint;
    v_expires_at bigint;
    v_nonce uuid;
    v_now bigint;
    v_key bytea;
    v_expected_signature bytea;
    v_provided_signature bytea;
    v_payload text;
    v_account_status text;
BEGIN
    v_key_id_text := pg_catalog.current_setting('finrisk.actor_assertion_key_id', true);
    v_user_id_text := pg_catalog.current_setting('finrisk.actor_assertion_user_id', true);
    v_issued_at_text := pg_catalog.current_setting('finrisk.actor_assertion_issued_at', true);
    v_expires_at_text := pg_catalog.current_setting('finrisk.actor_assertion_expires_at', true);
    v_nonce_text := pg_catalog.current_setting('finrisk.actor_assertion_nonce', true);
    v_xid := pg_catalog.current_setting('finrisk.actor_assertion_xid', true);
    v_signature_hex := pg_catalog.current_setting('finrisk.actor_assertion_signature', true);

    IF v_key_id_text IS NULL OR v_key_id_text !~ '^[1-9][0-9]{0,4}$'
       OR v_user_id_text IS NULL OR v_issued_at_text IS NULL
       OR v_expires_at_text IS NULL OR v_nonce_text IS NULL
       OR v_xid IS NULL OR v_xid !~ '^[0-9]{1,20}$'
       OR v_signature_hex IS NULL OR v_signature_hex !~ '^[0-9a-f]{64}$' THEN
        RETURN NULL;
    END IF;

    v_key_id := v_key_id_text::smallint;
    v_user_id := v_user_id_text::uuid;
    v_issued_at := v_issued_at_text::bigint;
    v_expires_at := v_expires_at_text::bigint;
    v_nonce := v_nonce_text::uuid;

    v_now := floor(extract(epoch FROM pg_catalog.statement_timestamp()))::bigint;

    -- Maximum assertion lifetime is 60 seconds; issuance allows at most 5 seconds of future skew.
    IF v_issued_at < v_now - 60
       OR v_issued_at > v_now + 5
       OR v_expires_at <= v_now
       OR v_expires_at <= v_issued_at
       OR v_expires_at - v_issued_at > 60 THEN
        RETURN NULL;
    END IF;

    -- Proof is valid only inside the exact PostgreSQL transaction for which it was minted.
    IF pg_catalog.pg_current_xact_id_if_assigned() IS NULL
       OR v_xid <> pg_catalog.pg_current_xact_id_if_assigned()::text THEN
        RETURN NULL;
    END IF;

    SELECT key_material
      INTO v_key
      FROM finrisk_private.actor_assertion_keys
     WHERE key_id = v_key_id
       AND key_status IN ('ACTIVE', 'VERIFY_ONLY');

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Canonical, versioned, fixed-audience payload.
    v_payload := 'finrisk-actor-v1|finrisk-api|finrisk-db|'
        || v_key_id::text || '|'
        || v_user_id::text || '|'
        || v_issued_at::text || '|'
        || v_expires_at::text || '|'
        || v_nonce::text || '|'
        || v_xid;

    v_expected_signature := finrisk_private.hmac(
        pg_catalog.convert_to(v_payload, 'UTF8'),
        v_key,
        'sha256'
    );
    v_provided_signature := pg_catalog.decode(v_signature_hex, 'hex');

    IF NOT finrisk_private.constant_time_bytea_equal(
        v_expected_signature,
        v_provided_signature
    ) THEN
        RETURN NULL;
    END IF;

    SELECT account_status
      INTO v_account_status
      FROM finrisk_app.app_users
     WHERE user_id = v_user_id;

    IF v_account_status IS DISTINCT FROM 'ACTIVE' THEN
        RETURN NULL;
    END IF;

    RETURN v_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$function$;

ALTER FUNCTION finrisk_app.current_actor_id() OWNER TO finrisk_owner;
REVOKE ALL ON FUNCTION finrisk_app.current_actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finrisk_app.current_actor_id() TO finrisk_app, finrisk_auditor;

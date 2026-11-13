-- M08.5.4.2 TEST-ONLY POC. Never run on production.
-- Installs a transaction-bound HMAC assertion verifier in an isolated M08.5.3.1 test DB.
-- The HMAC key is NOT included here; the Python test runner generates a random key in memory.

BEGIN;
SET LOCAL ROLE finrisk_owner;

DO $poc_preflight$
BEGIN
    IF to_regnamespace('finrisk_private') IS NOT NULL THEN
        RAISE EXCEPTION 'POC preflight: finrisk_private already exists; run the isolated POC cleanup first.';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'POC preflight: pgcrypto is already installed in this database; refusing to reuse or remove it.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        WHERE p.oid = 'finrisk_app.current_actor_id()'::regprocedure
          AND NOT p.prosecdef
    ) THEN
        RAISE EXCEPTION 'POC preflight: current_actor_id() is missing or no longer the expected SECURITY INVOKER baseline.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM finrisk_app.schema_migrations
        WHERE migration_version = '0004'
    ) THEN
        RAISE EXCEPTION 'POC preflight: unexpected migration 0004 exists in the isolated test database.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM finrisk_app.schema_migrations
        WHERE migration_version = '0003'
          AND migration_name = 'business_rule_registry'
          AND checksum_sha256 = '9428be4f4ff3bdf4aeab4bc31251774e1d14844584a073e229998db1c301ac66'
    ) THEN
        RAISE EXCEPTION 'POC preflight: expected migration 0003 checksum is not present.';
    END IF;
END;
$poc_preflight$;

CREATE SCHEMA finrisk_private AUTHORIZATION finrisk_owner;
REVOKE ALL ON SCHEMA finrisk_private FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;

-- pgcrypto is a trusted PostgreSQL extension, but it is created only in this POC DB.
CREATE EXTENSION pgcrypto WITH SCHEMA finrisk_private;

-- Only finrisk_owner / the privileged migration path can read the verification key.
CREATE TABLE finrisk_private.actor_assertion_keys (
    key_id smallint PRIMARY KEY CHECK (key_id > 0),
    key_material bytea NOT NULL CHECK (octet_length(key_material) >= 32),
    key_status varchar(16) NOT NULL
        CHECK (key_status IN ('ACTIVE', 'VERIFY_ONLY', 'RETIRED')),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE UNIQUE INDEX actor_assertion_keys_one_active
    ON finrisk_private.actor_assertion_keys (key_status)
    WHERE key_status = 'ACTIVE';

REVOKE ALL ON finrisk_private.actor_assertion_keys FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finrisk_private FROM PUBLIC, finrisk_app, finrisk_auditor, finrisk_readonly;

-- Fixed 32-byte loop; unlike bytea equality, this does not exit on the first differing byte.
-- This is a POC mitigation, not a formally certified constant-time primitive.
CREATE FUNCTION finrisk_private.constant_time_bytea_equal(p_left bytea, p_right bytea)
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
REVOKE ALL ON FUNCTION finrisk_private.constant_time_bytea_equal(bytea, bytea) FROM PUBLIC;

-- Replace the fail-closed NULL helper only inside this isolated POC database.
-- Caller-settable app.actor_id is intentionally ignored. All assertion claims are HMAC-verified.
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

    -- Maximum assertion lifetime is 60 seconds; issuance allows only 5 seconds of future skew.
    IF v_issued_at < v_now - 60
       OR v_issued_at > v_now + 5
       OR v_expires_at <= v_now
       OR v_expires_at <= v_issued_at
       OR v_expires_at - v_issued_at > 60 THEN
        RETURN NULL;
    END IF;

    -- The proof is valid only in the exact PostgreSQL transaction for which it was minted.
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

    -- Canonical, versioned, fixed-audience payload. Python signer uses this exact byte sequence.
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

    -- User must still exist and remain active; identity/session alone does not grant an app role.
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
        -- Any malformed claim, unavailable key or verification error fails closed.
        RETURN NULL;
END;
$function$;

ALTER FUNCTION finrisk_app.current_actor_id() OWNER TO finrisk_owner;
REVOKE ALL ON FUNCTION finrisk_app.current_actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finrisk_app.current_actor_id() TO finrisk_app, finrisk_auditor;

COMMIT;

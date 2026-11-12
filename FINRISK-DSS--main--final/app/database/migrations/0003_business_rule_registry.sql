-- FinRisk DSS — M08.5.3.1 migration 0003: Business Rule Registry foundation
-- Target: PostgreSQL 16–18. Database: finrisk_app_db. Schema: finrisk_app.
-- DRAFT FOR REVIEW ONLY. Do not apply until the owner approves this migration.
-- Adds governed rule metadata, immutable test cases and append-only simulation history.
-- No business-rule code is stored or executed. No H16/CORE4/H18/credit-decision changes.
-- The migration runner executes this file atomically and records its SHA-256 checksum.

SET LOCAL ROLE finrisk_owner;

-- Fail safely if rules have been inserted since the M08.5.1 audit. New mandatory
-- metadata must never be guessed or silently backfilled for existing rule rows.
DO $preflight$
BEGIN
    IF EXISTS (SELECT 1 FROM finrisk_app.business_rule_registry) THEN
        RAISE EXCEPTION
            'M08.5.3.1 requires an empty business_rule_registry; stop and prepare an explicit metadata backfill.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'finrisk_app.business_rule_registry'::regclass
          AND conname = 'business_rule_registry_approved_at_check'
          AND contype = 'c' AND convalidated
    ) THEN
        RAISE EXCEPTION 'Required approved_at IS NULL guard constraint is missing or not validated.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'finrisk_app.business_rule_registry'::regclass
          AND conname = 'business_rule_registry_is_executable_check'
          AND contype = 'c' AND convalidated
    ) THEN
        RAISE EXCEPTION 'Required is_executable = false guard constraint is missing or not validated.';
    END IF;
END;
$preflight$;

-- Rule Definition: extend the existing registry; do not create a second registry.
ALTER TABLE finrisk_app.business_rule_registry
    ADD COLUMN rule_type varchar(32) NOT NULL,
    ADD COLUMN application_scope varchar(32) NOT NULL,
    ADD COLUMN basis_reference varchar(255) NOT NULL,
    ALTER COLUMN rule_owner SET NOT NULL,
    ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE finrisk_app.business_rule_registry
    ADD CONSTRAINT business_rule_registry_rule_code_nonblank_check
        CHECK (length(btrim(rule_code)) > 0),
    ADD CONSTRAINT business_rule_registry_rule_type_check
        CHECK (rule_type IN (
            'INPUT_QUALITY',
            'DATA_COMPLETENESS',
            'DATA_CONSISTENCY',
            'DOCUMENT_CONTROL',
            'PROCESS_CONTROL',
            'AUDIT_CONTROL'
        )),
    ADD CONSTRAINT business_rule_registry_application_scope_check
        CHECK (application_scope IN (
            'CUSTOMER_PROFILE',
            'LOAN_APPLICATION',
            'FINANCIAL_INPUT',
            'DOCUMENT_PACKAGE',
            'ASSESSMENT_SUPPORT',
            'REPORTING',
            'SYSTEM_WORKFLOW'
        )),
    ADD CONSTRAINT business_rule_registry_rule_owner_nonblank_check
        CHECK (length(btrim(rule_owner)) > 0),
    ADD CONSTRAINT business_rule_registry_basis_reference_nonblank_check
        CHECK (length(btrim(basis_reference)) > 0),
    ADD CONSTRAINT business_rule_registry_title_nonblank_check
        CHECK (length(btrim(title)) > 0),
    ADD CONSTRAINT business_rule_registry_description_nonblank_check
        CHECK (length(btrim(description)) > 0);

COMMENT ON COLUMN finrisk_app.business_rule_registry.rule_type IS
    'One of six M08.5 governance categories; classification only, not an executable rule type.';
COMMENT ON COLUMN finrisk_app.business_rule_registry.application_scope IS
    'One of seven M08.5 application scopes; shared catalogue classification, not tenant ownership.';
COMMENT ON COLUMN finrisk_app.business_rule_registry.basis_reference IS
    'Reference to the source/basis that motivates the rule; distinct from evidence_reference.';
COMMENT ON COLUMN finrisk_app.business_rule_registry.evidence_reference IS
    'Reference to supporting evidence for governance/review; not proof of approval or execution.';

CREATE INDEX ix_business_rule_registry_type_scope_status
    ON finrisk_app.business_rule_registry(rule_type, application_scope, rule_status, created_at DESC);

-- Application roles are separate from PostgreSQL login/group roles.
-- Assign these roles only to identities established by a trusted authentication process.
INSERT INTO finrisk_app.app_roles(role_code, description) VALUES
    ('RULE_MANAGER', 'May register immutable business-rule versions, synthetic test cases and manual comparison records; cannot approve or execute rules.')
ON CONFLICT (role_code) DO NOTHING;

-- Role lookup helper. It is SECURITY INVOKER and reads only the current actor's
-- role rows through the existing app_user_roles RLS policy. A NULL actor fails closed.
CREATE OR REPLACE FUNCTION finrisk_app.actor_has_active_role(p_role_code varchar(32))
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, finrisk_app
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM finrisk_app.app_user_roles AS ur
        WHERE ur.user_id = finrisk_app.current_actor_id()
          AND ur.role_code = p_role_code
          AND ur.revoked_at IS NULL
    );
$function$;
REVOKE ALL ON FUNCTION finrisk_app.actor_has_active_role(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finrisk_app.actor_has_active_role(varchar) TO finrisk_app;

-- Rule Testing: immutable synthetic test-case definitions, tied to an exact rule version.
CREATE TABLE finrisk_app.business_rule_test_cases (
    test_case_id uuid PRIMARY KEY,
    rule_code varchar(80) NOT NULL,
    rule_version integer NOT NULL CHECK (rule_version > 0),
    test_case_code varchar(80) NOT NULL CHECK (length(btrim(test_case_code)) > 0),
    test_case_version integer NOT NULL DEFAULT 1 CHECK (test_case_version > 0),
    title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
    description text NOT NULL DEFAULT '',
    input_snapshot_jsonb jsonb NOT NULL
        CHECK (jsonb_typeof(input_snapshot_jsonb) = 'object'),
    expected_result_snapshot_jsonb jsonb NOT NULL
        CHECK (jsonb_typeof(expected_result_snapshot_jsonb) = 'object'),
    created_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_rule_test_cases_rule_fk
        FOREIGN KEY (rule_code, rule_version)
        REFERENCES finrisk_app.business_rule_registry(rule_code, rule_version)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT business_rule_test_cases_code_version_uq
        UNIQUE (rule_code, rule_version, test_case_code, test_case_version),
    CONSTRAINT business_rule_test_cases_run_reference_uq
        UNIQUE (test_case_id, rule_code, rule_version, test_case_version),
    CONSTRAINT business_rule_test_cases_input_safe_check
        CHECK (NOT finrisk_app.jsonb_has_any_key(
            input_snapshot_jsonb,
            ARRAY[
                'password','access_token','refresh_token','token','secret','api_key','authorization',
                'full_name','customer_name','email','phone','address','date_of_birth','birth_date',
                'national_id','passport_number','account_number','customer_id','applicant_reference',
                'user_id','owner_user_id','application_id','sk_id_curr',
                'target','code_gender','days_birth','feature_vector','raw_features','input_features'
            ]::text[]
        )),
    CONSTRAINT business_rule_test_cases_expected_safe_check
        CHECK (NOT finrisk_app.jsonb_has_any_key(
            expected_result_snapshot_jsonb,
            ARRAY[
                'password','access_token','refresh_token','token','secret','api_key','authorization',
                'full_name','customer_name','email','phone','address','date_of_birth','birth_date',
                'national_id','passport_number','account_number','customer_id','applicant_reference',
                'user_id','owner_user_id','application_id','sk_id_curr',
                'target','code_gender','days_birth','feature_vector','raw_features','input_features'
            ]::text[]
        ))
);
COMMENT ON TABLE finrisk_app.business_rule_test_cases IS
    'Immutable synthetic test-case definitions for a specific rule version. No customer records and no executable rule code.';
COMMENT ON COLUMN finrisk_app.business_rule_test_cases.input_snapshot_jsonb IS
    'Synthetic input only; recursively blocks PII, credentials, CORE4 identifiers, TARGET and raw feature-vector keys.';
COMMENT ON COLUMN finrisk_app.business_rule_test_cases.expected_result_snapshot_jsonb IS
    'Expected result used for manual comparison only; it does not represent a credit decision.';

CREATE INDEX ix_business_rule_test_cases_rule_created
    ON finrisk_app.business_rule_test_cases(rule_code, rule_version, created_at DESC);

-- Append-only simulation history. The database copies the exact test-case input and
-- expected-result snapshots before each run is recorded. It compares only the
-- supplied observed JSON result; it never evaluates or executes a business rule.
CREATE TABLE finrisk_app.business_rule_test_runs (
    test_run_id uuid PRIMARY KEY,
    test_case_id uuid NOT NULL,
    rule_code varchar(80) NOT NULL,
    rule_version integer NOT NULL CHECK (rule_version > 0),
    test_case_version integer NOT NULL CHECK (test_case_version > 0),
    simulation_mode varchar(24) NOT NULL DEFAULT 'MANUAL_COMPARISON'
        CHECK (simulation_mode = 'MANUAL_COMPARISON'),
    comparison_engine_version varchar(80) NOT NULL
        CHECK (length(btrim(comparison_engine_version)) > 0),
    input_snapshot_jsonb jsonb NOT NULL
        CHECK (jsonb_typeof(input_snapshot_jsonb) = 'object'),
    expected_result_snapshot_jsonb jsonb NOT NULL
        CHECK (jsonb_typeof(expected_result_snapshot_jsonb) = 'object'),
    observed_result_snapshot_jsonb jsonb,
    simulation_outcome varchar(16) NOT NULL
        CHECK (simulation_outcome IN ('MATCH', 'MISMATCH', 'ERROR', 'NOT_EVALUATED')),
    error_code varchar(80),
    request_id uuid NOT NULL UNIQUE,
    executed_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    executed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_rule_test_runs_case_fk
        FOREIGN KEY (test_case_id, rule_code, rule_version, test_case_version)
        REFERENCES finrisk_app.business_rule_test_cases(
            test_case_id, rule_code, rule_version, test_case_version
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT business_rule_test_runs_observed_object_check
        CHECK (observed_result_snapshot_jsonb IS NULL
            OR jsonb_typeof(observed_result_snapshot_jsonb) = 'object'),
    CONSTRAINT business_rule_test_runs_error_code_check
        CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,80}$'),
    CONSTRAINT business_rule_test_runs_outcome_consistency_check
        CHECK (
            (simulation_outcome IN ('MATCH', 'MISMATCH')
                AND observed_result_snapshot_jsonb IS NOT NULL AND error_code IS NULL)
            OR (simulation_outcome = 'ERROR'
                AND observed_result_snapshot_jsonb IS NULL AND error_code IS NOT NULL)
            OR (simulation_outcome = 'NOT_EVALUATED'
                AND observed_result_snapshot_jsonb IS NULL AND error_code IS NULL)
        ),
    CONSTRAINT business_rule_test_runs_input_safe_check
        CHECK (NOT finrisk_app.jsonb_has_any_key(
            input_snapshot_jsonb,
            ARRAY[
                'password','access_token','refresh_token','token','secret','api_key','authorization',
                'full_name','customer_name','email','phone','address','date_of_birth','birth_date',
                'national_id','passport_number','account_number','customer_id','applicant_reference',
                'user_id','owner_user_id','application_id','sk_id_curr',
                'target','code_gender','days_birth','feature_vector','raw_features','input_features'
            ]::text[]
        )),
    CONSTRAINT business_rule_test_runs_expected_safe_check
        CHECK (NOT finrisk_app.jsonb_has_any_key(
            expected_result_snapshot_jsonb,
            ARRAY[
                'password','access_token','refresh_token','token','secret','api_key','authorization',
                'full_name','customer_name','email','phone','address','date_of_birth','birth_date',
                'national_id','passport_number','account_number','customer_id','applicant_reference',
                'user_id','owner_user_id','application_id','sk_id_curr',
                'target','code_gender','days_birth','feature_vector','raw_features','input_features'
            ]::text[]
        )),
    CONSTRAINT business_rule_test_runs_observed_safe_check
        CHECK (observed_result_snapshot_jsonb IS NULL OR NOT finrisk_app.jsonb_has_any_key(
            observed_result_snapshot_jsonb,
            ARRAY[
                'password','access_token','refresh_token','token','secret','api_key','authorization',
                'full_name','customer_name','email','phone','address','date_of_birth','birth_date',
                'national_id','passport_number','account_number','customer_id','applicant_reference',
                'user_id','owner_user_id','application_id','sk_id_curr',
                'target','code_gender','days_birth','feature_vector','raw_features','input_features'
            ]::text[]
        ))
);
COMMENT ON TABLE finrisk_app.business_rule_test_runs IS
    'Append-only manual simulation/comparison history. No business-rule code execution and no connection to credit decisions.';
COMMENT ON COLUMN finrisk_app.business_rule_test_runs.simulation_mode IS
    'Fixed to MANUAL_COMPARISON. This records a supplied observed result against an expected snapshot; it does not execute a registered rule.';
COMMENT ON COLUMN finrisk_app.business_rule_test_runs.simulation_outcome IS
    'Derived by the BEFORE INSERT trigger: MATCH, MISMATCH, ERROR or NOT_EVALUATED.';
COMMENT ON COLUMN finrisk_app.business_rule_test_runs.request_id IS
    'Unique API idempotency key; a retried request cannot create a duplicate simulation record.';

CREATE INDEX ix_business_rule_test_runs_rule_executed
    ON finrisk_app.business_rule_test_runs(rule_code, rule_version, executed_at DESC);
CREATE INDEX ix_business_rule_test_runs_case_executed
    ON finrisk_app.business_rule_test_runs(test_case_id, executed_at DESC);
CREATE INDEX ix_business_rule_test_runs_actor_executed
    ON finrisk_app.business_rule_test_runs(executed_by, executed_at DESC);

-- Populate immutable snapshots from the selected test case and derive the result.
-- Only JSONB equality comparison is performed; no rule expression, SQL or script is run.
CREATE OR REPLACE FUNCTION finrisk_app.capture_business_rule_test_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, finrisk_app
AS $function$
DECLARE
    v_case finrisk_app.business_rule_test_cases%ROWTYPE;
BEGIN
    SELECT *
      INTO v_case
      FROM finrisk_app.business_rule_test_cases
     WHERE test_case_id = NEW.test_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'BUSINESS_RULE_TEST_CASE_NOT_FOUND';
    END IF;

    NEW.rule_code := v_case.rule_code;
    NEW.rule_version := v_case.rule_version;
    NEW.test_case_version := v_case.test_case_version;
    NEW.input_snapshot_jsonb := v_case.input_snapshot_jsonb;
    NEW.expected_result_snapshot_jsonb := v_case.expected_result_snapshot_jsonb;

    IF NEW.observed_result_snapshot_jsonb IS NOT NULL THEN
        IF NEW.error_code IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'OBSERVED_RESULT_AND_ERROR_CODE_ARE_MUTUALLY_EXCLUSIVE';
        END IF;
        IF NEW.observed_result_snapshot_jsonb = v_case.expected_result_snapshot_jsonb THEN
            NEW.simulation_outcome := 'MATCH';
        ELSE
            NEW.simulation_outcome := 'MISMATCH';
        END IF;
    ELSIF NEW.error_code IS NOT NULL THEN
        NEW.simulation_outcome := 'ERROR';
    ELSE
        NEW.simulation_outcome := 'NOT_EVALUATED';
    END IF;

    RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION finrisk_app.capture_business_rule_test_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finrisk_app.capture_business_rule_test_run() TO finrisk_app;

CREATE TRIGGER business_rule_test_runs_capture_snapshot
    BEFORE INSERT ON finrisk_app.business_rule_test_runs
    FOR EACH ROW
    EXECUTE FUNCTION finrisk_app.capture_business_rule_test_run();

-- RLS is used for role-gated writes, not tenant partitioning: the Rule Registry is
-- a shared catalogue. Reads are global for the explicitly granted technical roles.
-- Writes require a trusted current_actor_id() and an active RULE_MANAGER application role.

ALTER TABLE finrisk_app.business_rule_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.business_rule_registry FORCE ROW LEVEL SECURITY;
CREATE POLICY business_rule_registry_read_all_granted_roles
    ON finrisk_app.business_rule_registry
    FOR SELECT TO finrisk_app, finrisk_readonly, finrisk_auditor
    USING (true);
CREATE POLICY business_rule_registry_insert_rule_manager
    ON finrisk_app.business_rule_registry
    FOR INSERT TO finrisk_app
    WITH CHECK (
        created_by = finrisk_app.current_actor_id()
        AND finrisk_app.actor_has_active_role('RULE_MANAGER')
    );
CREATE POLICY business_rule_registry_owner_all
    ON finrisk_app.business_rule_registry
    FOR ALL TO finrisk_owner, finrisk_migrator
    USING (true) WITH CHECK (true);

ALTER TABLE finrisk_app.business_rule_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.business_rule_test_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY business_rule_test_cases_read_app_auditor
    ON finrisk_app.business_rule_test_cases
    FOR SELECT TO finrisk_app, finrisk_auditor
    USING (true);
CREATE POLICY business_rule_test_cases_insert_rule_manager
    ON finrisk_app.business_rule_test_cases
    FOR INSERT TO finrisk_app
    WITH CHECK (
        created_by = finrisk_app.current_actor_id()
        AND finrisk_app.actor_has_active_role('RULE_MANAGER')
    );
CREATE POLICY business_rule_test_cases_owner_all
    ON finrisk_app.business_rule_test_cases
    FOR ALL TO finrisk_owner, finrisk_migrator
    USING (true) WITH CHECK (true);

ALTER TABLE finrisk_app.business_rule_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.business_rule_test_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY business_rule_test_runs_read_app_auditor
    ON finrisk_app.business_rule_test_runs
    FOR SELECT TO finrisk_app, finrisk_auditor
    USING (true);
CREATE POLICY business_rule_test_runs_insert_rule_manager
    ON finrisk_app.business_rule_test_runs
    FOR INSERT TO finrisk_app
    WITH CHECK (
        executed_by = finrisk_app.current_actor_id()
        AND finrisk_app.actor_has_active_role('RULE_MANAGER')
    );
CREATE POLICY business_rule_test_runs_owner_all
    ON finrisk_app.business_rule_test_runs
    FOR ALL TO finrisk_owner, finrisk_migrator
    USING (true) WITH CHECK (true);

-- Least-privilege grants. finrisk_app INSERT is still blocked by RLS while
-- current_actor_id() is NULL; no UPDATE/DELETE/TRUNCATE is granted.
REVOKE ALL ON finrisk_app.business_rule_registry,
    finrisk_app.business_rule_test_cases,
    finrisk_app.business_rule_test_runs FROM PUBLIC;

GRANT SELECT, INSERT ON finrisk_app.business_rule_registry,
    finrisk_app.business_rule_test_cases,
    finrisk_app.business_rule_test_runs TO finrisk_app;
REVOKE UPDATE, DELETE, TRUNCATE ON finrisk_app.business_rule_registry,
    finrisk_app.business_rule_test_cases,
    finrisk_app.business_rule_test_runs FROM finrisk_app;

-- Auditor receives read-only visibility over definitions, synthetic test cases
-- and the complete append-only simulation history.
GRANT SELECT ON finrisk_app.business_rule_registry,
    finrisk_app.business_rule_test_cases,
    finrisk_app.business_rule_test_runs TO finrisk_auditor;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON finrisk_app.business_rule_registry,
    finrisk_app.business_rule_test_cases,
    finrisk_app.business_rule_test_runs FROM finrisk_auditor;

-- finrisk_readonly retains its existing SELECT grant on business_rule_registry only.
-- No access to test-case payloads or simulation-run snapshots is added.

-- Deliberately absent: UPDATE/DELETE endpoints, approval grants, executable fields,
-- production rule execution, H16/H18 integration and automatic credit decisions.

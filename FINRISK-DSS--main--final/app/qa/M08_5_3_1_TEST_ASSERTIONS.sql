\set ON_ERROR_STOP on

-- This file is run only against the dedicated test cluster/port by the PowerShell harness.
-- Fixture data is synthetic and remains in the disposable test database.
SELECT
    gen_random_uuid()::text AS actor_id,
    gen_random_uuid()::text AS user_role_id,
    gen_random_uuid()::text AS rule_id,
    gen_random_uuid()::text AS test_case_id,
    'M085_QA_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) AS rule_code
\gset

SELECT set_config('m085_test.actor_id', :'actor_id', true);
SELECT set_config('m085_test.rule_code', :'rule_code', true);
SELECT set_config('m085_test.test_case_id', :'test_case_id', true);

SET LOCAL ROLE finrisk_owner;

INSERT INTO finrisk_app.app_users (
    user_id, identity_provider, identity_subject, display_name, account_status
) VALUES (
    :'actor_id'::uuid, 'M08_5_3_1_ISOLATED_TEST', :'actor_id',
    'M08.5 isolated synthetic test actor', 'ACTIVE'
);

RESET ROLE;

-- app_user_roles has its own forced-RLS self-read policy in migration 0001; use the
-- isolated-cluster superuser to seed the manager assignment fixture, never the runtime role.
INSERT INTO finrisk_app.app_user_roles (
    user_role_id, user_id, role_code, granted_by
) VALUES (
    :'user_role_id'::uuid, :'actor_id'::uuid, 'RULE_MANAGER', :'actor_id'::uuid
);

SET LOCAL ROLE finrisk_owner;

INSERT INTO finrisk_app.business_rule_registry (
    rule_code, rule_version, title, description, rule_owner,
    rule_type, application_scope, basis_reference, created_by
) VALUES (
    :'rule_code', 1, 'M08.5 isolated test rule',
    'Synthetic rule metadata used only to validate the migration.',
    'M08.5 QA Owner', 'DATA_COMPLETENESS', 'LOAN_APPLICATION',
    'QA-SYNTHETIC-BASIS-001', :'actor_id'::uuid
);

INSERT INTO finrisk_app.business_rule_test_cases (
    test_case_id, rule_code, rule_version, test_case_code,
    test_case_version, title, description,
    input_snapshot_jsonb, expected_result_snapshot_jsonb, created_by
) VALUES (
    :'test_case_id'::uuid, :'rule_code', 1, 'SYNTHETIC_CASE_001',
    1, 'Synthetic comparison case', 'No real customer data.',
    '{"synthetic_value": 10}'::jsonb,
    '{"valid": true}'::jsonb,
    :'actor_id'::uuid
);

-- Deliberately send forged baseline fields. The BEFORE INSERT trigger must replace
-- them with the immutable test-case snapshots and derive every outcome.
INSERT INTO finrisk_app.business_rule_test_runs (
    test_run_id, test_case_id, rule_code, rule_version, test_case_version,
    comparison_engine_version, input_snapshot_jsonb, expected_result_snapshot_jsonb,
    observed_result_snapshot_jsonb, simulation_outcome, error_code,
    request_id, executed_by
) VALUES (
    gen_random_uuid(), :'test_case_id'::uuid, 'FORGED_RULE', 999, 999,
    'qa-jsonb-comparison-v1', '{"forged_input": true}'::jsonb,
    '{"forged_expected": true}'::jsonb, '{"valid": true}'::jsonb,
    'NOT_EVALUATED', NULL, gen_random_uuid(), :'actor_id'::uuid
);

INSERT INTO finrisk_app.business_rule_test_runs (
    test_run_id, test_case_id, rule_code, rule_version, test_case_version,
    comparison_engine_version, input_snapshot_jsonb, expected_result_snapshot_jsonb,
    observed_result_snapshot_jsonb, simulation_outcome, error_code,
    request_id, executed_by
) VALUES (
    gen_random_uuid(), :'test_case_id'::uuid, 'FORGED_RULE', 999, 999,
    'qa-jsonb-comparison-v1', '{"forged_input": true}'::jsonb,
    '{"forged_expected": true}'::jsonb, '{"valid": false}'::jsonb,
    'NOT_EVALUATED', NULL, gen_random_uuid(), :'actor_id'::uuid
);

INSERT INTO finrisk_app.business_rule_test_runs (
    test_run_id, test_case_id, rule_code, rule_version, test_case_version,
    comparison_engine_version, input_snapshot_jsonb, expected_result_snapshot_jsonb,
    observed_result_snapshot_jsonb, simulation_outcome, error_code,
    request_id, executed_by
) VALUES (
    gen_random_uuid(), :'test_case_id'::uuid, 'FORGED_RULE', 999, 999,
    'qa-jsonb-comparison-v1', '{"forged_input": true}'::jsonb,
    '{"forged_expected": true}'::jsonb, NULL,
    'MATCH', 'SIMULATED_TEST_ERROR', gen_random_uuid(), :'actor_id'::uuid
);

INSERT INTO finrisk_app.business_rule_test_runs (
    test_run_id, test_case_id, rule_code, rule_version, test_case_version,
    comparison_engine_version, input_snapshot_jsonb, expected_result_snapshot_jsonb,
    observed_result_snapshot_jsonb, simulation_outcome, error_code,
    request_id, executed_by
) VALUES (
    gen_random_uuid(), :'test_case_id'::uuid, 'FORGED_RULE', 999, 999,
    'qa-jsonb-comparison-v1', '{"forged_input": true}'::jsonb,
    '{"forged_expected": true}'::jsonb, NULL,
    'MATCH', NULL, gen_random_uuid(), :'actor_id'::uuid
);

DO $run_assertions$
DECLARE
    v_case uuid := current_setting('m085_test.test_case_id')::uuid;
    v_rule text := current_setting('m085_test.rule_code');
BEGIN
    IF (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case) <> 4 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: expected four simulation-history rows';
    END IF;
    IF (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case AND simulation_outcome = 'MATCH') <> 1 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: MATCH outcome was not derived correctly';
    END IF;
    IF (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case AND simulation_outcome = 'MISMATCH') <> 1 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: MISMATCH outcome was not derived correctly';
    END IF;
    IF (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case AND simulation_outcome = 'ERROR') <> 1 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: ERROR outcome was not derived correctly';
    END IF;
    IF (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case AND simulation_outcome = 'NOT_EVALUATED') <> 1 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: NOT_EVALUATED outcome was not derived correctly';
    END IF;
    IF EXISTS (
        SELECT 1 FROM finrisk_app.business_rule_test_runs
        WHERE test_case_id = v_case
          AND (rule_code <> v_rule OR rule_version <> 1 OR test_case_version <> 1
               OR input_snapshot_jsonb <> '{"synthetic_value": 10}'::jsonb
               OR expected_result_snapshot_jsonb <> '{"valid": true}'::jsonb)
    ) THEN
        RAISE EXCEPTION 'ASSERT_FAIL: trigger did not overwrite caller-supplied baseline snapshots';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM finrisk_app.business_rule_registry
        WHERE rule_code = v_rule AND rule_version = 1
          AND rule_owner = 'M08.5 QA Owner'
          AND basis_reference = 'QA-SYNTHETIC-BASIS-001'
          AND created_by = current_setting('m085_test.actor_id')::uuid
          AND rule_status = 'DRAFT' AND approved_at IS NULL AND is_executable = false
    ) THEN
        RAISE EXCEPTION 'ASSERT_FAIL: mandatory metadata or governance guards are incorrect';
    END IF;
    RAISE NOTICE 'PASS | four outcomes MATCH/MISMATCH/ERROR/NOT_EVALUATED are derived';
    RAISE NOTICE 'PASS | trigger overwrites caller-supplied rule and baseline snapshots';
    RAISE NOTICE 'PASS | rule_owner/created_by/basis_reference and governance guards are enforced';
END;
$run_assertions$;

-- The database constraints must reject approval, execution and sensitive synthetic payload keys.
DO $guard_assertions$
DECLARE
    v_actor uuid := current_setting('m085_test.actor_id')::uuid;
    v_rule text := current_setting('m085_test.rule_code');
BEGIN
    BEGIN
        INSERT INTO finrisk_app.business_rule_registry (
            rule_code, rule_version, title, description, rule_owner, rule_type,
            application_scope, basis_reference, created_by, approved_at
        ) VALUES (
            v_rule || '_BAD_APPROVAL', 1, 'Invalid approval probe', 'Synthetic guard test.',
            'M08.5 QA Owner', 'DATA_COMPLETENESS', 'LOAN_APPLICATION',
            'QA-SYNTHETIC-BASIS-002', v_actor, now()
        );
        RAISE EXCEPTION 'ASSERT_FAIL: approved_at guard allowed a timestamp';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS | approved_at IS NULL guard rejects approval timestamp';
    END;

    BEGIN
        INSERT INTO finrisk_app.business_rule_registry (
            rule_code, rule_version, title, description, rule_owner, rule_type,
            application_scope, basis_reference, created_by, is_executable
        ) VALUES (
            v_rule || '_BAD_EXEC', 1, 'Invalid execution probe', 'Synthetic guard test.',
            'M08.5 QA Owner', 'DATA_COMPLETENESS', 'LOAN_APPLICATION',
            'QA-SYNTHETIC-BASIS-003', v_actor, true
        );
        RAISE EXCEPTION 'ASSERT_FAIL: is_executable guard allowed true';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS | is_executable=false guard rejects true';
    END;

    BEGIN
        INSERT INTO finrisk_app.business_rule_test_cases (
            test_case_id, rule_code, rule_version, test_case_code, test_case_version,
            title, description, input_snapshot_jsonb, expected_result_snapshot_jsonb, created_by
        ) VALUES (
            gen_random_uuid(), v_rule, 1, 'PII_REJECT_PROBE', 1, 'PII guard probe',
            'Synthetic only.', '{"email":"not-a-real-person@example.invalid"}'::jsonb,
            '{"valid":true}'::jsonb, v_actor
        );
        RAISE EXCEPTION 'ASSERT_FAIL: JSON PII-key guard allowed email';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS | JSON snapshot guard rejects sensitive keys';
    END;
END;
$guard_assertions$;

RESET ROLE;

-- Runtime group has INSERT grants and the fixture actor is assigned RULE_MANAGER, but the
-- trusted identity helper remains NULL; RLS must still reject every write.
SET LOCAL ROLE finrisk_app;
DO $runtime_rls_assertions$
DECLARE
    v_actor uuid := current_setting('m085_test.actor_id')::uuid;
    v_rule text := current_setting('m085_test.rule_code');
    v_case uuid := current_setting('m085_test.test_case_id')::uuid;
BEGIN
    IF finrisk_app.current_actor_id() IS NOT NULL THEN
        RAISE EXCEPTION 'ASSERT_FAIL: test cluster unexpectedly has an actor identity';
    END IF;
    IF finrisk_app.actor_has_active_role('RULE_MANAGER') THEN
        RAISE EXCEPTION 'ASSERT_FAIL: RULE_MANAGER was accepted without a trusted actor';
    END IF;

    IF (SELECT count(*) FROM finrisk_app.business_rule_registry WHERE rule_code = v_rule) <> 1
       OR (SELECT count(*) FROM finrisk_app.business_rule_test_cases WHERE test_case_id = v_case) <> 1
       OR (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case) <> 4 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: finrisk_app cannot read the shared rule/test catalogue';
    END IF;

    BEGIN
        INSERT INTO finrisk_app.business_rule_registry (
            rule_code, rule_version, title, description, rule_owner, rule_type,
            application_scope, basis_reference, created_by
        ) VALUES (
            v_rule || '_RLS_DENY', 1, 'RLS denial probe', 'Must be blocked.',
            'M08.5 QA Owner', 'DATA_COMPLETENESS', 'LOAN_APPLICATION',
            'QA-RLS-DENY', v_actor
        );
        RAISE EXCEPTION 'ASSERT_FAIL: runtime Registry INSERT was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS | runtime Registry INSERT is blocked while actor is NULL';
    END;

    BEGIN
        INSERT INTO finrisk_app.business_rule_test_cases (
            test_case_id, rule_code, rule_version, test_case_code, test_case_version,
            title, description, input_snapshot_jsonb, expected_result_snapshot_jsonb, created_by
        ) VALUES (
            gen_random_uuid(), v_rule, 1, 'RLS_DENY_PROBE', 1, 'RLS denial probe',
            'Must be blocked.', '{"synthetic_value": 11}'::jsonb,
            '{"valid": true}'::jsonb, v_actor
        );
        RAISE EXCEPTION 'ASSERT_FAIL: runtime test-case INSERT was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS | runtime test-case INSERT is blocked while actor is NULL';
    END;

    BEGIN
        INSERT INTO finrisk_app.business_rule_test_runs (
            test_run_id, test_case_id, rule_code, rule_version, test_case_version,
            comparison_engine_version, input_snapshot_jsonb, expected_result_snapshot_jsonb,
            observed_result_snapshot_jsonb, simulation_outcome, request_id, executed_by
        ) VALUES (
            gen_random_uuid(), v_case, v_rule, 1, 1, 'qa-jsonb-comparison-v1',
            '{"synthetic_value": 10}'::jsonb, '{"valid": true}'::jsonb,
            '{"valid": true}'::jsonb, 'NOT_EVALUATED', gen_random_uuid(), v_actor
        );
        RAISE EXCEPTION 'ASSERT_FAIL: runtime test-run INSERT was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS | runtime test-run INSERT is blocked while actor is NULL';
    END;
END;
$runtime_rls_assertions$;

RESET ROLE;

-- Auditor receives SELECT on the three tables and no write privileges.
SET LOCAL ROLE finrisk_auditor;
DO $auditor_assertions$
DECLARE
    v_rule text := current_setting('m085_test.rule_code');
    v_case uuid := current_setting('m085_test.test_case_id')::uuid;
BEGIN
    IF (SELECT count(*) FROM finrisk_app.business_rule_registry WHERE rule_code = v_rule) <> 1
       OR (SELECT count(*) FROM finrisk_app.business_rule_test_cases WHERE test_case_id = v_case) <> 1
       OR (SELECT count(*) FROM finrisk_app.business_rule_test_runs WHERE test_case_id = v_case) <> 4 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: auditor SELECT did not expose the complete test catalogue/history';
    END IF;
    BEGIN
        INSERT INTO finrisk_app.business_rule_registry (
            rule_code, rule_version, title, description, rule_owner, rule_type,
            application_scope, basis_reference, created_by
        ) VALUES (
            v_rule || '_AUDITOR_DENY', 1, 'Auditor denial probe', 'Must be blocked.',
            'M08.5 QA Owner', 'DATA_COMPLETENESS', 'LOAN_APPLICATION',
            'QA-AUDITOR-DENY', NULL
        );
        RAISE EXCEPTION 'ASSERT_FAIL: auditor unexpectedly received Registry INSERT';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS | auditor can SELECT but cannot INSERT';
    END;
END;
$auditor_assertions$;

RESET ROLE;

DO $acl_assertions$
DECLARE
    v_table text;
    v_tables text[] := ARRAY[
        'finrisk_app.business_rule_registry',
        'finrisk_app.business_rule_test_cases',
        'finrisk_app.business_rule_test_runs'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        IF NOT has_table_privilege('finrisk_app', v_table, 'SELECT')
           OR NOT has_table_privilege('finrisk_app', v_table, 'INSERT') THEN
            RAISE EXCEPTION 'ASSERT_FAIL: finrisk_app SELECT/INSERT grants missing on %', v_table;
        END IF;
        IF has_table_privilege('finrisk_app', v_table, 'UPDATE')
           OR has_table_privilege('finrisk_app', v_table, 'DELETE')
           OR has_table_privilege('finrisk_app', v_table, 'TRUNCATE') THEN
            RAISE EXCEPTION 'ASSERT_FAIL: finrisk_app has an excessive write privilege on %', v_table;
        END IF;
        IF NOT has_table_privilege('finrisk_auditor', v_table, 'SELECT') THEN
            RAISE EXCEPTION 'ASSERT_FAIL: auditor SELECT grant missing on %', v_table;
        END IF;
        IF has_table_privilege('finrisk_auditor', v_table, 'INSERT')
           OR has_table_privilege('finrisk_auditor', v_table, 'UPDATE')
           OR has_table_privilege('finrisk_auditor', v_table, 'DELETE')
           OR has_table_privilege('finrisk_auditor', v_table, 'TRUNCATE') THEN
            RAISE EXCEPTION 'ASSERT_FAIL: auditor has an excessive write privilege on %', v_table;
        END IF;
    END LOOP;
    IF has_table_privilege('finrisk_readonly', 'finrisk_app.business_rule_test_cases', 'SELECT')
       OR has_table_privilege('finrisk_readonly', 'finrisk_app.business_rule_test_runs', 'SELECT') THEN
        RAISE EXCEPTION 'ASSERT_FAIL: finrisk_readonly was granted access to test payloads/history';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'finrisk_app'
          AND c.relname IN ('business_rule_registry','business_rule_test_cases','business_rule_test_runs')
          AND c.relrowsecurity AND c.relforcerowsecurity) <> 3 THEN
        RAISE EXCEPTION 'ASSERT_FAIL: RLS is not enabled and forced on all three tables';
    END IF;
    RAISE NOTICE 'PASS | least-privilege grants and forced RLS are correct for all three tables';
    RAISE NOTICE 'PASS | finrisk_readonly cannot access test-case payloads or simulation history';
END;
$acl_assertions$;

SELECT 'M08.5.3.1 ISOLATED POSTGRESQL TEST: PASS' AS final_result;

-- FINRISK DSS — M08.3 migration 0002: least-privilege runtime grants
-- Applied by the M08.3 migration runner after migration 0001.
SET LOCAL ROLE finrisk_owner;
REVOKE CONNECT ON DATABASE finrisk_app_db FROM PUBLIC;
GRANT CONNECT ON DATABASE finrisk_app_db TO finrisk_app, finrisk_auditor, finrisk_readonly, finrisk_migrator;
GRANT USAGE ON SCHEMA finrisk_app TO finrisk_app, finrisk_auditor, finrisk_readonly;

-- Clear previous draft grants before applying the least-privilege grant set.
REVOKE ALL ON ALL TABLES IN SCHEMA finrisk_app FROM finrisk_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finrisk_app FROM finrisk_app;

-- Runtime receives the actor helper only. It returns NULL until trusted
-- authentication is integrated; no direct SELECT on app_users is granted.
GRANT EXECUTE ON FUNCTION finrisk_app.current_actor_id() TO finrisk_app, finrisk_auditor;
GRANT EXECUTE ON FUNCTION finrisk_app.jsonb_has_any_key(jsonb, text[]) TO finrisk_app;

-- App runtime: no DDL, no TRUNCATE, no hard DELETE, no audit UPDATE.
GRANT SELECT ON finrisk_app.app_roles, finrisk_app.app_user_roles,
    finrisk_app.business_rule_registry TO finrisk_app;
GRANT SELECT, INSERT ON finrisk_app.loan_applications TO finrisk_app;
GRANT UPDATE (
    applicant_reference,
    applicant_name_ciphertext,
    pii_ciphertext_format,
    pii_key_version,
    applicant_age_years,
    monthly_income_amount,
    monthly_expenses_amount,
    existing_monthly_debt_amount,
    requested_amount,
    requested_term_months,
    loan_purpose_code,
    currency_code,
    application_status,
    source_schema_version,
    row_version,
    updated_by,
    updated_at,
    deleted_at
) ON finrisk_app.loan_applications TO finrisk_app;

-- Validation, H18 assessment and scenario input/result snapshots are immutable.
GRANT SELECT, INSERT ON finrisk_app.financial_validation_runs,
    finrisk_app.financial_validation_findings,
    finrisk_app.assessment_runs TO finrisk_app;
GRANT SELECT, INSERT ON finrisk_app.loan_simulation_scenarios TO finrisk_app;
GRANT UPDATE (deleted_at) ON finrisk_app.loan_simulation_scenarios TO finrisk_app;

-- A saved report may only transition to ARCHIVED; its evidence payload is immutable.
GRANT SELECT, INSERT ON finrisk_app.report_records TO finrisk_app;
GRANT UPDATE (record_status, archived_at) ON finrisk_app.report_records TO finrisk_app;

GRANT SELECT, INSERT ON finrisk_app.audit_events TO finrisk_app;
REVOKE UPDATE, DELETE, TRUNCATE ON finrisk_app.audit_events FROM finrisk_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA finrisk_app FROM finrisk_app;
REVOKE ALL ON finrisk_app.schema_migrations FROM finrisk_app;
GRANT SELECT (migration_version) ON finrisk_app.schema_migrations TO finrisk_app;

-- Read-only users do not receive access to applicant PII ciphertext or report payloads.
GRANT SELECT ON finrisk_app.app_roles, finrisk_app.business_rule_registry TO finrisk_readonly;
GRANT SELECT ON finrisk_app.assessment_runs TO finrisk_auditor;
GRANT SELECT ON finrisk_app.audit_events TO finrisk_auditor;

-- Provision LOGIN principals separately and interactively; no password appears in this file.

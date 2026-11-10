-- FINRISK DSS — M08.3 migration 0001: initial application schema
-- Target: PostgreSQL 16-18. Database: finrisk_app_db. Schema: finrisk_app.
-- Ownership: application-owned workflow metadata only. CORE4/H16 files remain external/read-only.
-- Applied only by the M08.3 migration runner inside a transaction.
-- No DROP/TRUNCATE, no credentials, no H16 feature matrix, no TARGET or loan approval decision.

SET LOCAL ROLE finrisk_owner;

CREATE SCHEMA finrisk_app AUTHORIZATION finrisk_owner;
REVOKE ALL ON SCHEMA finrisk_app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMENT ON SCHEMA finrisk_app IS
  'FinRisk application-owned workflow data only. CORE4 snapshot and H16 model remain external and read-only.';

CREATE OR REPLACE FUNCTION finrisk_app.jsonb_has_any_key(p_doc jsonb, p_forbidden text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
    kv record;
    item jsonb;
BEGIN
    IF p_doc IS NULL THEN
        RETURN false;
    ELSIF jsonb_typeof(p_doc) = 'object' THEN
        FOR kv IN SELECT key, value FROM jsonb_each(p_doc) LOOP
            IF lower(kv.key) = ANY(p_forbidden)
               OR finrisk_app.jsonb_has_any_key(kv.value, p_forbidden) THEN
                RETURN true;
            END IF;
        END LOOP;
    ELSIF jsonb_typeof(p_doc) = 'array' THEN
        FOR item IN SELECT value FROM jsonb_array_elements(p_doc) LOOP
            IF finrisk_app.jsonb_has_any_key(item, p_forbidden) THEN
                RETURN true;
            END IF;
        END LOOP;
    END IF;
    RETURN false;
END;
$function$;

-- Fail closed until a trusted authentication adapter is approved and installed.
-- A caller-controlled custom GUC is NOT an identity source: runtime callers can
-- set arbitrary GUC values and impersonate another owner.
CREATE OR REPLACE FUNCTION finrisk_app.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
    SELECT NULL::uuid
$function$;

CREATE TABLE finrisk_app.app_users (
    user_id uuid PRIMARY KEY,
    identity_provider varchar(120) NOT NULL,
    identity_subject varchar(255) NOT NULL,
    display_name varchar(120) NOT NULL,
    account_status varchar(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'DISABLED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (identity_provider, identity_subject)
);
COMMENT ON TABLE finrisk_app.app_users IS
  'External identity mapping only. No passwords, access tokens, email or phone are stored here.';

-- No caller-supplied identity resolver is exposed. Identity-provider verification
-- and a signed/trusted actor context are prerequisites for enabling owner-scoped APIs.

CREATE TABLE finrisk_app.app_roles (
    role_code varchar(32) PRIMARY KEY,
    description varchar(240) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO finrisk_app.app_roles(role_code, description) VALUES
    ('VIEWER', 'Read permitted application records.'),
    ('LOAN_OFFICER', 'Create and maintain assigned loan applications.'),
    ('REVIEWER', 'Review permitted assessment support records; no automatic credit authority.'),
    ('AUDITOR', 'Read approved audit and report metadata.'),
    ('ADMIN', 'Manage application accounts and role assignments.'),
    ('QA', 'Manage test evidence; no production credit authority.')
ON CONFLICT (role_code) DO NOTHING;

CREATE TABLE finrisk_app.app_user_roles (
    user_role_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    role_code varchar(32) NOT NULL REFERENCES finrisk_app.app_roles(role_code),
    granted_by uuid REFERENCES finrisk_app.app_users(user_id),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX uq_app_user_roles_active
    ON finrisk_app.app_user_roles(user_id, role_code)
    WHERE revoked_at IS NULL;

CREATE TABLE finrisk_app.loan_applications (
    application_id uuid PRIMARY KEY,
    application_code varchar(40) NOT NULL UNIQUE,
    owner_user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    applicant_reference varchar(30) NOT NULL,
    applicant_name_ciphertext bytea NOT NULL,
    pii_ciphertext_format varchar(32) NOT NULL DEFAULT 'AES_GCM_V1' CHECK (pii_ciphertext_format = 'AES_GCM_V1'),
    pii_key_version varchar(80) NOT NULL,
    applicant_age_years smallint,
    monthly_income_amount numeric(18,2),
    monthly_expenses_amount numeric(18,2),
    existing_monthly_debt_amount numeric(18,2),
    requested_amount numeric(18,2) NOT NULL,
    requested_term_months smallint NOT NULL,
    loan_purpose_code varchar(24) NOT NULL
        CHECK (loan_purpose_code IN ('personal', 'business', 'education', 'housing', 'other')),
    currency_code varchar(3) NOT NULL DEFAULT 'VND'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    application_status varchar(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (application_status IN ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'CLOSED')),
    source_schema_version varchar(80) NOT NULL DEFAULT 'finrisk.loan_application.v1',
    row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
    created_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    updated_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (applicant_age_years IS NULL OR applicant_age_years BETWEEN 0 AND 130),
    CHECK (monthly_income_amount IS NULL OR monthly_income_amount >= 0),
    CHECK (monthly_expenses_amount IS NULL OR monthly_expenses_amount >= 0),
    CHECK (existing_monthly_debt_amount IS NULL OR existing_monthly_debt_amount >= 0),
    CHECK (requested_amount > 0),
    CHECK (requested_term_months > 0),
    CHECK (octet_length(applicant_name_ciphertext) >= 29),
    UNIQUE (application_id, owner_user_id),
    CHECK (updated_at >= created_at)
);
COMMENT ON TABLE finrisk_app.loan_applications IS
  'User-entered application record. applicant_reference is NOT sk_id_curr. No direct H16 feature mapping is implied.';
COMMENT ON COLUMN finrisk_app.loan_applications.applicant_name_ciphertext IS
  'Application-layer authenticated ciphertext only; plaintext applicant name must never be sent to this column.';
COMMENT ON COLUMN finrisk_app.loan_applications.pii_key_version IS
  'Identifier for the envelope-encryption key version; actual key material is held outside PostgreSQL/source control.';

CREATE TABLE finrisk_app.financial_validation_runs (
    validation_run_id uuid PRIMARY KEY,
    application_id uuid NOT NULL REFERENCES finrisk_app.loan_applications(application_id),
    owner_user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    validator_version varchar(80) NOT NULL,
    validation_scope varchar(32) NOT NULL DEFAULT 'INPUT_QUALITY'
        CHECK (validation_scope = 'INPUT_QUALITY'),
    outcome varchar(12) NOT NULL CHECK (outcome IN ('PASS', 'WARN', 'FAIL')),
    error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
    is_credit_policy boolean NOT NULL DEFAULT false CHECK (is_credit_policy = false),
    executed_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    executed_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (application_id, owner_user_id)
        REFERENCES finrisk_app.loan_applications(application_id, owner_user_id)
);
COMMENT ON TABLE finrisk_app.financial_validation_runs IS
  'Technical/input-quality validation only. This table does not represent credit eligibility or policy.';

CREATE TABLE finrisk_app.financial_validation_findings (
    finding_id uuid PRIMARY KEY,
    validation_run_id uuid NOT NULL REFERENCES finrisk_app.financial_validation_runs(validation_run_id),
    rule_code varchar(80) NOT NULL,
    rule_category varchar(32) NOT NULL DEFAULT 'INPUT_QUALITY'
        CHECK (rule_category = 'INPUT_QUALITY'),
    severity varchar(12) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
    field_path varchar(160),
    message_key varchar(120) NOT NULL,
    message_args_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(message_args_jsonb) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT finrisk_app.jsonb_has_any_key(
        message_args_jsonb,
        ARRAY['password','token','secret','authorization','full_name','email','phone','target']::text[]
    ))
);

CREATE TABLE finrisk_app.loan_simulation_scenarios (
    scenario_id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    application_id uuid REFERENCES finrisk_app.loan_applications(application_id),
    scenario_type varchar(24) NOT NULL DEFAULT 'HYPOTHETICAL'
        CHECK (scenario_type = 'HYPOTHETICAL'),
    principal_amount numeric(18,2) NOT NULL CHECK (principal_amount > 0),
    annual_rate_assumption_pct numeric(7,4) NOT NULL
        CHECK (annual_rate_assumption_pct BETWEEN 0 AND 100),
    term_months smallint NOT NULL CHECK (term_months BETWEEN 1 AND 600),
    repayment_method varchar(24) NOT NULL
        CHECK (repayment_method IN ('ANNUITY', 'EQUAL_PRINCIPAL')),
    currency_code varchar(3) NOT NULL DEFAULT 'VND'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    formula_version varchar(80) NOT NULL,
    result_snapshot_jsonb jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot_jsonb) = 'object'),
    scenario_only boolean NOT NULL DEFAULT true CHECK (scenario_only = true),
    created_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    FOREIGN KEY (application_id, owner_user_id)
        REFERENCES finrisk_app.loan_applications(application_id, owner_user_id),
    CHECK (NOT finrisk_app.jsonb_has_any_key(
        result_snapshot_jsonb,
        ARRAY['target','code_gender','days_birth','full_name','email','phone','address','password','access_token','refresh_token','token','secret','api_key','authorization','feature_vector','raw_features','input_features']::text[]
    ))
);
COMMENT ON TABLE finrisk_app.loan_simulation_scenarios IS
  'Hypothetical calculator inputs/outputs only. Not a product quote, offer, approval or H16 feature source.';

CREATE TABLE finrisk_app.assessment_runs (
    assessment_id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    source_system varchar(16) NOT NULL DEFAULT 'CORE4' CHECK (source_system = 'CORE4'),
    sk_id_curr bigint NOT NULL CHECK (sk_id_curr > 0),
    data_version varchar(120) NOT NULL,
    feature_set_version varchar(120) NOT NULL,
    feature_count smallint NOT NULL CHECK (feature_count = 169),
    model_version varchar(120) NOT NULL,
    model_sha256 char(64) NOT NULL CHECK (model_sha256 ~ '^[0-9a-f]{64}$'),
    threshold_policy_version varchar(120) NOT NULL,
    decision_threshold numeric(14,12) NOT NULL CHECK (decision_threshold BETWEEN 0 AND 1),
    risk_score numeric(14,12) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
    review_signal varchar(40) NOT NULL
        CHECK (review_signal IN ('MANUAL_REVIEW_RECOMMENDED', 'NO_REVIEW_SIGNAL')),
    business_policy_status varchar(24) NOT NULL DEFAULT 'NOT_APPROVED'
        CHECK (business_policy_status = 'NOT_APPROVED'),
    automatic_credit_decision boolean NOT NULL DEFAULT false
        CHECK (automatic_credit_decision = false),
    explanation_snapshot_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(explanation_snapshot_jsonb) = 'object'),
    response_contract_version varchar(80) NOT NULL,
    request_id uuid NOT NULL UNIQUE,
    created_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (assessment_id, owner_user_id),
    CHECK (NOT finrisk_app.jsonb_has_any_key(
        explanation_snapshot_jsonb,
        ARRAY['target','code_gender','days_birth','full_name','email','phone','address','password','access_token','refresh_token','token','secret','api_key','authorization','feature_vector','raw_features','input_features']::text[]
    ))
);
COMMENT ON TABLE finrisk_app.assessment_runs IS
  'Immutable H18 support-signal snapshots for allowed CORE4 profile IDs. No raw 169-feature vector or TARGET is stored.';
COMMENT ON COLUMN finrisk_app.assessment_runs.sk_id_curr IS
  'External CORE4 identifier only; it is not a foreign key into this application database.';

CREATE TABLE finrisk_app.report_records (
    report_id uuid PRIMARY KEY,
    report_code varchar(80) NOT NULL UNIQUE,
    owner_user_id uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    assessment_id uuid NOT NULL REFERENCES finrisk_app.assessment_runs(assessment_id),
    report_type varchar(60) NOT NULL DEFAULT 'CORE4_H18_REVIEW_SUPPORT'
        CHECK (report_type = 'CORE4_H18_REVIEW_SUPPORT'),
    report_schema_version varchar(80) NOT NULL,
    report_payload_jsonb jsonb NOT NULL CHECK (jsonb_typeof(report_payload_jsonb) = 'object'),
    payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    record_status varchar(16) NOT NULL DEFAULT 'ACTIVE'
        CHECK (record_status IN ('ACTIVE', 'ARCHIVED')),
    created_by uuid NOT NULL REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    FOREIGN KEY (assessment_id, owner_user_id)
        REFERENCES finrisk_app.assessment_runs(assessment_id, owner_user_id),
    CHECK ((record_status = 'ACTIVE' AND archived_at IS NULL)
        OR (record_status = 'ARCHIVED' AND archived_at IS NOT NULL)),
    CHECK (NOT finrisk_app.jsonb_has_any_key(
        report_payload_jsonb,
        ARRAY['target','code_gender','days_birth','full_name','email','phone','address','password','token','secret','feature_vector','raw_features','input_features']::text[]
    ))
);
COMMENT ON TABLE finrisk_app.report_records IS
  'Explicitly saved, allowlisted CORE4/H18 report snapshot. Not a credit approval document.';

CREATE TABLE finrisk_app.audit_events (
    audit_event_id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES finrisk_app.app_users(user_id),
    action_code varchar(80) NOT NULL,
    entity_type varchar(80) NOT NULL,
    entity_id uuid,
    request_id uuid,
    metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata_jsonb) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT finrisk_app.jsonb_has_any_key(
        metadata_jsonb,
        ARRAY['password','access_token','refresh_token','token','secret','api_key','authorization','full_name','email','phone','target','feature_vector','raw_features','input_features']::text[]
    ))
);
COMMENT ON TABLE finrisk_app.audit_events IS
  'Append-only audit events. Never store credentials, raw request bodies, names or raw feature vectors.';

CREATE TABLE finrisk_app.business_rule_registry (
    rule_code varchar(80) NOT NULL,
    rule_version integer NOT NULL CHECK (rule_version > 0),
    title varchar(180) NOT NULL,
    description text NOT NULL,
    rule_owner varchar(120),
    approver_reference varchar(160),
    rule_status varchar(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (rule_status IN ('DRAFT', 'NOT_APPROVED', 'RETIRED')),
    is_executable boolean NOT NULL DEFAULT false CHECK (is_executable = false),
    effective_at timestamptz,
    approved_at timestamptz CHECK (approved_at IS NULL),
    evidence_reference varchar(255),
    created_by uuid REFERENCES finrisk_app.app_users(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (rule_code, rule_version)
);
COMMENT ON TABLE finrisk_app.business_rule_registry IS
  'Governance register only. This proposal intentionally prevents rule execution/approval in current M08 scope.';

CREATE TABLE finrisk_app.schema_migrations (
    migration_version varchar(40) PRIMARY KEY,
    migration_name varchar(180) NOT NULL,
    checksum_sha256 char(64) NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    applied_by varchar(120) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_loan_applications_owner_created
    ON finrisk_app.loan_applications(owner_user_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_loan_applications_status
    ON finrisk_app.loan_applications(owner_user_id, application_status, updated_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_validation_runs_application
    ON finrisk_app.financial_validation_runs(application_id, executed_at DESC);
CREATE INDEX ix_simulation_owner_created
    ON finrisk_app.loan_simulation_scenarios(owner_user_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_assessment_owner_created
    ON finrisk_app.assessment_runs(owner_user_id, created_at DESC);
CREATE INDEX ix_assessment_core4_profile
    ON finrisk_app.assessment_runs(sk_id_curr, created_at DESC);
CREATE INDEX ix_reports_owner_created
    ON finrisk_app.report_records(owner_user_id, created_at DESC)
    WHERE record_status = 'ACTIVE';
CREATE INDEX ix_audit_entity_created
    ON finrisk_app.audit_events(entity_type, entity_id, created_at DESC);

-- Row-level security is defense-in-depth. current_actor_id() deliberately returns
-- NULL until a trusted authentication adapter supplies a verified actor context.
-- Do not restore caller-controlled GUC identity or expose arbitrary identity lookup.

ALTER TABLE finrisk_app.app_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.app_user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY app_user_roles_self_read ON finrisk_app.app_user_roles
    FOR SELECT USING (user_id = finrisk_app.current_actor_id());

ALTER TABLE finrisk_app.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.loan_applications FORCE ROW LEVEL SECURITY;
CREATE POLICY loan_applications_owner_scope ON finrisk_app.loan_applications
    USING (owner_user_id = finrisk_app.current_actor_id())
    WITH CHECK (owner_user_id = finrisk_app.current_actor_id()
        AND updated_by = finrisk_app.current_actor_id());

ALTER TABLE finrisk_app.financial_validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.financial_validation_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY validation_runs_owner_scope ON finrisk_app.financial_validation_runs
    USING (owner_user_id = finrisk_app.current_actor_id())
    WITH CHECK (owner_user_id = finrisk_app.current_actor_id()
        AND executed_by = finrisk_app.current_actor_id());

ALTER TABLE finrisk_app.financial_validation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.financial_validation_findings FORCE ROW LEVEL SECURITY;
CREATE POLICY validation_findings_owner_scope ON finrisk_app.financial_validation_findings
    USING (EXISTS (
        SELECT 1 FROM finrisk_app.financial_validation_runs r
        WHERE r.validation_run_id = finrisk_app.financial_validation_findings.validation_run_id
          AND r.owner_user_id = finrisk_app.current_actor_id()
    ));

ALTER TABLE finrisk_app.loan_simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.loan_simulation_scenarios FORCE ROW LEVEL SECURITY;
CREATE POLICY simulation_scenarios_owner_scope ON finrisk_app.loan_simulation_scenarios
    USING (owner_user_id = finrisk_app.current_actor_id())
    WITH CHECK (owner_user_id = finrisk_app.current_actor_id()
        AND created_by = finrisk_app.current_actor_id());

ALTER TABLE finrisk_app.assessment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.assessment_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY assessment_runs_owner_scope ON finrisk_app.assessment_runs
    USING (owner_user_id = finrisk_app.current_actor_id())
    WITH CHECK (owner_user_id = finrisk_app.current_actor_id()
        AND created_by = finrisk_app.current_actor_id());
CREATE POLICY assessment_runs_auditor_read ON finrisk_app.assessment_runs
    FOR SELECT USING (pg_has_role(current_user, 'finrisk_auditor', 'member'));

ALTER TABLE finrisk_app.report_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.report_records FORCE ROW LEVEL SECURITY;
CREATE POLICY report_records_owner_scope ON finrisk_app.report_records
    USING (owner_user_id = finrisk_app.current_actor_id())
    WITH CHECK (owner_user_id = finrisk_app.current_actor_id()
        AND created_by = finrisk_app.current_actor_id());

ALTER TABLE finrisk_app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE finrisk_app.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_actor_scope ON finrisk_app.audit_events
    FOR SELECT USING (actor_user_id = finrisk_app.current_actor_id());
CREATE POLICY audit_events_actor_insert ON finrisk_app.audit_events
    FOR INSERT WITH CHECK (actor_user_id = finrisk_app.current_actor_id());
CREATE POLICY audit_events_auditor_read ON finrisk_app.audit_events
    FOR SELECT USING (pg_has_role(current_user, 'finrisk_auditor', 'member'));

-- Public access must never be inherited accidentally.
REVOKE ALL ON ALL TABLES IN SCHEMA finrisk_app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finrisk_app FROM PUBLIC;

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const APP = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(APP, p), "utf8");

test("M08.2 proposes 12 app-owned entities", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  const tables = ["app_users","app_roles","app_user_roles","loan_applications","financial_validation_runs","financial_validation_findings","loan_simulation_scenarios","assessment_runs","report_records","audit_events","business_rule_registry","schema_migrations"];
  for (const table of tables) assert.match(sql, new RegExp(`CREATE TABLE finrisk_app\\.${table}\\s*\\(`, "i"), table);
});

test("M08.2 keeps CORE4 and H16 outside the application DB", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /sk_id_curr bigint NOT NULL/);
  assert.match(sql, /external CORE4 identifier only/i);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*(?:feature_matrix|application_train|bureau_snapshot)/is);
  assert.doesNotMatch(sql, /\btarget\s+(?:boolean|integer|numeric)\b/i);
});

test("Form #09 application fields are distinguished from CORE4 ID", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /applicant_reference varchar\(30\)/);
  assert.match(sql, /applicant_name_ciphertext bytea NOT NULL/);
  assert.match(sql, /pii_ciphertext_format varchar\(32\).*AES_GCM_V1/);
  assert.match(sql, /requested_amount numeric\(18,2\)/);
  assert.match(sql, /requested_term_months smallint NOT NULL/);
  assert.match(sql, /loan_purpose_code varchar\(24\)/);
  assert.doesNotMatch(sql, /\bfull_name\s+(?:varchar|text)\b/i);
});

test("Applicant PII contract uses ciphertext and keeps encryption keys outside source/database", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  const dictionary = read("qa/M08_2_DATA_DICTIONARY_20261108.md");
  assert.match(sql, /CHECK \(octet_length\(applicant_name_ciphertext\) >= 29\)/);
  assert.match(sql, /pii_key_version varchar\(80\) NOT NULL/);
  assert.match(dictionary, /AES-256-GCM envelope/);
  assert.match(dictionary, /key material is never stored in PostgreSQL or source control/);
});

test("H18 remains a support signal, never a credit decision", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /business_policy_status varchar\(24\) NOT NULL DEFAULT 'NOT_APPROVED'/);
  assert.match(sql, /automatic_credit_decision boolean NOT NULL DEFAULT false/);
  assert.match(sql, /CHECK \(automatic_credit_decision = false\)/);
  assert.doesNotMatch(sql, /approved_amount|approved_interest_rate|approved_term_months/i);
});

test("Financial validation is explicitly input-quality only", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /CHECK \(validation_scope = 'INPUT_QUALITY'\)/);
  assert.match(sql, /CHECK \(is_credit_policy = false\)/);
});

test("W04 scenario storage is hypothetical and isolated", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /CHECK \(scenario_type = 'HYPOTHETICAL'\)/);
  assert.match(sql, /CHECK \(scenario_only = true\)/);
  assert.match(sql, /ANNUITY/);
  assert.match(sql, /EQUAL_PRINCIPAL/);
});

test("Rule registry cannot execute or be approved in this proposal", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /CHECK \(is_executable = false\)/);
  assert.match(sql, /CHECK \(approved_at IS NULL\)/);
  assert.match(sql, /DRAFT', 'NOT_APPROVED', 'RETIRED/);
});

test("RLS and append-only audit design are present", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  const roles = read("database/proposals/003_grants_draft.sql");
  assert.ok((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length >= 8);
  assert.match(sql, /finrisk_app\.current_actor_id\(\)/);
  assert.match(roles, /REVOKE UPDATE, DELETE, TRUNCATE ON finrisk_app\.audit_events FROM finrisk_app/);
});

test("Credentials are placeholders and DB driver does not alter H16 lock", () => {
  const env = read("database/.env.example");
  const pgReq = read("database/requirements-postgres.txt");
  const h16Lock = read("backend_ml/model/requirements-lock.txt");
  assert.match(env, /CHANGE_ME/);
  assert.doesNotMatch(env, /password=\w+|secret=\w+/i);
  assert.match(pgReq, /psycopg\[binary\]==3\.3\.6/);
  assert.doesNotMatch(h16Lock, /psycopg/i);
});

test("M08.2 API contract is draft and secured", () => {
  const api = read("qa/M08_2_API_CONTRACT_DRAFT_20261108.yaml");
  assert.match(api, /NOT implemented in M08\.2/);
  assert.match(api, /security:/);
  assert.match(api, /bearerAuth/);
});


test("Runtime grants keep H18 and validation snapshots immutable", () => {
  const grants = read("database/proposals/003_grants_draft.sql");
  assert.match(grants, /GRANT SELECT, INSERT ON finrisk_app\.financial_validation_runs,[\s\S]*?finrisk_app\.assessment_runs TO finrisk_app/);
  assert.doesNotMatch(grants, /GRANT UPDATE[^;]*assessment_runs/is);
  assert.match(grants, /GRANT UPDATE \(record_status, archived_at\) ON finrisk_app\.report_records TO finrisk_app/);
  assert.match(grants, /GRANT UPDATE \(deleted_at\) ON finrisk_app\.loan_simulation_scenarios TO finrisk_app/);
});

test("RLS helper functions have explicit runtime grants and app_users is not exposed", () => {
  const grants = read("database/proposals/003_grants_draft.sql");
  assert.match(grants, /GRANT EXECUTE ON FUNCTION finrisk_app\.current_actor_id\(\) TO finrisk_app, finrisk_auditor/);
  assert.match(grants, /GRANT EXECUTE ON FUNCTION finrisk_app\.resolve_identity\(varchar, varchar\) TO finrisk_app/);
  assert.doesNotMatch(grants, /GRANT SELECT ON finrisk_app\.app_users/);
});

test("JSON forbidden keys are rejected recursively regardless of letter case", () => {
  const sql = read("database/proposals/001_app_schema_draft.sql");
  assert.match(sql, /lower\(kv\.key\) = ANY\(p_forbidden\)/);
  assert.match(sql, /jsonb_array_elements/);
});

test("SQL setup keeps database login principals separate from NOLOGIN groups", () => {
  const roles = read("database/proposals/002_create_roles_draft.sql");
  const setup = read("database/M08_2_POSTGRES_SETUP_DRAFT.md");
  assert.match(roles, /CREATE ROLE finrisk_app NOLOGIN/);
  assert.match(setup, /CREATE ROLE finrisk_api_login LOGIN IN ROLE finrisk_app/);
  assert.match(setup, /\\password finrisk_api_login/);
});


test("Default ACL and database CONNECT are restricted from PUBLIC", () => {
  const schema = read("database/proposals/001_app_schema_draft.sql");
  const grants = read("database/proposals/003_grants_draft.sql");
  assert.match(schema, /ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE ALL ON TABLES FROM PUBLIC/);
  assert.match(schema, /ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/);
  assert.match(grants, /REVOKE CONNECT ON DATABASE finrisk_app_db FROM PUBLIC/);
});

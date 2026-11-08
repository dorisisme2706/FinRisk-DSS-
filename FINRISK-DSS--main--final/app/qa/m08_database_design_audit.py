#!/usr/bin/env python3
"""Static M08.2 design audit. This does not parse/apply SQL or connect to PostgreSQL."""
from __future__ import annotations
import hashlib, json, re, sys
from pathlib import Path
APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
SCHEMA = APP / "database" / "proposals" / "001_app_schema_draft.sql"
ROLES = APP / "database" / "proposals" / "003_grants_draft.sql"
ROLE_BOOTSTRAP = APP / "database" / "proposals" / "002_create_roles_draft.sql"
ENV_EXAMPLE = APP / "database" / ".env.example"
PG_REQ = APP / "database" / "requirements-postgres.txt"
FREEZE = APP / "qa" / "M08_CORE_FREEZE_MANIFEST.json"

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    schema = SCHEMA.read_text(encoding="utf-8")
    roles = ROLES.read_text(encoding="utf-8")
    env = ENV_EXAMPLE.read_text(encoding="utf-8")
    pg_req = PG_REQ.read_text(encoding="utf-8")
    manifest = json.loads(FREEZE.read_text(encoding="utf-8"))
    checks = []
    def add(name, ok, detail): checks.append({"name":name,"status":"PASS" if ok else "FAIL","detail":detail})
    required_tables = ["app_users", "app_roles", "app_user_roles", "loan_applications", "financial_validation_runs", "financial_validation_findings", "loan_simulation_scenarios", "assessment_runs", "report_records", "audit_events", "business_rule_registry", "schema_migrations"]
    missing = [t for t in required_tables if not re.search(rf"CREATE TABLE finrisk_app\.{t}\s*\(", schema, re.I)]
    add("12 proposed application tables declared", not missing, "missing=" + ",".join(missing))
    app_contract = all(x in schema for x in ("applicant_reference", "applicant_name_ciphertext", "requested_amount", "requested_term_months", "loan_purpose_code"))
    add("Loan application contract maps form #09", app_contract, "Reference, encrypted name and requested terms are present")
    h16_exclusion = all(x in schema for x in ("feature_count smallint NOT NULL CHECK (feature_count = 169)", "business_policy_status = 'NOT_APPROVED'", "automatic_credit_decision = false")) and not re.search(r"CREATE TABLE[^;]*(?:target\s+(?:boolean|integer|numeric)|feature_matrix)", schema, re.I | re.S)
    add("H16/H18 governance constraints declared", h16_exclusion, "169 count metadata only; no TARGET/feature matrix; H18 NOT_APPROVED/no-auto-decision")
    no_plaintext_name = "applicant_name_ciphertext bytea NOT NULL" in schema and "pii_ciphertext_format" in schema and "SECURITY DEFINER" in schema and not re.search(r"\b(full_name|applicant_name)\s+(?:varchar|text)\b", schema, re.I)
    add("Applicant identity and name are protected", no_plaintext_name and "GRANT EXECUTE ON FUNCTION finrisk_app.resolve_identity(varchar, varchar) TO finrisk_app" in roles and "GRANT SELECT ON finrisk_app.app_users" not in roles, "Encrypted name; identity lookup exposes only user_id/status")
    pii_envelope = "CHECK (octet_length(applicant_name_ciphertext) >= 29)" in schema and "pii_key_version varchar(80) NOT NULL" in schema
    add("PII ciphertext envelope has a minimum payload and external key version", pii_envelope, "AES-GCM nonce/tag envelope proposal; key material remains outside database/source")
    policy_locked = "CHECK (is_executable = false)" in schema and "CHECK (approved_at IS NULL)" in schema and "('DRAFT', 'NOT_APPROVED', 'RETIRED')" in schema
    add("Business rule registry is non-executable", policy_locked, "DRAFT/NOT_APPROVED/RETIRED only; is_executable=false")
    audit_append_only = "CREATE TABLE finrisk_app.audit_events" in schema and "GRANT SELECT, INSERT ON finrisk_app.audit_events TO finrisk_app" in roles and "REVOKE UPDATE, DELETE, TRUNCATE ON finrisk_app.audit_events FROM finrisk_app" in roles
    add("Audit event append-only permission model", audit_append_only, "Runtime group has no UPDATE/DELETE/TRUNCATE")
    rls = schema.count("ENABLE ROW LEVEL SECURITY") >= 8 and "finrisk_app.current_actor_id()" in schema
    add("RLS owner-scope policies are present", rls, f"RLS-enabled tables={schema.count('ENABLE ROW LEVEL SECURITY')}")
    no_drop = not re.search(r"\b(DROP\s+TABLE|DROP\s+SCHEMA|TRUNCATE\s+TABLE)\b", schema, re.I)
    no_password = not re.search(r"\bPASSWORD\s+['\"]", roles, re.I) and "CHANGE_ME" in env
    add("Draft SQL is non-destructive and has no hard-coded password", no_drop and no_password, "No DROP/TRUNCATE; only placeholder connection data")
    separate_lock = "psycopg[binary]==3.3.6" in pg_req and "psycopg" not in (APP / "backend_ml" / "model" / "requirements-lock.txt").read_text(encoding="utf-8")
    add("PostgreSQL driver is isolated from frozen H16 lock", separate_lock, "Psycopg is a separate M08.3 adapter dependency")
    freeze_ok = True; failures=[]
    for item in manifest["protected_files"]:
        p = APP / item["path"]
        if not p.is_file() or p.stat().st_size != item["size_bytes"] or sha256(p) != item["sha256"]:
            freeze_ok=False; failures.append(item["path"])
    add("39 protected H16/H18 files still match", freeze_ok, "39/39 MATCH" if freeze_ok else "mismatch=" + ",".join(failures))
    # Ensure the API draft explicitly requires authentication and does not claim implementation.
    api_draft = (APP / "qa" / "M08_2_API_CONTRACT_DRAFT_20261108.yaml").read_text(encoding="utf-8")
    role_create = ROLE_BOOTSTRAP.read_text(encoding="utf-8")
    add("Technical role creation is separate from database grants", "CREATE ROLE finrisk_owner NOLOGIN" in role_create and "CREATE ROLE finrisk_app NOLOGIN" in role_create and "GRANT CONNECT ON DATABASE" not in role_create, "Role bootstrap and schema grants are separate ordered scripts")
    add("Future write API contract requires authentication", "security:" in api_draft and "NOT implemented in M08.2" in api_draft, "Draft-only API; bearer auth required")
    least_privilege = (
        re.search(r"GRANT SELECT, INSERT ON finrisk_app\.financial_validation_runs,[\s\S]*?finrisk_app\.assessment_runs TO finrisk_app", roles) is not None
        and "GRANT UPDATE ON finrisk_app.assessment_runs" not in roles
        and "GRANT UPDATE ON finrisk_app.financial_validation_runs" not in roles
        and "GRANT UPDATE ON finrisk_app.financial_validation_findings" not in roles
        and "GRANT UPDATE (record_status, archived_at) ON finrisk_app.report_records TO finrisk_app" in roles
        and "GRANT UPDATE (deleted_at) ON finrisk_app.loan_simulation_scenarios TO finrisk_app" in roles
    )
    add("Runtime table grants follow least privilege", least_privilege, "H18 and validation snapshots immutable; report archive-only; scenario soft-delete only")
    rls_helpers = (
        "GRANT EXECUTE ON FUNCTION finrisk_app.current_actor_id() TO finrisk_app, finrisk_auditor" in roles
        and "GRANT EXECUTE ON FUNCTION finrisk_app.resolve_identity(varchar, varchar) TO finrisk_app" in roles
        and "GRANT SELECT ON finrisk_app.app_users" not in roles
    )
    add("RLS and identity helper execute rights are explicit", rls_helpers, "Runtime can resolve a verified identity without direct app_users SELECT")
    actor_checks = (
        "created_by = finrisk_app.current_actor_id()" in schema
        and "updated_by = finrisk_app.current_actor_id()" in schema
        and "executed_by = finrisk_app.current_actor_id()" in schema
    )
    add("Owner and actor identity are bound in RLS insert/update checks", actor_checks, "Application owner/creator/editor and validation executor must match transaction actor")
    insensitive_json_guard = "lower(kv.key) = ANY(p_forbidden)" in schema
    add("JSON forbidden-key guard is recursive and case-insensitive", insensitive_json_guard, "Upper/lower-case variants of restricted keys are rejected")
    login_setup = all(x in (APP / "database" / "M08_2_POSTGRES_SETUP_DRAFT.md").read_text(encoding="utf-8") for x in ("finrisk_migrator_login", "finrisk_api_login", "\\password finrisk_api_login"))
    add("Database setup distinguishes LOGIN principals from NOLOGIN groups", login_setup, "Example login roles and interactive password setup are documented")
    default_acl = (
        "ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE ALL ON TABLES FROM PUBLIC" in schema
        and "ALTER DEFAULT PRIVILEGES FOR ROLE finrisk_owner IN SCHEMA finrisk_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC" in schema
        and "REVOKE CONNECT ON DATABASE finrisk_app_db FROM PUBLIC" in roles
    )
    add("Future objects and database connection default are restricted", default_acl, "Public table/function grants and PUBLIC database CONNECT are revoked")
    failed = [c for c in checks if c["status"] == "FAIL"]
    result={"schema_version":2,"audit_id":"FINRISK_M08_2_DESIGN_AUDIT_20261108","status":"PASS" if not failed else "FAIL","checks_passed":len(checks)-len(failed),"checks_total":len(checks),"checks_failed":len(failed),"postgres_server_tested":False,"sql_applied":False,"checks":checks}
    out = APP / "evidence" / "m08" / "M08_2_DESIGN_AUDIT_20261108.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    lines=[f"M08.2 Database Design Audit: {result['status']}",f"Checks: {result['checks_passed']}/{result['checks_total']} PASS; {result['checks_failed']} FAIL","PostgreSQL live server tested: NO","Schema SQL applied: NO (design review only)"]
    lines += [f"{c['status']} | {c['name']} | {c['detail']}" for c in checks]
    (APP / "evidence" / "m08" / "M08_2_DESIGN_AUDIT_20261108.txt").write_text("\n".join(lines)+"\n",encoding="utf-8")
    print("\n".join(lines))
    return 0 if not failed else 1
if __name__ == "__main__": sys.exit(main())

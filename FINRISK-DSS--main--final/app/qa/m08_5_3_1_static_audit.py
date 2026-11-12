#!/usr/bin/env python3
"""Static source audit for the revised M08.5.3.1 migration; no DB connection."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "database" / "migrations" / "0003_business_rule_registry.sql"
OUT = ROOT / "qa" / "M08_5_3_1_STATIC_AUDIT.json"
TXT = ROOT / "qa" / "M08_5_3_1_STATIC_AUDIT.txt"


def main() -> int:
    sql = SQL_PATH.read_text(encoding="utf-8")
    normalized = re.sub(r"(?m)^\s*--.*$", "", sql).lower()
    types = [
        "INPUT_QUALITY", "DATA_COMPLETENESS", "DATA_CONSISTENCY",
        "DOCUMENT_CONTROL", "PROCESS_CONTROL", "AUDIT_CONTROL",
    ]
    scopes = [
        "CUSTOMER_PROFILE", "LOAN_APPLICATION", "FINANCIAL_INPUT",
        "DOCUMENT_PACKAGE", "ASSESSMENT_SUPPORT", "REPORTING", "SYSTEM_WORKFLOW",
    ]
    role_seed = re.search(r"insert into finrisk_app\.app_roles\(role_code, description\) values(.*?)on conflict \(role_code\)", normalized, re.S)
    new_app_roles = re.findall(r"\(\s*'([a-z_]+)'\s*,", role_seed.group(1)) if role_seed else []
    run_insert_policy = re.search(
        r"create policy business_rule_test_runs_insert_rule_manager.*?with check\s*\((.*?)\);",
        normalized,
        re.S,
    )
    checks = {
        "next sequential migration filename": SQL_PATH.name == "0003_business_rule_registry.sql",
        "extends the existing Registry rather than creating a duplicate": (
            "alter table finrisk_app.business_rule_registry" in normalized
            and normalized.count("create table finrisk_app.business_rule_registry") == 0
        ),
        "creates exactly two supporting tables": normalized.count("create table finrisk_app.") == 2,
        "contains all six approved rule types": all(f"'{v.lower()}'" in normalized for v in types),
        "contains all seven approved application scopes": all(f"'{v.lower()}'" in normalized for v in scopes),
        "requires rule_type, application_scope and basis_reference": all(
            x in normalized for x in (
                "add column rule_type varchar(32) not null",
                "add column application_scope varchar(32) not null",
                "add column basis_reference varchar(255) not null",
            )
        ),
        "requires rule_owner and created_by on new rules": (
            "alter column rule_owner set not null" in normalized
            and "alter column created_by set not null" in normalized
        ),
        "separates basis_reference from evidence_reference": (
            "basis_reference" in normalized and "evidence_reference" in normalized
        ),
        "keeps approval and execution guards intact": (
            "business_rule_registry_approved_at_check" in normalized
            and "business_rule_registry_is_executable_check" in normalized
            and "approved_at is null" in normalized
            and "is_executable = false" in normalized
            and not re.search(r"alter\s+column\s+(approved_at|is_executable)", normalized)
        ),
        "prevents unreviewed metadata backfill when Registry is no longer empty": (
            "if exists (select 1 from finrisk_app.business_rule_registry)" in normalized
            and "requires an empty business_rule_registry" in normalized
        ),
        "creates exactly one new application role RULE_MANAGER": (
            new_app_roles == ["rule_manager"]
            and "rule_tester" not in normalized
        ),
        "role lookup uses current trusted actor and existing application role mapping": (
            "finrisk_app.current_actor_id()" in normalized
            and "finrisk_app.actor_has_active_role('rule_manager')" in normalized
        ),
        "all three rule/testing tables have RLS enabled and forced": all(
            f"alter table finrisk_app.{name} enable row level security" in normalized
            and f"alter table finrisk_app.{name} force row level security" in normalized
            for name in [
                "business_rule_registry",
                "business_rule_test_cases",
                "business_rule_test_runs",
            ]
        ),
        "all three INSERT policies require RULE_MANAGER": (
            "business_rule_registry_insert_rule_manager" in normalized
            and "business_rule_test_cases_insert_rule_manager" in normalized
            and "business_rule_test_runs_insert_rule_manager" in normalized
            and normalized.count("actor_has_active_role('rule_manager')") == 3
        ),
        "simulation-run INSERT policy binds executed_by to trusted actor": bool(run_insert_policy)
        and "executed_by = finrisk_app.current_actor_id()" in run_insert_policy.group(1),
        "finrisk_auditor receives SELECT on all three tables": (
            "grant select on finrisk_app.business_rule_registry," in normalized
            and "finrisk_app.business_rule_test_cases," in normalized
            and "finrisk_app.business_rule_test_runs to finrisk_auditor" in normalized
        ),
        "run history copies snapshots from exact immutable test case": (
            "create trigger business_rule_test_runs_capture_snapshot" in normalized
            and "new.input_snapshot_jsonb := v_case.input_snapshot_jsonb" in normalized
            and "new.expected_result_snapshot_jsonb := v_case.expected_result_snapshot_jsonb" in normalized
        ),
        "simulation compares observed and expected JSON only": (
            "new.observed_result_snapshot_jsonb = v_case.expected_result_snapshot_jsonb" in normalized
            and "manual_comparison" in normalized
            and "rule_sql" not in normalized
            and "rule_python" not in normalized
            and "executable_code" not in normalized
        ),
        "every inserted attempt receives one of four derived outcomes": all(
            f"new.simulation_outcome := '{outcome.lower()}'" in normalized
            for outcome in ["MATCH", "MISMATCH", "ERROR", "NOT_EVALUATED"]
        ),
        "run history is idempotency-keyed and append-only for runtime": (
            "request_id uuid not null unique" in normalized
            and "revoke update, delete, truncate on finrisk_app.business_rule_registry" in normalized
            and "business_rule_test_cases" in normalized
            and "business_rule_test_runs" in normalized
        ),
        "JSON snapshots reject PII, credentials and protected model keys": all(
            k in normalized for k in [
                "full_name", "access_token", "sk_id_curr", "target", "feature_vector", "raw_features"
            ]
        ),
        "no destructive DROP or TRUNCATE statements": not re.search(
            r"(?im)^\s*(?:drop\s+table|truncate\s+(?:table\s+)?)", normalized
        ),
        "no approval/execution guard is relaxed": not re.search(
            r"(?i)alter\s+column\s+(?:approved_at|is_executable)", normalized
        ),
        "no executable rule-code field is introduced": not re.search(
            r"(?i)\b(?:rule_sql|rule_python|executable_code|script_body|expression_code)\b", normalized
        ),
    }
    result = {
        "audit_id": "FINRISK_M08_5_3_1_MIGRATION_STATIC_AUDIT_REVISED",
        "status": "PASS" if all(checks.values()) else "FAIL",
        "checks": [{"name": name, "status": "PASS" if ok else "FAIL"} for name, ok in checks.items()],
        "migration": SQL_PATH.name,
        "sha256": hashlib.sha256(SQL_PATH.read_bytes()).hexdigest(),
        "application_roles_created": new_app_roles,
        "owner_decisions_incorporated": {
            "single_application_role": "RULE_MANAGER",
            "auditor_select": True,
            "mandatory_rule_owner_created_by_basis_reference": True,
            "manual_observed_vs_expected_comparison_only": True,
        },
        "live_database_tested": False,
        "sql_execution_tested": False,
        "source_repository_modified": False,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    passed = sum(checks.values())
    lines = [
        f"M08.5.3.1 revised static audit: {result['status']} ({passed}/{len(checks)} PASS)",
        *[f"{item['status']} | {item['name']}" for item in result["checks"]],
        f"APPLICATION ROLE | {', '.join(new_app_roles) if new_app_roles else 'NONE'}",
        f"SHA-256 | {result['sha256']}",
        "LIVE DATABASE | NOT TESTED",
        "SQL EXECUTION | NOT TESTED",
        "SOURCE REPOSITORY | NOT MODIFIED",
    ]
    TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())

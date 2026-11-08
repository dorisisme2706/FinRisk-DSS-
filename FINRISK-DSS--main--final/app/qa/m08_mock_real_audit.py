#!/usr/bin/env python3
"""Static inventory of FinRisk's REAL/MOCK workspace screens and data paths."""
from __future__ import annotations
import argparse
import ast
import json
import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (APP_ROOT / rel).read_text(encoding="utf-8")


def parse_screen_registry(text: str):
    match = re.search(r"const screens = \[(.*?)\n  \];", text, re.S)
    if not match:
        raise RuntimeError("Could not locate the workspace screen registry.")
    rows = re.findall(r'\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]', match.group(1))
    return [{"id": row[0], "label_vi": row[1], "description": row[2], "icon": row[3]} for row in rows]


def parse_customer_allowlist(text: str) -> dict:
    module = ast.parse(text)
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "CUSTOMER_PROFILE_FIELDS":
                    return ast.literal_eval(node.value)
    raise RuntimeError("CUSTOMER_PROFILE_FIELDS not found")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-out", type=Path, help="Write inventory JSON to this path")
    args = parser.parse_args()

    app_js = read("src/app.js")
    server = read("backend_api/server.py")
    decision_adapter = read("backend_api/decision_engine.py")
    loan_module = read("src/finrisk-loan.js")
    simulation = read("src/finrisk-simulation.js")
    integration_mock = read("src/finrisk-integration-mock.js")
    mock_decision = read("src/finrisk-decision-mock.js")
    trace_mock = read("src/finrisk-decision-trace.js")
    mock_report = read("src/finrisk-credit-report.js")
    report_history = read("src/finrisk-report-history.js")
    uat = read("src/finrisk-uat.js")
    html = read("index.html")
    features = json.loads(read("backend_ml/contracts/model_features_v1.json"))

    screens = parse_screen_registry(app_js)
    expected = ["overview", "customer", "data", "simulation", "decision", "reports", "evidence", "validation", "trace", "result", "export", "e2e", "acceptance"]
    if [screen["id"] for screen in screens] != expected:
        raise RuntimeError(f"Workspace screen list changed: {[screen['id'] for screen in screens]}")

    render_match = re.search(r"const renderers = \{(.*?)\n  \};", app_js, re.S)
    renderer_ids = re.findall(r"^\s{4}([a-z0-9]+):\s*render[A-Za-z0-9_]+,?$", render_match.group(1), re.M) if render_match else []
    if set(renderer_ids) != set(expected):
        raise RuntimeError(f"Renderer map mismatch: {renderer_ids}")

    allowlist = parse_customer_allowlist(server)
    allowlist_count = sum(len(fields) for fields in allowlist.values())
    form_match = re.search(r"const fields=\[(.*?)\];", loan_module, re.S)
    loan_fields = re.findall(r"['\"]([^'\"]+)['\"]", form_match.group(1)) if form_match else []
    model_fields = features["feature_order"]
    overlap = sorted(set(loan_fields) & set(model_fields))

    api_routes = [
        {"method": "GET", "path": "/api/ml/health", "purpose": "H18 health and model/data metadata"},
        {"method": "GET", "path": "/api/customer/profile?sk_id_curr=<id>", "purpose": "W02 read-only allowlisted CORE4 profile"},
        {"method": "GET", "path": "/api/ml/score?sk_id_curr=<id>", "purpose": "H16 model score without decision-support wrapper"},
        {"method": "GET", "path": "/api/decision/assess?sk_id_curr=<id>", "purpose": "H18 review signal and decision-support contract"}
    ]
    route_checks = all(path in server for path in [
        'path.path == "/api/ml/health"',
        'path.path == "/api/customer/profile"',
        '"/api/ml/score", "/api/decision/assess"'
    ])
    no_post = "def do_POST" not in server
    no_database_driver = not any(token in server for token in ("psycopg", "psycopg2", "sqlalchemy", "sqlite3"))
    proposals_root = APP_ROOT / "database" / "proposals"
    migrations_root = APP_ROOT / "database" / "migrations"
    sql_proposal_files = sorted(p.relative_to(APP_ROOT).as_posix() for p in proposals_root.rglob("*.sql")) if proposals_root.is_dir() else []
    sql_migration_files = sorted(p.relative_to(APP_ROOT).as_posix() for p in migrations_root.rglob("*.sql")) if migrations_root.is_dir() else []
    migrations_dirs = [migrations_root.relative_to(APP_ROOT).as_posix()] if migrations_root.is_dir() else []

    storage_keys = {
        "loan_application_mock": "finrisk.loan.application.mock.v1",
        "decision_scenario_mock": "finrisk.decision.mock.scenario.v1",
        "integration_records_mock": "finrisk.integration.records.mock.v1",
        "integration_last_run_mock": "finrisk.integration.last-run.mock.v1",
        "uat_manual": "finrisk.uat.v1",
        "report_history_local": "finrisk.w06.report-history.v1",
        "language_preference": "finrisk-language",
        "motion_preference": "CG_UI_MOTION_ENABLED",
        "legacy_ui_state": "carbongraph.mvp.v0.6.working-state",
        "legacy_acceptance": "carbongraph.acceptance.v0.6"
    }

    inventory = {
        "schema_version": 1,
        "audit_id": "FINRISK_M08_1_MOCK_REAL_AUDIT_20261107",
        "baseline_archive": "FinRisk_DSS_W07_Setup_Batch_Fix_20261107.zip",
        "workspace_screen_count": len(screens),
        "screens": screens,
        "renderers": renderer_ids,
        "api_routes": api_routes,
        "api_route_source_checks_pass": route_checks,
        "api_write_route_present": not no_post,
        "postgres_driver_detected_in_local_server": not no_database_driver,
        "sql_migration_files": sql_migration_files,
        "sql_design_proposal_files": sql_proposal_files,
        "migrations_directories": migrations_dirs,
        "browser_storage_keys": storage_keys,
        "customer_profile": {
            "source": "CORE4 snapshot via GET /api/customer/profile",
            "read_only": True,
            "allowlist_groups": {name: list(fields) for name, fields in allowlist.items()},
            "allowlisted_field_count": allowlist_count,
            "test_split_blocked_by_server": "if split == \"test\"" in server
        },
        "loan_application_mock": {
            "module": "src/finrisk-loan.js",
            "storage_key": storage_keys["loan_application_mock"],
            "fields": loan_fields,
            "default_example_contains_synthetic_name": "Nguyễn Văn A" in loan_module,
            "api_persistence": False,
            "validation_policy_status": "MOCK input validation only"
        },
        "loan_application_to_h16_feature_mapping": {
            "loan_form_field_count": len(loan_fields),
            "h16_feature_count": len(model_fields),
            "shared_field_count": len(overlap),
            "shared_fields": overlap,
            "conclusion": "No direct field-name overlap. The loan form cannot be sent to H16 as a profile; a governed feature construction/data contract is required and must not be guessed."
        },
        "loan_simulation": {
            "module": "src/finrisk-simulation.js",
            "calculation_location": "browser JavaScript",
            "api_calls": "none in simulation module",
            "inputs_seeded_from": "Loan Application #09 MOCK localStorage",
            "interest_rate": "user-entered hypothetical assumption; not an approved product rate"
        },
        "real_ml_and_decision_support": {
            "W03_W05_source": "CORE4 snapshot + H16 LightGBM + H18 API",
            "decision_adapter": "backend_api/decision_engine.py",
            "decision_guardrail": {
                "automatic_credit_decision": False,
                "business_policy_status": "NOT_APPROVED",
                "loan_terms_generated": False
            }
        },
        "reports_history": {
            "source": "W02 CORE4 profile + H18 decision/assess",
            "storage": "browser localStorage only",
            "storage_key": storage_keys["report_history_local"],
            "maximum_records": 50,
            "user_action_required_to_save": "explicit Save to browser history",
            "exports": ["JSON", "HTML"],
            "central_database_sync": False
        },
        "mock_screens": {
            "overview": "Hard-coded DEMO/MOCK dashboard and hero metrics; no API-backed aggregates.",
            "data": "Loan application #09; browser localStorage; no API/DB.",
            "evidence": "#19 PostgreSQL readiness UI; FinRiskIntegrationMock; localStorage; backend OFFLINE.",
            "validation": "#10 validation of #09 form using FinRiskLoan.validate; illustrative input constraints, not credit policy.",
            "trace": "Legacy #11 trace reads #09 localStorage and FinRiskDecisionMock; MOCK.",
            "result": "#12 FinRiskDecisionMock scenarios; APPROVE/REVIEW/REJECT are explicitly MOCK labels.",
            "export": "#13 finrisk.credit-report.v1-mock; local report from #09/#10/#12.",
            "e2e": "#18 FinRiskIntegrationMock; browser simulation only; no DB/ML/API execution.",
            "acceptance": "Manual UAT stored in localStorage; not a leader signature or centralized QA record."
        },
        "known_inconsistencies": [
            "Marketing/footer copy still calls the whole application Local UI Demo / NO LIVE BACKEND although W02/W03/W05/W06 now use live CORE4/H18 paths.",
            "Navigation contains legacy mock Trace/Result/Export/End-to-End tabs alongside real W05/W06 features; their labels/disclaimers must remain unambiguous.",
            "M08.2 contains draft SQL design proposals only; no active migration, PostgreSQL driver or database write API is present yet.",
            "Legacy UI persistence and UAT keys retain CarbonGraph naming; cleanup needs a migration/compatibility plan before removal."
        ],
        "audit_conclusion": "W01-W07 is a mixed REAL/MOCK local academic prototype. W02/W03/W05/W06 have read-only/live CORE4-H18 functions; multiple legacy modules remain browser-local MOCK. M08.2 has draft SQL proposals only; PostgreSQL persistence and authentication are not implemented."
    }

    # Mechanical checks against source evidence: fail if the code changes materially and the audit isn't reviewed.
    checks = {
        "13 workspace screens parsed": len(screens) == 13,
        "all 13 screen renderers mapped": len(renderer_ids) == 13,
        "W02 read-only allowlist is 38 fields": allowlist_count == 38,
        "Loan form has no direct overlap with the 169 H16 features": len(overlap) == 0,
        "current API routes are verified": route_checks,
        "no POST write route in current server": no_post,
        "no PostgreSQL database driver in current server": no_database_driver,
        "no active SQL migrations in current source": len(sql_migration_files) == 0 and len(migrations_dirs) == 0,
        "draft SQL proposals remain separate from active migrations": len(sql_proposal_files) == 3 and all(p.startswith("database/proposals/") for p in sql_proposal_files),
        "W06 history is local and capped at 50": "MAX_RECORDS = 50" in report_history and storage_keys["report_history_local"] in report_history,
        "W04 calculator is browser-local": "fetch(" not in simulation,
        "W05 policy guardrails preserved": all(x in decision_adapter for x in ('"automatic_credit_decision": False','"business_policy_status": "NOT_APPROVED"','"recommended_amount": None')),
        "W06 reports validate profile before H18": "profileResponse" in read("src/app.js") and read("src/app.js").find("profileResponse = await fetch") < read("src/app.js").find("decisionResponse = await fetch")
    }
    inventory["audit_checks"] = [{"name": name, "status": "PASS" if ok else "FAIL"} for name, ok in checks.items()]
    inventory["audit_status"] = "PASS" if all(checks.values()) else "FAIL"

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"M08.1 MOCK/REAL Source Audit: {inventory['audit_status']}")
    print(f"Checks: {sum(checks.values())}/{len(checks)} PASS; {sum(not x for x in checks.values())} FAIL")
    for item in inventory["audit_checks"]:
        print(f"{item['status']} | {item['name']}")
    print(f"Workspace screens: {len(screens)}; CORE4 allowlist fields: {allowlist_count}; loan form ↔ H16 direct feature-name overlap: {len(overlap)}")
    print(f"API write route: {'present' if not no_post else 'not present'}; PostgreSQL driver: {'detected' if not no_database_driver else 'not detected'}; active migrations: {len(sql_migration_files)}; draft proposals: {len(sql_proposal_files)}")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())

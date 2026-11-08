#!/usr/bin/env python3
"""FinRisk DSS W07 overall static/release audit.

This script verifies cross-workspace source invariants and frozen H16 hashes.
It does not run live CORE4 inference or replace the W07 browser/Windows UAT.
Run from any directory: python qa/w07_overall_qa.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
RESULT_DIR = APP / "evidence" / "w07"
RESULT_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST_PATH = APP / "qa" / "W07_RELEASE_MANIFEST.json"

checks: list[dict] = []


def read_text(relative: str) -> str:
    return (APP / relative).read_text(encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check(name: str, passed: bool, detail: str) -> None:
    checks.append({"name": name, "status": "PASS" if passed else "FAIL", "detail": detail})


def parse_expected_versions() -> tuple[dict, dict]:
    metadata = json.loads(read_text("backend_ml/model/metadata.json"))
    lock_text = read_text("backend_ml/model/requirements-lock.txt")
    locked = {}
    for line in lock_text.splitlines():
        match = re.match(r"^\s*([A-Za-z0-9_.-]+)==([^\s;]+)\s*$", line)
        if match:
            locked[match.group(1).lower().replace("_", "-")] = match.group(2)
    expected = {
        str(key).lower().replace("_", "-"): str(value)
        for key, value in (metadata.get("versions") or {}).items()
    }
    return expected, locked



def main() -> int:
    try:
        app_js = read_text("src/app.js")
        i18n_js = read_text("src/i18n.js")
        index_html = read_text("index.html")
        css = read_text("assets/styles.css")
        server_py = read_text("backend_api/server.py")
        w04_js = read_text("src/finrisk-simulation.js")
        w05_js = read_text("src/finrisk-decision-engine.js")
        w06_js = read_text("src/finrisk-report-history.js")
        w06_handoff = read_text("FINRISK_W06_HANDOFF_20261107.md")
        env_checker = read_text("qa/w07_environment_check.py")
        setup_bat = read_text("setup_windows.bat")
        runner_bat = read_text("run_w07_qa.bat")
        ml_launcher = read_text("run_with_ml.bat")
        api_launcher = read_text("run_api_tests.bat")
        test_launcher = read_text("run_tests.bat")
        h19_freeze_launcher = read_text("03_H19_E2E_FREEZE.cmd")

        # 01. Workspace structure and screen registration.
        screens_match = re.search(r"const screens\s*=\s*\[([\s\S]*?)\n\s*\];", app_js)
        screen_ids = re.findall(r'^\s*\["([a-z0-9_-]+)"\s*,', screens_match.group(1), re.M) if screens_match else []
        expected_screens = ["overview", "customer", "data", "simulation", "decision", "reports",
                            "evidence", "validation", "trace", "result", "export", "e2e", "acceptance"]
        check("13 workspace routes are registered once", len(screen_ids) == 13 and len(set(screen_ids)) == 13 and
              all(item in screen_ids for item in expected_screens), f"Detected {len(screen_ids)} unique routes: {screen_ids}")

        # 02. Each route has a renderer.
        renderer_match = re.search(r"const renderers\s*=\s*\{([\s\S]*?)\n\s*\};", app_js)
        renderers = set(re.findall(r"^\s*([a-z0-9_-]+):\s*render[A-Za-z0-9_]+,?\s*$",
                                   renderer_match.group(1), re.M)) if renderer_match else set()
        check("Every workspace route resolves to a renderer", set(screen_ids) == renderers,
              f"Routes={len(screen_ids)}; renderers={len(renderers)}; missing={sorted(set(screen_ids)-renderers)}")

        # 03. Frontend module load order.
        scripts = re.findall(r'<script\s+src="([^"]+)"\s*></script>', index_html)
        app_index = scripts.index("src/app.js") if "src/app.js" in scripts else -1
        required_modules = ["src/finrisk-simulation.js", "src/finrisk-decision-engine.js", "src/finrisk-report-history.js"]
        ordered = app_index >= 0 and all(module in scripts and scripts.index(module) < app_index for module in required_modules)
        check("W04-W06 modules load before app.js", ordered, f"Required modules={required_modules}; app.js index={app_index}")

        # 04. W02 allowlist and Test split security.
        profile_match = re.search(r"CUSTOMER_PROFILE_FIELDS\s*=\s*\{([\s\S]*?)\n\}", server_py)
        groups = re.findall(r'"[a-z0-9_]+"\s*:\s*\(([\s\S]*?)\),', profile_match.group(1), re.I) if profile_match else []
        profile_fields = sum(len(re.findall(r'"([a-z0-9_]+)"', group)) for group in groups)
        guarded_test = bool(re.search(r'if\s+split\s*==\s*["\']test["\']:[\s\S]*?403', server_py))
        check("W02 CORE4 profile allowlist is exactly 38 read-only fields", profile_fields == 38 and '"read_only": True' in server_py,
              f"Allowlisted fields={profile_fields}; read_only projection present={'\"read_only\": True' in server_py}")
        check("W02 Test partition is blocked by the backend", guarded_test,
              "build_customer_profile checks split == 'test' and returns HTTP 403" if guarded_test else "Test split guard not found")

        # 05. W04 simulation integrity.
        w04_ok = all(token in w04_js for token in ["annuity", "equal_principal", "monthlyRate === 0", "calculateReferenceCashflow"])
        w04_no_api = not re.search(r"\bfetch\s*\(", w04_js)
        check("W04 supports both repayment methods and 0% scenarios", w04_ok,
              "Annuity, equal-principal and zero-interest code paths are present" if w04_ok else "A W04 calculation path is missing")
        check("W04 remains independent from ML/API scoring", w04_no_api,
              "Simulation module contains no fetch() call" if w04_no_api else "Unexpected API fetch found in W04 module")

        # 06. W05 decision-support guardrails.
        w05_ok = all(token in w05_js for token in ["NO_REVIEW_SIGNAL", "MANUAL_REVIEW_RECOMMENDED",
                         'business_policy_status !== "NOT_APPROVED"', "automatic_credit_decision !== false",
                         '"recommended_amount"', '"recommended_term_months"', '"interest_rate"', '"monthly_payment"'])
        w05_i18n = '"Bộ máy hỗ trợ quyết định": "Decision Engine"' in i18n_js
        check("W05 fails closed on unapproved lending policy and loan terms", w05_ok,
              "H18 validator preserves NOT_APPROVED, automatic=false and null terms" if w05_ok else "W05 guardrail validation incomplete")
        check("W05 tab has its VI/EN label mapping", w05_i18n,
              "Bộ máy hỗ trợ quyết định ↔ Decision Engine" if w05_i18n else "W05 translation mapping missing")

        # 07. W06 workflow, explicit browser history and exports.
        report_start = app_js.find("function renderReportHistory()")
        report_end = app_js.find("\n  const renderers =", report_start)
        report_ui = app_js[report_start:report_end] if report_start >= 0 and report_end > report_start else ""
        p_index = report_ui.find("/api/customer/profile?")
        d_index = report_ui.find("/api/decision/assess?")
        ordered_api = p_index >= 0 and d_index > p_index
        fail_closed = "if (!profileResponse.ok" in report_ui and report_ui.find("if (!profileResponse.ok") < d_index
        check("W06 calls W02 before H18 and stops on profile failure", ordered_api and fail_closed,
              f"Profile fetch index={p_index}; H18 fetch index={d_index}; profile failure guard={fail_closed}")
        w06_storage = "finrisk.w06.report-history.v1" in w06_js and "const MAX_RECORDS = 50" in w06_js and "storage.setItem" in w06_js
        w06_exports = all(token in w06_js for token in ["function renderJson(", "function renderHtml(", "function fileName(", "return Object.freeze({"]) and "exportHtml" in report_ui and "exportJson" in report_ui
        w06_guardrails = all(token in w06_js for token in ["officialCreditDecisionIssued: false", "businessPolicyApproved: false",
                              "recommendedAmount: null", "interestRate: null"])
        check("W06 history is explicit, browser-local and capped at 50", w06_storage,
              "Storage key, explicit save API and MAX_RECORDS=50 are present" if w06_storage else "W06 local storage contract incomplete")
        check("W06 exports JSON/HTML and retains non-decision disclaimers", w06_exports and w06_guardrails,
              "JSON/HTML export code and business guardrails are present" if w06_exports and w06_guardrails else "Export or guardrail code missing")

        # 08. Translation and responsive coverage.
        translations = [
            '"Hồ sơ khách hàng": "Customer profile"',
            '"Mô phỏng khoản vay": "Loan simulation"',
            '"Bộ máy hỗ trợ quyết định": "Decision Engine"',
            '"Báo cáo & lịch sử": "Reports & history"',
        ]
        i18n_ok = all(value in i18n_js for value in translations)
        check("W02/W04/W05/W06 navigation has VI/EN mappings", i18n_ok,
              "All four workspace label pairs exist" if i18n_ok else "One or more workspace label pairs missing")
        responsive_selectors = [".finrisk-customer-profile", ".finrisk-w04-screen", ".finrisk-w05-screen", ".finrisk-w06-screen"]
        responsive_ok = all(value in css for value in responsive_selectors) and all(
            re.search(rf"@media\s*\(max-width:\s*{width}px\)", css)
            for width in [900, 720, 600, 560]
        )
        check("W02/W04/W05/W06 include mobile/tablet/desktop responsive rules", responsive_ok,
              "Scoped screen styles plus 900/720/600/560px media rules found" if responsive_ok else "Responsive rules are incomplete")

        # 09. API local security posture.
        loopback = 'os.environ.get("FINRISK_HOST", "127.0.0.1")' in server_py
        no_auth_warning = "the API has no authentication" in server_py and "never expose it to the internet" in server_py
        private_guard = "Only public UI assets may be served" in server_py and '"src", "assets"' in server_py
        check("API binds to loopback by default and warns on network bind", loopback and no_auth_warning,
              "Default host 127.0.0.1; warning documents no authentication" if loopback and no_auth_warning else "Server binding warning missing")
        check("API does not serve model/data/backend source files as public assets", private_guard,
              "Static handler only exposes index.html, src and assets" if private_guard else "Private asset allowlist not found")

        # 10. Frozen model lock and strict runtime gate wiring.
        expected, locked = parse_expected_versions()
        lock_ok = bool(expected) and all(locked.get(key) == value for key, value in expected.items())
        check("Frozen model metadata versions match the pinned requirements lock", lock_ok,
              f"Compared {len(expected)} model runtime packages against {len(locked)} locked packages")
        setup_ok = ("py -3.14 -m venv .venv" in setup_bat and "--only-binary=:all:" in setup_bat
                      and "qa\\w07_environment_check.py" in setup_bat
                      and "Python Launcher py.exe was not found." in setup_bat
                      and "Python Launcher (py.exe)" not in setup_bat)
        check("Windows setup creates a locked CPython 3.14 environment and runs preflight", setup_ok,
              "Setup selects Python 3.14, installs binary wheels from the frozen lock and runs the environment gate" if setup_ok else "Python runtime setup is not aligned with model metadata")
        gate_tokens = ["sys.version_info", "requirements-lock.txt", "pip", "InconsistentVersionWarning", "pyarrow", "Parquet", "pipeline.joblib"]
        env_gate_ok = all(token in env_checker for token in gate_tokens + ["sys.platform", "win32"])
        check("Strict runtime preflight validates interpreter, packages, Parquet and model unpickle", env_gate_ok,
              "Dedicated W07 environment gate checks Python 3.14, Windows x64, all pins, pip graph, PyArrow round-trip and sklearn warnings" if env_gate_ok else "One or more strict runtime checks are missing")
        runtime_prerequisite_gate_ok = "strict_model_prerequisites" in env_checker and "if strict_model_prerequisites:" in env_checker and "Parquet header check skipped" in env_checker
        check("Runtime gate fails closed before model unpickle or incomplete snapshot validation", runtime_prerequisite_gate_ok,
              "Model unpickle requires all interpreter/package/pip prerequisites; missing PyArrow cannot pass snapshot header check" if runtime_prerequisite_gate_ok else "Strict fail-closed preconditions are incomplete")
        launcher_gate_ok = (
            "qa\\w07_environment_check.py" in runner_bat
            and runner_bat.index("qa\\w07_environment_check.py") < runner_bat.index("node --test")
            and "qa\\w07_environment_check.py" in ml_launcher
            and ml_launcher.index("qa\\w07_environment_check.py") < ml_launcher.index("backend_api\\server.py")
            and "qa\\w07_environment_check.py" in api_launcher
            and api_launcher.index("qa\\w07_environment_check.py") < api_launcher.index("backend_api.test_server")
            and "qa\\w07_environment_check.py" in test_launcher
            and test_launcher.index("qa\\w07_environment_check.py") < test_launcher.index("node --test")
            and "qa\\w07_environment_check.py" in h19_freeze_launcher
            and h19_freeze_launcher.index("qa\\w07_environment_check.py") < h19_freeze_launcher.index("verify_h19.py")
        )
        check("W07 QA/API/ML/test/H19 launchers block mismatched environments", launcher_gate_ok,
              "Each runner invokes the strict gate before Node/API/model/H19 work" if launcher_gate_ok else "A launcher bypasses or runs work before the required preflight")
        full_runner_requires_venv = 'if not exist ".venv\\Scripts\\python.exe"' in test_launcher and "Python API tests were not run because .venv is missing" not in test_launcher
        check("Full regression runner cannot silently skip the Python environment gate", full_runner_requires_venv,
              "run_tests.bat stops when .venv is missing or incompatible" if full_runner_requires_venv else "Full test runner still permits a partial pass")

        # 11. Freeze audit for ML bundle and H16 evidence.
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        protected_results = []
        for item in manifest.get("protected_files", []):
            path = (APP / item["path"]).resolve()
            exists = path.is_file() and path.is_relative_to(APP.resolve())
            actual = sha256(path) if exists else None
            protected_results.append({"path": item["path"], "expected": item["sha256"], "actual": actual,
                                      "passed": exists and actual == item["sha256"]})
        protected_ok = (len(protected_results) == manifest.get("protected_file_count") and
                        len(protected_results) > 0 and all(item["passed"] for item in protected_results))
        check("H16 model package and H16 evidence match the W06 freeze manifest", protected_ok,
              f"Verified {sum(1 for x in protected_results if x['passed'])}/{len(protected_results)} protected files")

        # 12. Package hygiene.
        ignore_text = read_text(".gitignore")
        ignore_rules = all(token in ignore_text for token in [".venv/", "__pycache__/", "*.pyc", "data/", "data_snapshot/"])
        snapshot_files = [p.relative_to(APP).as_posix() for p in APP.rglob("feature_matrix.parquet") if p.is_file()]
        check("Source package ignores generated caches/venvs and excludes raw CORE4 snapshot", ignore_rules and not snapshot_files,
              f"Required ignore rules present={ignore_rules}; raw feature_matrix.parquet files={len(snapshot_files)}")

        # 13. Test coverage files exist.
        required_tests = [
            "tests/finrisk-w01-w03.test.js", "tests/finrisk-w02.test.js",
            "tests/finrisk-w04-simulation.test.js", "tests/finrisk-w05-decision-engine.test.js",
            "tests/finrisk-w06-reports-history.test.js", "tests/finrisk-w07-overall-qa.test.js",
            "backend_api/test_server.py",
        ]
        missing_tests = [path for path in required_tests if not (APP / path).is_file()]
        check("W01-W07 and backend regression suites are present", not missing_tests,
              "All required regression suites found" if not missing_tests else f"Missing: {missing_tests}")

        # Exact runtime compatibility is enforced by qa/w07_environment_check.py
        # before test/API/model launch. This source audit intentionally does not
        # compare the build container's package set with the deployment venv.
        failed = [item for item in checks if item["status"] == "FAIL"]
        result = {
            "schema_version": 1,
            "release": "FinRisk DSS W07 Overall QA",
            "baseline": "FinRisk_DSS_W06_Reports_History_20261107.zip",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "python": sys.version.split()[0],
            "checks_total": len(checks),
            "checks_passed": len(checks) - len(failed),
            "checks_failed": len(failed),
            "source_audit_status": "PASS" if not failed else "FAIL",
            "runtime_gate": {
                "script": "qa/w07_environment_check.py",
                "mandatory_in": ["setup_windows.bat", "run_w07_qa.bat", "run_with_ml.bat", "run_api_tests.bat", "run_tests.bat", "03_H19_E2E_FREEZE.cmd"],
                "execution_scope": "Target .venv only; use run_w07_qa.bat to generate environment_check_results.json",
                "status": "SOURCE_WIRING_VERIFIED_NOT_EXECUTED_BY_STATIC_AUDIT"
            },
            "protected_file_count": len(protected_results),
            "protected_file_matches": sum(1 for item in protected_results if item["passed"]),
            "protected_files": protected_results,
            "checks": checks,
            "scope_note": "Static source and freeze audit only. Live CORE4 inference, Windows behavior and business UAT are separate acceptance activities."
        }
        output = RESULT_DIR / "overall_qa_results.json"
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        text_lines = [f"W07 Overall QA: {result['source_audit_status']}",
                      f"Static checks: {result['checks_passed']}/{result['checks_total']} PASS; {result['checks_failed']} FAIL",
                      f"Protected H16 files: {result['protected_file_matches']}/{result['protected_file_count']} MATCH",
                      "Runtime compatibility: strict gate is wired into Windows setup, W07 QA, API tests, full test runner, H19 freeze and ML launcher; execute in target .venv."]
        text_lines += [f"{'PASS' if item['status']=='PASS' else 'FAIL'} | {item['name']} | {item['detail']}" for item in checks]
        (RESULT_DIR / "overall_qa_results.txt").write_text("\n".join(text_lines) + "\n", encoding="utf-8")

        print("\n".join(text_lines))
        return 1 if failed else 0

    except Exception as exc:  # produce an actionable failure instead of a traceback-only result
        print(f"W07 overall audit failed to execute: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

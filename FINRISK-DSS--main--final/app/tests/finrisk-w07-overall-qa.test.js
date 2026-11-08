"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(APP, relative), "utf8");
const app = read("src/app.js");
const i18n = read("src/i18n.js");
const html = read("index.html");
const css = read("assets/styles.css");
const server = read("backend_api/server.py");
const simulation = read("src/finrisk-simulation.js");
const decision = read("src/finrisk-decision-engine.js");
const reports = read("src/finrisk-report-history.js");
const setup = read("setup_windows.bat");
const runner = read("run_w07_qa.bat");
const mlLauncher = read("run_with_ml.bat");
const apiLauncher = read("run_api_tests.bat");
const fullTestLauncher = read("run_tests.bat");
const h19FreezeLauncher = read("03_H19_E2E_FREEZE.cmd");
const runtimeGate = read("qa/w07_environment_check.py");

function screenIds() {
  const block = app.match(/const screens\s*=\s*\[([\s\S]*?)\n\s*\];/);
  assert.ok(block, "navigation screen declaration exists");
  return [...block[1].matchAll(/\["([a-z0-9_-]+)"\s*,/g)].map((match) => match[1]);
}

test("W07: navigation contains the six W01-W06 workspaces and retains legacy demo screens", () => {
  const ids = screenIds();
  for (const id of ["overview", "customer", "data", "simulation", "decision", "reports"]) {
    assert.ok(ids.includes(id), `missing screen ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, "screen IDs must be unique");
  assert.equal(ids.length, 13, "the released workspace contains 13 registered screens");
});

test("W07: every navigation screen has a renderer", () => {
  const block = app.match(/const renderers\s*=\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(block, "renderer registry exists");
  const rendered = [...block[1].matchAll(/^\s*([a-z0-9_-]+):\s*render[A-Za-z0-9_]+,?\s*$/gm)].map((m) => m[1]);
  for (const id of screenIds()) assert.ok(rendered.includes(id), `renderer missing for ${id}`);
});

test("W07: all W02-W06 browser modules load before app initialization", () => {
  const modules = [
    "src/finrisk-simulation.js",
    "src/finrisk-decision-engine.js",
    "src/finrisk-report-history.js"
  ];
  const appIndex = html.indexOf('src="src/app.js"');
  assert.ok(appIndex > 0, "app.js is loaded");
  for (const modulePath of modules) {
    const index = html.indexOf(`src="${modulePath}"`);
    assert.ok(index >= 0 && index < appIndex, `${modulePath} must load before app.js`);
  }
  assert.ok(html.indexOf('src="src/i18n.js"') > appIndex, "i18n observer initializes after app DOM creation");
});

test("W07: W02 exposes exactly 38 CORE4 fields through a read-only allowlist", () => {
  const block = server.match(/CUSTOMER_PROFILE_FIELDS\s*=\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, "CORE4 profile allowlist exists");
  const groups = [...block[1].matchAll(/"[a-z0-9_]+":\s*\(([\s\S]*?)\),/g)];
  const fields = groups.flatMap((group) => [...group[1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
  assert.equal(fields.length, 38);
  assert.equal(new Set(fields).size, 38);
  assert.match(server, /"read_only":\s*True/);
  assert.match(server, /if\s+split\s*==\s*["']test["']:[\s\S]*?403/);
});

test("W07: W04 supports both repayment methods and a zero-interest case without backend inference", () => {
  assert.match(simulation, /annuity:\s*["']annuity["']/);
  assert.match(simulation, /equalPrincipal:\s*["']equal_principal["']/);
  assert.match(simulation, /monthlyRate\s*===\s*0/);
  assert.match(simulation, /calculateReferenceCashflow/);
  assert.doesNotMatch(simulation, /fetch\s*\(/);
});

test("W07: W05 validates H18 signals and fails closed on unapproved policy or generated loan terms", () => {
  assert.match(decision, /automatic_credit_decision\s*!==\s*false/);
  assert.match(decision, /business_policy_status\s*!==\s*["']NOT_APPROVED["']/);
  assert.match(decision, /NO_REVIEW_SIGNAL/);
  assert.match(decision, /MANUAL_REVIEW_RECOMMENDED/);
  for (const field of ["recommended_amount", "recommended_term_months", "interest_rate", "monthly_payment"]) {
    assert.ok(decision.includes(`"${field}"`), `W05 must guard ${field}`);
  }
});

test("W07: W05 tab label has the approved VI/EN translation pair", () => {
  assert.match(app, /\["decision",\s*"Bộ máy hỗ trợ quyết định"/);
  assert.match(i18n, /"Bộ máy hỗ trợ quyết định"\s*:\s*"Decision Engine"/);
});

test("W07: W06 reads the W02 profile before requesting the H18 assessment", () => {
  const start = app.indexOf("function renderReportHistory()");
  const end = app.indexOf("\n  const renderers =", start);
  assert.ok(start >= 0 && end > start, "W06 render function exists");
  const block = app.slice(start, end);
  const profileIndex = block.indexOf("/api/customer/profile?");
  const decisionIndex = block.indexOf("/api/decision/assess?");
  assert.ok(profileIndex >= 0 && decisionIndex > profileIndex, "CORE4 profile must be fetched first");
  assert.match(block, /profileResponse\.ok/);
  assert.match(block, /decisionResponse\.ok/);
});

test("W07: W06 history is browser-local, explicit-save, and bounded to 50 records", () => {
  assert.match(reports, /finrisk\.w06\.report-history\.v1/);
  assert.match(reports, /const MAX_RECORDS\s*=\s*50/);
  assert.match(reports, /function save\(/);
  assert.match(reports, /localStorage|storage\.setItem/);
  assert.match(app, /w06-save-report/);
  assert.match(app, /engine\.save\(currentReport,\s*window\.localStorage\)/);
});

test("W07: W06 export supports JSON and escaped HTML with explicit non-decision guardrails", () => {
  assert.match(reports, /JSON\.stringify/);
  assert.match(reports, /text\/html|<!doctype html/i);
  assert.match(reports, /officialCreditDecisionIssued:\s*false/);
  assert.match(reports, /businessPolicyApproved:\s*false/);
  assert.match(reports, /recommendedAmount:\s*null/);
  assert.match(reports, /interestRate:\s*null/);
});

test("W07: W06 and W02 navigation labels have VI/EN translations", () => {
  for (const pair of [
    [/"Hồ sơ khách hàng"\s*:\s*"Customer profile"/, "W02"],
    [/"Mô phỏng khoản vay"\s*:\s*"Loan simulation"/, "W04"],
    [/"Bộ máy hỗ trợ quyết định"\s*:\s*"Decision Engine"/, "W05"],
    [/"Báo cáo & lịch sử"\s*:\s*"Reports & history"/, "W06"]
  ]) assert.match(i18n, pair[0], `${pair[1]} navigation translation missing`);
});

test("W07: W02/W04/W05/W06 have scoped responsive rules for mobile and tablet widths", () => {
  for (const selector of [".finrisk-customer-profile", ".finrisk-w04-screen", ".finrisk-w05-screen", ".finrisk-w06-screen"]) {
    assert.ok(css.includes(selector), `${selector} styles missing`);
  }
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
});

test("W07: backend binds to loopback by default and warns when network binding is enabled", () => {
  assert.match(server, /FINRISK_HOST",\s*"127\.0\.0\.1"/);
  assert.match(server, /no authentication/i);
  assert.match(server, /never expose it to the internet/i);
});


test("W07: Windows setup selects CPython 3.14 and safely backs up an incompatible virtual environment", () => {
  assert.match(setup, /py -3\.14 -m venv \.venv/);
  assert.match(setup, /\.venv_backup/);
  assert.match(setup, /--only-binary=:all:/);
  assert.match(setup, /qa\\w07_environment_check\.py/);
  assert.doesNotMatch(setup, /py -3\.12 -m venv \.venv/);
});

test("W07: environment compatibility gate checks all lock pins and blocks sklearn version warnings", () => {
  for (const token of ["requirements-lock.txt", "sys.version_info", "sys.platform", "win32", "pip", "pyarrow", "Parquet", "InconsistentVersionWarning", "pipeline.joblib", "169"]) {
    assert.ok(runtimeGate.includes(token), `runtime gate must check ${token}`);
  }
});

test("W07: ML, API, full-test and H19 launchers require the strict runtime preflight", () => {
  for (const [name, content] of [
    ["W07 runner", runner],
    ["ML launcher", mlLauncher],
    ["API launcher", apiLauncher],
    ["full test launcher", fullTestLauncher],
    ["H19 freeze launcher", h19FreezeLauncher]
  ]) {
    assert.ok(content.includes("qa\\w07_environment_check.py"), `${name} bypasses the runtime gate`);
  }
  assert.ok(runner.indexOf("qa\\w07_environment_check.py") < runner.indexOf("node --test"));
  assert.ok(mlLauncher.indexOf("qa\\w07_environment_check.py") < mlLauncher.indexOf("backend_api\\server.py"));
  assert.ok(apiLauncher.indexOf("qa\\w07_environment_check.py") < apiLauncher.indexOf("backend_api.test_server"));
  assert.ok(fullTestLauncher.indexOf("qa\\w07_environment_check.py") < fullTestLauncher.indexOf("node --test"));
  assert.ok(h19FreezeLauncher.indexOf("qa\\w07_environment_check.py") < h19FreezeLauncher.indexOf("verify_h19.py"));
});

test("W07: full regression runner fails instead of silently skipping the Python gate", () => {
  assert.match(fullTestLauncher, /if not exist ".venv\\Scripts\\python\.exe"/);
  assert.doesNotMatch(fullTestLauncher, /Python API tests were not run because \.venv is missing/);
});


test("W07: setup_windows.bat does not use unescaped parentheses in the IF-block launcher error", () => {
  assert.match(setup, /echo \[FAIL\] Python Launcher py\.exe was not found\./);
  assert.doesNotMatch(setup, /echo \[FAIL\] Python Launcher \(py\.exe\) was not found\./);
});

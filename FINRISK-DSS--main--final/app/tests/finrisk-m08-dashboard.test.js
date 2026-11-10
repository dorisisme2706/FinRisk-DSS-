"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const APP = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(APP, relative), "utf8");

test("M08.4 dashboard uses the live summary API instead of seeded KPI values", () => {
  const source = read("src/app.js");
  assert.match(source, /fetch\("\/api\/dashboard\/summary"/);
  assert.match(source, /fr-kpi-applications/);
  assert.match(source, /fr-kpi-validations/);
  assert.match(source, /fr-kpi-assessments/);
  assert.match(source, /fr-kpi-reports/);
  assert.doesNotMatch(source, /1\.248|68,4%|18,2%|13,4%|854 hồ sơ \(giả lập\)/);
});

test("Dashboard does not show zero when trusted actor scope is unavailable", () => {
  const source = read("src/app.js");
  assert.match(source, /AUTH_CONTEXT_REQUIRED/);
  assert.match(source, /No fabricated zero|số 0 giả/);
  assert.match(source, /Number\.isFinite\(value\)/);
});

test("M08.4 keeps operational data separate from read-only CORE4/H16", () => {
  const source = read("src/app.js");
  const backend = read("backend_api/server.py");
  assert.match(source, /CORE4 \/ H16/);
  assert.match(source, /PostgreSQL/);
  assert.match(backend, /"source": "CORE4\/H16"/);
  assert.match(backend, /"read_only": True/);
  assert.match(source, /Không đưa test split vào KPI Dashboard/);
});

test("Dashboard excludes approval and high-risk mock KPIs", () => {
  const source = read("src/app.js");
  const dashboard = source.split('id="finrisk-kpi-dashboard"', 2)[1].split("</section>", 1)[0];
  assert.doesNotMatch(dashboard, /Tỷ lệ phê duyệt|Approval rate|Rủi ro cao|High risk/i);
  assert.match(dashboard, /NOT_APPROVED/);
});

test("Data Management screen reports backend health and labels legacy local mock data", () => {
  const source = read("src/app.js");
  assert.match(source, /fr-data-health-details/);
  assert.match(source, /fr-data-refresh/);
  assert.match(source, /Dữ liệu MOCK cục bộ/);
  assert.match(source, /không phải PostgreSQL/);
});

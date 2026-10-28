"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const CGState = require("../src/state.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");
const releaseEngine = require("../src/release-engine.js");
const reportEngine = require("../src/report-engine.js");

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

function store() {
  return CGState.createStore(baseline, { validationEngine, graphEngine, releaseEngine });
}

function report(state = store().getState()) {
  return reportEngine.buildReport(state, { generatedAt: "2026-08-21T00:00:00.000Z" });
}

run("C7 report is explicitly working-only and synthetic", () => {
  const value = report();
  assert.strictEqual(value.reportType, "CARBONGRAPH_WORKING_STATUS_REPORT");
  assert.strictEqual(value.reportStatus, "WORKING_ONLY");
  assert.strictEqual(value.guardrails.dataOrigin, "SYNTHETIC_DEMO");
  assert.strictEqual(value.guardrails.officialFiling, false);
});

run("C7 report keeps R-006 open and numeric output excluded", () => {
  const value = report();
  assert.strictEqual(value.guardrails.r006Status, "OPEN");
  assert.strictEqual(value.guardrails.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(value.guardrails.resultVisibility, "MASKED");
  assert.strictEqual(value.guardrails.embeddedEmissionNumeric, "NOT_INCLUDED");
  assert.strictEqual(value.precursorEmissionData.numericDataIncluded, false);
});

run("candidate CN8 remains separate from real CN8", () => {
  const value = report();
  assert.strictEqual(value.classification.candidateCn8, "72083800");
  assert.strictEqual(value.classification.candidateSourceClass, "SYNTHETIC");
  assert.strictEqual(value.classification.realCn8, null);
});

run("HTML export contains guardrails and no emission unit/value field", () => {
  const html = reportEngine.renderHtml(report());
  assert.match(html, /Working Status Report/);
  assert.match(html, /SYNTHETIC_DEMO/);
  assert.match(html, /R-006 OPEN/);
  assert.match(html, /NOT_INCLUDED/);
  assert.doesNotMatch(html, /tCO2e/i);
  assert.doesNotMatch(html, /numericValue/);
});

run("JSON export excludes release numericValue and SEE value", () => {
  const json = reportEngine.renderJson(report());
  assert.doesNotMatch(json, /"numericValue"/);
  assert.doesNotMatch(json, /"seeDirect"/);
  assert.doesNotMatch(json, /tCO2e/i);
});

run("validation issues propagate into the working report", () => {
  const s = store();
  s.applyInput({ widthMm: "" });
  const value = report(s.getState());
  assert.ok(value.validation.issues.some((item) => item.issueId === "VAL-C3-WIDTH"));
  assert.strictEqual(value.classification.candidateCn8, null);
});

run("C7 fails closed if R-006 is not OPEN", () => {
  const state = store().getState();
  state.meta.r006Status = "CLOSED";
  assert.throws(() => reportEngine.buildReport(state), /R-006 giữ OPEN/);
});

run("download filenames are trace-based and local-safe", () => {
  const value = report();
  assert.strictEqual(reportEngine.fileName(value, "html"), "CarbonGraph_Working_Report_TRACE-REL-DEMO-001.html");
  assert.strictEqual(reportEngine.fileName(value, "json"), "CarbonGraph_Trace_TRACE-REL-DEMO-001.json");
});

console.log("\nAll C7 working-export tests passed.");

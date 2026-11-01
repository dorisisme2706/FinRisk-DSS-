"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const CGState = require("../src/state.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");
const releaseEngine = require("../src/release-engine.js");
const reportEngine = require("../src/report-engine.js");
const e2eEngine = require("../src/e2e-engine.js");

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

function store() {
  return CGState.createStore(baseline, { validationEngine, graphEngine, releaseEngine });
}

run("initial pipeline derives validation, graph and release", () => {
  const state = store().getState();
  assert.strictEqual(state.precursor.candidateCn8.value, "72083800");
  assert.strictEqual(state.graphSummary.integrityStatus, "PASS");
  assert.strictEqual(state.release.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(state.release.resultVisibility, "MASKED");
});

run("changing batch rebuilds dynamic graph in same transaction", () => {
  const s = store();
  s.applyInput({ batchId: "BATCH-SYN-222" });
  const state = s.getState();
  assert.ok(state.graph.nodes.some((n) => n.id === "BATCH-SYN-222"));
  assert.ok(state.graph.edges.some((e) => e.relation === "DERIVED_FROM" && e.to === "BATCH-SYN-222"));
  assert.strictEqual(state.graphSummary.integrityStatus, "PASS");
});

run("missing width propagates Input -> Validation -> Graph -> Release", () => {
  const s = store();
  s.applyInput({ widthMm: "" });
  const state = s.getState();
  assert.strictEqual(state.precursor.widthMm, null);
  assert.ok(state.validation.some((x) => x.issueId === "VAL-C3-WIDTH"));
  assert.ok(state.graph.nodes.some((n) => n.id === "VAL-C3-WIDTH"));
  assert.strictEqual(state.release.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(state.release.numericValue, null);
});

run("working state reaches C7 export with numeric result excluded", () => {
  const state = store().getState();
  const report = reportEngine.buildReport(state, { generatedAt: "PIPELINE_TEST" });
  assert.strictEqual(report.guardrails.embeddedEmissionNumeric, "NOT_INCLUDED");
  assert.strictEqual(report.release.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(report.release.resultVisibility, "MASKED");
});

run("C8 confirms technical flow without claiming compliance acceptance", () => {
  const result = e2eEngine.evaluate(store().getState());
  assert.strictEqual(result.pipelineStatus, "SAFE_WORKING_FLOW_PASS");
  assert.strictEqual(result.complianceStatus, "NOT_EVALUATED");
  assert.strictEqual(result.numericEmissionStatus, "BLOCKED");
});

console.log("\nAll v0.6 end-to-end derived-state tests passed.");

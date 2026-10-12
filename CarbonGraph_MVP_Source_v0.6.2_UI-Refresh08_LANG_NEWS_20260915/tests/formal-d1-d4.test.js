"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const CGState = require("../src/state.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");
const releaseEngine = require("../src/release-engine.js");
const reportEngine = require("../src/report-engine.js");

function store() { return CGState.createStore(baseline, { validationEngine, graphEngine, releaseEngine }); }
function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("D1 baseline scope and schema guardrails are testable", () => {
  const state = store().getState();
  assert.strictEqual(state.meta.dataOrigin, "SYNTHETIC_DEMO");
  assert.strictEqual(state.meta.r006Status, "OPEN");
  assert.ok(state.batch.batchId && state.batch.hrcLotId);
});

run("D2 non-numeric reconciliation keeps candidate and real classification separate", () => {
  const report = reportEngine.buildReport(store().getState(), { generatedAt: "FORMAL_D2" });
  assert.strictEqual(report.classification.candidateSourceClass, "SYNTHETIC");
  assert.strictEqual(report.classification.realCn8, null);
  assert.strictEqual(report.precursorEmissionData.numericDataIncluded, false);
});

run("D3 negative input becomes MISSING instead of zero or accepted", () => {
  const current = store();
  current.applyInput({ widthMm: "" });
  const state = current.getState();
  assert.strictEqual(state.precursor.widthMm, null);
  assert.ok(state.validation.some((item) => item.issueId === "VAL-C3-WIDTH" && item.status === "MISSING"));
  assert.strictEqual(state.release.numericReleaseStatus, "BLOCKED");
});

run("D4 trace has complete core relations and no orphan edge", () => {
  const state = store().getState();
  ["INSTANCE_OF", "CONSUMES", "IS_LOT_OF", "DERIVED_FROM", "HAS_TRACE", "VALIDATED_BY", "GATED_BY"].forEach((relation) => {
    assert.ok(state.graph.edges.some((item) => item.relation === relation), relation);
  });
  assert.strictEqual(state.graphSummary.orphanCount, 0);
  assert.strictEqual(state.graphSummary.integrityStatus, "PASS");
});

run("D4 working export preserves trace while redacting numeric emissions", () => {
  const report = reportEngine.buildReport(store().getState(), { generatedAt: "FORMAL_D4" });
  assert.ok(report.graph.traceId);
  assert.strictEqual(report.release.resultVisibility, "MASKED");
  assert.strictEqual(report.guardrails.embeddedEmissionNumeric, "NOT_INCLUDED");
});

console.log("\nAll formal D1-D4 boundary tests passed.");

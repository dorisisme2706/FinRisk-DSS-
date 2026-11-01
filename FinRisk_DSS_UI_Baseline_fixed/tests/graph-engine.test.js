"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

function derivedState(input = baseline) {
  const state = clone(input);
  const validation = validationEngine.evaluate(state);
  state.validation = validation.issues;
  state.validationSummary = validation.summary;
  state.precursor.candidateCn8 = validation.candidateCn8;
  return state;
}

run("baseline dynamic graph has PASS integrity", () => {
  const result = graphEngine.build(derivedState());
  assert.strictEqual(result.summary.integrityStatus, "PASS");
  assert.strictEqual(result.summary.orphanCount, 0);
  assert.ok(result.nodes.some((n) => n.id === "BATCH-SYN-001"));
  assert.ok(result.edges.some((e) => e.from === "RESULT-DEMO-001" && e.relation === "VALIDATED_BY" && e.to === "VR-018"));
});

run("working batch identity replaces baseline batch node", () => {
  const state = derivedState();
  state.batch.batchId = "BATCH-SYN-099";
  const result = graphEngine.build(state);
  assert.ok(result.nodes.some((n) => n.id === "BATCH-SYN-099"));
  assert.ok(!result.nodes.some((n) => n.id === "BATCH-SYN-001" && n.type === "BATCH"));
  assert.ok(result.edges.some((e) => e.from === "RESULT-DEMO-001" && e.to === "BATCH-SYN-099" && e.relation === "DERIVED_FROM"));
});

run("working HRC lot identity rebuilds CONSUMES and IS_LOT_OF edges", () => {
  const state = derivedState();
  state.batch.hrcLotId = "HRCLOT-SYN-099";
  const result = graphEngine.build(state);
  assert.ok(result.edges.some((e) => e.relation === "CONSUMES" && e.to === "HRCLOT-SYN-099"));
  assert.ok(result.edges.some((e) => e.relation === "IS_LOT_OF" && e.from === "HRCLOT-SYN-099"));
});

run("validation issues become graph nodes linked to their rule", () => {
  const state = derivedState();
  const result = graphEngine.build(state);
  assert.ok(result.nodes.some((n) => n.id === "VAL-C3-RELEASE" && n.type === "VALIDATION_ISSUE"));
  assert.ok(result.nodes.some((n) => n.id === "VR-018" && n.type === "RULE"));
  assert.ok(result.edges.some((e) => e.from === "VAL-C3-RELEASE" && e.to === "VR-018" && e.relation === "VIOLATES_RULE"));
  assert.ok(result.edges.some((e) => e.from === "RESULT-DEMO-001" && e.to === "VR-018" && e.relation === "VALIDATED_BY"));
});

run("blank batch causes graph REVIEW instead of fabricating an identity", () => {
  const state = derivedState();
  state.batch.batchId = "";
  const validation = validationEngine.evaluate(state);
  state.validation = validation.issues;
  state.validationSummary = validation.summary;
  const result = graphEngine.build(state);
  assert.strictEqual(result.summary.integrityStatus, "REVIEW");
  assert.ok(result.summary.missingCoreRelations.includes("INSTANCE_OF"));
});

console.log("\nAll C5 graph-engine tests passed.");

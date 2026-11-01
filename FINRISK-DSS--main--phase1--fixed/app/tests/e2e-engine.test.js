"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const CGState = require("../src/state.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");
const releaseEngine = require("../src/release-engine.js");
const e2eEngine = require("../src/e2e-engine.js");

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

function store() {
  return CGState.createStore(baseline, { validationEngine, graphEngine, releaseEngine });
}

run("C8 baseline completes the safe working flow", () => {
  const result = e2eEngine.evaluate(store().getState());
  assert.strictEqual(result.pipelineStatus, "SAFE_WORKING_FLOW_PASS");
  assert.strictEqual(result.complianceStatus, "NOT_EVALUATED");
  assert.strictEqual(result.numericEmissionStatus, "BLOCKED");
  assert.strictEqual(result.r006Status, "OPEN");
  assert.ok(result.checks.every((item) => item.status === "PASS"));
});

run("missing width is processed end-to-end without releasing numeric output", () => {
  const s = store();
  s.applyInput({ widthMm: "" });
  const state = s.getState();
  const result = e2eEngine.evaluate(state);
  assert.strictEqual(result.pipelineStatus, "SAFE_WORKING_FLOW_PASS");
  assert.ok(state.validation.some((item) => item.issueId === "VAL-C3-WIDTH"));
  assert.strictEqual(state.release.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(state.release.numericValue, null);
});

run("broken graph integrity changes C8 to REVIEW", () => {
  const s = store();
  s.applyInput({ batchId: "" });
  const result = e2eEngine.evaluate(s.getState());
  assert.strictEqual(result.pipelineStatus, "REVIEW");
  assert.strictEqual(result.checks.find((item) => item.id === "C8-04").status, "REVIEW");
});

run("R-006 closure is refused by C8 working export safety", () => {
  const state = store().getState();
  state.meta.r006Status = "CLOSED";
  const result = e2eEngine.evaluate(state);
  assert.strictEqual(result.pipelineStatus, "REVIEW");
  assert.strictEqual(result.checks.find((item) => item.id === "C8-02").status, "REVIEW");
  assert.strictEqual(result.checks.find((item) => item.id === "C8-06").status, "REVIEW");
});

console.log("\nAll C8 local end-to-end safety tests passed.");

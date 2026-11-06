"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const validationEngine = require("../src/validation-engine.js");
const graphEngine = require("../src/graph-engine.js");
const releaseEngine = require("../src/release-engine.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

function prepare(state) {
  const validation = validationEngine.evaluate(state);
  state.validation = validation.issues;
  state.validationSummary = validation.summary;
  state.precursor.candidateCn8 = validation.candidateCn8;
  const graph = graphEngine.build(state);
  state.graph = { nodes: graph.nodes, edges: graph.edges };
  state.graphSummary = graph.summary;
  return state;
}

run("synthetic baseline is always BLOCKED and MASKED", () => {
  const result = releaseEngine.evaluate(prepare(clone(baseline)));
  assert.strictEqual(result.numericReleaseStatus, "BLOCKED");
  assert.strictEqual(result.resultVisibility, "MASKED");
  assert.strictEqual(result.numericValue, null);
  assert.ok(result.reasons.some((x) => x.code === "REL-SYNTHETIC"));
  assert.ok(result.reasons.some((x) => x.code === "REL-R006"));
});

run("validation release blockers appear in release reasons", () => {
  const state = clone(baseline);
  state.precursor.widthMm = null;
  const result = releaseEngine.evaluate(prepare(state));
  assert.ok(result.reasons.some((x) => x.code === "REL-VALIDATION"));
});

run("graph REVIEW becomes an explicit release blocker", () => {
  const state = prepare(clone(baseline));
  state.graphSummary.integrityStatus = "REVIEW";
  const result = releaseEngine.evaluate(state);
  assert.ok(result.reasons.some((x) => x.code === "REL-GRAPH"));
});

run("C6 never invents numeric emissions", () => {
  const result = releaseEngine.evaluate(prepare(clone(baseline)));
  assert.strictEqual(result.numericValue, null);
});

console.log("\nAll C6 release-engine tests passed.");

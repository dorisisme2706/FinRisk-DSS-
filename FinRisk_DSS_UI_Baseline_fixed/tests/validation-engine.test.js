"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const engine = require("../src/validation-engine.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasIssue(result, issueId) {
  return result.issues.some((x) => x.issueId === issueId);
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

run("baseline synthetic branch returns candidate 72083800", () => {
  const result = engine.evaluate(clone(baseline));
  assert.strictEqual(result.candidateCn8.value, "72083800");
  assert.strictEqual(result.candidateCn8.label, "SYNTHETIC_CANDIDATE");
});

run("missing width creates blocker and removes candidate", () => {
  const state = clone(baseline);
  state.precursor.widthMm = null;
  const result = engine.evaluate(state);
  assert.strictEqual(result.candidateCn8.value, null);
  assert.ok(hasIssue(result, "VAL-C3-WIDTH"));
  assert.ok(result.summary.candidateBlocked);
});

run("pickled branch returns candidate 72082600", () => {
  const state = clone(baseline);
  state.precursor.surfaceState = "PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF";
  const result = engine.evaluate(state);
  assert.strictEqual(result.candidateCn8.value, "72082600");
});

run("coated branch remains REVIEW and does not invent CN8", () => {
  const state = clone(baseline);
  state.precursor.surfaceState = "MILL_FINISH|NOT_PICKLED|COATED|NO_RELIEF";
  const result = engine.evaluate(state);
  assert.strictEqual(result.candidateCn8.value, null);
  assert.strictEqual(result.candidateCn8.label, "UNSUPPORTED_BRANCH");
  assert.ok(hasIssue(result, "VAL-C3-BRANCH-SURFACE"));
});

run("width below 600 is explicitly unsupported instead of guessed", () => {
  const state = clone(baseline);
  state.precursor.widthMm = 500;
  const result = engine.evaluate(state);
  assert.strictEqual(result.candidateCn8.value, null);
  assert.ok(hasIssue(result, "VAL-C3-BRANCH-7211"));
});

run("thickness outside tested branch stays REVIEW", () => {
  const state = clone(baseline);
  state.precursor.thicknessMm = 5;
  const result = engine.evaluate(state);
  assert.strictEqual(result.candidateCn8.value, null);
  assert.ok(hasIssue(result, "VAL-C3-BRANCH-THICKNESS"));
});

run("invalid origin produces validation error", () => {
  const state = clone(baseline);
  state.precursor.origin = "X";
  const result = engine.evaluate(state);
  assert.ok(hasIssue(result, "VAL-C3-ORIGIN"));
  assert.ok(result.summary.ERROR >= 1);
});

run("baseline governance keeps release blocked", () => {
  const result = engine.evaluate(clone(baseline));
  assert.ok(hasIssue(result, "VAL-C3-RELEASE"));
  assert.ok(hasIssue(result, "VAL-C3-SOURCE-SEGREGATION"));
  assert.ok(hasIssue(result, "VAL-C3-REAL-CN"));
  assert.ok(hasIssue(result, "VAL-C3-SEE"));
  assert.strictEqual(result.summary.releaseBlocked, true);
});

console.log("\nAll C3 validation-engine tests passed.");

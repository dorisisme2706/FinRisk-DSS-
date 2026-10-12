"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const CGState = require("../src/state.js");
const validationEngine = require("../src/validation-engine.js");

function run(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

function store() {
  return CGState.createStore(baseline, { validationEngine });
}

run("normalizeId uppercases and removes unsupported characters", () => {
  assert.strictEqual(CGState.normalizeId(" batch syn 002! "), "BATCH-SYN-002");
});

run("blank numeric input remains null and never becomes zero", () => {
  assert.strictEqual(CGState.normalizeNullableNumber(""), null);
});

run("origin is normalized to ISO2 working format", () => {
  assert.strictEqual(CGState.normalizeIso2(" vn "), "VN");
});

run("data_origin cannot be changed through C2 input patch", () => {
  assert.throws(() => store().applyInput({ dataOrigin: "ACTUAL" }), /Locked or unsupported field/);
});

run("batch identity changes are stored in working state", () => {
  const s = store();
  s.applyInput({ batchId: "batch syn 002" });
  assert.strictEqual(s.getState().batch.batchId, "BATCH-SYN-002");
});

run("C3 automatically reclassifies baseline-compatible width change", () => {
  const s = store();
  s.applyInput({ widthMm: "1490" });
  const current = s.getState();
  assert.strictEqual(current.precursor.widthMm, 1490);
  assert.strictEqual(current.precursor.candidateCn8.value, "72083800");
  assert.strictEqual(current.precursor.candidateCn8.reason, "C3_RULE_ENGINE_NOT_PICKLED_BRANCH");
});

run("blank width is stored as null and C3 removes candidate", () => {
  const s = store();
  s.applyInput({ widthMm: "" });
  const current = s.getState();
  assert.strictEqual(current.precursor.widthMm, null);
  assert.strictEqual(current.precursor.candidateCn8.value, null);
  assert.ok(current.validation.some((x) => x.issueId === "VAL-C3-WIDTH"));
});

run("pickled input is reclassified by C3", () => {
  const s = store();
  s.applyInput({ surfaceState: "PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF" });
  assert.strictEqual(s.getState().precursor.candidateCn8.value, "72082600");
});

run("reset restores synthetic baseline and revalidates", () => {
  const s = store();
  s.applyInput({ widthMm: "" });
  s.reset();
  const current = s.getState();
  assert.strictEqual(current.precursor.widthMm, baseline.precursor.widthMm);
  assert.strictEqual(current.precursor.candidateCn8.value, "72083800");
});

console.log("\nAll C2/C3 state integration tests passed.");

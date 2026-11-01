"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const engine = require("../src/validation-engine.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hasIssue(result, issueId) { return result.issues.some((item) => item.issueId === issueId); }
function hasRule(result, ruleId) { return result.issues.some((item) => item.rule === ruleId); }
function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("T-VAL-001 rejects missing or duplicate official identifiers", () => {
  const missing = clone(baseline);
  missing.scope.facilityId = "";
  assert.ok(hasIssue(engine.evaluate(missing), "VAL-VR001-MISSING-FACILITY_ID"));

  const duplicate = clone(baseline);
  duplicate.meta.traceId = duplicate.meta.datasetId;
  assert.ok(hasIssue(engine.evaluate(duplicate), "VAL-VR001-DUPLICATE-ID"));
});

run("T-VAL-002 blocks values outside the locked MVP scope", () => {
  const state = clone(baseline);
  state.scope.facilityId = "FAC-VN-999";
  state.scope.productDefinitionVersion = "UNCONTROLLED";
  const result = engine.evaluate(state);
  assert.ok(hasIssue(result, "VAL-VR002-OUTSIDE-MVP-SCOPE"));
  assert.strictEqual(result.summary.releaseBlocked, true);
});

run("T-VAL-003 blocks blank or different finished product CN", () => {
  for (const value of ["", "7306 30 71"]) {
    const state = clone(baseline);
    state.scope.finishedCn = value;
    assert.ok(hasIssue(engine.evaluate(state), "VAL-VR003-FINISHED-CN"));
  }
});

run("T-VAL-004 rejects invalid, reversed or out-of-2026 periods", () => {
  const cases = [
    ["2026-02-30", "2026-12-31"],
    ["2026-12-31", "2026-01-01"],
    ["2025-12-31", "2026-12-31"]
  ];
  cases.forEach(([start, end]) => {
    const state = clone(baseline);
    state.scope.periodStart = start;
    state.scope.periodEnd = end;
    assert.ok(hasIssue(engine.evaluate(state), "VAL-VR004-PERIOD"));
  });
});

run("T-VAL-005 rejects invalid optional numeric inputs without converting blanks to zero", () => {
  const state = clone(baseline);
  state.numericInputs.hrcInputMassT = 0;
  state.numericInputs.scrapMassT = -1;
  const result = engine.evaluate(state);
  assert.ok(hasIssue(result, "VAL-VR005-HRCINPUTMASST"));
  assert.ok(hasIssue(result, "VAL-VR005-SCRAPMASST"));
  assert.strictEqual(baseline.numericInputs.directEmissionsTco2e, null);
});

run("T-EVD-001 downgrades ACCEPTED evidence without reviewer approval", () => {
  const state = clone(baseline);
  state.evidence[0].realStatus = "ACCEPTED";
  const result = engine.evaluate(state);
  assert.ok(hasRule(result, "VR-011"));
  assert.strictEqual(result.issues.find((item) => item.rule === "VR-011").status, "REVIEW");
});

run("T-EVD-002 blocks a selected factor with incomplete source metadata", () => {
  const state = clone(baseline);
  state.factors[0].selectedForCalculation = true;
  state.factors[0].value = 1.23;
  const result = engine.evaluate(state);
  assert.ok(hasRule(result, "VR-012"));
  assert.strictEqual(result.summary.releaseBlocked, true);
});

run("T-TRACE-001 requires trace ID and calculation version when numeric is attempted", () => {
  const missingTrace = clone(baseline);
  missingTrace.meta.traceId = "";
  assert.ok(hasIssue(engine.evaluate(missingTrace), "VAL-VR013-TRACE-ID"));

  const numericAttempt = clone(baseline);
  numericAttempt.meta.officialCalculationPresent = true;
  assert.ok(hasIssue(engine.evaluate(numericAttempt), "VAL-VR013-CALCULATION-VERSION"));
});

run("T-DATA-001 keeps synthetic dataset REVIEW until assumptions and approval are complete", () => {
  const missingAssumptions = clone(baseline);
  missingAssumptions.meta.syntheticGovernance.assumptions = [];
  assert.ok(hasIssue(engine.evaluate(missingAssumptions), "VAL-VR016-SYNTHETIC-METADATA"));

  const prematureAcceptance = clone(baseline);
  prematureAcceptance.meta.datasetStatus = "ACCEPTED";
  assert.ok(hasIssue(engine.evaluate(prematureAcceptance), "VAL-VR016-SYNTHETIC-APPROVAL"));
});

console.log("\nAll expanded VR-001–VR-016 fail-closed tests passed.");

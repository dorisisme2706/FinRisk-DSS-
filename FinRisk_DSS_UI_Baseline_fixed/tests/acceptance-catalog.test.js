"use strict";

const assert = require("assert");
const catalog = require("../src/acceptance-catalog.js");

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("UAT catalog has ten unique executable cases", () => {
  assert.strictEqual(catalog.cases.length, 10);
  assert.strictEqual(new Set(catalog.cases.map((item) => item.id)).size, 10);
});

run("every UAT case contains sample, steps, pass, fail, fix and evidence", () => {
  catalog.cases.forEach((item) => {
    ["sampleInput", "steps", "expected", "failSymptoms", "fixes"].forEach((field) => {
      assert.ok(Array.isArray(item[field]) && item[field].length > 0, `${item.id}.${field}`);
    });
    assert.ok(item.evidence.length > 0, `${item.id}.evidence`);
  });
});

run("catalog covers D1, D3, D4, D5 and C9 without claiming D2 numeric acceptance", () => {
  const scope = catalog.cases.map((item) => item.workItem).join("/");
  ["D1", "D3", "D4", "D5", "C9"].forEach((id) => assert.match(scope, new RegExp(id)));
  assert.doesNotMatch(scope, /D2/);
});

run("catalog-level guardrails remain synthetic open and blocked", () => {
  assert.strictEqual(catalog.dataset, "SYNTHETIC_DEMO");
  assert.strictEqual(catalog.r006Status, "OPEN");
  assert.strictEqual(catalog.numericEmissionStatus, "BLOCKED");
});

console.log("\nAll UAT catalog tests passed.");

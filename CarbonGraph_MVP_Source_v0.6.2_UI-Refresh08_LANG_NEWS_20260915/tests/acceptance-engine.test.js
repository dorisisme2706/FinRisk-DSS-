"use strict";

const assert = require("assert");
const catalog = require("../src/acceptance-catalog.js");
const engine = require("../src/acceptance-engine.js");

function fakeStorage() {
  const map = new Map();
  return {
    setItem(key, value) { map.set(key, String(value)); },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    removeItem(key) { map.delete(key); }
  };
}

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("new manual review starts incomplete with all cases NOT_RUN", () => {
  const summary = engine.summary(catalog, engine.empty(catalog));
  assert.strictEqual(summary.NOT_RUN, 10);
  assert.strictEqual(summary.reviewStatus, "REVIEW_INCOMPLETE");
});

run("one PASS cannot complete manual review", () => {
  let records = engine.empty(catalog);
  records = engine.setResult(catalog, records, "UAT-01", "PASS", "Observed", "2026-08-22T00:00:00.000Z");
  const summary = engine.summary(catalog, records);
  assert.strictEqual(summary.PASS, 1);
  assert.strictEqual(summary.reviewStatus, "REVIEW_INCOMPLETE");
});

run("REVIEW_COMPLETE requires all ten cases PASS", () => {
  let records = engine.empty(catalog);
  catalog.cases.forEach((item) => {
    records = engine.setResult(catalog, records, item.id, "PASS", "evidence", "2026-08-22T00:00:00.000Z");
  });
  assert.strictEqual(engine.summary(catalog, records).reviewStatus, "REVIEW_COMPLETE");
});

run("manual record persists independently and rejects corrupt payload", () => {
  const storage = fakeStorage();
  let records = engine.empty(catalog);
  records = engine.setResult(catalog, records, "UAT-02", "FAIL", "Browser blocked storage", "2026-08-22T00:00:00.000Z");
  assert.strictEqual(engine.save(catalog, records, storage), true);
  assert.strictEqual(engine.load(catalog, storage)["UAT-02"].status, "FAIL");
  storage.setItem(engine.STORAGE_KEY, "{bad-json");
  assert.strictEqual(engine.load(catalog, storage)["UAT-02"].status, "NOT_RUN");
  assert.strictEqual(engine.saveReviewer("  Minh   Thư  ", storage), true);
  assert.strictEqual(engine.loadReviewer(storage), "Minh Thư");
});

run("manual export cannot close R-006 or approve compliance/Gate", () => {
  let records = engine.empty(catalog);
  catalog.cases.forEach((item) => {
    records = engine.setResult(catalog, records, item.id, "PASS", "evidence", "2026-08-22T00:00:00.000Z");
  });
  assert.strictEqual(engine.isExportReady(catalog, records, ""), false);
  assert.strictEqual(engine.isExportReady(catalog, records, "TESTER"), true);
  const record = engine.buildRecord(catalog, records, {
    generatedAt: "2026-08-22T00:00:00.000Z",
    reviewer: "TESTER"
  });
  assert.strictEqual(record.reviewer, "TESTER");
  assert.strictEqual(record.guardrails.r006Status, "OPEN");
  assert.strictEqual(record.guardrails.numericEmissionStatus, "BLOCKED");
  assert.strictEqual(record.guardrails.complianceStatus, "NOT_EVALUATED");
  assert.strictEqual(record.guardrails.gateDecision, "NOT_MADE_BY_THIS_RECORD");
});

run("unknown case or unsupported status is refused", () => {
  assert.throws(() => engine.setResult(catalog, {}, "UAT-99", "PASS", ""), /Unknown/);
  assert.throws(() => engine.setResult(catalog, {}, "UAT-01", "APPROVED", ""), /Unsupported/);
});

console.log("\nAll manual acceptance-engine tests passed.");

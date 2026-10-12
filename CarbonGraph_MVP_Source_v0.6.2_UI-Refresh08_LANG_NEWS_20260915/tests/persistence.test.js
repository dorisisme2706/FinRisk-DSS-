"use strict";

const assert = require("assert");
const baseline = require("../src/demo-data.js");
const persistence = require("../src/persistence.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fakeStorage() {
  const map = new Map();
  return {
    setItem(k, v) { map.set(k, String(v)); },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    removeItem(k) { map.delete(k); }
  };
}
function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("persistence stores only editable working fields", () => {
  const state = clone(baseline);
  state.batch.batchId = "BATCH-SYN-888";
  state.meta.dataOrigin = "SHOULD_NOT_PERSIST";
  state.release = { numericReleaseStatus: "SHOULD_NOT_PERSIST" };
  const patch = persistence.extractPatch(state);
  assert.strictEqual(patch.batchId, "BATCH-SYN-888");
  assert.ok(!Object.prototype.hasOwnProperty.call(patch, "dataOrigin"));
  assert.ok(!Object.prototype.hasOwnProperty.call(patch, "release"));
});

run("saved working fields restore onto trusted baseline", () => {
  const storage = fakeStorage();
  const state = clone(baseline);
  state.batch.batchId = "BATCH-SYN-777";
  state.precursor.widthMm = 1490;
  persistence.save(state, storage);
  const loaded = persistence.load(baseline, storage);
  assert.strictEqual(loaded.restored, true);
  assert.strictEqual(loaded.seed.batch.batchId, "BATCH-SYN-777");
  assert.strictEqual(loaded.seed.precursor.widthMm, 1490);
  assert.strictEqual(loaded.seed.meta.dataOrigin, "SYNTHETIC_DEMO");
});

run("clear removes persisted working state", () => {
  const storage = fakeStorage();
  persistence.save(baseline, storage);
  persistence.clear(storage);
  const loaded = persistence.load(baseline, storage);
  assert.strictEqual(loaded.restored, false);
});

run("v0.6 restores the v0.5 working-state key for continuity", () => {
  const storage = fakeStorage();
  storage.setItem(persistence.LEGACY_STORAGE_KEY, JSON.stringify({
    schemaVersion: persistence.SCHEMA_VERSION,
    savedAt: "2026-08-20T00:00:00.000Z",
    patch: { batchId: "BATCH-SYN-V04", widthMm: 1495 }
  }));
  const loaded = persistence.load(baseline, storage);
  assert.strictEqual(loaded.restored, true);
  assert.strictEqual(loaded.seed.batch.batchId, "BATCH-SYN-V04");
  assert.strictEqual(loaded.seed.precursor.widthMm, 1495);
  assert.strictEqual(loaded.seed.meta.dataOrigin, "SYNTHETIC_DEMO");
});

console.log("\nAll local persistence tests passed.");

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const APP_ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "qa/M08_CORE_FREEZE_MANIFEST.json"), "utf8"));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(APP_ROOT, relative), "utf8"));
const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("M08 freeze manifest records the accepted W07 baseline and protected scope", () => {
  assert.equal(manifest.freeze_id, "FINRISK_M08_CORE_FREEZE_20261107");
  assert.match(manifest.baseline.archive_sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.protected_file_count, 39);
  assert.equal(manifest.protected_files.length, 39);
  assert.deepEqual(manifest.protected_roots, ["backend_ml", "evidence/h16", "evidence/h18"]);
  assert.ok(manifest.additional_protected_files.includes("backend_api/decision_engine.py"));
});

test("all frozen model, H16/H18 evidence and decision adapter files retain their SHA-256", () => {
  for (const item of manifest.protected_files) {
    const absolute = path.join(APP_ROOT, item.path);
    assert.ok(fs.existsSync(absolute), `Missing frozen file: ${item.path}`);
    assert.equal(fs.statSync(absolute).size, item.size_bytes, `Size changed: ${item.path}`);
    assert.equal(hashFile(absolute), item.sha256, `SHA-256 changed: ${item.path}`);
  }
});

test("H16 feature contract remains ordered at 169 predictors", () => {
  const contract = readJson("backend_ml/contracts/model_features_v1.json");
  const featureOrder = contract.feature_order;
  const orderHash = crypto.createHash("sha256").update(`${featureOrder.join("\n")}\n`, "utf8").digest("hex");
  assert.equal(contract.feature_set_version, "core4_169_baseline_v1");
  assert.equal(featureOrder.length, 169);
  assert.equal(new Set(featureOrder).size, 169);
  assert.equal(contract.numeric.length, 154);
  assert.equal(contract.categorical.length, 15);
  assert.equal(orderHash, manifest.frozen_model_contract.feature_order_sha256_utf8_lf_terminated);
});

test("H16 threshold and calibration remain frozen and non-approving", () => {
  const metadata = readJson("backend_ml/model/metadata.json");
  const policy = readJson("backend_ml/model/threshold_policy.json");
  assert.equal(metadata.model_version, "finrisk_lgbm_h12_demo_v0.2");
  assert.equal(metadata.calibration_status, "uncalibrated_candidate_not_selected");
  assert.equal(policy.threshold, 0.14484327385366114);
  assert.equal(policy.comparator, ">=");
  assert.equal(policy.automatic_approval_or_rejection, false);
  assert.equal(policy.business_costs_provided, false);
});

test("H18 decision support does not issue credit decisions or loan terms", () => {
  const source = fs.readFileSync(path.join(APP_ROOT, "backend_api/decision_engine.py"), "utf8");
  for (const invariant of [
    '"automatic_credit_decision": False',
    '"business_policy_status": "NOT_APPROVED"',
    '"recommended_amount": None',
    '"recommended_term_months": None',
    '"interest_rate": None',
    '"monthly_payment": None'
  ]) assert.ok(source.includes(invariant), `Missing decision guardrail: ${invariant}`);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const APP_ROOT = path.resolve(__dirname, "..");
const inventoryPath = path.join(APP_ROOT, "evidence/m08/M08_MOCK_REAL_AUDIT_20261107.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

test("M08.1 audit inventories every workspace route and renderer", () => {
  assert.equal(inventory.audit_status, "PASS");
  assert.equal(inventory.workspace_screen_count, 13);
  assert.equal(inventory.renderers.length, 13);
  assert.deepEqual(inventory.screens.map(item => item.id), [
    "overview", "customer", "data", "simulation", "decision", "reports", "evidence",
    "validation", "trace", "result", "export", "e2e", "acceptance"
  ]);
});

test("M08.1 audit verifies 38 read-only CORE4 fields and zero direct loan-form feature overlap", () => {
  assert.equal(inventory.customer_profile.allowlisted_field_count, 38);
  assert.equal(inventory.customer_profile.read_only, true);
  assert.equal(inventory.loan_application_to_h16_feature_mapping.h16_feature_count, 169);
  assert.equal(inventory.loan_application_to_h16_feature_mapping.shared_field_count, 0);
});

test("M08.1 audit records no current PostgreSQL write implementation", () => {
  assert.equal(inventory.api_write_route_present, false);
  assert.equal(inventory.postgres_driver_detected_in_local_server, false);
  assert.deepEqual(inventory.sql_migration_files, []);
  assert.deepEqual(inventory.migrations_directories, []);
  assert.equal(inventory.sql_design_proposal_files.length, 3);
  assert.ok(inventory.sql_design_proposal_files.every(file => file.startsWith("database/proposals/")));
});

test("M08.1 distinguishes M08.2 SQL design proposals from active database migrations", () => {
  assert.deepEqual(inventory.sql_migration_files, []);
  assert.equal(inventory.sql_design_proposal_files.length, 3);
  assert.ok(inventory.audit_checks.some(check => check.name === "draft SQL proposals remain separate from active migrations" && check.status === "PASS"));
});

test("M08.1 audit preserves local-only W06 history and explicit mock inventory", () => {
  assert.equal(inventory.reports_history.storage, "browser localStorage only");
  assert.equal(inventory.reports_history.maximum_records, 50);
  assert.ok(inventory.mock_screens.overview.includes("MOCK"));
  assert.ok(inventory.mock_screens.evidence.includes("localStorage"));
  assert.ok(inventory.mock_screens.e2e.includes("no DB/ML/API"));
});

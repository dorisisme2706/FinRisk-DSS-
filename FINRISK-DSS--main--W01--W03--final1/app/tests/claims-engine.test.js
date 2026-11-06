"use strict";

const assert = require("assert");
const engine = require("../src/claims-engine.js");

function run(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { console.error(`FAIL  ${name}`); throw error; }
}

run("T-CLM-002 blocks legacy 100% tracked claim", () => {
  const findings = engine.scanText("CarbonGraph provides 100% tracked supply data.", { surface: "DECK" });
  assert.ok(findings.some((item) => item.code === "CLM-LEGACY-TRACKED"));
});

run("T-CLM-002 blocks legacy -0.85 kg CO2e metric", () => {
  const findings = engine.scanText("Impact: -0.85 kg CO2e per unit.", { surface: "POSTER" });
  assert.ok(findings.some((item) => item.code === "CLM-LEGACY-EMISSION-METRIC"));
});

run("T-CLM-002 blocks unsupported compliance and verification claims", () => {
  const findings = engine.scanText("CBAM compliant with verified embedded emissions.", { surface: "SCRIPT" });
  assert.ok(findings.some((item) => item.code === "CLM-CBAM-COMPLIANCE"));
  assert.ok(findings.some((item) => item.code === "CLM-VERIFIED-EMISSIONS"));
});

run("current guardrail wording passes technical legacy-claim scan", () => {
  const result = engine.scanSurfaces([
    { name: "APP", content: "SYNTHETIC_DEMO · R-006 OPEN · NUMERIC BLOCKED · RESULT MASKED" },
    { name: "REPORT", content: "Không phải hồ sơ CBAM chính thức và không phải kết quả được thẩm tra." }
  ]);
  assert.strictEqual(result.status, "PASS_TECHNICAL");
  assert.strictEqual(result.findings.length, 0);
});

console.log("\nAll VR-019 legacy-claim scanner tests passed.");

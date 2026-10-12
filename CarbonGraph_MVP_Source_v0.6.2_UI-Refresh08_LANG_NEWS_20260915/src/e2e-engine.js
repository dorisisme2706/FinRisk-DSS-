(function (root, factory) {
  let reportEngine;
  if (typeof module !== "undefined" && module.exports) {
    reportEngine = require("./report-engine.js");
    module.exports = factory(reportEngine);
  } else {
    reportEngine = root.CGReportEngine;
    root.CGE2EEngine = factory(reportEngine);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (reportEngine) {
  "use strict";

  function check(id, name, passed, evidence) {
    return { id, name, status: passed ? "PASS" : "REVIEW", evidence };
  }

  function evaluate(state) {
    const checks = [];

    checks.push(check(
      "C8-01",
      "Synthetic dataset lock",
      state.meta?.dataOrigin === "SYNTHETIC_DEMO",
      `data_origin = ${state.meta?.dataOrigin || "MISSING"}`
    ));
    checks.push(check(
      "C8-02",
      "R-006 remains open",
      state.meta?.r006Status === "OPEN",
      `R-006 = ${state.meta?.r006Status || "MISSING"}`
    ));
    checks.push(check(
      "C8-03",
      "Validation pipeline executed",
      Array.isArray(state.validation) && Boolean(state.validationSummary),
      `${state.validationSummary?.total ?? 0} issue(s); data acceptance is not implied`
    ));
    checks.push(check(
      "C8-04",
      "Dynamic graph integrity",
      state.graphSummary?.integrityStatus === "PASS",
      `${state.graphSummary?.nodeCount ?? 0} nodes; ${state.graphSummary?.edgeCount ?? 0} edges; integrity = ${state.graphSummary?.integrityStatus || "REVIEW"}`
    ));
    checks.push(check(
      "C8-05",
      "Release remains safely gated",
      state.release?.numericReleaseStatus === "BLOCKED" &&
        state.release?.resultVisibility === "MASKED" &&
        state.release?.numericValue === null,
      `${state.release?.numericReleaseStatus || "MISSING"}/${state.release?.resultVisibility || "MISSING"}; numeric = NOT_INCLUDED`
    ));

    let exportEvidence = "Working export refused by guardrail";
    let exportPassed = false;
    try {
      const report = reportEngine.buildReport(state, { generatedAt: "E2E_CHECK" });
      exportPassed = report.guardrails.embeddedEmissionNumeric === "NOT_INCLUDED" &&
        report.guardrails.officialFiling === false &&
        report.guardrails.verifierApproved === false;
      exportEvidence = `${report.reportType}; numeric = ${report.guardrails.embeddedEmissionNumeric}`;
    } catch (error) {
      exportEvidence = error.message;
    }
    checks.push(check("C8-06", "Working export safety", exportPassed, exportEvidence));

    const safeWorkingFlow = checks.every((item) => item.status === "PASS");
    return {
      pipelineStatus: safeWorkingFlow ? "SAFE_WORKING_FLOW_PASS" : "REVIEW",
      complianceStatus: "NOT_EVALUATED",
      numericEmissionStatus: "BLOCKED",
      r006Status: state.meta?.r006Status || "OPEN",
      checks
    };
  }

  return { evaluate };
});

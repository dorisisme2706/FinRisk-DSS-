(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGReleaseEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function evaluate(state) {
    const reasons = [];

    if (state.meta.dataOrigin === "SYNTHETIC_DEMO") {
      reasons.push({ code: "REL-SYNTHETIC", message: "data_origin = SYNTHETIC_DEMO." });
    }

    if (state.meta.r006Status !== "CLOSED") {
      reasons.push({ code: "REL-R006", message: `R-006 = ${state.meta.r006Status || "OPEN"}.` });
    }

    if (state.validationSummary?.releaseBlocked) {
      const blockerCount = (state.validation || []).filter((item) => item.blocksRelease).length;
      reasons.push({
        code: "REL-VALIDATION",
        message: `Validation Engine đang có ${blockerCount} issue chặn release.`
      });
    }

    if (state.graphSummary && state.graphSummary.integrityStatus !== "PASS") {
      reasons.push({
        code: "REL-GRAPH",
        message: `Graph integrity = ${state.graphSummary.integrityStatus}.`
      });
    }

    const blocked = reasons.length > 0;

    return {
      resultId: state.result?.resultId || "RESULT-DEMO-001",
      traceId: state.meta.traceId,
      numericReleaseStatus: blocked ? "BLOCKED" : "NUMERIC_RELEASE_ALLOWED",
      resultVisibility: blocked ? "MASKED" : "INTERNAL_TEST",
      resultStatus: blocked ? "BLOCKED" : "REVIEW",
      numericValue: null,
      reasons
    };
  }

  return { evaluate };
});

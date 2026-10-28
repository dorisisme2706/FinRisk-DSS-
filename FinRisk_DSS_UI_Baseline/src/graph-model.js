(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGGraphModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NODE_TYPES = Object.freeze({
    DATASET: "DATASET",
    FACILITY: "FACILITY",
    PRODUCT: "PRODUCT",
    BATCH: "BATCH",
    PRECURSOR_LOT: "PRECURSOR_LOT",
    PRECURSOR: "PRECURSOR",
    EVIDENCE: "EVIDENCE",
    VALIDATION_ISSUE: "VALIDATION_ISSUE",
    RULE: "RULE",
    TRACE: "TRACE",
    RESULT: "RESULT",
    RISK: "RISK"
  });

  const RELATIONS = Object.freeze({
    HAS_SCOPE: "HAS_SCOPE",
    DESCRIBES: "DESCRIBES",
    INSTANCE_OF: "INSTANCE_OF",
    PRODUCED_AT: "PRODUCED_AT",
    CONSUMES: "CONSUMES",
    IS_LOT_OF: "IS_LOT_OF",
    SUPPORTED_BY: "SUPPORTED_BY",
    DERIVED_FROM: "DERIVED_FROM",
    HAS_TRACE: "HAS_TRACE",
    GATED_BY: "GATED_BY",
    VALIDATED_BY: "VALIDATED_BY",
    HAS_VALIDATION_ISSUE: "HAS_VALIDATION_ISSUE",
    VIOLATES_RULE: "VIOLATES_RULE"
  });

  const CORE_RELATIONS = Object.freeze([
    RELATIONS.HAS_SCOPE,
    RELATIONS.DESCRIBES,
    RELATIONS.INSTANCE_OF,
    RELATIONS.PRODUCED_AT,
    RELATIONS.CONSUMES,
    RELATIONS.IS_LOT_OF,
    RELATIONS.DERIVED_FROM,
    RELATIONS.HAS_TRACE,
    RELATIONS.VALIDATED_BY,
    RELATIONS.GATED_BY
  ]);

  return {
    NODE_TYPES,
    RELATIONS,
    CORE_RELATIONS
  };
});

(function (root, factory) {
  const data = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = data;
  } else {
    root.CG_BASELINE = data;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return {
    meta: {
      dataOrigin: "SYNTHETIC_DEMO",
      r006Status: "OPEN",
      numericReleaseStatus: "BLOCKED",
      resultVisibility: "MASKED",
      datasetId: "DATASET-SYN-DEMO-001",
      datasetStatus: "REVIEW",
      scenarioId: "HRC-SYN-001",
      traceId: "TRACE-REL-DEMO-001",
      calculationVersion: null,
      officialCalculationPresent: false,
      syntheticGovernance: {
        assumptions: [
          { id: "ASM-001", field: "precursor.origin", statement: "VN is a synthetic demo assumption." },
          { id: "ASM-002", field: "precursor.route", statement: "BF_BOF is a synthetic demo assumption." }
        ],
        reviewer: null,
        reviewedAt: null,
        approvalStatus: "PENDING"
      }
    },

    scope: {
      facilityId: "FAC-VN-001",
      productId: "RP-ST-001",
      period: "2026",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      productDefinitionVersion: "CG_Product_Definition_Card_v1.0",
      finishedCn: "7306 30 77",
      productName: "Ống thép tròn kết cấu hàn dọc từ HRC"
    },

    batch: {
      batchId: "BATCH-SYN-001",
      hrcLotId: "HRCLOT-SYN-001",
      precursorId: "PRE-HRC-001"
    },

    numericInputs: {
      status: "HOLD_R006",
      hrcInputMassT: null,
      outputMassT: null,
      scrapMassT: null,
      directEmissionsTco2e: null
    },

    precursor: {
      materialStandard: "EN 10025-2 / S235JR",
      alloyStatus: "NON_ALLOY",
      productForm: "FLAT_ROLLED_COIL",
      widthMm: 1500,
      thicknessMm: 3.8,
      surfaceState: "MILL_FINISH|NOT_PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF",
      origin: "VN",
      route: "BF_BOF",

      candidateCn8: {
        value: "72083800",
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "SYNTHETIC_CANDIDATE",
        reason: "BASELINE_SYNTHETIC_SCENARIO"
      },

      realCn8: {
        value: null,
        sourceClass: "REAL_EVIDENCE",
        status: "REVIEW"
      },

      seeDirect: {
        value: null,
        unit: "tCO2e/t",
        status: "MISSING"
      }
    },

    evidence: [
      { id: "EV-HRC-01", need: "MTC/CMTR hoặc CoC/spec", realStatus: "MISSING", demo: "SYN-EV-HRC-01", reviewer: null, reviewedAt: null },
      { id: "EV-HRC-02", need: "Form/width/thickness/surface", realStatus: "MISSING", demo: "SYN-EV-HRC-02", reviewer: null, reviewedAt: null },
      { id: "EV-HRC-03", need: "Origin evidence", realStatus: "MISSING", demo: "SYN-EV-HRC-03", reviewer: null, reviewedAt: null },
      { id: "EV-HRC-04", need: "Installation/route evidence", realStatus: "MISSING", demo: "SYN-EV-HRC-04", reviewer: null, reviewedAt: null },
      { id: "EV-HRC-05A/B", need: "Actual verified hoặc binding default", realStatus: "MISSING", demo: null, reviewer: null, reviewedAt: null }
    ],

    factors: [
      {
        factorId: "EF-HRC-DIRECT-001",
        value: null,
        unit: "tCO2e/t",
        status: "MISSING",
        selectedForCalculation: false,
        source: {
          issuer: null,
          url: null,
          publicationDate: null,
          accessDate: null,
          version: null,
          geography: null,
          cn: null,
          route: null
        }
      }
    ],

    validation: [
      { issueId: "VAL-009", rule: "VR-009", severity: "BLOCKER", message: "HRC real CN/origin/route/SEE chưa được khóa.", status: "OPEN" },
      { issueId: "VAL-017", rule: "VR-017", severity: "BLOCKER", message: "Synthetic evidence không được thỏa mãn REAL_REQUIRED.", status: "OPEN" },
      { issueId: "VAL-018", rule: "VR-018", severity: "BLOCKER", message: "R-006 OPEN hoặc SYNTHETIC_DEMO => numeric BLOCKED/MASKED.", status: "OPEN" },
      { issueId: "VAL-020", rule: "VR-020", severity: "INFO", message: "Graph node/edge integrity PASS.", status: "RESOLVED" },
      { issueId: "VAL-021", rule: "VR-021", severity: "INFO", message: "Batch→product/facility/HRC-lot linkage PASS.", status: "RESOLVED" },
      { issueId: "VAL-022", rule: "VR-022", severity: "INFO", message: "Result→validation/trace/release-gate linkage PASS.", status: "RESOLVED" }
    ],

    result: {
      resultId: "RESULT-DEMO-001"
    },

    graphBaseline: {
      nodes: [
        ["DATASET-SYN-DEMO-001", "DATASET", "REVIEW"],
        ["FAC-VN-001", "FACILITY", "ACCEPTED"],
        ["RP-ST-001", "PRODUCT", "ACCEPTED"],
        ["BATCH-SYN-001", "BATCH", "REVIEW"],
        ["HRCLOT-SYN-001", "PRECURSOR_LOT", "REVIEW"],
        ["PRE-HRC-001", "PRECURSOR", "ACCEPTED_ID_ONLY"],
        ["CG-DAT-004", "EVIDENCE", "REVIEW_SYNTHETIC_ONLY"],
        ["VR-018", "RULE", "ACCEPTED"],
        ["TRACE-REL-DEMO-001", "TRACE", "REVIEW"],
        ["RESULT-DEMO-001", "RESULT", "MASKED"],
        ["R-006", "RISK", "OPEN"]
      ],
      edges: [
        ["DATASET-SYN-DEMO-001", "HAS_SCOPE", "FAC-VN-001"],
        ["DATASET-SYN-DEMO-001", "DESCRIBES", "RP-ST-001"],
        ["BATCH-SYN-001", "INSTANCE_OF", "RP-ST-001"],
        ["BATCH-SYN-001", "PRODUCED_AT", "FAC-VN-001"],
        ["BATCH-SYN-001", "CONSUMES", "HRCLOT-SYN-001"],
        ["HRCLOT-SYN-001", "IS_LOT_OF", "PRE-HRC-001"],
        ["PRE-HRC-001", "SUPPORTED_BY", "CG-DAT-004"],
        ["RESULT-DEMO-001", "VALIDATED_BY", "VR-018"],
        ["RESULT-DEMO-001", "HAS_TRACE", "TRACE-REL-DEMO-001"],
        ["RESULT-DEMO-001", "GATED_BY", "R-006"],
        ["RESULT-DEMO-001", "DERIVED_FROM", "BATCH-SYN-001"]
      ]
    }
  };
});

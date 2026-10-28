(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGValidationRules = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /*
   * C3 Validation Rule Registry
   * ---------------------------
   * Đây là contract mã nguồn cho subset rule cần để chạy MVP synthetic branch.
   * Nó KHÔNG phải một CN classifier tổng quát và KHÔNG thay thế legal evidence.
   */
  const RULES = Object.freeze({
    IDENTIFIERS: Object.freeze({
      id: "VR-001",
      field: "meta/scope/batch identifiers",
      severity: "ERROR",
      title: "Định danh bắt buộc và duy nhất"
    }),
    MVP_SCOPE: Object.freeze({
      id: "VR-002",
      field: "scope",
      severity: "BLOCKER",
      title: "Phạm vi MVP phải khớp Gate 1"
    }),
    FINISHED_CN: Object.freeze({
      id: "VR-003",
      field: "scope.finishedCn",
      severity: "BLOCKER",
      title: "Finished product CN phải là 73063077"
    }),
    PERIOD: Object.freeze({
      id: "VR-004",
      field: "scope.periodStart/scope.periodEnd",
      severity: "ERROR",
      title: "Kỳ dữ liệu phải hợp lệ và nằm trong năm 2026"
    }),
    NUMERIC: Object.freeze({
      id: "VR-005",
      field: "numericInputs/precursor dimensions",
      severity: "ERROR",
      title: "Numeric input phải thỏa miền giá trị"
    }),
    BATCH_REQUIRED: Object.freeze({
      id: "VR-001",
      field: "batch.batchId",
      severity: "ERROR",
      title: "Batch ID bắt buộc"
    }),
    HRC_LOT_REQUIRED: Object.freeze({
      id: "VR-001",
      field: "batch.hrcLotId",
      severity: "ERROR",
      title: "HRC lot ID bắt buộc"
    }),
    WIDTH_REQUIRED: Object.freeze({
      id: "VR-005",
      field: "precursor.widthMm",
      severity: "BLOCKER",
      title: "HRC width bắt buộc cho candidate classification"
    }),
    THICKNESS_REQUIRED: Object.freeze({
      id: "VR-005",
      field: "precursor.thicknessMm",
      severity: "BLOCKER",
      title: "HRC thickness bắt buộc cho candidate classification"
    }),
    SURFACE_REQUIRED: Object.freeze({
      id: "VR-009",
      field: "precursor.surfaceState",
      severity: "BLOCKER",
      title: "Surface state bắt buộc cho candidate classification"
    }),
    CLASSIFICATION_BRANCH: Object.freeze({
      id: "VR-009",
      field: "precursor.candidateCn8",
      severity: "WARNING",
      title: "Classification branch chưa được MVP hỗ trợ"
    }),
    ORIGIN_FORMAT: Object.freeze({
      id: "VR-009",
      field: "precursor.origin",
      severity: "ERROR",
      title: "Origin phải là ISO2 working code"
    }),
    ROUTE_REQUIRED: Object.freeze({
      id: "VR-009",
      field: "precursor.route",
      severity: "WARNING",
      title: "Production route cần được chọn để test SEE path"
    }),
    SOURCE_SEGREGATION: Object.freeze({
      id: "VR-017",
      field: "evidence",
      severity: "BLOCKER",
      title: "Synthetic evidence không được đóng REAL_REQUIRED"
    }),
    NUMERIC_REDACTION: Object.freeze({
      id: "VR-018",
      field: "release",
      severity: "BLOCKER",
      title: "Numeric release bị chặn"
    }),
    REAL_CN_MISSING: Object.freeze({
      id: "VR-009",
      field: "precursor.realCn8",
      severity: "BLOCKER",
      title: "Real HRC CN8 chưa được khóa"
    }),
    SEE_MISSING: Object.freeze({
      id: "VR-009",
      field: "precursor.seeDirect",
      severity: "BLOCKER",
      title: "HRC SEE chưa được khóa"
    }),
    EVIDENCE_APPROVAL: Object.freeze({
      id: "VR-011",
      field: "evidence",
      severity: "BLOCKER",
      title: "ACCEPTED evidence phải có ID và phê duyệt"
    }),
    FACTOR_SOURCE: Object.freeze({
      id: "VR-012",
      field: "factors.source",
      severity: "BLOCKER",
      title: "Factor được chọn phải có đủ metadata nguồn"
    }),
    TRACEABILITY: Object.freeze({
      id: "VR-013",
      field: "meta.traceId/meta.calculationVersion",
      severity: "ERROR",
      title: "Result/calculation phải có trace và version phù hợp"
    }),
    SYNTHETIC_GOVERNANCE: Object.freeze({
      id: "VR-016",
      field: "meta.syntheticGovernance",
      severity: "BLOCKER",
      title: "Dataset synthetic phải có scenario, giả định và phê duyệt trước ACCEPTED"
    }),
    LEGACY_CLAIM: Object.freeze({
      id: "VR-019",
      field: "release surfaces",
      severity: "BLOCKER",
      title: "Legacy claim chưa duyệt phải bị chặn"
    })
  });

  const SUPPORTED_ROUTES = Object.freeze(["BF_BOF", "EAF", "OTHER_REVIEW"]);

  const SURFACE = Object.freeze({
    NOT_PICKLED: "MILL_FINISH|NOT_PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF",
    PICKLED: "PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF",
    COATED: "MILL_FINISH|NOT_PICKLED|COATED|NO_RELIEF",
    OTHER: "OTHER_REVIEW"
  });

  return {
    RULES,
    SUPPORTED_ROUTES,
    SURFACE
  };
});

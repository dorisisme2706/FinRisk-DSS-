(function (root, factory) {
  let rulesApi;
  if (typeof module !== "undefined" && module.exports) {
    rulesApi = require("./validation-rules.js");
    module.exports = factory(rulesApi);
  } else {
    rulesApi = root.CGValidationRules;
    root.CGValidationEngine = factory(rulesApi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (rulesApi) {
  "use strict";

  if (!rulesApi || !rulesApi.RULES) {
    throw new Error("Validation Engine boot failed: validation-rules.js is missing.");
  }

  const { RULES, SUPPORTED_ROUTES, SURFACE } = rulesApi;
  const LOCKED_SCOPE = Object.freeze({
    facilityId: "FAC-VN-001",
    productId: "RP-ST-001",
    period: "2026",
    productDefinitionVersion: "CG_Product_Definition_Card_v1.0",
    finishedCn: "73063077"
  });

  function issue({ id, rule, field, severity, message, status = "OPEN", blocksCandidate = false, blocksRelease = false }) {
    return {
      issueId: id,
      rule,
      field,
      severity,
      message,
      status,
      blocksCandidate,
      blocksRelease
    };
  }

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function isPositiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  function isNonNegativeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function isIso2(value) {
    return typeof value === "string" && /^[A-Z]{2}$/.test(value);
  }

  function compactCode(value) {
    return isBlank(value) ? "" : String(value).replace(/\s+/g, "").toUpperCase();
  }

  function parseIsoDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
    return parsed;
  }

  function classifySyntheticCandidate(state, issues) {
    const p = state.precursor;

    // Required technical attributes.
    if (!isPositiveNumber(p.widthMm)) {
      issues.push(issue({
        id: "VAL-C3-WIDTH",
        rule: RULES.WIDTH_REQUIRED.id,
        field: RULES.WIDTH_REQUIRED.field,
        severity: RULES.WIDTH_REQUIRED.severity,
        message: "HRC width phải là số > 0 trước khi chạy candidate classification.",
        status: "MISSING",
        blocksCandidate: true,
        blocksRelease: true
      }));
    }

    if (!isPositiveNumber(p.thicknessMm)) {
      issues.push(issue({
        id: "VAL-C3-THICKNESS",
        rule: RULES.THICKNESS_REQUIRED.id,
        field: RULES.THICKNESS_REQUIRED.field,
        severity: RULES.THICKNESS_REQUIRED.severity,
        message: "HRC thickness phải là số > 0 trước khi chạy candidate classification.",
        status: "MISSING",
        blocksCandidate: true,
        blocksRelease: true
      }));
    }

    if (isBlank(p.surfaceState)) {
      issues.push(issue({
        id: "VAL-C3-SURFACE",
        rule: RULES.SURFACE_REQUIRED.id,
        field: RULES.SURFACE_REQUIRED.field,
        severity: RULES.SURFACE_REQUIRED.severity,
        message: "Surface state đang trống; candidate CN8 phải ở REVIEW.",
        status: "MISSING",
        blocksCandidate: true,
        blocksRelease: true
      }));
    }

    if (issues.some((x) => x.blocksCandidate)) {
      return {
        value: null,
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "REQUIRES_REVALIDATION",
        reason: "REQUIRED_CLASSIFICATION_INPUT_MISSING"
      };
    }

    if (p.alloyStatus !== "NON_ALLOY" || p.productForm !== "FLAT_ROLLED_COIL") {
      issues.push(issue({
        id: "VAL-C3-BRANCH-PRODUCT",
        rule: RULES.CLASSIFICATION_BRANCH.id,
        field: RULES.CLASSIFICATION_BRANCH.field,
        severity: RULES.CLASSIFICATION_BRANCH.severity,
        message: "MVP v0.6 chỉ triển khai synthetic classification branch NON_ALLOY + FLAT_ROLLED_COIL.",
        status: "REVIEW",
        blocksCandidate: true
      }));
      return {
        value: null,
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "UNSUPPORTED_BRANCH",
        reason: "PRODUCT_FORM_OR_ALLOY_OUTSIDE_MVP_BRANCH"
      };
    }

    // Heading 7211 branch deliberately not coded to CN8 depth in this MVP.
    if (p.widthMm < 600) {
      issues.push(issue({
        id: "VAL-C3-BRANCH-7211",
        rule: RULES.CLASSIFICATION_BRANCH.id,
        field: RULES.CLASSIFICATION_BRANCH.field,
        severity: RULES.CLASSIFICATION_BRANCH.severity,
        message: "Width < 600 mm đi sang heading 7211; MVP v0.6 chưa triển khai CN8 branch này nên giữ REVIEW.",
        status: "REVIEW",
        blocksCandidate: true
      }));
      return {
        value: null,
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "UNSUPPORTED_BRANCH",
        reason: "WIDTH_LT_600_REQUIRES_7211_BRANCH"
      };
    }

    if (p.surfaceState === SURFACE.COATED || p.surfaceState === SURFACE.OTHER) {
      issues.push(issue({
        id: "VAL-C3-BRANCH-SURFACE",
        rule: RULES.CLASSIFICATION_BRANCH.id,
        field: RULES.CLASSIFICATION_BRANCH.field,
        severity: RULES.CLASSIFICATION_BRANCH.severity,
        message: "Surface state hiện nằm ngoài synthetic CN8 branch đã unit-test; candidate phải giữ REVIEW.",
        status: "REVIEW",
        blocksCandidate: true
      }));
      return {
        value: null,
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "UNSUPPORTED_BRANCH",
        reason: "SURFACE_OUTSIDE_TESTED_BRANCH"
      };
    }

    if (!(p.thicknessMm >= 3 && p.thicknessMm < 4.75)) {
      issues.push(issue({
        id: "VAL-C3-BRANCH-THICKNESS",
        rule: RULES.CLASSIFICATION_BRANCH.id,
        field: RULES.CLASSIFICATION_BRANCH.field,
        severity: RULES.CLASSIFICATION_BRANCH.severity,
        message: "Thickness nằm ngoài branch 3.0–<4.75 mm đã triển khai trong MVP v0.6; candidate giữ REVIEW.",
        status: "REVIEW",
        blocksCandidate: true
      }));
      return {
        value: null,
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "UNSUPPORTED_BRANCH",
        reason: "THICKNESS_OUTSIDE_TESTED_BRANCH"
      };
    }

    if (p.surfaceState === SURFACE.NOT_PICKLED) {
      return {
        value: "72083800",
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "SYNTHETIC_CANDIDATE",
        reason: "C3_RULE_ENGINE_NOT_PICKLED_BRANCH"
      };
    }

    if (p.surfaceState === SURFACE.PICKLED) {
      return {
        value: "72082600",
        sourceClass: "SYNTHETIC",
        status: "REVIEW",
        label: "SYNTHETIC_CANDIDATE",
        reason: "C3_RULE_ENGINE_PICKLED_BRANCH"
      };
    }

    issues.push(issue({
      id: "VAL-C3-BRANCH-UNKNOWN",
      rule: RULES.CLASSIFICATION_BRANCH.id,
      field: RULES.CLASSIFICATION_BRANCH.field,
      severity: RULES.CLASSIFICATION_BRANCH.severity,
      message: "Không nhận diện được synthetic surface branch; candidate giữ REVIEW.",
      status: "REVIEW",
      blocksCandidate: true
    }));

    return {
      value: null,
      sourceClass: "SYNTHETIC",
      status: "REVIEW",
      label: "UNSUPPORTED_BRANCH",
      reason: "UNKNOWN_CLASSIFICATION_BRANCH"
    };
  }

  function validateIdentity(state, issues) {
    if (isBlank(state.batch.batchId)) {
      issues.push(issue({
        id: "VAL-C3-BATCH-ID",
        rule: RULES.BATCH_REQUIRED.id,
        field: RULES.BATCH_REQUIRED.field,
        severity: RULES.BATCH_REQUIRED.severity,
        message: "Batch ID không được để trống.",
        status: "MISSING",
        blocksRelease: true
      }));
    }

    if (isBlank(state.batch.hrcLotId)) {
      issues.push(issue({
        id: "VAL-C3-HRC-LOT-ID",
        rule: RULES.HRC_LOT_REQUIRED.id,
        field: RULES.HRC_LOT_REQUIRED.field,
        severity: RULES.HRC_LOT_REQUIRED.severity,
        message: "HRC lot ID không được để trống.",
        status: "MISSING",
        blocksRelease: true
      }));
    }

    const officialIdentifiers = [
      ["facility_id", state.scope?.facilityId],
      ["product_id", state.scope?.productId],
      ["dataset_id", state.meta?.datasetId],
      ["lot_id", state.batch?.hrcLotId],
      ["trace_id", state.meta?.traceId]
    ];

    officialIdentifiers.forEach(([label, value]) => {
      if (isBlank(value)) {
        issues.push(issue({
          id: `VAL-VR001-MISSING-${label.toUpperCase()}`,
          rule: RULES.IDENTIFIERS.id,
          field: label,
          severity: RULES.IDENTIFIERS.severity,
          message: `${label} bắt buộc phải có theo VR-001.`,
          status: "MISSING",
          blocksRelease: true
        }));
      }
    });

    const nonBlankValues = officialIdentifiers
      .filter(([, value]) => !isBlank(value))
      .map(([, value]) => String(value).trim().toUpperCase());
    if (new Set(nonBlankValues).size !== nonBlankValues.length) {
      issues.push(issue({
        id: "VAL-VR001-DUPLICATE-ID",
        rule: RULES.IDENTIFIERS.id,
        field: RULES.IDENTIFIERS.field,
        severity: RULES.IDENTIFIERS.severity,
        message: "facility_id, product_id, dataset_id, lot_id và trace_id phải duy nhất.",
        status: "REVIEW",
        blocksRelease: true
      }));
    }
  }

  function validateLockedScope(state, issues) {
    const actual = {
      facilityId: state.scope?.facilityId,
      productId: state.scope?.productId,
      period: state.scope?.period,
      productDefinitionVersion: state.scope?.productDefinitionVersion
    };
    const mismatches = Object.keys(actual).filter((key) => actual[key] !== LOCKED_SCOPE[key]);
    if (mismatches.length > 0) {
      issues.push(issue({
        id: "VAL-VR002-OUTSIDE-MVP-SCOPE",
        rule: RULES.MVP_SCOPE.id,
        field: mismatches.map((key) => `scope.${key}`).join(", "),
        severity: RULES.MVP_SCOPE.severity,
        message: `Giá trị nằm ngoài Gate 1 locked scope: ${mismatches.join(", ")}. Phải dừng import và mở change control.`,
        status: "REVIEW",
        blocksRelease: true
      }));
    }

    if (compactCode(state.scope?.finishedCn) !== LOCKED_SCOPE.finishedCn) {
      issues.push(issue({
        id: "VAL-VR003-FINISHED-CN",
        rule: RULES.FINISHED_CN.id,
        field: RULES.FINISHED_CN.field,
        severity: RULES.FINISHED_CN.severity,
        message: "finished_product_cn phải bằng 73063077 trong MVP; blank hoặc mã khác phải chặn calculation.",
        status: "REVIEW",
        blocksRelease: true
      }));
    }
  }

  function validatePeriod(state, issues) {
    const start = parseIsoDate(state.scope?.periodStart);
    const end = parseIsoDate(state.scope?.periodEnd);
    const valid = Boolean(start && end)
      && start.getUTCFullYear() === 2026
      && end.getUTCFullYear() === 2026
      && start.getTime() <= end.getTime();
    if (!valid) {
      issues.push(issue({
        id: "VAL-VR004-PERIOD",
        rule: RULES.PERIOD.id,
        field: RULES.PERIOD.field,
        severity: RULES.PERIOD.severity,
        message: "periodStart/periodEnd phải là ngày ISO hợp lệ trong năm 2026 và start <= end.",
        status: "REVIEW",
        blocksRelease: true
      }));
    }
  }

  function validateOptionalNumericInputs(state, issues) {
    const numeric = state.numericInputs || {};
    const positiveWhenPresent = ["hrcInputMassT", "outputMassT"];
    const nonNegativeWhenPresent = ["scrapMassT", "directEmissionsTco2e"];

    positiveWhenPresent.forEach((field) => {
      if (!isBlank(numeric[field]) && !isPositiveNumber(numeric[field])) {
        issues.push(issue({
          id: `VAL-VR005-${field.toUpperCase()}`,
          rule: RULES.NUMERIC.id,
          field: `numericInputs.${field}`,
          severity: RULES.NUMERIC.severity,
          message: `${field} nếu được cung cấp phải là số > 0; không được dùng 0/âm để mở calculation.`,
          status: "REVIEW",
          blocksRelease: true
        }));
      }
    });

    nonNegativeWhenPresent.forEach((field) => {
      if (!isBlank(numeric[field]) && !isNonNegativeNumber(numeric[field])) {
        issues.push(issue({
          id: `VAL-VR005-${field.toUpperCase()}`,
          rule: RULES.NUMERIC.id,
          field: `numericInputs.${field}`,
          severity: RULES.NUMERIC.severity,
          message: `${field} nếu được cung cấp phải là số >= 0; blank vẫn giữ null.`,
          status: "REVIEW",
          blocksRelease: true
        }));
      }
    });
  }

  function validateOriginAndRoute(state, issues) {
    if (!isIso2(state.precursor.origin)) {
      issues.push(issue({
        id: "VAL-C3-ORIGIN",
        rule: RULES.ORIGIN_FORMAT.id,
        field: RULES.ORIGIN_FORMAT.field,
        severity: RULES.ORIGIN_FORMAT.severity,
        message: "Origin phải là 2 chữ cái A–Z (working ISO2 code). Đây vẫn chỉ là SYNTHETIC assumption.",
        blocksRelease: true
      }));
    }

    if (isBlank(state.precursor.route) || !SUPPORTED_ROUTES.includes(state.precursor.route)) {
      issues.push(issue({
        id: "VAL-C3-ROUTE",
        rule: RULES.ROUTE_REQUIRED.id,
        field: RULES.ROUTE_REQUIRED.field,
        severity: RULES.ROUTE_REQUIRED.severity,
        message: "Production route chưa hợp lệ cho synthetic SEE-path test.",
        status: "REVIEW",
        blocksRelease: true
      }));
    } else if (state.precursor.route === "OTHER_REVIEW") {
      issues.push(issue({
        id: "VAL-C3-ROUTE-REVIEW",
        rule: RULES.ROUTE_REQUIRED.id,
        field: RULES.ROUTE_REQUIRED.field,
        severity: "WARNING",
        message: "Route = OTHER_REVIEW; không được dùng để chọn binding default.",
        status: "REVIEW",
        blocksRelease: true
      }));
    }
  }

  function validateGovernance(state, issues) {
    const syntheticEvidenceExists = Array.isArray(state.evidence) && state.evidence.some((e) => Boolean(e.demo));
    const realEvidenceMissing = Array.isArray(state.evidence) && state.evidence.some((e) => e.realStatus === "MISSING");

    if (syntheticEvidenceExists && realEvidenceMissing) {
      issues.push(issue({
        id: "VAL-C3-SOURCE-SEGREGATION",
        rule: RULES.SOURCE_SEGREGATION.id,
        field: RULES.SOURCE_SEGREGATION.field,
        severity: RULES.SOURCE_SEGREGATION.severity,
        message: "Có synthetic substitute nhưng REAL_REQUIRED evidence vẫn MISSING. Không được tự chuyển ACCEPTED.",
        blocksRelease: true
      }));
    }

    if (state.precursor.realCn8.value === null || state.precursor.realCn8.value === "") {
      issues.push(issue({
        id: "VAL-C3-REAL-CN",
        rule: RULES.REAL_CN_MISSING.id,
        field: RULES.REAL_CN_MISSING.field,
        severity: RULES.REAL_CN_MISSING.severity,
        message: "Real HRC CN8 chưa được khóa; synthetic candidate không được copy vào field real.",
        status: "MISSING",
        blocksRelease: true
      }));
    }

    if (state.precursor.seeDirect.value === null || state.precursor.seeDirect.value === "") {
      issues.push(issue({
        id: "VAL-C3-SEE",
        rule: RULES.SEE_MISSING.id,
        field: RULES.SEE_MISSING.field,
        severity: RULES.SEE_MISSING.severity,
        message: "HRC SEE đang MISSING; blank phải giữ blank, không mặc định thành 0.",
        status: "MISSING",
        blocksRelease: true
      }));
    }

    if (state.meta.dataOrigin === "SYNTHETIC_DEMO" || state.meta.r006Status !== "CLOSED") {
      issues.push(issue({
        id: "VAL-C3-RELEASE",
        rule: RULES.NUMERIC_REDACTION.id,
        field: RULES.NUMERIC_REDACTION.field,
        severity: RULES.NUMERIC_REDACTION.severity,
        message: "SYNTHETIC_DEMO hoặc R-006 chưa CLOSED => numeric release BLOCKED và result MASKED.",
        blocksRelease: true
      }));
    }
  }

  function validateEvidenceApproval(state, issues) {
    (state.evidence || []).forEach((evidenceItem, index) => {
      if (evidenceItem.realStatus !== "ACCEPTED") return;
      const complete = !isBlank(evidenceItem.id)
        && !isBlank(evidenceItem.reviewer)
        && parseIsoDate(String(evidenceItem.reviewedAt || "").slice(0, 10));
      if (!complete) {
        issues.push(issue({
          id: `VAL-VR011-EVIDENCE-${String(index + 1).padStart(2, "0")}`,
          rule: RULES.EVIDENCE_APPROVAL.id,
          field: `evidence[${index}]`,
          severity: RULES.EVIDENCE_APPROVAL.severity,
          message: "Evidence không được ACCEPTED khi thiếu evidence_id, reviewer hoặc reviewed_at hợp lệ; phải hạ về REVIEW.",
          status: "REVIEW",
          blocksRelease: true
        }));
      }
    });
  }

  function validateFactorSources(state, issues) {
    (state.factors || []).forEach((factor, index) => {
      const active = factor.selectedForCalculation === true
        || factor.status === "ACCEPTED"
        || !isBlank(factor.value);
      if (!active) return;
      const source = factor.source || {};
      const publicationOrAccessDate = !isBlank(source.publicationDate) || !isBlank(source.accessDate);
      const complete = !isBlank(factor.factorId)
        && !isBlank(source.issuer)
        && !isBlank(source.url)
        && publicationOrAccessDate
        && !isBlank(source.version)
        && !isBlank(source.geography)
        && !isBlank(source.cn)
        && !isBlank(source.route);
      if (!complete) {
        issues.push(issue({
          id: `VAL-VR012-FACTOR-${String(index + 1).padStart(2, "0")}`,
          rule: RULES.FACTOR_SOURCE.id,
          field: `factors[${index}].source`,
          severity: RULES.FACTOR_SOURCE.severity,
          message: "Factor đang được chọn nhưng thiếu issuer, URL, publication/access date, version, geography, CN hoặc route; không được dùng trong calculation.",
          status: "REVIEW",
          blocksRelease: true
        }));
      }
    });
  }

  function validateTraceability(state, issues) {
    if (state.result && !isBlank(state.result.resultId) && isBlank(state.meta?.traceId)) {
      issues.push(issue({
        id: "VAL-VR013-TRACE-ID",
        rule: RULES.TRACEABILITY.id,
        field: "meta.traceId",
        severity: RULES.TRACEABILITY.severity,
        message: "Working result không có trace_id nên không được hiển thị hoặc xuất.",
        status: "MISSING",
        blocksRelease: true
      }));
    }

    const observedReleaseStatuses = [state.meta?.numericReleaseStatus, state.release?.numericReleaseStatus]
      .filter((value) => !isBlank(value));
    const numericAttempted = state.meta?.officialCalculationPresent === true
      || observedReleaseStatuses.some((value) => value !== "BLOCKED");
    if (numericAttempted && isBlank(state.meta?.calculationVersion)) {
      issues.push(issue({
        id: "VAL-VR013-CALCULATION-VERSION",
        rule: RULES.TRACEABILITY.id,
        field: "meta.calculationVersion",
        severity: RULES.TRACEABILITY.severity,
        message: "Numeric calculation/release không được phép khi thiếu calculation_version.",
        status: "MISSING",
        blocksRelease: true
      }));
    }
  }

  function validateSyntheticGovernance(state, issues) {
    if (state.meta?.dataOrigin !== "SYNTHETIC_DEMO") return;
    const governance = state.meta.syntheticGovernance || {};
    const assumptions = Array.isArray(governance.assumptions) ? governance.assumptions : [];
    const baseComplete = !isBlank(state.meta.scenarioId)
      && assumptions.length > 0
      && assumptions.every((item) => !isBlank(item.id) && !isBlank(item.statement));
    if (!baseComplete) {
      issues.push(issue({
        id: "VAL-VR016-SYNTHETIC-METADATA",
        rule: RULES.SYNTHETIC_GOVERNANCE.id,
        field: RULES.SYNTHETIC_GOVERNANCE.field,
        severity: RULES.SYNTHETIC_GOVERNANCE.severity,
        message: "SYNTHETIC_DEMO phải có scenario_id và danh sách giả định có cấu trúc.",
        status: "REVIEW",
        blocksRelease: true
      }));
    }

    if (state.meta.datasetStatus === "ACCEPTED") {
      const approvalComplete = !isBlank(governance.reviewer)
        && parseIsoDate(String(governance.reviewedAt || "").slice(0, 10))
        && governance.approvalStatus === "APPROVED";
      if (!approvalComplete) {
        issues.push(issue({
          id: "VAL-VR016-SYNTHETIC-APPROVAL",
          rule: RULES.SYNTHETIC_GOVERNANCE.id,
          field: "meta.syntheticGovernance.reviewer/reviewedAt/approvalStatus",
          severity: RULES.SYNTHETIC_GOVERNANCE.severity,
          message: "Dataset synthetic không được ACCEPTED khi chưa có reviewer, reviewed_at và approvalStatus=APPROVED.",
          status: "REVIEW",
          blocksRelease: true
        }));
      }
    }
  }

  function summarize(issues) {
    const counts = { BLOCKER: 0, ERROR: 0, WARNING: 0, INFO: 0 };
    issues.forEach((x) => {
      if (!(x.severity in counts)) counts[x.severity] = 0;
      counts[x.severity] += 1;
    });

    return {
      total: issues.length,
      ...counts,
      openBlockers: issues.filter((x) => x.status === "OPEN" && x.severity === "BLOCKER").length,
      candidateBlocked: issues.some((x) => x.blocksCandidate),
      releaseBlocked: issues.some((x) => x.blocksRelease)
    };
  }

  function evaluate(state) {
    const issues = [];

    validateIdentity(state, issues);
    validateLockedScope(state, issues);
    validatePeriod(state, issues);
    validateOptionalNumericInputs(state, issues);
    validateOriginAndRoute(state, issues);
    const candidateCn8 = classifySyntheticCandidate(state, issues);
    validateEvidenceApproval(state, issues);
    validateFactorSources(state, issues);
    validateTraceability(state, issues);
    validateSyntheticGovernance(state, issues);
    validateGovernance(state, issues);

    return {
      issues,
      summary: summarize(issues),
      candidateCn8
    };
  }

  return {
    evaluate,
    isBlank,
    isPositiveNumber,
    isNonNegativeNumber,
    parseIsoDate,
    isIso2
  };
});

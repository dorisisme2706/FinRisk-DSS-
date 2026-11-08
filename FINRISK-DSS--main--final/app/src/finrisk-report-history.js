(function (root, factory) {
  "use strict";
  const decisionEngine = root.FinRiskDecisionEngine ||
    (typeof require === "function" ? require("./finrisk-decision-engine.js") : null);
  const api = factory(decisionEngine);
  root.FinRiskReportHistory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function (decisionEngine) {
  "use strict";

  const STORAGE_KEY = "finrisk.w06.report-history.v1";
  const SCHEMA_VERSION = 1;
  const REPORT_TYPE = "CORE4_H18_REVIEW_SUPPORT";
  const MAX_RECORDS = 50;
  const GROUP_FIELDS = Object.freeze({
    customer_context: [
      "name_contract_type", "name_income_type", "name_education_type", "name_family_status",
      "name_housing_type", "flag_own_car", "flag_own_realty", "cnt_children", "cnt_fam_members", "organization_type"
    ],
    financial_snapshot: [
      "amt_income_total", "amt_credit", "amt_annuity", "amt_goods_price", "app_credit_to_income_raw",
      "ext_source_1", "ext_source_2", "ext_source_3"
    ],
    bureau_history: [
      "bureau_history_observed", "bureau_loan_count", "bureau_active_count", "bureau_closed_count",
      "bureau_overdue_observed_count", "bureau_max_overdue_days", "bureau_currency_count"
    ],
    previous_applications: [
      "previous_history_observed", "previous_application_count", "previous_approved_count",
      "previous_refused_count", "previous_canceled_count"
    ],
    installment_history: [
      "installments_history_observed", "installments_observed_payment_rows", "installments_observed_contracts",
      "installments_observed_periods", "installments_eligible_periods", "installments_recorded_late_periods",
      "installments_recorded_shortfall_periods", "installments_max_recorded_delay_days"
    ]
  });
  const FORBIDDEN_KEYS = new Set(["target", "code_gender", "days_birth", "full_name", "name", "address", "phone", "email"]);
  const FIELD_LABELS = Object.freeze({
    name_contract_type: ["Loại hợp đồng", "Contract type"],
    name_income_type: ["Loại thu nhập", "Income type"],
    name_education_type: ["Trình độ học vấn", "Education"],
    name_family_status: ["Tình trạng gia đình", "Family status"],
    name_housing_type: ["Hình thức nhà ở", "Housing type"],
    flag_own_car: ["Sở hữu ô tô", "Owns a car"],
    flag_own_realty: ["Sở hữu bất động sản", "Owns real estate"],
    cnt_children: ["Số con", "Number of children"],
    cnt_fam_members: ["Số thành viên gia đình", "Family members"],
    organization_type: ["Loại tổ chức / nơi làm việc", "Organization / employer type"],
    amt_income_total: ["Tổng thu nhập theo dữ liệu nguồn", "Total income (source unit)"],
    amt_credit: ["Số tiền tín dụng", "Credit amount (source unit)"],
    amt_annuity: ["Giá trị annuity (AMT_ANNUITY)", "Annuity amount (source unit)"],
    amt_goods_price: ["Giá trị hàng hóa", "Goods price (source unit)"],
    app_credit_to_income_raw: ["Tỷ lệ tín dụng / thu nhập (raw)", "Credit-to-income ratio (raw)"],
    ext_source_1: ["Điểm nguồn ngoài 1", "External source score 1"],
    ext_source_2: ["Điểm nguồn ngoài 2", "External source score 2"],
    ext_source_3: ["Điểm nguồn ngoài 3", "External source score 3"],
    bureau_history_observed: ["Lịch sử Bureau được quan sát", "Bureau history observed"],
    bureau_loan_count: ["Số khoản vay Bureau", "Bureau loan count"],
    bureau_active_count: ["Số khoản đang hoạt động", "Active loans"],
    bureau_closed_count: ["Số khoản đã đóng", "Closed loans"],
    bureau_overdue_observed_count: ["Số khoản có quá hạn được quan sát", "Observed overdue loans"],
    bureau_max_overdue_days: ["Số ngày quá hạn tối đa được ghi nhận", "Maximum recorded overdue days"],
    bureau_currency_count: ["Số loại tiền tệ ghi nhận", "Recorded currencies"],
    previous_history_observed: ["Lịch sử hồ sơ trước đây được quan sát", "Previous history observed"],
    previous_application_count: ["Tổng số hồ sơ trước đây", "Previous applications"],
    previous_approved_count: ["Số hồ sơ được chấp thuận trước đây", "Previously approved"],
    previous_refused_count: ["Số hồ sơ bị từ chối trước đây", "Previously refused"],
    previous_canceled_count: ["Số hồ sơ đã hủy trước đây", "Previously canceled"],
    installments_history_observed: ["Lịch sử thanh toán được quan sát", "Installment history observed"],
    installments_observed_payment_rows: ["Số dòng thanh toán quan sát được", "Observed payment rows"],
    installments_observed_contracts: ["Số hợp đồng quan sát được", "Observed contracts"],
    installments_observed_periods: ["Số kỳ quan sát được", "Observed periods"],
    installments_eligible_periods: ["Số kỳ đủ điều kiện phân tích", "Eligible periods"],
    installments_recorded_late_periods: ["Số kỳ ghi nhận thanh toán trễ", "Recorded late periods"],
    installments_recorded_shortfall_periods: ["Số kỳ ghi nhận thanh toán thiếu", "Recorded shortfall periods"],
    installments_max_recorded_delay_days: ["Số ngày trễ tối đa được ghi nhận", "Maximum recorded delay days"]
  });
  const GROUP_LABELS = Object.freeze({
    customer_context: ["Thông tin hồ sơ", "Customer context"],
    financial_snapshot: ["Thông tin tài chính", "Financial snapshot"],
    bureau_history: ["Lịch sử tín dụng (Bureau)", "Bureau history"],
    previous_applications: ["Lịch sử hồ sơ trước đây", "Previous applications"],
    installment_history: ["Lịch sử thanh toán kỳ góp", "Installment history"]
  });

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function isPrimitive(value) {
    return value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value));
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }
  function safeFileToken(value) {
    return String(value ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "unknown";
  }
  function formatNumber(value, language) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);
    return value.toLocaleString(language === "en" ? "en-US" : "vi-VN", { maximumFractionDigits: 6 });
  }
  function createId(profileId, createdAt) {
    const date = new Date(createdAt);
    const stamp = Number.isFinite(date.getTime()) ? date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) : String(Date.now());
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `W06-${profileId}-${stamp}-${random}`;
  }

  function validateProfile(profile, expectedId) {
    if (!isObject(profile) || profile.status !== "ok" || profile.source !== "CORE4" ||
        profile.read_only !== true || profile.sk_id_curr !== expectedId ||
        typeof profile.data_version !== "string" || !profile.data_version ||
        typeof profile.feature_set_version !== "string" || !profile.feature_set_version ||
        !isObject(profile.profile)) return { valid: false, code: "INVALID_PROFILE_RESPONSE" };

    const groups = {};
    for (const [group, fields] of Object.entries(GROUP_FIELDS)) {
      const source = profile.profile[group];
      if (!isObject(source)) return { valid: false, code: "INVALID_PROFILE_RESPONSE" };
      const allowed = new Set(fields);
      if (Object.keys(source).some(key => FORBIDDEN_KEYS.has(key) || !allowed.has(key))) {
        return { valid: false, code: "INVALID_PROFILE_RESPONSE" };
      }
      const snapshot = {};
      for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(source, field) || !isPrimitive(source[field])) {
          return { valid: false, code: "INVALID_PROFILE_RESPONSE" };
        }
        snapshot[field] = source[field];
      }
      groups[group] = snapshot;
    }
    if (Object.keys(profile.profile).some(group => !Object.prototype.hasOwnProperty.call(GROUP_FIELDS, group))) {
      return { valid: false, code: "INVALID_PROFILE_RESPONSE" };
    }
    return { valid: true, groups };
  }

  function buildReport(profile, decision, options = {}) {
    if (!Number.isSafeInteger(profile?.sk_id_curr) || profile.sk_id_curr <= 0) {
      throw new Error("INVALID_PROFILE_RESPONSE");
    }
    const expectedId = profile.sk_id_curr;
    const profileCheck = validateProfile(profile, expectedId);
    if (!profileCheck.valid) throw new Error(profileCheck.code);
    if (!decisionEngine || typeof decisionEngine.validateResponse !== "function" ||
        !decisionEngine.validateResponse(decision, expectedId).valid) {
      throw new Error("INVALID_DECISION_RESPONSE");
    }
    const createdAt = options.createdAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error("INVALID_REPORT_DATE");
    const d = decision;
    const explanations = d.explanations.map(item => ({
      feature: item.feature,
      contribution: item.contribution,
      observedValue: isPrimitive(item.observed_value) ? item.observed_value : null,
      scale: item.scale
    }));
    const details = d.explanation_status === "ok" ? {
      baseMargin: d.explanation_details.base_margin,
      displayedContributionsSum: d.explanation_details.displayed_contributions_sum,
      otherFeaturesSum: d.explanation_details.other_features_sum,
      rawMargin: d.explanation_details.raw_margin
    } : null;
    const reportId = options.reportId || createId(expectedId, createdAt);
    return {
      schemaVersion: SCHEMA_VERSION,
      reportType: REPORT_TYPE,
      reportId,
      createdAt,
      source: {
        customerProfile: "CORE4_READ_ONLY_API",
        decisionSupport: "H18_DECISION_ASSESS_API",
        storage: "BROWSER_LOCAL_STORAGE_ON_EXPLICIT_SAVE"
      },
      profile: {
        skIdCurr: expectedId,
        dataVersion: profile.data_version,
        featureSetVersion: profile.feature_set_version,
        readOnly: true,
        groups: profileCheck.groups
      },
      assessment: {
        riskScore: d.risk_score,
        decisionThreshold: d.decision_threshold,
        reviewRecommended: d.review_recommended,
        signal: d.decision_support.signal,
        businessPolicyStatus: d.decision_support.business_policy_status,
        automaticCreditDecision: d.decision_support.automatic_credit_decision,
        policyBasis: d.decision_support.policy_basis,
        modelVersion: d.model_version,
        integrationStage: d.integration_stage,
        h16ReleaseStage: d.h16_release_stage,
        formalGkReview: d.formal_gk_review || null,
        thresholdPolicyVersion: d.threshold_policy_version,
        calibrationStatus: d.calibration_status,
        thresholdScope: d.threshold_scope,
        qualityFlags: d.quality_flags.slice(),
        explanationStatus: d.explanation_status,
        explanations,
        explanationDetails: details,
        decisionTrace: decisionEngine.buildTrace(d).map(step => ({
          id: step.id, key: step.key, status: step.status, value: step.value, detail: step.detail
        })),
        loanTerms: {
          recommendedAmount: null,
          recommendedTermMonths: null,
          interestRate: null,
          monthlyPayment: null
        }
      },
      guardrails: {
        officialCreditDecisionIssued: false,
        businessPolicyApproved: false,
        automaticCreditDecision: false,
        dataPersistence: "LOCAL_BROWSER_ONLY",
        disclaimer: "This report is a local copy of CORE4/H18 decision-support output. It is not an official credit decision, approval, rejection, loan offer, or approved lending policy."
      }
    };
  }

  function isStoredReport(report) {
    if (!isObject(report) || report.schemaVersion !== SCHEMA_VERSION || report.reportType !== REPORT_TYPE ||
        typeof report.reportId !== "string" || report.reportId.length === 0 || report.reportId.length > 100 ||
        !Number.isFinite(Date.parse(report.createdAt)) || !isObject(report.profile) ||
        !Number.isSafeInteger(report.profile.skIdCurr) || report.profile.skIdCurr <= 0 || report.profile.readOnly !== true ||
        typeof report.profile.dataVersion !== "string" || typeof report.profile.featureSetVersion !== "string" ||
        !isObject(report.profile.groups) || !isObject(report.assessment) ||
        !Number.isFinite(report.assessment.riskScore) || report.assessment.riskScore < 0 || report.assessment.riskScore > 1 ||
        !Number.isFinite(report.assessment.decisionThreshold) || report.assessment.decisionThreshold < 0 || report.assessment.decisionThreshold > 1 ||
        typeof report.assessment.reviewRecommended !== "boolean" ||
        report.assessment.reviewRecommended !== (report.assessment.riskScore >= report.assessment.decisionThreshold) ||
        report.assessment.signal !== (report.assessment.reviewRecommended ? "MANUAL_REVIEW_RECOMMENDED" : "NO_REVIEW_SIGNAL") ||
        report.assessment.businessPolicyStatus !== "NOT_APPROVED" || report.assessment.automaticCreditDecision !== false ||
        typeof report.assessment.modelVersion !== "string" || typeof report.assessment.thresholdPolicyVersion !== "string" ||
        !Array.isArray(report.assessment.qualityFlags) || !report.assessment.qualityFlags.every(item => typeof item === "string") ||
        !Array.isArray(report.assessment.explanations) || report.assessment.explanations.length > 10 ||
        !Array.isArray(report.assessment.decisionTrace) || report.assessment.decisionTrace.length !== 6 ||
        !isObject(report.assessment.loanTerms) ||
        ["recommendedAmount", "recommendedTermMonths", "interestRate", "monthlyPayment"].some(key => report.assessment.loanTerms[key] !== null) ||
        report.guardrails?.officialCreditDecisionIssued !== false || report.guardrails?.businessPolicyApproved !== false ||
        report.guardrails?.automaticCreditDecision !== false || report.guardrails?.dataPersistence !== "LOCAL_BROWSER_ONLY") return false;

    for (const [group, fields] of Object.entries(GROUP_FIELDS)) {
      const values = report.profile.groups[group];
      if (!isObject(values) || Object.keys(values).length !== fields.length) return false;
      if (fields.some(field => !Object.prototype.hasOwnProperty.call(values, field) || !isPrimitive(values[field]))) return false;
    }
    if (Object.keys(report.profile.groups).length !== Object.keys(GROUP_FIELDS).length ||
        Object.keys(report.profile.groups).some(group => !Object.prototype.hasOwnProperty.call(GROUP_FIELDS, group))) return false;
    if (report.assessment.explanations.some(item => !isObject(item) || typeof item.feature !== "string" ||
        FORBIDDEN_KEYS.has(item.feature) || !Number.isFinite(item.contribution) ||
        (item.observedValue !== null && !isPrimitive(item.observedValue)) || item.scale !== "raw_margin_log_odds")) return false;
    if (report.assessment.decisionTrace.some(step => !isObject(step) || typeof step.id !== "string" ||
        typeof step.key !== "string" || typeof step.status !== "string" || typeof step.value !== "string" || typeof step.detail !== "string")) return false;
    if (report.assessment.explanationDetails !== null && (!isObject(report.assessment.explanationDetails) ||
        !["baseMargin", "displayedContributionsSum", "otherFeaturesSum", "rawMargin"].every(key => Number.isFinite(report.assessment.explanationDetails[key])))) return false;
    return true;
  }

  function load(storage) {
    if (!storage || typeof storage.getItem !== "function") return [];
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const envelope = JSON.parse(raw);
      if (!isObject(envelope) || envelope.schemaVersion !== SCHEMA_VERSION || !Array.isArray(envelope.records)) return [];
      return envelope.records.filter(isStoredReport).slice(0, MAX_RECORDS);
    } catch (_) { return []; }
  }

  function save(report, storage) {
    if (!isStoredReport(report)) throw new Error("INVALID_REPORT");
    if (!storage || typeof storage.setItem !== "function") throw new Error("STORAGE_UNAVAILABLE");
    const records = load(storage).filter(item => item.reportId !== report.reportId);
    const next = [clone(report), ...records].slice(0, MAX_RECORDS);
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), records: next }));
    return next;
  }

  function remove(reportId, storage) {
    if (!storage || typeof storage.setItem !== "function") throw new Error("STORAGE_UNAVAILABLE");
    const next = load(storage).filter(item => item.reportId !== reportId);
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), records: next }));
    return next;
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== "function") throw new Error("STORAGE_UNAVAILABLE");
    storage.removeItem(STORAGE_KEY);
    return [];
  }

  function renderJson(report) {
    if (!isStoredReport(report)) throw new Error("INVALID_REPORT");
    return JSON.stringify(report, null, 2);
  }

  function renderHtml(report, language = "vi") {
    if (!isStoredReport(report)) throw new Error("INVALID_REPORT");
    const en = language === "en";
    const text = {
      title: en ? "FinRisk DSS · CORE4 / H18 Review-support Report" : "FinRisk DSS · Báo cáo hỗ trợ thẩm định CORE4 / H18",
      generated: en ? "Generated at" : "Thời điểm tạo",
      id: en ? "Profile ID (sk_id_curr)" : "Mã hồ sơ (sk_id_curr)",
      risk: en ? "Model risk score" : "Điểm rủi ro mô hình",
      threshold: en ? "Demo threshold" : "Ngưỡng demo",
      signal: en ? "Decision-support signal" : "Tín hiệu hỗ trợ quyết định",
      model: en ? "Model version" : "Phiên bản mô hình",
      data: en ? "Data version" : "Phiên bản dữ liệu",
      feature: en ? "Feature set" : "Bộ đặc trưng",
      policy: en ? "Threshold policy" : "Phiên bản threshold policy",
      notApproved: en ? "NOT_APPROVED · No final credit decision issued" : "NOT_APPROVED · Chưa phát hành quyết định tín dụng cuối cùng",
      groupLabel: en ? "Profile data" : "Dữ liệu hồ sơ",
      decisionLabel: en ? "Model assessment" : "Kết quả mô hình",
      traceLabel: en ? "Decision trace" : "Dấu vết xử lý",
      explanationLabel: en ? "Top 10 feature contributions (raw-margin log-odds)" : "Top 10 đóng góp đặc trưng (log-odds trên raw margin)",
      quality: en ? "Quality flags" : "Cảnh báo chất lượng",
      none: en ? "None" : "Không có",
      business: en ? "Business policy" : "Chính sách nghiệp vụ",
      guardrail: en ? "Important limitation" : "Giới hạn quan trọng",
      disclaimer: en ? "This report is a local copy of CORE4/H18 decision-support output. It is not an official credit decision, approval, rejection, loan offer, or approved lending policy." : "Đây là bản sao cục bộ của kết quả hỗ trợ quyết định CORE4/H18. Báo cáo không phải quyết định tín dụng chính thức, chấp thuận, từ chối, đề nghị cho vay hoặc chính sách cho vay được phê duyệt.",
      yes: en ? "Yes" : "Có",
      no: en ? "No" : "Không",
      null: en ? "Not available" : "Không có dữ liệu",
      contribution: en ? "Contribution" : "Đóng góp",
      observed: en ? "Observed value" : "Giá trị quan sát",
      feature: en ? "Feature" : "Đặc trưng",
      step: en ? "Step" : "Bước",
      status: en ? "Status" : "Trạng thái",
      value: en ? "Value" : "Giá trị",
      detail: en ? "Detail key" : "Mã diễn giải",
      calibration: en ? "Probability calibration" : "Hiệu chỉnh xác suất",
      thresholdScope: en ? "Threshold scope" : "Phạm vi ngưỡng",
      base: en ? "Base" : "Giá trị nền",
      top10: en ? "Top 10 sum" : "Tổng top 10",
      other: en ? "Other features" : "Các đặc trưng còn lại",
      rawMargin: en ? "Raw margin" : "Margin thô"
    };
    const score = (report.assessment.riskScore * 100).toFixed(3) + "%";
    const threshold = (report.assessment.decisionThreshold * 100).toFixed(3) + "%";
    const value = item => item === null || item === undefined ? text.null :
      typeof item === "boolean" ? (item ? text.yes : text.no) : escapeHtml(formatNumber(item, language));
    const tables = Object.entries(report.profile.groups).map(([group, fields]) => {
      const title = GROUP_LABELS[group]?.[en ? 1 : 0] || group;
      const rows = Object.entries(fields).map(([key, item]) => {
        const label = FIELD_LABELS[key]?.[en ? 1 : 0] || key;
        return `<tr><th>${escapeHtml(label)}<small>${escapeHtml(key)}</small></th><td>${value(item)}</td></tr>`;
      }).join("");
      return `<h2>${escapeHtml(title)}</h2><table>${rows}</table>`;
    }).join("");
    const explanations = report.assessment.explanations.length ?
      report.assessment.explanations.map(item => `<tr><td><code>${escapeHtml(item.feature)}</code></td><td>${escapeHtml(item.contribution.toFixed(6))}</td><td>${value(item.observedValue)}</td></tr>`).join("") :
      `<tr><td colspan="3">${escapeHtml(en ? "Explanations unavailable; score remains available." : "Giải thích chưa khả dụng; điểm mô hình vẫn được giữ.")}</td></tr>`;
    const trace = report.assessment.decisionTrace.map(step =>
      `<tr><td>${escapeHtml(step.id)}</td><td>${escapeHtml(step.status)}</td><td>${escapeHtml(step.value)}</td><td>${escapeHtml(step.detail)}</td></tr>`).join("");
    const flags = report.assessment.qualityFlags.length ? report.assessment.qualityFlags.map(escapeHtml).join(", ") : text.none;
    return `<!doctype html><html lang="${en ? "en" : "vi"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(text.title)} · ${report.profile.skIdCurr}</title><style>
      *{box-sizing:border-box}body{font:14px/1.55 Arial,sans-serif;color:#1e352a;max-width:1120px;margin:28px auto;padding:0 22px;background:#f5f8f5}main{background:#fff;border:1px solid #dce8df;border-radius:14px;padding:28px}h1{font-size:24px;margin:0 0 6px}h2{font-size:17px;margin:25px 0 10px;padding-bottom:6px;border-bottom:1px solid #e3ece5}p.meta{color:#657a6e;font-size:12px}.banner{padding:13px 16px;background:#fff5e6;border:1px solid #efd5a4;border-left:4px solid #cd9226;border-radius:9px;font-weight:700;margin:18px 0}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.kpis div{border:1px solid #e1ebe3;border-radius:9px;padding:12px;min-width:0}.kpis span{display:block;font-size:11px;color:#75887c}.kpis strong{display:block;overflow-wrap:anywhere;margin-top:5px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #e1e9e3;padding:8px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f3f7f4;width:42%}th small{display:block;color:#7c8d82;font-weight:400;font-size:10px}code{overflow-wrap:anywhere}.footer{margin-top:26px;padding-top:14px;border-top:1px solid #e1e9e3;color:#73867a;font-size:11px}@media(max-width:720px){main{padding:18px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media print{body{margin:0;padding:0;background:#fff}main{border:0;border-radius:0;padding:0}.banner{break-inside:avoid}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}
      </style></head><body><main><h1>${escapeHtml(text.title)}</h1><p class="meta">${escapeHtml(text.generated)}: ${escapeHtml(new Date(report.createdAt).toLocaleString(en ? "en-US" : "vi-VN"))} · ${escapeHtml(report.reportId)}</p>
      <div class="banner">${escapeHtml(text.notApproved)}<br>${escapeHtml(text.disclaimer)}</div>
      <div class="kpis"><div><span>${escapeHtml(text.id)}</span><strong>${report.profile.skIdCurr}</strong></div><div><span>${escapeHtml(text.risk)}</span><strong>${score}</strong></div><div><span>${escapeHtml(text.threshold)}</span><strong>${threshold}</strong></div><div><span>${escapeHtml(text.signal)}</span><strong>${escapeHtml(report.assessment.signal)}</strong></div></div>
      <h2>${escapeHtml(text.decisionLabel)}</h2><table>${[
        [text.model, report.assessment.modelVersion], [text.data, report.profile.dataVersion], [text.feature, report.profile.featureSetVersion],
        [text.policy, report.assessment.thresholdPolicyVersion], [text.business, report.assessment.businessPolicyStatus],
        [text.calibration, report.assessment.calibrationStatus], [text.thresholdScope, report.assessment.thresholdScope], [text.quality, flags]
      ].map(([label, item]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(item ?? "—")}</td></tr>`).join("")}</table>
      <h2>${escapeHtml(text.groupLabel)}</h2>${tables}
      <h2>${escapeHtml(text.explanationLabel)}</h2><table><thead><tr><th>${escapeHtml(text.feature)}</th><th>${escapeHtml(text.contribution)}</th><th>${escapeHtml(text.observed)}</th></tr></thead><tbody>${explanations}</tbody></table>
      ${report.assessment.explanationDetails ? `<p>${escapeHtml(text.base)}: ${report.assessment.explanationDetails.baseMargin.toFixed(6)} · ${escapeHtml(text.top10)}: ${report.assessment.explanationDetails.displayedContributionsSum.toFixed(6)} · ${escapeHtml(text.other)}: ${report.assessment.explanationDetails.otherFeaturesSum.toFixed(6)} · ${escapeHtml(text.rawMargin)}: ${report.assessment.explanationDetails.rawMargin.toFixed(6)}</p>` : ""}
      <h2>${escapeHtml(text.traceLabel)}</h2><table><thead><tr><th>${escapeHtml(text.step)}</th><th>${escapeHtml(text.status)}</th><th>${escapeHtml(text.value)}</th><th>${escapeHtml(text.detail)}</th></tr></thead><tbody>${trace}</tbody></table>
      <h2>${escapeHtml(text.guardrail)}</h2><p>${escapeHtml(text.disclaimer)}</p><p>${escapeHtml(text.business)}: NOT_APPROVED · Automatic credit decision: DISABLED · Loan terms: NOT GENERATED.</p>
      <div class="footer">CORE4 snapshot + H18 API · Read-only source · Local browser report copy · Not a final credit decision.</div></main></body></html>`;
  }

  function fileName(report, extension) {
    if (!isStoredReport(report)) throw new Error("INVALID_REPORT");
    if (!['html', 'json'].includes(extension)) throw new Error("UNSUPPORTED_FORMAT");
    return `FinRisk_W06_Report_${safeFileToken(report.profile.skIdCurr)}_${safeFileToken(report.createdAt.slice(0, 10))}.${extension}`;
  }

  return Object.freeze({
    STORAGE_KEY, SCHEMA_VERSION, REPORT_TYPE, MAX_RECORDS, GROUP_FIELDS, FIELD_LABELS, GROUP_LABELS,
    validateProfile, buildReport, isStoredReport, load, save, remove, clear,
    renderJson, renderHtml, fileName
  });
});

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGReportEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REPORT_TYPE = "CARBONGRAPH_WORKING_STATUS_REPORT";
  const SCHEMA_VERSION = "CG-WORKING-REPORT-1.0";
  const DISCLAIMER = "Báo cáo trạng thái làm việc dùng dữ liệu giả lập. Không phải hồ sơ CBAM chính thức, không phải kết quả được thẩm tra và không chứa kết quả phát thải số.";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertExportGuardrails(state) {
    if (!state || state.meta?.dataOrigin !== "SYNTHETIC_DEMO") {
      throw new Error("C7 export chỉ được phép chạy với data_origin = SYNTHETIC_DEMO trong build này.");
    }
    if (state.meta?.r006Status !== "OPEN") {
      throw new Error("C7 export build này yêu cầu R-006 giữ OPEN; thay đổi trạng thái cần một lượt review riêng.");
    }
    if (state.release?.numericReleaseStatus !== "BLOCKED" || state.release?.resultVisibility !== "MASKED") {
      throw new Error("C7 export từ chối trạng thái chưa BLOCKED/MASKED.");
    }
    if (state.release?.numericValue !== null) {
      throw new Error("C7 export từ chối state có numeric emission value.");
    }
  }

  function coreTraceEdges(state) {
    const allowed = new Set([
      "INSTANCE_OF",
      "PRODUCED_AT",
      "CONSUMES",
      "IS_LOT_OF",
      "SUPPORTED_BY",
      "DERIVED_FROM",
      "HAS_TRACE",
      "VALIDATED_BY",
      "GATED_BY",
      "HAS_VALIDATION_ISSUE",
      "VIOLATES_RULE"
    ]);
    return (state.graph?.edges || [])
      .filter((item) => allowed.has(item.relation))
      .map((item) => ({
        id: item.id,
        from: item.from,
        relation: item.relation,
        to: item.to,
        status: item.status
      }));
  }

  function buildReport(state, options = {}) {
    assertExportGuardrails(state);
    const generatedAt = options.generatedAt || new Date().toISOString();

    return {
      schemaVersion: SCHEMA_VERSION,
      reportType: REPORT_TYPE,
      reportStatus: "WORKING_ONLY",
      generatedAt,
      guardrails: {
        dataOrigin: "SYNTHETIC_DEMO",
        r006Status: "OPEN",
        numericReleaseStatus: "BLOCKED",
        resultVisibility: "MASKED",
        embeddedEmissionNumeric: "NOT_INCLUDED",
        officialFiling: false,
        verifierApproved: false,
        disclaimer: DISCLAIMER
      },
      scope: {
        datasetId: state.meta.datasetId,
        scenarioId: state.meta.scenarioId,
        facilityId: state.scope.facilityId,
        productId: state.scope.productId,
        reportingPeriod: state.scope.period,
        finishedProductCn: state.scope.finishedCn,
        productName: state.scope.productName
      },
      workingInput: {
        batchId: state.batch.batchId || null,
        hrcLotId: state.batch.hrcLotId || null,
        precursorId: state.batch.precursorId,
        materialStandard: state.precursor.materialStandard,
        widthMm: state.precursor.widthMm,
        thicknessMm: state.precursor.thicknessMm,
        surfaceState: state.precursor.surfaceState,
        origin: state.precursor.origin,
        route: state.precursor.route
      },
      classification: {
        candidateCn8: state.precursor.candidateCn8?.value ?? null,
        candidateLabel: state.precursor.candidateCn8?.label || "REVIEW",
        candidateSourceClass: state.precursor.candidateCn8?.sourceClass || "SYNTHETIC",
        candidateStatus: state.precursor.candidateCn8?.status || "REVIEW",
        realCn8: null,
        realCn8Status: state.precursor.realCn8?.status || "MISSING"
      },
      precursorEmissionData: {
        seeStatus: state.precursor.seeDirect?.status || "MISSING",
        numericDataIncluded: false
      },
      validation: {
        summary: clone(state.validationSummary || {}),
        issues: (state.validation || []).map((item) => ({
          issueId: item.issueId,
          rule: item.rule,
          field: item.field || null,
          severity: item.severity,
          message: item.message,
          status: item.status,
          blocksRelease: Boolean(item.blocksRelease)
        }))
      },
      graph: {
        traceId: state.meta.traceId,
        integrityStatus: state.graphSummary?.integrityStatus || "REVIEW",
        nodeCount: state.graphSummary?.nodeCount ?? 0,
        edgeCount: state.graphSummary?.edgeCount ?? 0,
        orphanCount: state.graphSummary?.orphanCount ?? 0,
        missingCoreRelations: clone(state.graphSummary?.missingCoreRelations || []),
        traceEdges: coreTraceEdges(state)
      },
      release: {
        resultId: state.release.resultId,
        traceId: state.release.traceId,
        numericReleaseStatus: "BLOCKED",
        resultVisibility: "MASKED",
        resultStatus: state.release.resultStatus,
        reasons: clone(state.release.reasons || [])
      }
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function display(value) {
    return value === null || value === undefined || value === "" ? "—" : escapeHtml(value);
  }

  function rows(items) {
    return items.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${display(value)}</td></tr>`).join("");
  }

  function renderHtml(report) {
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinRisk Working Status Report (legacy internal) · ${escapeHtml(report.graph.traceId)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#17212b;max-width:1050px;margin:0 auto;padding:28px;background:#f5f7fa;line-height:1.45}
    main{background:#fff;border:1px solid #dfe5ec;border-radius:14px;padding:26px}
    h1{margin:0 0 5px;font-size:25px} h2{font-size:17px;margin:25px 0 9px}
    .banner{background:#7a2d2d;color:#fff;padding:13px 15px;border-radius:9px;font-weight:700;margin:17px 0}
    .meta{color:#667085;font-size:12px} table{border-collapse:collapse;width:100%;font-size:13px}
    th,td{border:1px solid #dfe5ec;padding:8px 10px;text-align:left;vertical-align:top} th{background:#f0f4f7;width:230px}
    code{font-family:Consolas,monospace}.tag{display:inline-block;border-radius:999px;padding:4px 8px;background:#fde8e8;color:#933;font-weight:700;font-size:11px}
    ul{margin-top:8px}.footer{margin-top:28px;border-top:1px solid #dfe5ec;padding-top:13px;color:#667085;font-size:11px}
  </style>
</head>
<body><main>
  <h1>FinRisk Working Status Report (legacy internal)</h1>
  <div class="meta">Schema ${escapeHtml(report.schemaVersion)} · Generated ${escapeHtml(report.generatedAt)}</div>
  <div class="banner">SYNTHETIC_DEMO · R-006 OPEN · NUMERIC BLOCKED · RESULT MASKED</div>
  <p><strong>${escapeHtml(report.guardrails.disclaimer)}</strong></p>

  <h2>Phạm vi làm việc</h2>
  <table>${rows([
    ["Dataset", report.scope.datasetId], ["Scenario", report.scope.scenarioId],
    ["Facility", report.scope.facilityId], ["Product", report.scope.productId],
    ["Reporting period", report.scope.reportingPeriod], ["Finished product CN", report.scope.finishedProductCn]
  ])}</table>

  <h2>Working input</h2>
  <table>${rows([
    ["Batch ID", report.workingInput.batchId], ["HRC lot", report.workingInput.hrcLotId],
    ["Precursor", report.workingInput.precursorId], ["Material standard", report.workingInput.materialStandard],
    ["Width (mm)", report.workingInput.widthMm], ["Thickness (mm)", report.workingInput.thicknessMm],
    ["Surface", report.workingInput.surfaceState], ["Origin", report.workingInput.origin], ["Route", report.workingInput.route]
  ])}</table>

  <h2>Candidate classification</h2>
  <table>${rows([
    ["Candidate CN8", report.classification.candidateCn8], ["Candidate label", report.classification.candidateLabel],
    ["Source class", report.classification.candidateSourceClass], ["Candidate status", report.classification.candidateStatus],
    ["Real CN8", report.classification.realCn8], ["Real CN8 status", report.classification.realCn8Status]
  ])}</table>

  <h2>Validation và trace</h2>
  <table>${rows([
    ["Validation issues", report.validation.summary.total ?? report.validation.issues.length],
    ["Validation blockers", report.validation.summary.BLOCKER ?? 0], ["Trace ID", report.graph.traceId],
    ["Graph integrity", report.graph.integrityStatus], ["Nodes", report.graph.nodeCount],
    ["Edges", report.graph.edgeCount], ["Orphan edges", report.graph.orphanCount]
  ])}</table>
  <ul>${report.validation.issues.map((item) => `<li><code>${escapeHtml(item.issueId)}</code> · ${escapeHtml(item.severity)} · ${escapeHtml(item.status)} — ${escapeHtml(item.message)}</li>`).join("")}</ul>

  <h2>Release guardrail</h2>
  <table>${rows([
    ["Result ID", report.release.resultId], ["Release status", report.release.numericReleaseStatus],
    ["Visibility", report.release.resultVisibility], ["Embedded emission numeric", report.guardrails.embeddedEmissionNumeric],
    ["Official filing", report.guardrails.officialFiling], ["Verifier approved", report.guardrails.verifierApproved]
  ])}</table>
  <ul>${report.release.reasons.map((item) => `<li><code>${escapeHtml(item.code)}</code> — ${escapeHtml(item.message)}</li>`).join("")}</ul>
  <div class="footer">WORKING_ONLY · Không sử dụng tài liệu này như kết quả phát thải thật hoặc hồ sơ khai báo chính thức.</div>
</main></body></html>`;
  }

  function renderJson(report) {
    return JSON.stringify(report, null, 2);
  }

  function safeToken(value) {
    const token = String(value || "TRACE-UNASSIGNED").toUpperCase().replace(/[^A-Z0-9_-]/g, "-");
    return token || "TRACE-UNASSIGNED";
  }

  function fileName(report, extension) {
    const ext = extension === "json" ? "json" : "html";
    const prefix = ext === "json" ? "CarbonGraph_Trace" : "CarbonGraph_Working_Report";
    return `${prefix}_${safeToken(report.graph.traceId)}.${ext}`;
  }

  return {
    REPORT_TYPE,
    SCHEMA_VERSION,
    DISCLAIMER,
    assertExportGuardrails,
    buildReport,
    renderHtml,
    renderJson,
    fileName
  };
});

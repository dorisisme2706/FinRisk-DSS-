(function(root){
  "use strict";
  const DISCLAIMER="MOCK ONLY — Not an actual credit decision. No real ML, approved credit policy, API or PostgreSQL integration.";
  const FIELDS=["customer_id","full_name","age","monthly_income","monthly_expenses","existing_monthly_debt","loan_amount","loan_term_months","loan_purpose"];
  function build(application,scenario){
    if(!root.FinRiskLoan||!root.FinRiskDecisionMock)throw new Error("Missing FinRisk loan or decision modules");
    const data=root.FinRiskLoan.normalize(application);
    const validation=root.FinRiskLoan.validate(data);
    const assessment=root.FinRiskDecisionMock.assess(data,scenario);
    return {schema:"finrisk.credit-report.v1-mock",reportType:"CREDIT_ASSESSMENT_MOCK",generatedAt:new Date().toISOString(),source:{application:"localStorage MOCK",validation:"illustrative rules #10",riskScore:"scenario MOCK #12",model:"NOT_CONNECTED",policy:"NOT_APPROVED",backend:"NOT_CONNECTED"},application:Object.fromEntries(FIELDS.map(k=>[k,data[k]])),validation:{valid:validation.valid,errors:{...validation.errors}},assessment:{status:assessment.status,score:assessment.score,reason:assessment.reason,reasons:[...assessment.reasons],scenario},disclaimer:DISCLAIMER};
  }
  function renderJson(report){return JSON.stringify(report,null,2);}
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||"&quot;"));}
  function renderHtml(report){
    const rows=Object.entries(report.application).map(([k,v])=>`<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("");
    const issues=Object.entries(report.validation.errors).map(([k,v])=>`<li>${escapeHtml(k)}: ${escapeHtml(v)}</li>`).join("")||"<li>No validation issues</li>";
    const reasons=report.assessment.reasons.map(v=>`<li>${escapeHtml(v)}</li>`).join("");
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FinRisk Credit Report MOCK</title><style>body{font:16px system-ui,Arial,sans-serif;max-width:850px;margin:35px auto;padding:0 22px;color:#173126}h1,h2{color:#176b46}table{width:100%;border-collapse:collapse}td,th{border:1px solid #d4e1d9;padding:10px;text-align:left;overflow-wrap:anywhere}th{width:42%;background:#eff7f1}.warning{border:2px solid #ae5e36;background:#fff4e8;padding:15px;border-radius:8px}li{margin:7px 0}@media print{body{margin:10px auto}}</style></head><body><h1>FinRisk DSS · Credit Assessment Report</h1><div class="warning"><strong>MOCK — KHÔNG PHẢI PHÊ DUYỆT TÍN DỤNG</strong><p>${escapeHtml(report.disclaimer)}</p></div><p>Generated: ${escapeHtml(report.generatedAt)}</p><h2>Hồ sơ vay #09</h2><table>${rows}</table><h2>Kiểm tra tài chính #10</h2><p>Status: <strong>${report.validation.valid?"PASS":"INVALID"}</strong></p><ul>${issues}</ul><h2>Đánh giá #12 (MOCK)</h2><p>Scenario: ${escapeHtml(report.assessment.scenario)} · Status: <strong>${escapeHtml(report.assessment.status)}</strong> · Score: ${report.assessment.score===null?"N/A":escapeHtml(report.assessment.score)+"/100"}</p><ul>${reasons}</ul><h2>Nguồn dữ liệu</h2><p>localStorage MOCK; ML chưa kết nối; policy chưa duyệt; PostgreSQL chưa tích hợp.</p></body></html>`;
  }
  function fileName(report,extension){if(!["html","json"].includes(extension))throw new Error("Unsupported export format");const id=String(report.application.customer_id||"unknown").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,30);return `FinRisk_Credit_Report_MOCK_${id}.${extension}`;}
  const api=Object.freeze({build,renderJson,renderHtml,fileName,DISCLAIMER});root.FinRiskCreditReport=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);

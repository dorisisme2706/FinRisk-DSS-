const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const engine = require('../src/finrisk-report-history.js');

function fixture(profileId = 100035, review = true) {
  const profile = {
    status: 'ok', sk_id_curr: profileId, source: 'CORE4', read_only: true,
    data_version: 'finrisk_v2_test', feature_set_version: 'core4_169_baseline_v1', profile: {}
  };
  for (const [group, fields] of Object.entries(engine.GROUP_FIELDS)) {
    profile.profile[group] = Object.fromEntries(fields.map(field => [field, null]));
  }
  profile.profile.customer_context.name_income_type = 'Commercial associate';
  profile.profile.financial_snapshot.amt_income_total = 180000;
  const decision = {
    status: 'ok', sk_id_curr: profileId, risk_score: review ? 0.15160322574159024 : 0.10,
    decision_threshold: 0.14484327385366114, review_recommended: review,
    integration_stage: 'H18', h16_release_stage: 'h16_final_test_evaluated_pending_formal_GK_review',
    formal_gk_review: 'SIGNED_OFF', model_version: 'finrisk_lgbm_h12_demo_v0.2',
    data_version: 'finrisk_v2_test', feature_set_version: 'core4_169_baseline_v1',
    threshold_policy_version: 'finrisk_demo_f1_validation_v1', quality_flags: [],
    calibration_status: 'uncalibrated_candidate_not_selected', threshold_scope: 'demo_only_pending_review',
    explanation_status: 'error', explanations: [],
    decision_support: {
      signal: review ? 'MANUAL_REVIEW_RECOMMENDED' : 'NO_REVIEW_SIGNAL', review_recommended: review,
      automatic_credit_decision: false, business_policy_status: 'NOT_APPROVED',
      policy_basis: 'frozen_model_threshold_only', recommended_amount: null,
      recommended_term_months: null, interest_rate: null, monthly_payment: null,
      scenario_changes_model_score: false
    }
  };
  return { profile, decision };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test('W06 report is built only from matching read-only CORE4 profile and valid H18 response', () => {
  const { profile, decision } = fixture();
  const report = engine.buildReport(profile, decision, { reportId: 'W06-TEST-1', createdAt: '2026-11-07T12:00:00.000Z' });
  assert.equal(report.reportType, 'CORE4_H18_REVIEW_SUPPORT');
  assert.equal(report.profile.skIdCurr, 100035);
  assert.equal(report.profile.readOnly, true);
  assert.equal(report.assessment.signal, 'MANUAL_REVIEW_RECOMMENDED');
  assert.equal(report.assessment.businessPolicyStatus, 'NOT_APPROVED');
  assert.equal(report.assessment.automaticCreditDecision, false);
  assert.equal(report.guardrails.officialCreditDecisionIssued, false);
  assert.equal(report.assessment.loanTerms.recommendedAmount, null);
  assert.equal(Object.values(report.profile.groups).reduce((n, group) => n + Object.keys(group).length, 0), 38);
});

test('W06 rejects forbidden or unexpected CORE4 profile fields', () => {
  const { profile, decision } = fixture();
  profile.profile.customer_context.target = 1;
  assert.throws(() => engine.buildReport(profile, decision), /INVALID_PROFILE_RESPONSE/);
  const clean = fixture();
  clean.profile.profile.customer_context.code_gender = 'F';
  assert.throws(() => engine.buildReport(clean.profile, clean.decision), /INVALID_PROFILE_RESPONSE/);
});

test('W06 rejects mismatched IDs, test-reserved profiles and altered H18 policy signals', () => {
  const first = fixture();
  assert.throws(() => engine.buildReport(first.profile, { ...first.decision, sk_id_curr: 100009 }), /INVALID_DECISION_RESPONSE/);
  assert.throws(() => engine.buildReport({ ...first.profile, read_only: false }, first.decision), /INVALID_PROFILE_RESPONSE/);
  const invalidPolicy = fixture();
  invalidPolicy.decision.decision_support.automatic_credit_decision = true;
  assert.throws(() => engine.buildReport(invalidPolicy.profile, invalidPolicy.decision), /INVALID_DECISION_RESPONSE/);
  const fabricatedTerm = fixture();
  fabricatedTerm.decision.decision_support.recommended_term_months = 24;
  assert.throws(() => engine.buildReport(fabricatedTerm.profile, fabricatedTerm.decision), /INVALID_DECISION_RESPONSE/);
});

test('W06 supports NO_REVIEW_SIGNAL without interpreting it as approval', () => {
  const { profile, decision } = fixture(100035, false);
  const report = engine.buildReport(profile, decision);
  assert.equal(report.assessment.signal, 'NO_REVIEW_SIGNAL');
  assert.equal(report.assessment.businessPolicyStatus, 'NOT_APPROVED');
  assert.equal(report.guardrails.officialCreditDecisionIssued, false);
  assert.equal(report.assessment.loanTerms.interestRate, null);
});

test('W06 history is explicit browser-local storage, bounded to 50 and supports remove/clear', () => {
  const storage = memoryStorage();
  assert.deepEqual(engine.load(storage), []);
  for (let index = 0; index < 55; index++) {
    const { profile, decision } = fixture(100035 + index);
    const report = engine.buildReport(profile, decision, {
      reportId: `W06-TEST-${index}`, createdAt: new Date(Date.UTC(2026, 10, 7, 12, 0, index)).toISOString()
    });
    engine.save(report, storage);
  }
  let records = engine.load(storage);
  assert.equal(records.length, 50);
  assert.equal(records[0].reportId, 'W06-TEST-54');
  records = engine.remove('W06-TEST-54', storage);
  assert.equal(records.length, 49);
  assert.equal(records.some(item => item.reportId === 'W06-TEST-54'), false);
  assert.deepEqual(engine.clear(storage), []);
  assert.deepEqual(engine.load(storage), []);
});

test('W06 does not write history until explicit save and protects invalid local records', () => {
  const storage = memoryStorage();
  const { profile, decision } = fixture();
  const report = engine.buildReport(profile, decision, { reportId: 'W06-EXPLICIT-SAVE' });
  assert.deepEqual(engine.load(storage), []);
  assert.equal(engine.save(report, storage).length, 1);
  storage.setItem(engine.STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records: [{ ...report, assessment: { ...report.assessment, businessPolicyStatus: 'APPROVED' } }] }));
  assert.deepEqual(engine.load(storage), []);
});

test('W06 exports escaped HTML and complete structured JSON with safe file names', () => {
  const { profile, decision } = fixture();
  profile.profile.customer_context.name_income_type = '<script>alert(1)</script>';
  const report = engine.buildReport(profile, decision, { reportId: 'W06-EXPORT-1' });
  const html = engine.renderHtml(report, 'vi');
  assert.match(html, /CORE4 \/ H18/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
  const json = engine.renderJson(report);
  assert.equal(JSON.parse(json).profile.groups.customer_context.name_income_type, '<script>alert(1)</script>');
  assert.match(engine.fileName(report, 'html'), /^FinRisk_W06_Report_100035_/);
  assert.throws(() => engine.fileName(report, 'pdf'), /UNSUPPORTED_FORMAT/);
});

test('W06 is a separate VI/EN workspace screen using CORE4 and H18 endpoints', () => {
  const app = read('src/app.js');
  const html = read('index.html');
  const i18n = read('src/i18n.js');
  assert.match(app, /\["reports",\s*"Báo cáo & lịch sử",\s*"W06 · Báo cáo CORE4\/H18"/);
  assert.match(app, /reports:\s*renderReportHistory/);
  assert.match(app, /\/api\/customer\/profile\?sk_id_curr=/);
  assert.match(app, /\/api\/decision\/assess\?sk_id_curr=/);
  assert.match(app, /engine\.save\(currentReport, window\.localStorage\)/);
  assert.match(html, /src="src\/finrisk-report-history\.js"/);
  assert.match(i18n, /"Báo cáo & lịch sử":\s*"Reports & history"/);
  assert.match(i18n, /"W06 · Báo cáo CORE4\/H18":\s*"W06 · CORE4\/H18 reports"/);
});

test('W06 adds mobile, tablet and desktop responsive layouts without changing the frozen ML bundle', () => {
  const css = read('assets/styles.css');
  assert.match(css, /\.finrisk-w06-screen/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /\.w06-table-wrap\{width:100%;overflow-x:auto/);
});

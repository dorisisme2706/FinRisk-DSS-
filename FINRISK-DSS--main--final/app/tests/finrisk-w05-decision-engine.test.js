const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../src/finrisk-decision-engine.js');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function response(review = true) {
  const risk = review ? 0.15160322574159024 : 0.10;
  const threshold = 0.14484327385366114;
  return {
    status: 'ok', sk_id_curr: 100035, risk_score: risk, decision_threshold: threshold,
    review_recommended: review, integration_stage: 'H18', h16_release_stage: 'frozen',
    model_version: 'finrisk_lgbm_h12_demo_v0.2', data_version: 'finrisk_v2_20261022151614259322',
    feature_set_version: 'core4_169_baseline_v1', threshold_policy_version: 'finrisk_demo_f1_validation_v1',
    quality_flags: [], calibration_status: 'uncalibrated_candidate_not_selected', threshold_scope: 'demo_only_pending_review',
    explanation_status: 'error', explanations: [],
    decision_support: {
      signal: review ? 'MANUAL_REVIEW_RECOMMENDED' : 'NO_REVIEW_SIGNAL', review_recommended: review,
      automatic_credit_decision: false, business_policy_status: 'NOT_APPROVED',
      policy_basis: 'frozen_model_threshold_only', recommended_amount: null,
      recommended_term_months: null, interest_rate: null, monthly_payment: null,
      scenario_changes_model_score: false
    }
  };
}

test('W05 is a separate navigation route and uses the real H18 decision-assess endpoint', () => {
  const app = read('src/app.js');
  assert.match(app, /\["decision",\s*"Bộ máy hỗ trợ quyết định",\s*"W05/);
  assert.match(read("src/i18n.js"), /"Bộ máy hỗ trợ quyết định":\s*"Decision Engine"/);
  assert.match(app, /decision:\s*renderDecisionEngine/);
  assert.match(app, /mountRealMlLookup\(paintFlow\)/);
  assert.match(app, /\/api\/decision\/assess\?sk_id_curr=/);
});

test('W05 trace never emits an approval/rejection decision or loan terms', () => {
  const trace = engine.buildTrace(response(true));
  assert.equal(trace.length, 6);
  assert.equal(trace.at(-1).status, 'BLOCKED');
  assert.equal(trace.at(-1).value, 'NOT_APPROVED');
  assert.ok(trace.every(step => !['APPROVE', 'REJECT'].includes(step.value)));
  const text = read('src/finrisk-decision-engine.js');
  for (const field of ['recommended_amount', 'recommended_term_months', 'interest_rate', 'monthly_payment']) {
    assert.match(text, new RegExp(field));
  }
});

test('W05 validates policy boundary, threshold comparison and H18 metadata', () => {
  assert.equal(engine.validateResponse(response(true), 100035).valid, true);
  assert.equal(engine.validateResponse(response(false), 100035).valid, true);
  const wrongPolicy = response(true); wrongPolicy.decision_support.business_policy_status = 'APPROVED';
  assert.equal(engine.validateResponse(wrongPolicy, 100035).valid, false);
  const fabricatedTerm = response(true); fabricatedTerm.decision_support.recommended_term_months = 24;
  assert.equal(engine.validateResponse(fabricatedTerm, 100035).valid, false);
  const wrongSignal = response(false); wrongSignal.decision_support.signal = 'APPROVE';
  assert.equal(engine.validateResponse(wrongSignal, 100035).valid, false);
  assert.equal(engine.validateResponse(response(true), 100034).valid, false);
});

test('W05 renders business guardrails and VI/EN translation keys', () => {
  const app = read('src/app.js');
  const i18n = read('src/i18n.js');
  assert.match(app, /Các ràng buộc nghiệp vụ/);
  assert.match(app, /NOT_APPROVED/);
  assert.match(app, /automatic_credit_decision === false/);
  for (const phrase of ['Decision Engine – hỗ trợ quyết định có giải thích','Các ràng buộc nghiệp vụ','W05 chỉ tra cứu và hiển thị; không ghi quyết định vào database hoặc lịch sử.']) {
    assert.ok(i18n.includes(phrase), `missing VI/EN mapping: ${phrase}`);
  }
  for (const key of ['w05StepPolicyDetail','w05StepThresholdReview','w05StatusNoReview']) {
    assert.match(i18n, new RegExp(key + ':'));
  }
});

test('W05 keeps final lending decision and history unissued/unwritten', () => {
  const app = read('src/app.js');
  assert.match(app, /W05 chỉ tra cứu và hiển thị; không ghi quyết định/);
  assert.match(app, /Không đề xuất số tiền, hạn mức, kỳ hạn, lãi suất/);
  assert.match(app, /Không tự động duyệt hoặc từ chối/);
  assert.match(read('backend_api/decision_engine.py'), /"automatic_credit_decision": False/);
  assert.match(read('backend_api/decision_engine.py'), /"business_policy_status": "NOT_APPROVED"/);
});

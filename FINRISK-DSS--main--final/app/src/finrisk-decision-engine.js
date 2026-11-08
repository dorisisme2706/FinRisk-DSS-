(function(root){
  "use strict";

  const FORBIDDEN_FEATURES = new Set(["target", "sk_id_curr", "code_gender", "days_birth"]);
  const REQUIRED_NULL_FIELDS = ["recommended_amount", "recommended_term_months", "interest_rate", "monthly_payment"];

  function finiteRange(value, min, max){
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }

  function validateResponse(data, expectedProfileId){
    if(!data || typeof data !== "object" || data.status !== "ok") return {valid:false, code:"INVALID_RESPONSE"};
    if(!Number.isSafeInteger(expectedProfileId) || data.sk_id_curr !== expectedProfileId) return {valid:false, code:"INVALID_RESPONSE"};
    if(!finiteRange(data.risk_score,0,1) || !finiteRange(data.decision_threshold,0,1)) return {valid:false, code:"INVALID_RESPONSE"};
    if(typeof data.review_recommended !== "boolean" || data.review_recommended !== (data.risk_score >= data.decision_threshold)) return {valid:false, code:"INVALID_RESPONSE"};
    if(data.integration_stage !== "H18" || typeof data.h16_release_stage !== "string" || !data.h16_release_stage) return {valid:false, code:"INVALID_RESPONSE"};
    for(const key of ["model_version","data_version","feature_set_version","threshold_policy_version"]){
      if(typeof data[key] !== "string" || !data[key]) return {valid:false, code:"INVALID_RESPONSE"};
    }
    const support = data.decision_support;
    if(!support || typeof support !== "object") return {valid:false, code:"INVALID_RESPONSE"};
    const expectedSignal = data.review_recommended ? "MANUAL_REVIEW_RECOMMENDED" : "NO_REVIEW_SIGNAL";
    if(support.automatic_credit_decision !== false || support.business_policy_status !== "NOT_APPROVED" ||
       support.policy_basis !== "frozen_model_threshold_only" || support.review_recommended !== data.review_recommended ||
       support.signal !== expectedSignal || support.scenario_changes_model_score !== false ||
       REQUIRED_NULL_FIELDS.some(key => support[key] !== null)) return {valid:false, code:"INVALID_RESPONSE"};
    if(!Array.isArray(data.quality_flags) || !data.quality_flags.every(x => typeof x === "string")) return {valid:false, code:"INVALID_RESPONSE"};
    if(typeof data.calibration_status !== "string" || typeof data.threshold_scope !== "string") return {valid:false, code:"INVALID_RESPONSE"};
    if(!Array.isArray(data.explanations)) return {valid:false, code:"INVALID_RESPONSE"};
    if(data.explanation_status === "error"){
      if(data.explanations.length !== 0) return {valid:false, code:"INVALID_RESPONSE"};
    }else if(data.explanation_status === "ok"){
      const details = data.explanation_details;
      if(data.explanations.length !== 10 || !details ||
         !["base_margin","displayed_contributions_sum","other_features_sum","raw_margin"].every(k => Number.isFinite(details[k])) ||
         Math.abs(details.base_margin + details.displayed_contributions_sum + details.other_features_sum - details.raw_margin) > 1e-6 ||
         !data.explanations.every(x => x && typeof x.feature === "string" && !FORBIDDEN_FEATURES.has(x.feature) &&
           Number.isFinite(x.contribution) && x.scale === "raw_margin_log_odds")) return {valid:false, code:"INVALID_RESPONSE"};
    }else return {valid:false, code:"INVALID_RESPONSE"};
    return {valid:true, code:null};
  }

  function buildTrace(data){
    const check = validateResponse(data, data && data.sk_id_curr);
    if(!check.valid) throw new Error(check.code);
    const review = data.review_recommended;
    const signal = data.decision_support.signal;
    const score = (data.risk_score * 100).toFixed(3) + "%";
    const threshold = (data.decision_threshold * 100).toFixed(3) + "%";
    return [
      {id:"profile", key:"w05StepProfile", status:"PASS", value:String(data.sk_id_curr), detail:"w05StepProfileDetail"},
      {id:"features", key:"w05StepFeatures", status:"PASS", value:data.feature_set_version, detail:"w05StepFeaturesDetail"},
      {id:"model", key:"w05StepModel", status:"PASS", value:data.model_version, detail:"w05StepModelDetail"},
      {id:"threshold", key:"w05StepThreshold", status:review?"REVIEW":"NO_REVIEW", value:`${score} / ${threshold}`, detail:review?"w05StepThresholdReview":"w05StepThresholdNoReview"},
      {id:"signal", key:"w05StepSignal", status:review?"REVIEW":"NO_REVIEW", value:signal, detail:review?"w05StepSignalReview":"w05StepSignalNoReview"},
      {id:"policy", key:"w05StepPolicy", status:"BLOCKED", value:"NOT_APPROVED", detail:"w05StepPolicyDetail"}
    ];
  }

  const api = Object.freeze({validateResponse, buildTrace});
  root.FinRiskDecisionEngine = api;
  if(typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

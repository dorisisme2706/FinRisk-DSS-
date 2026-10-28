(function (root) {
  "use strict";
  const SCENARIOS = Object.freeze({low:20,medium:55,high:85,missing:null});
  const STORAGE_KEY="finrisk.decision.mock.scenario.v1";
  function getScenario() {
    try {const value=root.localStorage.getItem(STORAGE_KEY);return Object.prototype.hasOwnProperty.call(SCENARIOS,value)?value:"medium";}
    catch (_) {return "medium";}
  }
  function setScenario(value) {
    if(!Object.prototype.hasOwnProperty.call(SCENARIOS,value))throw new Error("Invalid mock scenario");
    try {root.localStorage.setItem(STORAGE_KEY,value);} catch (_) {}
  }
  function assess(application,scenario="medium") {
    if(!Object.prototype.hasOwnProperty.call(SCENARIOS,scenario))throw new Error("Invalid mock scenario");
    if(!root.FinRiskLoan)throw new Error("FinRisk loan module is unavailable");
    const validation=root.FinRiskLoan.validate(application);
    if(!validation.valid)return {status:"INVALID_INPUT",score:null,message:"Hồ sơ chưa qua kiểm tra dữ liệu.",reason:"Cần sửa dữ liệu tại #09 / #10.",reasons:["Kiểm tra tài chính #10 chưa đạt.","Không thực hiện đánh giá khi dữ liệu không hợp lệ."]};
    const score=SCENARIOS[scenario];
    if(score===null)return {status:"UNAVAILABLE",score:null,message:"Chưa có điểm dự đoán từ mô hình ML.",reason:"Không thể xác định trạng thái khi thiếu đầu ra ML.",reasons:["ML output chưa được kết nối.","Không suy diễn kết quả tín dụng khi thiếu điểm rủi ro."]};
    // Illustrative thresholds only; not a bank policy or a production decision.
    const status=score<40?"APPROVE":score<70?"REVIEW":"REJECT";
    const descriptions={APPROVE:"Điểm rủi ro thấp theo ngưỡng MOCK.",REVIEW:"Điểm rủi ro trung bình theo ngưỡng MOCK.",REJECT:"Điểm rủi ro cao theo ngưỡng MOCK."};
    return {status,score,message:"Đang hiển thị kết quả theo kịch bản rủi ro giả lập.",reason:descriptions[status],reasons:[`Điểm rủi ro MOCK: ${score}/100.`,"Ngưỡng minh họa: dưới 40 → APPROVE; 40–69 → REVIEW; từ 70 → REJECT.","Chưa có policy duyệt, xác nhận ML hay API backend."]};
  }
  const api=Object.freeze({assess,getScenario,setScenario,SCENARIOS});
  root.FinRiskDecisionMock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);

(function(root){
  "use strict";
  const LABELS=["Customer","Features","ML","Risk","Decision","Recommendation"];
  function build(application,scenario){
    if(!root.FinRiskLoan||!root.FinRiskDecisionMock)throw new Error("Missing FinRisk modules");
    const data=root.FinRiskLoan.normalize(application);
    const validation=root.FinRiskLoan.validate(data);
    const assessment=root.FinRiskDecisionMock.assess(data,scenario);
    const valid=validation.valid;
    const score=assessment.score;
    const features=valid?`Thu nhập ${data.monthly_income} VND · Vay ${data.loan_amount} VND`:`${Object.keys(validation.errors).length} trường chưa hợp lệ`;
    const mlStatus=!valid?"BLOCKED":"UNAVAILABLE";
    const status=assessment.status;
    const recommendation={
      APPROVE:"Đề xuất xem xét chấp thuận (MOCK)",
      REVIEW:"Chuyển nhân viên xem xét (MOCK)",
      REJECT:"Đề xuất từ chối (MOCK)",
      UNAVAILABLE:"Chờ kết quả ML thật",
      INVALID_INPUT:"Quay lại sửa hồ sơ #09"
    }[status];
    const steps=[
      {id:"customer",label:"Customer",value:data.customer_id||"—",status:valid?"PASS":"BLOCKED",description:"Hồ sơ vay #09 được đọc từ MOCK localStorage; không chứa dữ liệu khách hàng thật."},
      {id:"features",label:"Features",value:features,status:valid?"PASS":"BLOCKED",description:valid?"Đầu vào tài chính đã qua quy tắc kiểm tra minh họa #10; chưa có feature engineering thật.":"Validation #10 chưa đạt; không chuyển hồ sơ sang đánh giá."},
      {id:"ml",label:"ML",value:valid?(score===null?"N/A":`Điểm kịch bản ${score}/100`):"Không xử lý",status:mlStatus,description:valid?"Không chạy mô hình ML; điểm số chỉ là kịch bản MOCK được chọn ở #12.":"Dừng trước bước ML do hồ sơ không hợp lệ."},
      {id:"risk",label:"Risk",value:score===null?"Chưa xác định":`${score}/100 (MOCK)`,status:score===null?"UNAVAILABLE":"MOCK",description:"Điểm rủi ro và các ngưỡng chỉ minh họa giao diện, chưa được duyệt làm chính sách tín dụng."},
      {id:"decision",label:"Decision",value:status,status:valid?(score===null?"UNAVAILABLE":"MOCK"):"BLOCKED",description:assessment.reason+" Đây không phải quyết định cho vay thật."},
      {id:"recommendation",label:"Recommendation",value:recommendation,status:valid?(score===null?"UNAVAILABLE":"MOCK"):"BLOCKED",description:"Gợi ý hiển thị cho mục đích thử nghiệm; không gửi hoặc lưu quyết định vào backend."}
    ];
    return {customerId:data.customer_id||"—",validation,assessment,steps,source:"MOCK",schema:"finrisk.decision-trace.v1-mock"};
  }
  const api=Object.freeze({build,LABELS});
  root.FinRiskDecisionTrace=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);

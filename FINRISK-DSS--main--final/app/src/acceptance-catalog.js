(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.CGAcceptanceCatalog = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const cases = [
    {
      id: "UAT-01",
      workItem: "D1/D5",
      title: "Khởi động đúng baseline và guardrail",
      purpose: "Chứng minh bản demo mở đúng phạm vi an toàn trước khi nhập dữ liệu.",
      sampleInput: ["Không cần nhập; mở Overview."],
      steps: [
        "Chạy run_localhost.bat và mở http://127.0.0.1:8080.",
        "Chọn Overview.",
        "Đối chiếu ribbon, Dataset, R-006 và Release."
      ],
      expected: [
        "Ribbon hiện SYNTHETIC_DEMO và NUMERIC RELEASE BLOCKED.",
        "Dataset = SYNTHETIC_DEMO; R-006 = OPEN.",
        "Release = BLOCKED; visibility = MASKED; không có số phát thải."
      ],
      failSymptoms: ["Không tải được trang/module.", "Thiếu một trong các nhãn an toàn.", "Xuất hiện giá trị phát thải số."],
      fixes: ["Kiểm tra cửa sổ server còn mở và đúng cổng 8000.", "Hard refresh Ctrl+F5.", "Nếu guardrail sai: dừng demo, chạy run_tests.bat và không dùng bản build này."],
      evidence: "Ảnh Overview có ribbon + Dataset + Release; ghi URL và thời điểm test."
    },
    {
      id: "UAT-02",
      workItem: "D1/D5",
      title: "Lưu và khôi phục working input tại localhost",
      purpose: "Xác nhận dữ liệu làm việc được lưu cục bộ nhưng không làm thay đổi baseline tin cậy.",
      sampleInput: ["Batch ID = BATCH-SYN-UAT-002", "Width = 1490"],
      steps: [
        "Vào Input Module; nhập Batch ID và Width theo mẫu.",
        "Bấm Apply + validate + rebuild graph.",
        "Refresh trình duyệt và quay lại Input Module."
      ],
      expected: ["Batch ID vẫn là BATCH-SYN-UAT-002 và Width = 1490.", "Data origin vẫn bị khóa ở SYNTHETIC_DEMO.", "Derived state được tính lại; không khôi phục một release state giả."],
      failSymptoms: ["Refresh làm mất working input.", "Data origin có thể sửa.", "Release đổi khỏi BLOCKED/MASKED."],
      fixes: ["Bảo đảm dùng cùng URL http://127.0.0.1:8080, không mở file://.", "Cho phép localStorage cho localhost.", "Bấm Reset baseline rồi thử lại; nếu vẫn lỗi, ghi FAIL và lưu Console error."],
      evidence: "Hai ảnh trước/sau refresh và revision/change log."
    },
    {
      id: "UAT-03",
      workItem: "D4/D5",
      title: "Đổi định danh và kiểm tra Evidence Graph động",
      purpose: "Xác nhận trace dùng working identity mới, không giữ node/edge cũ.",
      sampleInput: ["Batch ID = BATCH-SYN-UAT-003", "HRC lot ID = HRCLOT-SYN-UAT-003"],
      steps: ["Nhập hai ID mẫu trong Input Module và Apply.", "Mở Trace Explorer.", "Tìm node/edge chứa đúng hai ID mới."],
      expected: ["Có node BATCH-SYN-UAT-003 và HRCLOT-SYN-UAT-003.", "Edge DERIVED_FROM, CONSUMES và IS_LOT_OF trỏ tới ID mới.", "Graph integrity = PASS; Orphans = 0."],
      failSymptoms: ["Vẫn còn core edge trỏ ID baseline.", "Orphans > 0 hoặc integrity = REVIEW.", "Node mới không xuất hiện."],
      fixes: ["Quay lại Input Module và Apply lại, không chỉ gõ rồi chuyển màn hình.", "Bấm Run derived-state pipeline again.", "Nếu edge vẫn sai, ghi FAIL; đính kèm ảnh Dynamic edges và input."],
      evidence: "Ảnh Trace Explorer gồm integrity, node và ba edge core."
    },
    {
      id: "UAT-04",
      workItem: "D3/D5",
      title: "Thiếu Width phải lan truyền MISSING và vẫn chặn release",
      purpose: "Kiểm thử âm: dữ liệu bắt buộc trống không được biến thành 0 hoặc tạo candidate CN8.",
      sampleInput: ["Width = để trống"],
      steps: ["Xóa Width trong Input Module và Apply.", "Mở Validation Queue.", "Mở Trace Explorer rồi Release / Result."],
      expected: ["Có issue VAL-C3-WIDTH, severity BLOCKER, status MISSING.", "Candidate CN8 = trống; graph có node VAL-C3-WIDTH.", "Release = BLOCKED, visibility = MASKED, numericValue không tồn tại trên UI."],
      failSymptoms: ["Width trống bị đổi thành 0.", "Vẫn hiện candidate CN8.", "Issue không xuất hiện trong graph hoặc release không chặn."],
      fixes: ["Hard refresh và Reset baseline, sau đó lặp lại.", "Xác nhận đã bấm Apply.", "Nếu còn sai, không tiếp tục Gate 3; lưu ảnh ba màn hình và Console error."],
      evidence: "Ảnh Input, Validation issue, graph node và Release."
    },
    {
      id: "UAT-05",
      workItem: "D3/D5",
      title: "Phân nhánh candidate CN8 có kiểm soát",
      purpose: "Xác nhận C3 chỉ sinh candidate cho hai nhánh đã hỗ trợ và fail closed cho coated.",
      sampleInput: ["Case A: MILL_FINISH|NOT_PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF", "Case B: PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF", "Case C: MILL_FINISH|NOT_PICKLED|COATED|NO_RELIEF"],
      steps: ["Reset baseline.", "Apply lần lượt từng Surface state A, B, C.", "Sau mỗi lần, ghi Candidate CN8 và trạng thái Validation."],
      expected: ["A → candidate 72083800, nhãn SYNTHETIC_CANDIDATE.", "B → candidate 72082600, nhãn SYNTHETIC_CANDIDATE.", "C → không có candidate; UNSUPPORTED_BRANCH/REVIEW và issue VAL-C3-BRANCH-SURFACE."],
      failSymptoms: ["Candidate A/B khác mẫu.", "Case C vẫn tự đoán CN8.", "Candidate bị hiển thị như mã CN thực."],
      fixes: ["Kiểm tra đúng Width ≥ 600 và Thickness trong nhánh baseline.", "Reset baseline trước chuỗi test.", "Nếu C tự sinh CN8, dừng demo và ghi blocker C3."],
      evidence: "Ba ảnh Derived state/Validation tương ứng A, B, C."
    },
    {
      id: "UAT-06",
      workItem: "D3/D5",
      title: "Origin và Route sai phải vào REVIEW/ERROR",
      purpose: "Xác nhận input ngoài schema làm xuất hiện issue, không bị hệ thống im lặng chấp nhận.",
      sampleInput: ["Origin = X", "Route = OTHER_REVIEW"],
      steps: ["Nhập Origin X và Route OTHER_REVIEW rồi Apply.", "Mở Validation Queue.", "Đối chiếu issue và Release reasons."],
      expected: ["Có VAL-C3-ORIGIN severity ERROR.", "Có issue route/unsupported với trạng thái REVIEW.", "Release vẫn BLOCKED/MASKED."],
      failSymptoms: ["Không có issue.", "Origin X hiển thị như ACCEPTED.", "Release cho phép hiển thị kết quả."],
      fixes: ["Xác nhận input đúng mẫu và đã Apply.", "Bấm Run derived-state pipeline again.", "Nếu rule không chạy, ghi FAIL D3/C3 và lưu bảng Validation."],
      evidence: "Ảnh Input + hai issue + Release reasons."
    },
    {
      id: "UAT-07",
      workItem: "D3/D4/D5",
      title: "Release gate luôn che số phát thải",
      purpose: "Chứng minh R-006 OPEN và SYNTHETIC_DEMO luôn thắng mọi trạng thái kỹ thuật khác.",
      sampleInput: ["Reset baseline hoặc bất kỳ input synthetic hợp lệ."],
      steps: ["Mở Release / Result.", "Đối chiếu Result state và Embedded emissions.", "Mở End-to-End và đọc bốn trạng thái đầu trang."],
      expected: ["numeric_release_status = BLOCKED; result_visibility = MASKED.", "Embedded emissions hiện MASKED · KHÔNG PHÁT HÀNH, không có số/đơn vị phát thải.", "SAFE_WORKING_FLOW_PASS đi cùng Compliance = NOT_EVALUATED, Numeric = BLOCKED, R-006 = OPEN."],
      failSymptoms: ["Có số hoặc tCO2e.", "R-006 khác OPEN.", "SAFE_WORKING_FLOW_PASS bị mô tả là compliance/real-data pass."],
      fixes: ["Dừng sử dụng/export ngay.", "Chạy toàn bộ automated tests; chỉ tiếp tục khi release/report/E2E tests đều PASS.", "Không sửa dữ liệu để né guardrail; sửa logic hoặc quay về bản v0.5 đã kiểm thử."],
      evidence: "Ảnh Release / Result và End-to-End."
    },
    {
      id: "UAT-08",
      workItem: "D4/D5",
      title: "Working Export HTML/JSON không rò rỉ numeric emission",
      purpose: "Xác nhận file tải xuống chỉ dùng cho review nội bộ và có trace/guardrail đầy đủ.",
      sampleInput: ["Reset baseline; không cần dữ liệu mới."],
      steps: ["Mở Working Export.", "Tải Working Report .html và Trace .json.", "Mở hai file; tìm SYNTHETIC_DEMO, R-006 OPEN, BLOCKED, MASKED; tìm thử tCO2e và numericValue."],
      expected: ["Hai file tải thành công.", "Có WORKING_ONLY/SYNTHETIC_DEMO/R-006 OPEN/BLOCKED/MASKED và trace ID.", "Không có tCO2e, numericValue hoặc SEE numeric value."],
      failSymptoms: ["Không tải được file.", "Thiếu nhãn WORKING_ONLY hoặc R-006 OPEN.", "Có trường/giá trị phát thải số."],
      fixes: ["Cho phép browser download từ localhost.", "Reset baseline và tải lại.", "Nếu rò rỉ numeric, coi là blocker: xóa file export lỗi, không chia sẻ, chạy report-engine tests và sửa fail-closed."],
      evidence: "Hai file export và ảnh kết quả tìm kiếm các từ khóa."
    },
    {
      id: "UAT-09",
      workItem: "D1/D3/D4",
      title: "Bộ automated test đạt hoàn toàn",
      purpose: "Xác nhận regression cho input, validation, graph, release, export, E2E và acceptance record.",
      sampleInput: ["Chạy run_tests.bat trong thư mục source."],
      steps: ["Đóng các cửa sổ lệnh cũ dễ nhầm.", "Chạy run_tests.bat.", "Chờ đến dòng tổng kết; không chỉ nhìn test đầu tiên."],
      expected: ["Mọi case in PASS.", "Dòng cuối ALL TESTS PASSED.", "Không có FAIL, stack trace hoặc exit code lỗi."],
      failSymptoms: ["Một hoặc nhiều FAIL.", "Cửa sổ dừng trước dòng tổng kết.", "Node.js not found."],
      fixes: ["Nếu thiếu Node.js: cài Node LTS hoặc chạy trên máy đã có Node.", "Đọc test đầu tiên FAIL và module tương ứng; không sửa expected để che lỗi.", "Sau sửa phải chạy lại toàn bộ suite, không chỉ file từng lỗi."],
      evidence: "Ảnh/copy log từ test đầu đến ALL TESTS PASSED."
    },
    {
      id: "UAT-10",
      workItem: "D5/C9",
      title: "Reset baseline và chốt biên bản UAT",
      purpose: "Đưa demo về trạng thái sạch và xác nhận UAT chỉ là nghiệm thu kỹ thuật, không phải Gate/compliance approval.",
      sampleInput: ["Bấm Reset baseline trong Input Module."],
      steps: ["Bấm Reset baseline.", "Kiểm tra Overview và End-to-End.", "Vào Test Center, ghi note cho từng case, đánh dấu PASS/FAIL trung thực và Export UAT record."],
      expected: ["Batch = BATCH-SYN-001; HRC lot = HRCLOT-SYN-001.", "Graph integrity = PASS; SAFE_WORKING_FLOW_PASS; Compliance = NOT_EVALUATED.", "Test Center chỉ hiện REVIEW_COMPLETE khi cả 10 case PASS; R-006 vẫn OPEN; numeric vẫn BLOCKED."],
      failSymptoms: ["Baseline không trở lại.", "REVIEW_COMPLETE khi còn NOT_RUN/FAIL.", "UAT record làm thay đổi R-006/release hoặc tuyên bố Gate 3 PASS."],
      fixes: ["Xóa localStorage bằng Reset baseline rồi refresh.", "Sửa case FAIL trước khi đánh giá lại; không tự đổi status.", "C9 chỉ chuyển review sau khi D1–D5 có bằng chứng và người duyệt ký."],
      evidence: "File CG_UAT_Record_*.json, ảnh Test Center summary và ảnh Overview baseline."
    }
  ];

  return Object.freeze({
    version: "1.0",
    dataset: "SYNTHETIC_DEMO",
    r006Status: "OPEN",
    numericEmissionStatus: "BLOCKED",
    cases: Object.freeze(cases)
  });
});

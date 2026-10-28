(function () {
  "use strict";

  const STORAGE_KEY = "finrisk-language";
  const DEFAULT_LANGUAGE = "vi";
  const VIETNAMESE_RE = /[À-ỹĐđ]/;

  const exact = new Map(Object.entries({
    "Motion": "Motion",
    "Paused": "Paused",
    "Quản lý dữ liệu": "Data Management",
    "PostgreSQL · MOCK": "PostgreSQL · MOCK",
    "FinRisk pipeline · MOCK": "FinRisk pipeline · MOCK",
    "Quản lý hồ sơ vay": "Loan application management",
    "Lưu hồ sơ #09 (MOCK)": "Save application #09 (MOCK)",
    "Đọc lại (MOCK)": "Reload (MOCK)",
    "Xuất JSON": "Export JSON",
    "Chưa có hồ sơ MOCK được lưu.": "No MOCK applications saved.",
    "Chuẩn bị tích hợp PostgreSQL": "PostgreSQL integration readiness",
    "Chưa thống nhất": "Not finalized",
    "Chưa có endpoint": "No endpoint available",
    "Chưa tích hợp": "Not integrated",
    "Chưa kết nối": "Not connected",
    "Chạy mô phỏng": "Run simulation",
    "Quy trình xử lý": "Processing pipeline",
    "Kết quả chạy gần nhất": "Latest run",
    "Điều kiện để chạy E2E thật": "Requirements for real E2E",
    "Chưa có lần chạy": "No runs yet",
    "Nhấn Chạy mô phỏng để kiểm tra luồng frontend.": "Select Run simulation to test the frontend flow.",

    "Báo cáo tín dụng · FinRisk": "Credit Report · FinRisk",
    "Báo cáo tín dụng": "Credit Report",
    "#13 · Xem trước và xuất báo cáo HTML / JSON từ dữ liệu MOCK; không phải quyết định cho vay thật.": "#13 · Preview and export HTML / JSON reports using MOCK data; not a real credit decision.",
    "Xuất báo cáo tín dụng": "Export credit report",
    "Dữ liệu lấy từ hồ sơ #09, validation #10 và kịch bản #12 hiện tại. Tất cả xử lý trong trình duyệt.": "Data comes from application #09, validation #10 and the current #12 scenario. All processing stays in the browser.",
    "Báo cáo HTML": "HTML report",
    "Bản đọc độc lập gồm hồ sơ, kiểm tra dữ liệu, đánh giá, lý do và lưu ý MOCK.": "Standalone report with application, validation, assessment, reasons and MOCK disclaimer.",
    "Xuất HTML": "Export HTML",
    "Báo cáo JSON": "JSON report",
    "Dữ liệu có cấu trúc phục vụ kiểm thử và tích hợp API trong tương lai.": "Structured data for testing and future API integration.",
    "Xuất JSON": "Export JSON",
    "Dữ liệu lưu localStorage, điểm và ngưỡng đánh giá là giả lập. Chưa tích hợp ML, policy được duyệt hoặc PostgreSQL. Không sử dụng để phê duyệt khoản vay.": "Data is stored in localStorage; risk scores and thresholds are simulated. No ML, approved policy or PostgreSQL. Do not use for loan approval.",
    "Xem trước báo cáo": "Report preview",
    "Mã hồ sơ": "Application ID",
    "Thu nhập tháng": "Monthly income",
    "Số tiền vay": "Loan amount",
    "Thời hạn": "Loan term",
    "Điểm rủi ro": "Risk score",
    "Gợi ý": "Suggestion",
    "Không thể tạo báo cáo": "Unable to generate report",
    "Thiếu module báo cáo tín dụng FinRisk.": "FinRisk credit report module is missing.",
    "Giải thích quyết định": "Decision Trace",
    "Luồng đánh giá": "Assessment flow",
    "Giải thích quyết định · FinRisk": "Decision Trace · FinRisk",
    "#11 · Decision Trace: truy vết Customer → Features → ML → Risk → Decision → Recommendation bằng dữ liệu MOCK.": "#11 · Decision Trace: follow Customer → Features → ML → Risk → Decision → Recommendation using MOCK data.",
    "Hồ sơ #09": "Application #09",
    "Điểm MOCK #12": "MOCK score #12",
    "Không phải phê duyệt thật": "Not a real approval",
    "Truy vết mô phỏng dựa trên #09, #10 và kịch bản #12. Chưa có ML output, policy hoặc lịch sử quyết định từ backend.": "Simulated trace based on #09, #10 and #12 scenarios. No backend ML output, policy or decision history.",
    "Luồng giải thích quyết định": "Decision explanation flow",
    "Chọn từng bước để xem đầu vào, trạng thái và giải thích. Thay đổi kịch bản ở tab Đánh giá tín dụng để cập nhật luồng.": "Select a step to inspect its input, status and explanation. Change the scenario in Credit Assessment to update the trace.",
    "Chọn để xem chi tiết": "Select for details",
    "Chi tiết bước xử lý": "Processing step details",
    "Chọn một bước trong luồng để xem giải thích.": "Select a step in the flow to see its explanation.",
    "Danh sách bước và trạng thái": "Steps and statuses",
    "6 bước": "6 steps",
    "Bước": "Step",
    "Giá trị": "Value",
    "Trạng thái": "Status",
    "Giải thích": "Explanation",
    "Sẵn sàng": "Ready",
    "Giả lập": "Simulated",
    "Bị chặn": "Blocked",
    "Chưa có dữ liệu": "Unavailable",
    "Hồ sơ vay #09 được đọc từ MOCK localStorage; không chứa dữ liệu khách hàng thật.": "Loan application #09 is read from MOCK localStorage; no real customer data.",
    "Đầu vào tài chính đã qua quy tắc kiểm tra minh họa #10; chưa có feature engineering thật.": "Financial inputs passed illustrative validation #10; no real feature engineering.",
    "Validation #10 chưa đạt; không chuyển hồ sơ sang đánh giá.": "Validation #10 failed; do not forward application to assessment.",
    "Không chạy mô hình ML; điểm số chỉ là kịch bản MOCK được chọn ở #12.": "No ML model runs; the score is a MOCK scenario selected in #12.",
    "Dừng trước bước ML do hồ sơ không hợp lệ.": "Stop before ML due to invalid application.",
    "Điểm rủi ro và các ngưỡng chỉ minh họa giao diện, chưa được duyệt làm chính sách tín dụng.": "Risk scores and thresholds illustrate UI only and are not approved credit policy.",
    "Gợi ý hiển thị cho mục đích thử nghiệm; không gửi hoặc lưu quyết định vào backend.": "Suggestion for UI testing only; no decision is sent to or stored in backend.",
    "Đề xuất xem xét chấp thuận (MOCK)": "Suggested approval for review (MOCK)",
    "Chuyển nhân viên xem xét (MOCK)": "Refer to staff review (MOCK)",
    "Đề xuất từ chối (MOCK)": "Suggested rejection (MOCK)",
    "Chờ kết quả ML thật": "Await real ML result",
    "Quay lại sửa hồ sơ #09": "Return to edit application #09",
    "Không xử lý": "Not processed",
    "Chưa xác định": "Undetermined",

    "Đánh giá tín dụng": "Credit Assessment",
    "Kết quả MOCK": "MOCK result",
    "Đánh giá tín dụng · FinRisk": "Credit Assessment · FinRisk",
    "#12 · Loan Decision Engine UI: kết quả MOCK minh họa, chưa phải quyết định cấp tín dụng thật.": "#12 · Loan Decision Engine UI: illustrative MOCK result, not an actual credit decision.",
    "Đề xuất chấp thuận (MOCK)": "Suggested approval (MOCK)",
    "Cần xem xét (MOCK)": "Needs review (MOCK)",
    "Đề xuất từ chối (MOCK)": "Suggested rejection (MOCK)",
    "Dữ liệu chưa hợp lệ": "Invalid input",
    "Chưa có kết quả ML thật": "Real ML result unavailable",
    "Hồ sơ nhập liệu": "Application input",
    "Dữ liệu qua kiểm tra #10": "Data passed validation #10",
    "Nguồn dữ liệu": "Data source",
    "MOCK · localStorage, chưa có API/PostgreSQL": "MOCK · localStorage, no API/PostgreSQL",
    "Kết quả ML": "ML output",
    "Điểm rủi ro là kịch bản giả lập, không phải mô hình thật": "Risk score is a simulated scenario, not a real model",
    "Chính sách tín dụng": "Credit policy",
    "Ngưỡng chỉ phục vụ trình diễn, chưa được leader duyệt": "Thresholds are for demonstration only, not approved by the leader",
    "Hồ sơ MOCK từ #09": "MOCK application from #09",
    "Kiểm tra #10": "Validation #10",
    "Không chạy ML thật": "No real ML execution",
    "Không phát hành quyết định thật": "No actual credit decision issued",
    "Mọi kết quả chỉ dùng để thử giao diện, không có giá trị phê duyệt.": "All results are for UI testing only and do not constitute approval.",
    "Kịch bản đánh giá tín dụng": "Credit assessment scenario",
    "Thay đổi kịch bản để xem các trạng thái giao diện; không thay đổi dữ liệu hồ sơ.": "Change scenarios to preview UI states; application data is unchanged.",
    "Điểm rủi ro giả lập": "Simulated risk score",
    "Rủi ro thấp · 20/100": "Low risk · 20/100",
    "Rủi ro trung bình · 55/100": "Medium risk · 55/100",
    "Rủi ro cao · 85/100": "High risk · 85/100",
    "Không có điểm ML": "ML score unavailable",
    "Gợi ý trạng thái (MOCK)": "Suggested status (MOCK)",
    "Chỉnh sửa hồ sơ vay": "Edit loan application",
    "Giải thích kết quả minh họa": "Illustrative result explanation",
    "Đã đổi kịch bản đánh giá MOCK.": "MOCK assessment scenario changed.",
    "Hồ sơ chưa qua kiểm tra dữ liệu.": "Application has not passed validation.",
    "Cần sửa dữ liệu tại #09 / #10.": "Correct data in #09 / #10.",
    "Kiểm tra tài chính #10 chưa đạt.": "Financial validation #10 failed.",
    "Không thực hiện đánh giá khi dữ liệu không hợp lệ.": "No assessment on invalid data.",
    "Chưa có điểm dự đoán từ mô hình ML.": "No prediction score from ML.",
    "Không thể xác định trạng thái khi thiếu đầu ra ML.": "Cannot determine status without ML output.",
    "ML output chưa được kết nối.": "ML output is not connected.",
    "Không suy diễn kết quả tín dụng khi thiếu điểm rủi ro.": "Do not infer a credit decision without a risk score.",
    "Điểm rủi ro thấp theo ngưỡng MOCK.": "Low risk under MOCK thresholds.",
    "Điểm rủi ro trung bình theo ngưỡng MOCK.": "Medium risk under MOCK thresholds.",
    "Điểm rủi ro cao theo ngưỡng MOCK.": "High risk under MOCK thresholds.",
    "Đang hiển thị kết quả theo kịch bản rủi ro giả lập.": "Displaying a simulated risk scenario result.",
    "Ngưỡng minh họa: dưới 40 → APPROVE; 40–69 → REVIEW; từ 70 → REJECT.": "Illustrative thresholds: below 40 → APPROVE; 40–69 → REVIEW; 70+ → REJECT.",
    "Chưa có policy duyệt, xác nhận ML hay API backend.": "No approved policy, verified ML or backend API.",

    "Hồ sơ vay": "Loan Application",
    "Nhập hồ sơ": "Enter application",
    "Kiểm tra tài chính": "Financial Validation",
    "Nhập hồ sơ vay MOCK. Dữ liệu chỉ lưu trên trình duyệt, chưa gửi PostgreSQL hoặc ML.": "Enter a MOCK loan application. Data stays in this browser; it is not sent to PostgreSQL or ML.",
    "Hồ sơ đề nghị vay": "Loan application",
    "Nhập và chỉnh sửa thông tin. Bấm Kiểm tra để xem lỗi theo #10; Lưu MOCK để giữ dữ liệu trên thiết bị này.": "Enter and edit information. Validate using #10, then save MOCK data on this device.",
    "Khách hàng": "Customer",
    "Tài chính": "Financial details",
    "Kiểm tra": "Validate",
    "Lưu MOCK": "Save MOCK",
    "Thông tin khách hàng & khoản vay": "Customer and loan details",
    "Schema MOCK tạm thời, có thể chuyển sang API adapter khi nhóm thống nhất hợp đồng dữ liệu.": "Provisional MOCK schema; an API adapter can be used after the team agrees on a data contract.",
    "Mã khách hàng": "Customer ID",
    "Họ và tên": "Full name",
    "Tuổi": "Age",
    "Thu nhập hàng tháng (VNĐ)": "Monthly income (VND)",
    "Chi phí hàng tháng (VNĐ)": "Monthly expenses (VND)",
    "Khoản trả nợ hiện tại/tháng (VNĐ)": "Existing monthly debt payment (VND)",
    "Số tiền đề nghị vay (VNĐ)": "Requested loan amount (VND)",
    "Thời hạn vay (tháng)": "Loan term (months)",
    "Mục đích vay": "Loan purpose",
    "Chọn mục đích": "Select a purpose",
    "Tiêu dùng cá nhân": "Personal",
    "Kinh doanh": "Business",
    "Giáo dục": "Education",
    "Nhà ở": "Housing",
    "Khác": "Other",
    "Kiểm tra & lưu MOCK": "Validate & save MOCK",
    "Kiểm tra dữ liệu": "Validate data",
    "Reset hồ sơ": "Reset application",
    "Dữ liệu giả lập, không phải hồ sơ tín dụng được phê duyệt.": "Synthetic data, not an approved credit application.",
    "Trạng thái hồ sơ": "Application status",
    "Các giới hạn kiểm tra hiện chỉ là quy tắc nhập liệu minh họa, không phải chính sách xét duyệt tín dụng.": "These limits are illustrative input rules, not credit approval policy.",
    "Kiểm tra dữ liệu tài chính của hồ sơ vay MOCK; không áp dụng chính sách phê duyệt tín dụng.": "Validate MOCK loan financial inputs; no credit approval policy is applied.",
    "Kiểm tra hồ sơ vay": "Validate loan application",
    "Kết quả dựa trên hồ sơ MOCK đã lưu tại Input Module. Các giới hạn là giả định để kiểm thử UI.": "Results use the MOCK application saved in Input Module. Limits are UI-testing assumptions.",
    "Kiểm tra lại": "Revalidate",
    "Trường không hợp lệ": "Invalid fields",
    "Kiểm tra nhập liệu": "Input validation",
    "Tóm tắt hồ sơ": "Application summary",
    "Validation PASS không có nghĩa khoản vay được chấp thuận. Chưa kết nối ML, Decision Engine hay PostgreSQL.": "Validation PASS does not mean loan approval. ML, Decision Engine and PostgreSQL are not connected.",
    "Chỉnh sửa tại Input Module": "Edit in Input Module",
    "Không có lỗi nhập liệu": "No input errors",
    "Hồ sơ MOCK hiện tại vượt qua các quy tắc kiểm tra dữ liệu mẫu.": "The MOCK application passes the sample data validation rules.",
    "Đã lưu hồ sơ MOCK trong trình duyệt.": "MOCK application saved in the browser.",
    "Đã reset hồ sơ MOCK.": "MOCK application reset.",
    "Đã kiểm tra lại dữ liệu MOCK.": "MOCK data revalidated.",
    "Vui lòng sửa các trường chưa hợp lệ.": "Please correct invalid fields.",
    "Kiểm tra MOCK thành công.": "MOCK validation passed.",
    "Hồ sơ chưa hợp lệ, chưa lưu.": "Application is invalid and was not saved.",

    "Trạng thái xử lý & thông báo": "Processing states & notifications",
    "Thử các trạng thái giao diện. Đây chỉ là mô phỏng, không gửi hồ sơ, không chạy ML và không lưu vào PostgreSQL.": "Try UI states. This is only a simulation: no application is submitted, no ML runs, and nothing is stored in PostgreSQL.",
    "Xem thông báo mẫu": "Show sample notification",
    "Mô phỏng đang xử lý": "Simulate loading",
    "Xem trạng thái lỗi": "Show error state",
    "Sẵn sàng kiểm thử giao diện (MOCK).": "Ready to test the UI (MOCK).",
    "Đã hiển thị thông báo mẫu. Không có dữ liệu nào được lưu.": "Sample notification displayed. No data was saved.",
    "Đây là thông báo mẫu, không phải kết quả xử lý thật.": "This is a sample notification, not a real processing result.",
    "Không có kết nối backend: chưa thể xử lý hồ sơ thật.": "No backend connection: real applications cannot be processed.",
    "Chưa kết nối backend hoặc ML. Không có yêu cầu thật nào được gửi.": "Backend and ML are not connected. No real request was sent.",
    "Đang mô phỏng xử lý…": "Simulating processing…",
    "Mô phỏng hoàn tất. Không có backend hoặc mô hình ML được gọi.": "Simulation complete. No backend or ML model was called.",
    "Đã kết thúc mô phỏng trạng thái tải.": "Loading-state simulation completed.",
    "FinRisk DSS · DEMO": "FinRisk DSS · DEMO",

    "FinRisk DSS · Tổng quan": "FinRisk DSS · Overview",
    "Hero & KPI Dashboard · dữ liệu minh họa, chưa tích hợp backend.": "Hero & KPI Dashboard · illustrative data, backend not connected.",
    "Hiểu rủi ro rõ hơn.": "Understand risk more clearly.",
    "Ra quyết định tự tin hơn.": "Make decisions with greater confidence.",
    "Nhập hồ sơ vay": "Enter loan application",
    "Xem luồng đánh giá": "View assessment flow",
    "Chưa kết nối ML/PostgreSQL": "ML/PostgreSQL not connected",
    "Hồ sơ": "Applications",
    "Phê duyệt": "Approved",
    "Cần xem xét": "Needs review",
    "Minh họa": "Illustrative",
    "Concept UI · Chưa chạy mô hình": "Concept UI · Model not running",
    "Không phải quyết định tín dụng thật": "Not an actual credit decision",
    "Tổng quan danh mục hồ sơ": "Loan portfolio overview",
    "Số liệu giả lập để kiểm tra giao diện. Chưa kết nối PostgreSQL, API hoặc mô hình ML.": "Synthetic figures for UI testing. PostgreSQL, API and ML model are not connected.",
    "Tổng hồ sơ": "Total applications",
    "Tỷ lệ phê duyệt": "Approval rate",
    "Chờ xem xét": "Pending review",
    "Rủi ro cao": "High risk",
    "100% dữ liệu minh họa": "100% illustrative data",
    "854 hồ sơ (giả lập)": "854 applications (mock)",
    "227 hồ sơ (giả lập)": "227 applications (mock)",
    "167 hồ sơ (giả lập)": "167 applications (mock)",
    "Phân bố trạng thái hồ sơ": "Application status distribution",
    "Xu hướng hồ sơ theo tháng": "Monthly application trend",
    "Giả lập · 1.248 hồ sơ": "Mock · 1,248 applications",
    "Giả lập · Tháng 5–10/2026": "Mock · May–October 2026",
    "Phê duyệt 68,4%": "Approved 68.4%",
    "Xem xét 18,2%": "Review 18.2%",
    "Rủi ro cao 13,4%": "High risk 13.4%",
    "Tin tức tài chính và vay vốn": "Finance and lending news",
    "TIN TỨC & KIẾN THỨC": "NEWS & INSIGHTS",
    "Tin tức tài chính, tín dụng và quản trị rủi ro": "Finance, lending and risk management news",
    "Nguồn tham khảo từ cơ quan quản lý và tổ chức quốc tế. Nội dung được biên tập tóm tắt, không phải dữ liệu đánh giá khoản vay thời gian thực.": "Reference sources from regulators and international organizations. Editorial summaries, not real-time loan assessment data.",
    "Nguồn Ngân hàng Nhà nước": "State Bank of Vietnam sources",
    "Chính sách tín dụng": "Credit policy",
    "Quản trị rủi ro": "Risk management",
    "Tiếp cận tài chính": "Financial inclusion",
    "Dữ liệu tín dụng": "Credit data",
    "Tài chính số": "Digital finance",
    "Xem nguồn gốc": "View original source",
    "NGÂN HÀNG NHÀ NƯỚC": "STATE BANK OF VIETNAM",
    "Giới hạn cấp tín dụng theo Luật Các tổ chức tín dụng 2024": "Credit limits under the 2024 Law on Credit Institutions",
    "Tìm hiểu lộ trình giới hạn cấp tín dụng và mục tiêu kiểm soát rủi ro tập trung.": "Explore credit limit schedules and concentrated risk control objectives.",
    "Quản lý nợ xấu và các cơ chế bảo vệ hệ thống ngân hàng": "Non-performing loan management and banking safeguards",
    "Thông tin về quản lý rủi ro, xử lý nợ xấu và các biện pháp can thiệp đặc biệt.": "Information on risk management, bad debt resolution and special intervention measures.",
    "Phát triển dịch vụ tài chính và tiếp cận vốn bền vững": "Developing financial services and sustainable access to credit",
    "Tổng quan các ưu tiên về tiếp cận tài chính, hạ tầng tài chính và cho vay bền vững.": "Overview of financial inclusion, infrastructure and sustainable lending priorities.",
    "Các chỉ số tài chính và tín dụng của Việt Nam": "Vietnam's financial and credit indicators",
    "Khám phá nguồn dữ liệu thống kê về tín dụng, ngân hàng và các chỉ tiêu tài chính.": "Explore statistics on lending, banking and financial indicators.",
    "Điện thoại thúc đẩy tiết kiệm và tiếp cận dịch vụ tài chính": "Mobile phones support savings and financial inclusion",
    "Global Findex 2025 ghi nhận vai trò của điện thoại trong mở rộng tài khoản, tiết kiệm và thanh toán tại các nền kinh tế đang phát triển.": "Global Findex 2025 highlights mobile phones in expanding accounts, savings and payments in developing economies.",
    "Global Findex 2025: Dữ liệu về vay vốn và tài chính số tại Việt Nam": "Global Findex 2025: Lending and digital finance data in Vietnam",
    "Bộ dữ liệu khảo sát tại Việt Nam giúp tham khảo hành vi sử dụng tài khoản, thanh toán, tiết kiệm và vay vốn của người trưởng thành.": "Vietnam survey data on adults' account usage, payments, savings and borrowing.",
    "Lộ trình phát triển hệ thống hỗ trợ quyết định tín dụng FinRisk DSS": "FinRisk DSS credit decision support roadmap",
    "Ba định hướng sản phẩm dưới đây là concept UI, chưa phải tính năng nghiệp vụ đã triển khai. Kết quả đánh giá cần được kiểm chứng với schema, mô hình ML và policy đã thống nhất.": "The three directions below are UI concepts, not implemented business features. Assessments require an agreed schema, ML model and policy.",
    "Hồ sơ tín dụng": "Credit profiles",
    "Báo cáo tín dụng": "Credit reports",
    "AI & Decision Engine": "AI & Decision Engine",
    "Chuẩn hóa dữ liệu khách hàng và khoản vay": "Standardize customer and loan data",
    "Hồ sơ khách hàng": "Customer profile",
    "Thu nhập & khoản vay": "Income & loans",
    "Kiểm tra trường dữ liệu": "Field validation",
    "Trạng thái hồ sơ": "Application status",
    "Form hồ sơ theo schema đã được nhóm phê duyệt": "Application form based on the team-approved schema",
    "Kiểm tra trường bắt buộc và định dạng tài chính": "Validate required fields and financial formats",
    "Lưu, truy xuất và theo dõi phiên bản hồ sơ khi có backend": "Store, retrieve and version applications once a backend exists",
    "Phân biệt dữ liệu demo và dữ liệu thực": "Distinguish demo data from real data",
    "Thông tin hồ sơ và chỉ số đầu vào": "Application details and input metrics",
    "Lịch sử & dấu vết quyết định": "Decision history and audit trail",
    "Thông báo quan trọng": "Important notice",
    "Giải pháp": "Solutions",
    "Khám phá": "Explore",
    "Tin tức tài chính": "Financial news",
    "Câu hỏi thường gặp": "Frequently asked questions",
    "Dự án học thuật FinRisk DSS · Nhóm 06": "FinRisk DSS academic project · Team 06",
    "Trạng thái: Giao diện thử nghiệm (UI DEMO)": "Status: Experimental interface (UI DEMO)",
    "Không thu thập thông tin cá nhân thật trong bản demo": "Do not enter real personal information in this demo",
    "Không gian hỗ trợ đánh giá rủi ro tín dụng: hồ sơ khách hàng, chỉ số tổng quan, giải thích kết quả và định hướng hỗ trợ ra quyết định. Các tính năng chưa tích hợp được trình bày dưới dạng demo.": "A credit risk decision support workspace for customer profiles, portfolio metrics, explainable results and decision workflows. Unintegrated features are shown as demos.",
    "Hồ sơ tín dụng (đang phát triển)": "Credit profiles (in development)",
    "Dashboard KPI (MOCK)": "KPI Dashboard (MOCK)",
    "Đánh giá rủi ro (định hướng)": "Risk assessment (planned)",
    "Decision Trace (định hướng)": "Decision Trace (planned)",
    "Báo cáo tín dụng (định hướng)": "Credit reports (planned)",
    "FinRisk DSS là nguyên mẫu phục vụ học tập và trình diễn. Các chỉ số MOCK không phản ánh hồ sơ vay thực tế. Hệ thống không đưa ra phê duyệt tín dụng chính thức và không thay thế thẩm định của tổ chức tài chính.": "FinRisk DSS is an educational prototype. MOCK metrics do not represent real applications. It does not grant credit approval or replace professional financial underwriting.",
    "Minh bạch dữ liệu": "Data transparency",
    "Hỗ trợ quyết định": "Decision support",
    "Không phải tư vấn tài chính": "Not financial advice",
    "Điều hướng giới thiệu sản phẩm": "Product navigation",
    "Không gian hỗ trợ đánh giá rủi ro tín dụng": "Credit risk decision support workspace",
    "Chưa có backend": "No backend yet",
    "Trạng thái kỹ thuật": "Technical status",
    "Không tự biến missing thành 0": "Never replace missing values with zero",
    "Thiếu dữ liệu → REVIEW/BLOCKED": "Missing data → REVIEW/BLOCKED",
    "Không copy synthetic vào field real": "Do not copy synthetic data into real fields",
    "Result nối tới rule, issue và gate": "Results link to rules, issues and gates",

    "Giải pháp": "Solutions",
    "Quy trình": "Workflow",
    "Hỏi đáp": "FAQ",
    "Mở workspace": "Open workspace",
    "Tổng quan": "Overview",
    "Bằng chứng": "Evidence",
    "Tổng quan sản phẩm": "Product overview",
    "Trạng thái kỹ thuật": "Technical status",
    "Sản phẩm của TerraMetric": "A TerraMetric product",
    "Ghi chú vận hành": "Operational notes",
    "Dự án": "Project",
    "Đóng": "Close",
    "Đang xử lý…": "Processing…",
    "Thao tác không hoàn tất.": "The action could not be completed.",
    "Mở dữ liệu demo": "Open demo data",
    "Xem Evidence Graph": "View Evidence Graph",
    "Hồ sơ hiện đã đủ để mở numeric release chưa?": "Is the current evidence set ready for numeric release?",
    "Kết luận runtime": "Runtime conclusion",
    "Mở Đánh giá tín dụng": "Open Credit Assessment",
    "Đánh giá tín dụng": "Credit Assessment",
    "Kiểm kê": "Inventory",
    "Báo cáo": "Reporting",
    "Dự báo": "Forecasting",
    "So sánh quy trình dữ liệu": "Compare data workflows",
    "Cần xử lý trước release": "Requires action before release",
    "Không có blocker": "No blockers",
    "Không có validation issue": "No validation issues",
    "Không có issue phù hợp bộ lọc": "No issues match this filter",
    "Không có release blocker": "No release blockers",
    "Chưa đủ điều kiện phát hành kết quả số": "Not ready to release numeric results",
    "Người duyệt UAT": "UAT reviewer",
    "Họ và tên reviewer": "Reviewer full name",
    "Ghi chú người test": "Tester notes",
    "Mục đích:": "Purpose:",
    "Dữ liệu/mẫu cần test": "Test data / sample",
    "Các bước": "Steps",
    "Đạt khi hiện": "Pass criteria",
    "Không đạt nếu": "Fail if",
    "Cách sửa/điều tra": "Fix / investigate",
    "Bằng chứng cần lưu": "Evidence to retain",
    "Lưu reviewer": "Save reviewer",
    "SẴN SÀNG XUẤT": "READY TO EXPORT",
    "CHƯA ĐỦ ĐIỀU KIỆN": "NOT READY",
    "Đang tạo HTML…": "Generating HTML…",
    "Đang tạo JSON…": "Generating JSON…",
    "Đang tạo UAT JSON…": "Generating UAT JSON…",
    "Sản phẩm": "Product",
    "Quy trình xử lý dữ liệu": "Data processing workflow",
    "Tính năng": "Capabilities",
    "Lợi ích": "Benefits",
    "Tin tức": "News",
    "TIN TỨC & KIẾN THỨC": "NEWS & INSIGHTS",
    "VIỆT NAM": "VIETNAM",
    "QUỐC TẾ": "INTERNATIONAL",
    "Đọc tiếp": "Read more",
    "Thị trường thép 2026: Sản lượng tăng, xuất khẩu đối mặt nhiều rào cản": "Steel market 2026: output rises while exports face multiple barriers",
  }));

  // Ordered longest-first. These replacements cover dynamic strings produced by app.js,
  // validation rules, demo data and the UAT catalog without changing business logic.
  const phrases = [
    ["Landing + product narrative ở phía trên, operational workspace ở các module bên dưới.", "Landing page and product narrative above; operational workspace modules below."],
    ["trước khi một working result được phép đi xa hơn.", "before a working result is allowed to proceed further."],
    ["Các card dưới đây mô tả hướng mở rộng sản phẩm, không phải module đã hoàn thiện trong RC1. Lõi đang chạy vẫn là data control, evidence trace, validation và release guardrail.", "The cards below describe product-roadmap directions, not completed RC1 modules. The running core remains data control, evidence traceability, validation, and release guardrails."],
    ["Theo dõi khoảng trống bằng chứng HRC và giữ synthetic substitute tách biệt khỏi REAL_REQUIRED evidence.", "Track HRC evidence gaps while keeping synthetic substitutes separate from REAL_REQUIRED evidence."],
    ["Issue management dashboard cho C3; mỗi Apply sẽ chạy lại rule engine và cập nhật candidate classification.", "C3 issue-management dashboard; every Apply reruns the rule engine and updates candidate classification."],
    ["Evidence Graph workspace: xem node, relation, integrity và đường trace từ batch tới result/gate.", "Evidence Graph workspace: inspect nodes, relations, integrity, and the trace path from batch to result/gate."],
    ["Readiness/gate dashboard cho C6; giải thích rõ điều kiện nào đang giữ numeric result ở BLOCKED/MASKED.", "C6 readiness/gate dashboard explaining which conditions keep the numeric result BLOCKED/MASKED."],
    ["Report Center cho C7: tạo working-only HTML và trace JSON trực tiếp trên localhost, không phát hành numeric emission result.", "C7 Report Center: generate working-only HTML and trace JSON directly on localhost without releasing numeric emissions."],
    ["C8 pipeline console: quan sát toàn luồng Input → Validation → Graph → Gate → Working Export và các technical safety checks.", "C8 pipeline console: observe the full Input → Validation → Graph → Gate → Working Export flow and technical safety checks."],
    ["FinRisk DSS · 12 UAT thủ công cho #09/#10/#11/#12/#13/#15/#20. Kết quả chưa phải nghiệm thu của leader.", "FinRisk DSS · 12 manual UAT cases for #09/#10/#11/#12/#13/#15/#20. Results are not leader approval."],
    ["12 tình huống kiểm thử", "12 test scenarios"],
    ["Người thực hiện UAT", "UAT tester"],
    ["Họ tên người kiểm thử", "Tester full name"],
    ["Lưu reviewer", "Save reviewer"],
    ["Các bước:", "Steps:"],
    ["Ghi chú, tên file bằng chứng, thiết bị/trình duyệt", "Notes, evidence filenames, device/browser"],
    ["Xuất UAT JSON", "Export UAT JSON"],
    ["Reset UAT", "Reset UAT"],
    ["Đã reset UAT.", "UAT reset."],
    ["QA console cho D1/D3/D4/D5 manual acceptance; UAT record tách biệt hoàn toàn khỏi runtime release/compliance state.", "QA console for D1/D3/D4/D5 manual acceptance; the UAT record remains completely separate from runtime release/compliance state."],
    ["Nhập working data theo từng nhóm; Apply sẽ validate, rebuild graph và cập nhật release state ngay trên localhost.", "Enter working data by group; Apply validates, rebuilds the graph, and updates release state locally."],
    ["Working data đã được lưu và pipeline derived-state đã chạy lại.", "Working data was saved and the derived-state pipeline was rerun."],
    ["Working state đã trở về synthetic baseline.", "Working state has been reset to the synthetic baseline."],
    ["Validation, graph và release state đã được tính lại.", "Validation, graph, and release state have been recomputed."],
    ["End-to-End technical safety checks đã được recompute.", "End-to-End technical safety checks have been recomputed."],
    ["Hoàn tất manual evidence, định danh reviewer thật và chỉ export UAT JSON khi toàn bộ case đạt.", "Complete manual evidence, identify the actual reviewer, and export UAT JSON only when every case passes."],
    ["Tên này đi vào UAT JSON và phải là người thực sự review.", "This name is stored in the UAT JSON and must identify the actual reviewer."],
    ["Export chỉ mở khi 10/10 PASS + reviewer đã định danh.", "Export is enabled only when 10/10 cases PASS and a reviewer is identified."],
    ["Không dùng placeholder/UNSPECIFIED_REVIEWER.", "Do not use a placeholder or UNSPECIFIED_REVIEWER."],
    ["Cần đủ 10/10 PASS và họ tên reviewer thực tế trước khi xuất UAT.", "All 10/10 cases must PASS and an actual reviewer name is required before UAT export."],
    ["Manual UAT result và reviewer đã được reset.", "Manual UAT results and reviewer have been reset."],
    ["Reviewer đang để trống.", "Reviewer is blank."],
    ["Reviewer đã lưu:", "Reviewer saved:"],
    ["Lần kiểm tra gần nhất:", "Last checked:"],
    ["Máy/trình duyệt, kết quả quan sát, link/filename bằng chứng...", "Device/browser, observed result, evidence link/filename..."],
    ["Nhập họ và tên người thực sự duyệt", "Enter the actual reviewer's full name"],

    ["Chưa được khóa bằng real evidence", "Not locked by real evidence"],
    ["SEE đang blank; không mặc định thành 0", "SEE is blank; it does not default to 0"],
    ["OPEN — vẫn chặn numeric release", "OPEN — numeric release remains blocked"],
    ["CHƯA ĐỦ — GIỮ BLOCKED / MASKED", "NOT READY — KEEP BLOCKED / MASKED"],
    ["Thiếu dữ liệu → REVIEW/BLOCKED", "Missing data → REVIEW/BLOCKED"],
    ["Result nối tới rule, issue và gate", "Result links to rule, issue, and gate"],
    ["Không copy synthetic vào field real", "Synthetic values are never copied into real fields"],
    ["Không tự biến missing thành 0", "Missing values never become 0 automatically"],
    ["Không có demo substitute", "No demo substitute"],
    ["SYNTHETIC_ONLY · không đóng real gap", "SYNTHETIC_ONLY · does not close real gap"],
    ["Working state hiện không sinh issue nào.", "The current working state produces no issues."],
    ["Chọn ALL hoặc một severity khác để tiếp tục.", "Choose ALL or another severity to continue."],
    ["Lane này chưa có entity tương ứng trong working graph.", "This lane has no corresponding entity in the working graph."],
    ["Release engine hiện không trả về reason chặn nào.", "The release engine currently returns no blocking reasons."],
    ["Không có tCO₂e/SEE numeric output trong C6.", "No tCO₂e/SEE numeric output is released in C6."],
    ["Technical safety flow; không phải compliance decision.", "Technical safety flow; not a compliance decision."],
    ["Diễn giải đúng:", "Correct interpretation:"],
    ["chỉ chứng minh các module local nối đúng và guardrail hoạt động", "only demonstrates that local modules connect correctly and guardrails operate"],
    ["đã được tạo trong trình duyệt local.", "was generated in the local browser."],
    ["đã được ghi", "was recorded as"],

    ["Chuẩn hóa dữ liệu", "Standardize data"],
    ["quản lý bằng chứng", "manage evidence"],
    ["truy vết", "trace"],
    ["bằng chứng", "evidence"],
    ["dữ liệu", "data"],
    ["Dữ liệu", "Data"],
    ["giả lập", "synthetic"],
    ["kết quả", "result"],
    ["Kết quả", "Result"],
    ["thẩm tra", "verification"],
    ["kiểm tra", "check"],
    ["Kiểm tra", "Check"],
    ["quy tắc", "rules"],
    ["Quy tắc", "Rules"],
    ["cảnh báo", "warning"],
    ["Cảnh báo", "Warning"],
    ["rủi ro", "risk"],
    ["Rủi ro", "Risk"],
    ["trạng thái", "status"],
    ["Trạng thái", "Status"],
    ["nguồn", "source"],
    ["Nguồn", "Source"],
    ["phạm vi", "scope"],
    ["Phạm vi", "Scope"],
    ["được chọn", "is selected"],
    ["chưa được khóa", "is not locked"],
    ["bắt buộc", "required"],
    ["không được", "must not"],
    ["Không được", "Must not"],
    ["không thể", "cannot"],
    ["Không thể", "Cannot"],
    ["không có", "no"],
    ["Không có", "No"],
    ["chưa có", "not yet available"],
    ["Chưa có", "Not yet available"],
    ["đang", "is"],
    ["Đang", "Currently"],
    ["phải", "must"],
    ["Phải", "Must"],
    ["cần", "need"],
    ["Cần", "Need"],
    ["để", "to"],
    ["khi", "when"],
    ["nếu", "if"],
    ["Nếu", "If"],
    ["và", "and"],
    [" hoặc ", " or "],
    ["theo", "according to"],
    ["trong", "in"],
    ["trước", "before"],
    ["sau", "after"],
    ["vẫn", "still"],
    ["hiện", "currently"],
    ["mở", "open"],
    ["Mở", "Open"],
    ["đóng", "close"],
    ["Đóng", "Close"],
    ["lưu", "save"],
    ["Lưu", "Save"],
    ["xuất", "export"],
    ["Xuất", "Export"],
    ["nhập", "enter"],
    ["Nhập", "Enter"],
    ["chạy", "run"],
    ["Chạy", "Run"],
    ["xóa", "remove"],
    ["Xóa", "Remove"],
    ["sửa", "fix"],
    ["Sửa", "Fix"],
    ["chọn", "select"],
    ["Chọn", "Select"],
    ["đúng", "correct"],
    ["Đúng", "Correct"],
    ["sai", "incorrect"],
    ["Sai", "Incorrect"],
    ["hợp lệ", "valid"],
    ["thiếu", "missing"],
    ["Thiếu", "Missing"],
    ["thật", "real"],
    ["người duyệt", "reviewer"],
    ["Người duyệt", "Reviewer"],
    ["người test", "tester"],
    ["bản demo", "demo build"],
    ["bản build", "build"],
    ["trình duyệt", "browser"],
    ["cửa sổ", "window"],
    ["thời điểm", "timestamp"],
    ["đường dẫn", "path"],
    ["liên kết", "link"],
    ["màn hình", "screen"],
    ["trường", "field"],
    ["giá trị", "value"],
    ["thay đổi", "change"],
    ["hiển thị", "display"],
    ["tạo", "generate"],
    ["mẫu", "sample"],
    ["quy trình", "workflow"],
    ["chuỗi", "chain"],
    ["sẵn sàng", "ready"],
    ["điều kiện", "condition"],
    ["phê duyệt", "approval"],
    ["duyệt", "review"],
    ["giữ", "keep"],
    ["khóa", "lock"],
    ["định danh", "identity"],
    ["Định danh", "Identity"],
    ["áp dụng", "apply"],
    ["khôi phục", "restore"],
    ["lỗi", "error"],
    ["Lỗi", "Error"],
    ["dừng", "stop"],
    ["Dừng", "Stop"],
    ["tiếp tục", "continue"],
    ["hoàn tất", "complete"],
    ["Hoàn tất", "Complete"],
    ["chứng minh", "demonstrate"],
    ["Xác nhận", "Confirm"],
    ["xác nhận", "confirm"],
    ["đối chiếu", "verify"],
    ["Đối chiếu", "Verify"],
    ["lần lượt", "sequentially"],
    ["tương ứng", "corresponding"],
    ["toàn bộ", "all"],
    ["mỗi", "each"],
    ["Mỗi", "Each"],
    ["một", "one"],
    ["Một", "One"],
    ["nhiều", "multiple"],
    ["ngày", "date"],
    ["năm", "year"],
    ["cổng", "port"],
    ["ảnh", "screenshot"],
    ["Ảnh", "Screenshot"],
    ["dòng", "line"],
    ["từ khóa", "keywords"],
    ["gói", "package"],
    ["nội bộ", "internal"],
    ["kỹ thuật", "technical"],
    ["thực tế", "real-world"],
    ["tự động", "automated"],
    ["thủ công", "manual"],
    ["cục bộ", "locally"],
    ["được phép", "is allowed"],
    ["không phải", "is not"],
    ["Không phải", "Not"],
    ["đánh giá", "evaluate"],
    ["quyết định", "decision"],
    ["cơ sở", "facility"],
    ["nhà máy", "plant"],
    ["chi nhánh", "site"],
    ["Điện lưới", "Grid electricity"],
    ["Nhiên liệu", "Fuel"],
    ["Chuỗi giá trị", "Value chain"],
    ["Hệ thống kiểm kê toàn diện", "Comprehensive inventory system"],
    ["Xuất báo cáo theo nhiều định dạng", "Export reports in multiple formats"],
    ["Mẫu báo cáo KNK", "GHG report template"],
    ["Tính toán & phân tích kịch bản", "Scenario calculation & analysis"],
    ["Xu hướng", "Trend"],
    ["Mục tiêu", "Target"],
    ["Tổng quan dự án", "Project overview"],
    ["Câu hỏi thường gặp", "Frequently asked questions"],
    ["Ghi chú vận hành", "Operational notes"]
  ].sort((a, b) => b[0].length - a[0].length);

  // Weak references avoid retaining detached screens after repeated navigation.
  const textOriginal = new WeakMap();
  const textTranslated = new WeakMap();
  const attrOriginal = new WeakMap();
  const trackedText = new Set();
  const trackedElements = new Set();
  const ATTRS = ["title", "aria-label", "placeholder", "alt"];
  let language = DEFAULT_LANGUAGE;
  let observer;

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    return leading + translated.trim() + trailing;
  }

  function translateString(input) {
    if (!input) return input;
    const trimmed = input.trim();
    if (exact.has(trimmed)) return preserveWhitespace(input, exact.get(trimmed));
    // Preserve English/technical labels unless an explicit translation exists.
    if (!VIETNAMESE_RE.test(input)) return input;
    let out = input;
    phrases.forEach(([vi, en]) => {
      if (out.includes(vi)) out = out.split(vi).join(en);
    });
    return out;
  }

  function translateTextNode(node) {
    const current = node.nodeValue || "";
    if (!current.trim() || node.parentElement?.closest("script, style, code, pre, [data-i18n-ignore]")) return;
    const lastTranslation = textTranslated.get(node);
    if (lastTranslation === current) return;
    // A re-render can reuse the same text node: treat changed content as new source.
    textOriginal.set(node, current);
    trackedText.add(node);
    const translated = translateString(current);
    textTranslated.set(node, translated);
    if (translated !== current) node.nodeValue = translated;
  }

  function translateAttributes(element) {
    if (!element.hasAttribute || element.closest?.("[data-i18n-ignore]")) return;
    ATTRS.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      let originals = attrOriginal.get(element);
      if (!originals) {
        originals = {};
        attrOriginal.set(element, originals);
      }
      const current = element.getAttribute(name) || "";
      // Only a value not previously emitted by us is a new original.
      const previous = originals[name];
      if (!previous || (current !== previous.source && current !== previous.translated)) {
        originals[name] = { source: current, translated: translateString(current) };
      }
      trackedElements.add(element);
      const next = originals[name].translated;
      if (next !== current) element.setAttribute(name, next);
    });
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node);
      node = walker.nextNode();
    }
  }

  function restoreVietnamese() {
    if (observer) observer.disconnect();
    for (const node of trackedText) {
      if (!node.isConnected) { trackedText.delete(node); continue; }
      const original = textOriginal.get(node);
      const translated = textTranslated.get(node);
      if (original !== undefined && node.nodeValue === translated) node.nodeValue = original;
    }
    for (const element of trackedElements) {
      if (!element.isConnected) { trackedElements.delete(element); continue; }
      const originals = attrOriginal.get(element) || {};
      Object.entries(originals).forEach(([name, pair]) => {
        if (element.getAttribute(name) === pair.translated) element.setAttribute(name, pair.source);
      });
    }
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function syncLanguageButton() {
    const button = document.getElementById("language-toggle");
    if (!button) return;
    button.textContent = language === "vi" ? "VI" : "EN";
    button.setAttribute("aria-label", language === "vi" ? "Ngôn ngữ hiện tại: Tiếng Việt. Chuyển sang English" : "Current language: English. Switch to Vietnamese");
    button.title = language === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt";
    document.documentElement.lang = language;
  }

  function applyLanguage(nextLanguage, animate = false) {
    language = nextLanguage === "en" ? "en" : "vi";
    try { window.localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
    const button = document.getElementById("language-toggle");
    if (animate && button) {
      button.classList.remove("is-switching");
      void button.offsetWidth;
      button.classList.add("is-switching");
      window.setTimeout(() => button.classList.remove("is-switching"), 300);
    }
    if (language === "en") walk(document.body);
    else restoreVietnamese();
    syncLanguageButton();
    document.dispatchEvent(new CustomEvent("cg:languagechange", { detail: { language } }));
  }

  function initObserver() {
    observer = new MutationObserver((mutations) => {
      if (language !== "en") return;
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") translateTextNode(mutation.target);
        if (mutation.type === "attributes") translateAttributes(mutation.target);
        mutation.addedNodes?.forEach((node) => walk(node));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function init() {
    const button = document.getElementById("language-toggle");
    if (!button) return;
    button.addEventListener("click", () => applyLanguage(language === "vi" ? "en" : "vi", true));
    initObserver();
    let saved = DEFAULT_LANGUAGE;
    try { saved = window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE; } catch (_) {}
    applyLanguage(saved === "en" ? "en" : "vi");
  }

  init();
})();

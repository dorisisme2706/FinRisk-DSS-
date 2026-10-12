# CARBONGRAPH – RC1 RUNTIME MANIFEST v0.6.2

Ngày đóng gói: 27/08/2026  
Phân loại: `RC1_CANDIDATE / REVIEW`  
Không phải bản phát hành đã phê duyệt.

## 1. Trạng thái kiểm soát bắt buộc

- Dataset: `SYNTHETIC_DEMO`.
- R-006: `OPEN`.
- Numeric release: `BLOCKED`.
- Result visibility: `MASKED`.
- Compliance: `NOT_EVALUATED`.
- Gate 1: `CONDITIONAL PASS` theo checklist hiện hành.
- Gate 3/C9: chưa được phê duyệt.
- Không được dùng gói này để công bố tCO2e, SEE hoặc kết quả phát thải như kết quả thật.

## 2. Runtime đã kiểm tra

| Thành phần | Phiên bản/mô tả |
|---|---|
| Node.js | `v24.19.0` trên môi trường regression ngày 27/08/2026 |
| Python | `3.12.13` trên môi trường đóng gói; local launcher hỗ trợ lệnh `py` hoặc `python` trên Windows |
| Kiến trúc | Frontend tĩnh JavaScript + Python local HTTP server; không có backend API hoặc cơ sở dữ liệu server |
| Test runner | `run_tests.bat` gọi 13 test suite Node.js |
| Kết quả | `75/75 PASS` |

## 3. Thay đổi so với v0.6.1

1. Giữ nguyên D5 reviewer gate và VR-022 trace hotfix của v0.6.1.
2. Bổ sung fail-closed validator cho VR-001–005, VR-011–013 và VR-016.
3. Thêm schema phi phát hành cho period, numeric inputs, evidence approval, factor-source metadata và synthetic assumptions.
4. Thêm `claims-engine.js` và T-CLM-002 để chặn legacy/compliance/verification claim theo VR-019.
5. Quét bốn app surfaces (`index.html`, `app.js`, `report-engine.js`, `README.md`) đạt 0 finding.
6. Regression tăng từ 62 lên 75 case; numeric emissions tiếp tục `null`, UI/export vẫn fail-closed.

## 4. Thành phần chính trong gói

- `index.html`, `assets/`, `src/`: giao diện và runtime frontend.
- `serve_local.py`, `run_localhost.bat`: chạy ứng dụng qua localhost.
- `tests/`, `run_tests.bat`: regression suite.
- `CG_Validation_Rule_Coverage_Matrix_v1.1_20260827.md`: mapping VR-001–022.
- `CG_Bug_Closure_Log_v1.1_20260827.md`: BUG-001 đến BUG-003.
- `TEST_REPORT_v0.6.2_20260827.md`: kết quả 75/75.
- `CG_Test_Signoff_Register_v1.1_20260827.md`: bảng ký D5 → D1 → D3 → D4.
- `CG_Claims_Audit_Register_v0.1_20260827.md`: F1 audit theo từng bề mặt; các bề mặt chưa có giữ `PENDING`.
- `CG_VietFuture_QA_Bank_v0.1_20260827.md`: 30 câu hỏi–đáp theo năm nhóm để hoàn thiện F4.

## 5. Điều kiện còn chặn phê duyệt RC1

1. Người duyệt thật phải nhập họ tên và xuất lại D5 UAT JSON; không chấp nhận `UNSPECIFIED_REVIEWER`.
2. D1 và D3 cần Trọng Khang ký; D4 cần Khánh Linh ký; D5 cần người duyệt thực tế ký.
3. C3 đã có technical mapping cho 22/22 rule, nhưng VR-006/007 và nội dung numeric liên quan vẫn HOLD; F1 mới đạt technical scan cho app/export/README, còn deck/poster/brochure/video/script/social/booth `PENDING`.
4. Minh Thư chưa ký duyệt C3/ma trận v1.1.
5. F0 chưa có biên nhận cấu hình chung tuyển thực tế trên Drive.
6. A7 vẫn `CONDITIONAL PASS`; không được tự thay bằng PASS khi thiếu chữ ký và hyperlink/bằng chứng bắt buộc.
7. R-006 vẫn `OPEN`; C4, B1/B4/B6/B7 và phần numeric của D2 tiếp tục HOLD.

## 6. Quy tắc toàn vẹn gói

SHA-256 của tệp ZIP được phát hành riêng trong `CarbonGraph_MVP_Source_v0.6.2_20260827_RC1-CANDIDATE.zip.sha256` để tránh vòng lặp checksum khi manifest nằm bên trong gói.

Người kiểm tra phải:

1. Tính SHA-256 của ZIP vừa nhận.
2. So sánh nguyên chuỗi với tệp `.sha256`.
3. Chỉ giải nén/chạy khi hai chuỗi trùng nhau.
4. Nếu khác, coi gói bị thay đổi và không dùng làm bằng chứng.

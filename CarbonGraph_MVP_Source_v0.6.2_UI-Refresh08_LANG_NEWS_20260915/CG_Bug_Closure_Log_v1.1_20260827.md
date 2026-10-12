# CARBONGRAPH – BUG CLOSURE LOG v1.1

Ngày cập nhật: 27/08/2026  
Trạng thái gói: `RC1_CANDIDATE / REVIEW`  
Guardrail: `SYNTHETIC_DEMO`, `R-006 OPEN`, numeric `BLOCKED/MASKED`, compliance `NOT_EVALUATED`.

| Bug ID | Phát hiện | Mức độ | Nguyên nhân gốc | Sửa đổi | Kiểm tra hồi quy | Trạng thái đóng |
|---|---|---|---|---|---|---|
| BUG-001 | UAT JSON 10/10 có `reviewer = UNSPECIFIED_REVIEWER` | HIGH – bằng chứng D5 chưa ký hợp lệ | Test Center không thu và khóa tên reviewer trước khi export | Thêm reviewer input, lưu riêng localStorage, normalize tên; vô hiệu hóa Export đến khi 10/10 PASS và có tên reviewer thật; Reset xóa reviewer | `acceptance-engine.test.js`; full suite 75/75 PASS ngày 27/08/2026 | `CODE_FIXED / MANUAL_RETEST_REQUIRED`. Chỉ đóng hoàn toàn khi người thực sự duyệt nhập tên và xuất JSON mới. |
| BUG-002 | Result graph chưa có direct relation `VALIDATED_BY`; VR-022 có nguy cơ được suy từ issue→rule thay vì result→rule | BLOCKER – trace contract | Graph tạo `HAS_VALIDATION_ISSUE` và `VIOLATES_RULE` nhưng thiếu direct result→rule | Thêm relation `VALIDATED_BY` vào model/core relations; graph tạo một edge direct cho mỗi rule duy nhất; report export relation này | `graph-engine.test.js`, `formal-d1-d4.test.js`; full suite 75/75 PASS ngày 27/08/2026 | `CODE_CLOSED / D4_REVIEW_REQUIRED`. Cần D4 reviewer kiểm tra trace mới và ký. |
| BUG-003 | Ma trận C3 ghi nhận VR-001–005, 011–013, 016 và 019 còn PARTIAL/NOT IMPLEMENTED | HIGH – không đủ căn cứ duyệt C3 | Runtime mới chỉ tập trung branch classification, graph và release guardrail; thiếu validator chính thức cho nhiều rule phi số | Thêm schema metadata và fail-closed validator cho định danh, scope, CN, period, numeric domains, evidence approval, factor source, trace/version, synthetic governance; thêm VR-019 scanner | Thêm 9 case `validation-coverage.test.js` và 4 case `claims-engine.test.js`; scan 4 app surfaces có 0 finding; full suite 75/75 PASS | `CODE_CLOSED / C3_REVIEW_REQUIRED`. Không đóng C3 cho tới khi Minh Thư duyệt ma trận v1.1; numeric rules vẫn HOLD. |

## Quy tắc đóng lỗi

- `CODE_FIXED` không bằng `EVIDENCE_CLOSED`.
- Chỉ đổi BUG-001 sang `CLOSED` sau khi JSON mới có tên reviewer thật và ảnh Test Center vẫn 10/10.
- Chỉ đổi BUG-002 sang `CLOSED` sau khi D4 xác nhận trace mới có đủ `HAS_TRACE`, `VALIDATED_BY`, `GATED_BY`, integrity PASS và orphan=0.
- Chỉ đổi BUG-003 sang `CLOSED` sau khi Minh Thư duyệt C3 và F1 ghi nhận kết quả quét các release surface đã tồn tại.
- Mọi sửa đổi tiếp theo phải chạy lại toàn bộ suite; không thay expected result để che lỗi.
- Lỗi làm rò rỉ số phát thải phải dừng demo/export, thu hồi file lỗi và mở blocker mới ngay.

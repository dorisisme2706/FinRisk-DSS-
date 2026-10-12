# CARBONGRAPH – TEST SIGN-OFF REGISTER v1.1

Ngày cập nhật: 27/08/2026  
Gói tham chiếu: `CarbonGraph MVP v0.6.2 RC1_CANDIDATE`  
Trạng thái chung: `PENDING HUMAN SIGN-OFF`.

## Guardrail không được thay đổi

- `SYNTHETIC_DEMO`.
- `R-006 OPEN`.
- Numeric `BLOCKED/MASKED`.
- Compliance `NOT_EVALUATED`.
- Ký test không đóng R-006, không phê duyệt Gate 3 và không xác nhận kết quả phát thải số.

## Thứ tự ký bắt buộc

| Thứ tự | Hạng mục | Người ký/duyệt | Bằng chứng phải mở kiểm tra | Điều kiện PASS | Trạng thái | Họ tên/chữ ký | Ngày giờ thực |
|---:|---|---|---|---|---|---|---|
| 1 | D5 – Manual UAT | Người thực sự thực hiện UAT | Test Center `10/10`; terminal `ALL TESTS PASSED`; UAT JSON mới | JSON có đúng tên reviewer, 10 PASS, 0 FAIL, 0 NOT_RUN; regression `75/75 PASS`; vẫn giữ đủ năm guardrail | `PENDING RE-EXPORT` |  |  |
| 2 | D1 – Test plan/schema | Trọng Khang | Test Plan, schema contract, formal D1 test | Scope đúng FAC-VN-001/RP-ST-001/2026; không mở numeric; test liên quan PASS | `PENDING SIGN-OFF` |  |  |
| 3 | D3 – Negative/boundary | Trọng Khang | Validation tests, UAT-04/05/06/07 | Blank không thành 0; invalid origin/route vào REVIEW/ERROR; release vẫn chặn | `PENDING SIGN-OFF` |  |  |
| 4 | D4 – Trace/evidence | Khánh Linh | Trace JSON mới, Graph integrity, VR-022 tests | Có HAS_TRACE/VALIDATED_BY/GATED_BY; integrity PASS; orphan 0 | `PENDING SIGN-OFF` |  |  |

## Cách hoàn tất D5

1. Chạy bản v0.6.2 qua `run_localhost.bat` và mở Test Center.
2. Xác nhận 10 case vẫn PASS; nếu không, chạy lại case bị mất trạng thái.
3. Nhập họ tên thật của reviewer vào ô reviewer và bấm lưu.
4. Bấm `Export UAT record (.json)`.
5. Mở JSON và kiểm tra `reviewer` không rỗng, không phải `UNSPECIFIED_REVIEWER`.
6. Kiểm tra `manualPass = 10`, `fail = 0`, `notRun = 0`, `reviewStatus = REVIEW_COMPLETE`.
7. Kiểm tra guardrail trong JSON vẫn là synthetic/open/blocked/masked/not-evaluated.
8. Tải JSON mới lên thư mục UAT; giữ bản cũ để audit nhưng ghi rõ `SUPERSEDED`.
9. Điền họ tên, ngày giờ thực và ký D5. Chỉ sau đó mới chuyển BUG-001 sang `CLOSED`.

## Quy tắc ký

- Không ký thay người được phân công.
- Không lùi ngày.
- Không dùng ảnh chụp một phần nếu không thấy đủ tên case/kết quả/guardrail.
- Nếu phát hiện số tCO2e/SEE, dừng ký, thu hồi export và mở blocker.
- Một chữ ký D1/D3/D4/D5 không tự động chuyển C9/Gate 3 sang PASS.

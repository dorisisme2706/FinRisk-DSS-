# CARBONGRAPH LOCAL MVP v0.6.2 – HANDOFF UPDATE

Ngày cập nhật kỹ thuật: 27/08/2026.

## Quyết định không thay đổi

- Gate 1: `CONDITIONAL PASS`.
- Dataset: `SYNTHETIC_DEMO`.
- R-006: `OPEN`.
- Numeric result: `BLOCKED/MASKED`, không tính và không phát hành.
- Compliance: `NOT_EVALUATED`.
- Candidate CN8 synthetic không phải real CN8.

## Nội dung triển khai v0.6.2

- Test Center 10 case UAT có sample/steps/pass/fail/fix/evidence.
- Manual record lưu riêng, export JSON và không thay đổi runtime guardrail.
- C3 hiển thị `MISSING` cho field bắt buộc thiếu và `REVIEW` cho nhánh chưa hỗ trợ.
- Formal D1–D4 boundary suite, gồm D2 non-numeric reconciliation.
- Test Plan/UAT Guide và Golden Dataset note phi số.
- Regression: `75/75 PASS`.
- D5 hotfix: export UAT yêu cầu tên reviewer thật và chỉ bật khi 10/10 PASS.
- VR-022 hotfix: result graph có direct `VALIDATED_BY` bên cạnh `HAS_TRACE` và `GATED_BY`.
- VR-001–005, VR-011–013 và VR-016 có validator/test fail-closed chính thức.
- VR-019 có deterministic claim scanner; app surfaces hiện tại đạt 0 finding.

## Trạng thái đề xuất trong Task Tracker

| Task | Trạng thái đề xuất | Lý do |
|---|---|---|
| C3 | Đang xem xét | Technical mapping 22/22 rule đã có; VR-006/007 và numeric content giữ HOLD; chờ Minh Thư duyệt ma trận v1.1 và F1 audit release surfaces |
| C9 | Chưa bắt đầu | Chưa đủ C1–C8 + D1–D5 sign-off |
| D1 | Đang xem xét | Test Plan và suite đã có; chờ reviewer |
| D2 | Đang thực hiện | Chỉ non-numeric baseline; numeric reconciliation HOLD |
| D3 | Đang xem xét | Negative/boundary automated tests PASS; chờ manual evidence |
| D4 | Đang xem xét | Trace/evidence tests PASS và VR-022 đã sửa; chờ reviewer ký trace mới |
| D5 | Đang xem xét | UAT 10/10 đã có nhưng JSON cũ ghi UNSPECIFIED_REVIEWER; phải xuất lại bằng tên thật |
| D6 | Đang thực hiện | Đã lập Bug Closure Log; chưa feature freeze/RC1 approval |

Không chuyển task nào sang `Hoàn thành` chỉ dựa trên automated tests.

## Người dùng cần làm

1. Chạy `run_tests.bat`; lưu log `ALL TESTS PASSED`.
2. Chạy localhost và mở Test Center.
3. Xác nhận UAT-01 đến UAT-10; ghi note/evidence và nhập đúng họ tên người thực sự duyệt.
4. Export UAT record JSON mới; kiểm tra không còn `UNSPECIFIED_REVIEWER`.
5. Gửi case FAIL để sửa; sau sửa chạy regression + retest.
6. Minh Thư/Khánh Linh ký review theo phân công.

## Công việc tiếp theo ưu tiên

1. Minh Thư duyệt `CG_Validation_Rule_Coverage_Matrix_v1.1_20260827.md` và xác nhận C3 technical coverage.
2. Xuất lại D5 UAT bằng reviewer thật và hoàn tất Bug Closure Log.
3. Rà soát Claims/Communication theo R-007 cho toàn bộ demo/deck.
4. C4 + D2 numeric tiếp tục HOLD khi R-006 OPEN.
5. Chuẩn bị C9 checklist sau khi C1–C8 và D1–D5 có bằng chứng.

## Tiến độ kỹ thuật ước tính

- C2: 90–95% (chờ manual acceptance).
- C3: khoảng 90–95% kỹ thuật; 22/22 rule có mapping chính, còn human approval/F1 audit và numeric HOLD.
- C5–C8: 85–90% (automated PASS; chờ manual review).
- D1: 85% (artifact xong; chờ reviewer).
- D2: 25–30% vì numeric portion bị chặn đúng chủ đích.
- D3–D4: 80–85% (automated PASS; chờ manual evidence).
- D5: khoảng 85–90% (10/10 có bằng chứng; chờ re-export reviewer thật và ký).
- Toàn đề tài: khoảng 52–56%; MVP core an toàn kỹ thuật khoảng 88–91%.

Các tỷ lệ là ước tính quản lý, không phải quyết định Gate.

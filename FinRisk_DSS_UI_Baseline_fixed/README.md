# CarbonGraph MVP Source v0.6.2 – C3 rule-coverage hardening

## Trạng thái bắt buộc

- `data_origin = SYNTHETIC_DEMO`
- `R-006 = OPEN`
- `numeric_release_status = BLOCKED`
- `result_visibility = MASKED`
- `compliance_status = NOT_EVALUATED`
- Không có kết quả phát thải số được tính hoặc phát hành.
- Candidate CN8 synthetic tách khỏi real HRC CN8.

Gate 1 vẫn là `CONDITIONAL PASS`. Bản v0.6.2 không tự chuyển Gate 1/Gate 3 sang PASS.

## Module đang chạy

1. C2 Input Module – editable working state.
2. C3 Validation Engine – dynamic issue; field thiếu hiện `MISSING`, nhánh chưa hỗ trợ hiện `REVIEW`.
3. C5 Dynamic Evidence Graph – node/edge build lại theo state và validation issue.
4. C6 Dynamic Release State – derive `BLOCKED/MASKED` từ data origin, R-006, validation và graph integrity.
5. Local persistence – chỉ lưu 7 editable working fields; derived state luôn recompute.
6. C7 Working Status Export – HTML/JSON trace local, không chứa kết quả phát thải số.
7. C8 Local End-to-End – technical safety acceptance; không đánh giá compliance.
8. Test Center – 10 kịch bản thủ công gồm mẫu nhập, bước test, điều kiện đạt, dấu hiệu lỗi, cách sửa và bằng chứng.
9. Formal D1–D4 boundary suite – test plan/schema, reconciliation phi số, negative/boundary, trace/evidence integrity.
10. VR-001–VR-016 fail-closed validator – identifier, scope, CN, period, numeric domain, evidence/factor metadata, trace/version và synthetic governance.
11. VR-019 Claims Engine – quét legacy/compliance/verification claim trước khi release surface được duyệt.

## Chạy localhost trên Windows

Double-click `run_localhost.bat`, sau đó dùng `http://127.0.0.1:8080`.

Giữ cửa sổ terminal mở trong lúc dùng. Nhấn `Ctrl+C` để dừng.

Cách thủ công:

```bash
python serve_local.py --port 8080
```

Không mở trực tiếp `index.html` bằng `file://` vì local persistence/download có thể khác hành vi localhost.

## Chạy automated tests

Nếu máy có Node.js, double-click `run_tests.bat`.

Baseline v0.6.2: `75/75 PASS` trên môi trường regression ngày 27/08/2026.

Đạt khi mọi case in `PASS` và dòng cuối là `ALL TESTS PASSED`. Một `FAIL` bất kỳ có nghĩa chưa đạt regression; phải sửa nguyên nhân rồi chạy lại toàn bộ suite.

## Test Center

Mở menu `Test Center` và làm lần lượt `UAT-01` đến `UAT-10`.

- Mỗi case có dữ liệu mẫu, bước test, expected result, fail symptom, fix/diagnosis và evidence.
- `Mark PASS/FAIL` chỉ ghi review thủ công riêng trong localStorage.
- Manual result không thay đổi Input/Validation/Graph/Release, R-006 hoặc Gate decision.
- `REVIEW_COMPLETE` chỉ xuất hiện khi 10/10 case PASS.
- Dù 10/10 PASS, vẫn phải đọc cùng `Compliance = NOT_EVALUATED`, `R-006 = OPEN`, `Numeric = BLOCKED`.
- Người thực sự duyệt phải nhập và lưu họ tên; không dùng `UNSPECIFIED_REVIEWER`.
- `Export UAT record` chỉ được bật khi 10/10 PASS và có tên reviewer hợp lệ.
- Export JSON vẫn không thay đổi R-006, compliance, numeric release hoặc Gate decision.

## Local persistence

Working input được lưu qua refresh: batchId, hrcLotId, widthMm, thicknessMm, surfaceState, origin và route.

Working patch không persist `data_origin`, R-006, real CN8, HRC SEE, validation output, graph output hoặc release output. Test Center dùng storage key riêng và không tham gia derived runtime state.

## C7 Working Export

Màn `Working Export` tạo `CarbonGraph_Working_Report_<TRACE_ID>.html` và `CarbonGraph_Trace_<TRACE_ID>.json`.

Export fail closed nếu data origin/R-006/release guardrail bị thay đổi hoặc state có numeric emission value.

## D2 hiện được phép đến đâu

`formal-d1-d4.test.js` chỉ đối chứng phi số:

- candidate CN8 là synthetic;
- real CN8 vẫn null/MISSING;
- numeric precursor/emission data không được đưa vào report;
- output giữ BLOCKED/MASKED.

D2 chưa đạt golden reconciliation về số phát thải. Việc đó phụ thuộc C4 và xử lý R-006; không được dùng v0.6.2 để tuyên bố calculation accuracy.

## Guardrail

MVP v0.6.2 không đóng R-006; không dùng synthetic evidence như REAL_REQUIRED; không tự tạo HRC SEE/emission factor; không tính/phát hành số phát thải; không copy candidate CN8 sang real CN8; không tự quyết định Gate; và không phải CBAM filing system chính thức.

## Tệp bàn giao chính

- `CG_Test_Plan_and_UAT_Guide_v1.0.md`
- `CG_Golden_Dataset_and_Reconciliation_v0.1_NON_NUMERIC.md`
- `HANDOFF_v0.6.2.md`
- `CBAM_Definitive_2026_Source_Review_20260822.md`
- `tests/acceptance-*.test.js`
- `tests/formal-d1-d4.test.js`
- `CG_Validation_Rule_Coverage_Matrix_v1.1_20260827.md`
- `CG_Bug_Closure_Log_v1.1_20260827.md`
- `TEST_REPORT_v0.6.2_20260827.md`

## Bước tiếp theo

1. Người thực sự duyệt chạy/kiểm tra UAT-01…UAT-10, nhập đúng họ tên và xuất lại biên bản.
2. Minh Thư/Khánh Linh review C5–C8 + D1/D3/D4.
3. Sửa case FAIL và lập Bug Closure Log.
4. Minh Thư duyệt ma trận VR-001–022 v1.1; F1 dùng Claims Engine quét deck/poster/brochure/video/script khi các bề mặt này tồn tại.
5. D2 numeric/C4 giữ HOLD đến khi R-006 được xử lý đúng thẩm quyền.
6. Chỉ chuyển C9 sang review khi C1–C8 có đủ bằng chứng và D1–D5 được ký.

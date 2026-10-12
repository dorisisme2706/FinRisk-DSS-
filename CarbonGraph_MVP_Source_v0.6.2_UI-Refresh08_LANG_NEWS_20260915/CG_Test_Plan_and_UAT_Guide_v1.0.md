# CARBONGRAPH – TEST PLAN & UAT GUIDE v1.0

Ngày: 22/08/2026  
Build: CarbonGraph MVP Source v0.6  
Phạm vi: RP-ST-001 · FAC-VN-001 · kỳ 2026  
Data origin: `SYNTHETIC_DEMO`  
R-006: `OPEN`  
Numeric emission: `BLOCKED`  
Compliance: `NOT_EVALUATED`

## 1. Mục tiêu

Tài liệu này hướng dẫn người test xác nhận luồng kỹ thuật Input → Validation → Evidence Graph → Release Gate → Working Export → End-to-End và ghi bằng chứng UAT. PASS trong tài liệu chỉ là PASS kỹ thuật của case; không phải xác nhận dữ liệu thật, calculation accuracy, CBAM compliance, Gate 1 hay Gate 3.

## 2. Điều kiện trước test

1. Giải nén ZIP vào một thư mục không đồng bộ xung đột.
2. Máy có Python 3 để chạy localhost; có Node.js để chạy automated tests.
3. Double-click `run_localhost.bat` và giữ terminal mở.
4. Mở `http://127.0.0.1:8080`.
5. Dùng một cửa sổ trình duyệt và một localhost origin trong cả phiên test.
6. Tạo thư mục bằng chứng theo mẫu `Evidence/UAT-<ID>/`.
7. Không dùng bất kỳ output nào làm kết quả phát thải thật.

Nếu trang không mở: kiểm tra terminal/server, xung đột cổng 8080, firewall localhost, rồi chạy thủ công `python serve_local.py --port 8080`.

## 3. Quy tắc ghi kết quả

- `PASS`: quan sát đủ toàn bộ expected result và có bằng chứng.
- `FAIL`: chỉ cần một expected result sai, có lỗi UI, rò rỉ số, sai trace hoặc không lưu/tải file.
- `NOT_RUN`: chưa chạy hoặc bằng chứng chưa đủ.
- Sau khi sửa, chạy lại case lỗi và toàn bộ `run_tests.bat`.
- Không sửa expected result để biến lỗi thành PASS.
- Không đánh dấu PASS từ ảnh/bằng chứng của build cũ.

## 4. Automated regression

Chạy `run_tests.bat`. Đạt khi 62 case đều hiện `PASS` và dòng cuối là `ALL TESTS PASSED`. Không đạt nếu có `FAIL`, stack trace, cửa sổ dừng sớm hoặc báo thiếu Node.js.

Cách sửa: xử lý test đầu tiên FAIL theo module; chạy lại riêng file để chẩn đoán; sau khi sửa phải chạy lại toàn bộ suite. Nếu thiếu Node.js, cài Node LTS hoặc dùng máy test đã được phê duyệt có Node.

## 5. Ma trận công việc

| Hạng mục | Nội dung v0.6 | Tiêu chí hiện tại |
|---|---|---|
| D1 | Test plan, catalog và automated suite | Có tài liệu + 75/75 automated PASS; chờ người duyệt |
| D2 | Reconciliation phi số | Candidate/real tách biệt; numeric excluded; numeric golden vẫn HOLD |
| D3 | Negative/boundary | MISSING, REVIEW, invalid origin/route, release fail-closed |
| D4 | Trace/evidence integrity | Core relation đủ; no orphan; export giữ trace và redaction |
| D5 | UAT | 10 case thủ công; chờ người dùng chạy và ký |
| C9 | Gate 3 | Chưa quyết định; chỉ review sau đủ bằng chứng C1–C8 + D1–D5 |

## 6. Kịch bản UAT

### UAT-01 – Khởi động baseline và guardrail

Mẫu: không nhập; mở Overview.

Các bước: chạy localhost; mở Overview; đối chiếu ribbon, Dataset, R-006 và Release.

Đạt khi: ribbon có SYNTHETIC_DEMO và NUMERIC RELEASE BLOCKED; Dataset là SYNTHETIC_DEMO; R-006 OPEN; Release BLOCKED/MASKED; không có số phát thải.

Không đạt nếu: thiếu module/nhãn, R-006 khác OPEN, release khác BLOCKED/MASKED hoặc có số.

Cách sửa: hard refresh; kiểm tra server; chạy regression. Nếu guardrail sai, dừng demo và không dùng build.

Bằng chứng: ảnh Overview kèm URL và thời điểm.

### UAT-02 – Local persistence

Mẫu: Batch `BATCH-SYN-UAT-002`; Width `1490`.

Các bước: nhập và Apply; refresh; quay lại Input Module.

Đạt khi: input còn nguyên; data origin vẫn khóa SYNTHETIC_DEMO; release vẫn BLOCKED/MASKED.

Không đạt nếu: mất input, sửa được data origin hoặc restore một derived release state sai.

Cách sửa: dùng đúng localhost origin, cho phép localStorage, Reset baseline rồi chạy lại.

Bằng chứng: ảnh trước/sau refresh và change log.

### UAT-03 – Graph identity động

Mẫu: Batch `BATCH-SYN-UAT-003`; HRC lot `HRCLOT-SYN-UAT-003`.

Các bước: Apply; mở Trace Explorer; tìm node và edge mới.

Đạt khi: hai node ID mới xuất hiện; DERIVED_FROM, CONSUMES, IS_LOT_OF dùng ID mới; integrity PASS; orphan 0.

Không đạt nếu: edge giữ ID cũ, node thiếu, integrity REVIEW hoặc orphan > 0.

Cách sửa: Apply lại; chạy derived pipeline; nếu vẫn sai ghi FAIL D4/C5.

Bằng chứng: ảnh integrity + nodes + edges.

### UAT-04 – Missing Width

Mẫu: Width để trống.

Các bước: xóa Width và Apply; xem Validation, Trace, Release.

Đạt khi: `VAL-C3-WIDTH`, severity BLOCKER, status MISSING; candidate trống; graph có issue node; Release BLOCKED/MASKED.

Không đạt nếu: blank thành 0, candidate vẫn có, issue/graph thiếu hoặc release không chặn.

Cách sửa: Reset baseline, lặp lại; nếu vẫn lỗi không tiếp tục Gate 3.

Bằng chứng: ảnh Input, Validation, Trace, Release.

### UAT-05 – Candidate classification branches

Mẫu A: NOT_PICKLED baseline. Mẫu B: PICKLED. Mẫu C: COATED.

Đạt khi: A → 72083800 synthetic candidate; B → 72082600 synthetic candidate; C → candidate trống + UNSUPPORTED_BRANCH/REVIEW + `VAL-C3-BRANCH-SURFACE`.

Không đạt nếu: A/B sai, C tự đoán mã hoặc candidate bị mô tả như real CN8.

Cách sửa: Reset baseline; kiểm tra Width ≥ 600, Thickness 3.0–<4.75; nếu coated có candidate, coi là blocker C3.

Bằng chứng: ba ảnh Derived state/Validation.

### UAT-06 – Invalid Origin/Route

Mẫu: Origin `X`; Route `OTHER_REVIEW`.

Đạt khi: có `VAL-C3-ORIGIN` severity ERROR; route issue status REVIEW; Release BLOCKED/MASKED.

Không đạt nếu: không có issue, input sai được ACCEPTED hoặc release nới.

Cách sửa: Apply lại, chạy pipeline; nếu rule không chạy ghi FAIL D3/C3.

Bằng chứng: Input + Validation + Release reasons.

### UAT-07 – Numeric release redaction

Mẫu: baseline hoặc input synthetic hợp lệ.

Đạt khi: numeric_release_status BLOCKED; visibility MASKED; Embedded emissions là MASKED · KHÔNG PHÁT HÀNH; End-to-End có SAFE_WORKING_FLOW_PASS cùng NOT_EVALUATED/BLOCKED/OPEN.

Không đạt nếu: có số/tCO2e; R-006 khác OPEN; technical pass bị gọi là compliance pass.

Cách sửa: dừng export/demo; chạy regression; sửa logic fail-closed hoặc quay lại build đã kiểm thử. Không sửa data để né guardrail.

Bằng chứng: Release / Result và End-to-End.

### UAT-08 – Working Export

Mẫu: baseline.

Các bước: tải HTML và JSON; tìm SYNTHETIC_DEMO, R-006 OPEN, BLOCKED, MASKED; tìm thử `tCO2e` và `numericValue`.

Đạt khi: file tải được; có guardrails và trace ID; không có tCO2e/numericValue/SEE value.

Không đạt nếu: tải lỗi, thiếu nhãn hoặc rò rỉ field/value số.

Cách sửa: kiểm tra browser download, Reset baseline; nếu rò rỉ, xóa file, không chia sẻ, sửa report-engine và chạy lại tests.

Bằng chứng: hai file export và ảnh kết quả tìm từ khóa.

### UAT-09 – Automated suite

Mẫu: `run_tests.bat`.

Đạt khi: 75/75 PASS và `ALL TESTS PASSED`.

Không đạt nếu: bất kỳ FAIL, stack trace, dừng sớm hoặc Node.js not found.

Cách sửa: sửa test đầu tiên FAIL theo module, không đổi expected để che lỗi; chạy lại toàn bộ.

Bằng chứng: log đầy đủ hoặc ảnh terminal.

### UAT-10 – Reset và biên bản

Mẫu: bấm Reset baseline.

Đạt khi: Batch/HRC lot về `BATCH-SYN-001`/`HRCLOT-SYN-001`; graph PASS; SAFE_WORKING_FLOW_PASS + NOT_EVALUATED; Test Center chỉ REVIEW_COMPLETE khi 10/10 PASS; export được UAT JSON.

Không đạt nếu: baseline không trở lại, REVIEW_COMPLETE khi còn FAIL/NOT_RUN, manual record thay đổi release/R-006 hoặc tự quyết Gate.

Cách sửa: Reset rồi refresh; sửa từng case FAIL; C9 chỉ review sau đủ bằng chứng và ký.

Bằng chứng: UAT JSON + ảnh Test Center summary + Overview baseline.

## 7. Mẫu ghi lỗi

- Bug ID:
- UAT/Test ID:
- Build/commit:
- Máy + OS + browser:
- Dữ liệu mẫu:
- Bước tái hiện:
- Expected:
- Actual:
- Ảnh/log/file:
- Mức độ: BLOCKER/HIGH/MEDIUM/LOW
- Module owner:
- Fix version:
- Retest result:

BLOCKER gồm: rò rỉ số phát thải; R-006 không OPEN; synthetic thành real; real CN được tự điền; export thiếu disclaimer; graph trace sai core identity; test engine fail closed bị hỏng.

## 8. Exit criteria

D1/D3/D4 có thể chuyển `Đang xem xét` khi 75/75 automated PASS, tài liệu/bằng chứng được gắn và người phụ trách bàn giao reviewer. D5 chỉ chuyển `Đang xem xét` sau 10/10 UAT PASS có JSON + ảnh. Không task nào chuyển `Hoàn thành` trước reviewer sign-off.

C9 vẫn `Chưa bắt đầu` hoặc chỉ `Đang thực hiện` khi đang tập hợp bằng chứng; không PASS chỉ vì Test Center REVIEW_COMPLETE.

R-006 tiếp tục OPEN. C4 và D2 numeric tiếp tục HOLD.

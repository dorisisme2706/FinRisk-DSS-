# CARBONGRAPH – VALIDATION RULE COVERAGE MATRIX v1.1

Ngày rà soát: 27/08/2026  
Phạm vi build: CarbonGraph MVP v0.6.2 RC1 candidate  
Nguồn quy tắc kiểm soát: `CG_Data_Method_Workbook_v0.1_20260813` → tab `04_VALIDATION_RULES`  
Nguyên tắc: test kỹ thuật `PASS` không đồng nghĩa dữ liệu, hệ số, kết quả phát thải hoặc tuân thủ CBAM đã được chấp nhận.

## Trạng thái bắt buộc

- Dataset: `SYNTHETIC_DEMO`.
- R-006: `OPEN`.
- Numeric release: `BLOCKED`.
- Result visibility: `MASKED`.
- Compliance: `NOT_EVALUATED`.
- Không dùng ma trận này để đóng R-006, phê duyệt Gate 3 hoặc công bố kết quả phát thải số.

## Thang bao phủ

- `PASS – TECHNICAL`: code và test hiện tại chứng minh đúng hành vi fail-closed trong phạm vi synthetic.
- `PARTIAL`: đã có một phần code/test nhưng chưa bao phủ toàn bộ trigger/response của quy tắc.
- `HOLD`: chưa được phép triển khai/chấp nhận phần numeric vì phụ thuộc R-006 hoặc dữ liệu thật.
- `N/A-EVIDENCED`: loại khỏi direct result theo phạm vi A5 hiện hành; phải đánh giá lại nếu scope thay đổi.
- `NOT IMPLEMENTED`: chưa có code/test đủ để chứng minh quy tắc.

## Ma trận VR-001–VR-022

| Rule | Trạng thái hiện tại | Code hiện có | Test/bằng chứng hiện có | Khoảng trống và hành động bắt buộc |
|---|---|---|---|---|
| VR-001 – Identifiers | PASS – TECHNICAL FAIL-CLOSED | `validation-engine.js` kiểm tra đủ/duy nhất facility, product, dataset, lot, trace; vẫn kiểm tra batch/lot động | `validation-coverage.test.js::T-VAL-001`; graph/state tests | Blank hoặc duplicate tạo issue VR-001 và chặn release. Không suy ra dữ liệu thật đã được chấp nhận. |
| VR-002 – MVP scope | PASS – TECHNICAL FAIL-CLOSED | Locked scope FAC-VN-001/RP-ST-001/2026/Product Definition v1.0 trong validator | `validation-coverage.test.js::T-VAL-002`; D1 tests | Giá trị ngoài scope bị chặn và yêu cầu change control; các field này không được mở trong UI whitelist. |
| VR-003 – Finished CN | PASS – TECHNICAL FAIL-CLOSED | Validator chuẩn hóa khoảng trắng và yêu cầu đúng `73063077` | `validation-coverage.test.js::T-VAL-003` | Blank/mã khác chặn release; đây vẫn là mã CN làm việc A4, không phải BTI/TARIC10. |
| VR-004 – Period | PASS – TECHNICAL FAIL-CLOSED | Thêm `periodStart`, `periodEnd`; kiểm tra ISO date, cùng năm 2026 và start <= end | `validation-coverage.test.js::T-VAL-004` | Ngày giả, đảo chiều hoặc ngoài 2026 đều bị chặn. |
| VR-005 – Numeric | PASS – TECHNICAL FAIL-CLOSED | Width/thickness bắt buộc >0; schema numeric phi phát hành giữ null; mass >0 và scrap/emission >=0 khi được cung cấp | `validation-coverage.test.js::T-VAL-005`; state/validation/D3 tests | Kiểm soát miền giá trị đã có; numeric completeness/calculation vẫn HOLD vì R-006/C4. Blank không thành 0. |
| VR-006 – Mass balance | HOLD | Không có Calculation Engine numeric | Chưa có T-CALC-001 | Chưa khóa tolerance; giữ B6/C4 HOLD. Chỉ triển khai sau quyết định có thẩm quyền và dữ liệu/phương pháp hợp lệ; không tạo tolerance giả. |
| VR-007 – Mass consistency | HOLD | Chưa có input/output/scrap numeric được phép dùng | Chưa có T-CALC-002 | Bổ sung sau khi B3/B6 được mở. Phải kiểm tra đơn vị, adjustment evidence và trường hợp input < output. |
| VR-008 – Direct emissions | PASS – TECHNICAL FAIL-CLOSED / CONTENT HOLD | `seeDirect.value = null`; numeric schema giữ null; report không đưa numeric | D2/D3, report tests và T-VAL-005 | Build chứng minh blank không thành 0 và không được xuất. Nội dung số/nguồn vẫn HOLD cho tới R-006/C4. |
| VR-009 – HRC CN / SEE | PASS – TECHNICAL FAIL-CLOSED | `validation-engine.js` chặn real CN/SEE thiếu; kiểm tra origin/route; candidate CN tách real CN | `validation-engine.test.js`; UAT-05/06; D2 | Hành vi chặn đạt. Nội dung pháp lý/dữ liệu vẫn chưa đạt: real CN và SEE chưa khóa, R-006 vẫn OPEN. Không đổi sang ACCEPTED. |
| VR-010 – Electricity | N/A-EVIDENCED | Không cộng electricity vào direct result; C4 chưa hoạt động | A5 là bằng chứng phạm vi; report không có electricity numeric | Ghi rõ `MONITOR_ONLY` trong Data Dictionary/Source Register. Nếu scope A5 đổi, mở change control và viết T-CALC-004 trước khi dùng. |
| VR-011 – Evidence approval | PASS – TECHNICAL FAIL-CLOSED | Evidence schema có reviewer/reviewedAt; ACCEPTED thiếu ID/phê duyệt tạo REVIEW blocker | `validation-coverage.test.js::T-EVD-001`; UAT-01/08/10 | Reviewer UAT vẫn không thay reviewer evidence. Không có evidence thật nào được tự chuyển ACCEPTED. |
| VR-012 – Source control | PASS – TECHNICAL FAIL-CLOSED / CONTENT HOLD | Factor schema có issuer, URL, publication/access date, version, geography, CN, route; selected factor thiếu metadata bị chặn | `validation-coverage.test.js::T-EVD-002`; origin/route tests | Metadata gate đã chạy. EF-HRC-DIRECT-001 vẫn MISSING/TBD, không được chọn; factor value/content tiếp tục HOLD. |
| VR-013 – Traceability | PASS – TECHNICAL FAIL-CLOSED / CALC HOLD | Trace ID bắt buộc cho working result; calculation_version bắt buộc nếu phát hiện numeric attempt | `validation-coverage.test.js::T-TRACE-001`; graph/report/formal tests | Working trace đạt; calculation_version vẫn null đúng chủ đích vì C4 HOLD. Numeric attempt thiếu version bị chặn. |
| VR-014 – Claims | PASS – TECHNICAL | Ribbon/UI/report/UAT record luôn có synthetic/non-official guardrail | Report tests, UAT-01/07/08 | Tiếp tục chạy F1 Claims Audit trên app, deck, poster, brochure, video và script; R-007 chưa tự đóng. |
| VR-015 – Result release | PASS – TECHNICAL FAIL-CLOSED | `release-engine.js`, `report-engine.js` chặn/che và trả numeric null | Release/report/pipeline/e2e/formal tests; UAT-07/08 | PASS chỉ cho hành vi chặn. Không có đường ACCEPTED numeric trong build này; Gate 3 chưa được quyết định. |
| VR-016 – Synthetic governance | PASS – TECHNICAL FAIL-CLOSED | Thêm assumptions có cấu trúc, datasetStatus=REVIEW và approval fields; ACCEPTED thiếu reviewer/date/approval bị chặn | `validation-coverage.test.js::T-DATA-001`; acceptance/state/report tests | Dataset hiện vẫn REVIEW/PENDING; cần reviewer thật trước ACCEPTED, không tự điền tên. |
| VR-017 – Source segregation | PASS – TECHNICAL | `validation-engine.js`, Evidence Queue và export không cho synthetic đóng REAL_REQUIRED | Validation/report tests; UAT-01/07/08 | Duy trì C1–C4/R-006 OPEN tới khi có real/legal evidence. Không gắn demo ID vào trường REAL_REQUIRED. |
| VR-018 – Numeric redaction | PASS – TECHNICAL | Release/Report/E2E trả `BLOCKED`, `MASKED`, numeric null; export fail closed | Release/report/e2e/pipeline/formal tests; UAT-07/08 | Mỗi bản UI/export mới phải regression. Bất kỳ rò rỉ tCO2e/SEE numeric là blocker và file phải bị thu hồi. |
| VR-019 – Legacy claim block | PASS – TECHNICAL SCANNER / F1 PENDING | Thêm `claims-engine.js` quét legacy metric, CBAM compliance/certification và verified-emission claim | `claims-engine.test.js::T-CLM-002`; scan app/index/report/README = 0 finding | Scanner đã sẵn sàng. Deck/poster/brochure/video/script phải được quét khi tạo; R-007/F1 vẫn mở tới audit 100% surface. |
| VR-020 – Graph integrity | PASS – TECHNICAL | `graph-engine.js::checkIntegrity` kiểm tra duplicate/orphan/core relations | `graph-engine.test.js`, `formal-d1-d4.test.js`; UAT-03 | Graph PASS chỉ là integrity kỹ thuật, không phải compliance/evidence acceptance. |
| VR-021 – Batch/precursor link | PASS – TECHNICAL | Graph tạo INSTANCE_OF, PRODUCED_AT, CONSUMES, IS_LOT_OF | Graph/formal/pipeline tests; UAT-03 | Bổ sung negative tests cho từng edge thiếu nếu graph cho phép import ngoài UI. |
| VR-022 – Result trace | PASS – TECHNICAL sau hotfix 26/08 | Result có `HAS_TRACE`, `VALIDATED_BY`, `GATED_BY`; report export các relation này | `graph-engine.test.js`, `formal-d1-d4.test.js`; full regression 75/75 PASS ngày 27/08 | Hotfix đã thêm direct `RESULT → VALIDATED_BY → RULE`. Cần người duyệt D4 ký và lưu ảnh/JSON trace mới. |

## Tổng kết C3

| Nhóm | Số rule | Ý nghĩa |
|---|---:|---|
| PASS – TECHNICAL | 19 | VR-001–005, 008–009, 011–022 trừ VR-010; một số chỉ PASS về fail-closed/scanner, không PASS về dữ liệu, factor hoặc calculation. |
| PARTIAL | 0 | Không còn rule thiếu code/test ở trạng thái chính trong phạm vi v0.6.2. |
| HOLD | 2 | VR-006, VR-007; phần VR-008/012 cũng bị giới hạn bởi R-006/C4. |
| N/A-EVIDENCED | 1 | VR-010 theo scope A5 hiện hành. |
| NOT IMPLEMENTED | 0 | Không còn rule `NOT IMPLEMENTED`; human approval, F1 audit và numeric dependencies vẫn là điều kiện riêng. |

Lưu ý: bảng tổng dùng trạng thái chính để đủ 22 rule; VR-008 và VR-012 đồng thời bị giới hạn bởi HOLD, nên không được dùng số đếm này để suy ra tỷ lệ hoàn thành của Calculation Engine.

## Điều kiện để Minh Thư duyệt C3

1. Minh Thư mở ma trận v1.1 và xác nhận mapping test chính thức cho VR-001–VR-022.
2. D4 xác nhận trace mới; F1 quét mọi release surface ngoài app khi chúng được tạo.
3. VR-006–009/012 liên quan numeric tiếp tục chặn đúng khi R-006 OPEN.
4. Full regression tiếp tục `75/75 PASS` hoặc cao hơn sau mọi thay đổi.
5. D4 xác nhận graph không orphan và đủ HAS_TRACE/VALIDATED_BY/GATED_BY.
6. Không có tCO2e/SEE numeric trong UI/export/demo khi R-006 OPEN.

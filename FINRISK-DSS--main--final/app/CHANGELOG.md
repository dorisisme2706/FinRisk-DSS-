# M08.0 Core Freeze + M08.1 MOCK/REAL Audit — 07/11/2026

- Chốt W07 Setup Batch Fix làm baseline M08; lưu SHA-256 archive trong `qa/M08_CORE_FREEZE_MANIFEST.json`.
- Đóng băng 39 file: toàn bộ `backend_ml/` (32), `evidence/h16/` (4), `evidence/h18/` (2) và `backend_api/decision_engine.py` (1).
- Ghi nhận model H16, 169 predictor order, data/split hashes, threshold `0.14484327385366114`, policy `demo_only_pending_review`, calibration `uncalibrated_candidate_not_selected` và H18 no-auto-decision guardrails.
- Thêm `qa/m08_verify_freeze.py` để kiểm tra SHA-256 và các invariant model/threshold/calibration/169 features.
- Thêm `qa/m08_mock_real_audit.py` và inventory 13 workspace routes, 4 GET API, localStorage, các luồng MOCK/REAL và khoảng trống PostgreSQL/auth.
- Xác nhận 9 trường form #09 không có direct field-name overlap với 169 H16 predictors; không được tự suy diễn feature mapping.
- Bổ sung M08 roadmap và runner `run_m08_audit.bat`.
- M08.1 không thay đổi runtime/UI/API/database/model. Dataiku không thuộc stack.
- Audit: freeze 8/8 PASS; source 12/12 PASS; M08 Node tests 9/9 PASS.

# W07 – Windows setup batch parser hotfix – 07/11/2026

- Sửa lỗi `Was was unexpected at this time` trong `setup_windows.bat`: thông điệp lỗi `Python Launcher (py.exe)` nằm bên trong khối `if (...)`, khiến dấu ngoặc đóng trong câu `echo` bị CMD hiểu nhầm là kết thúc khối lệnh.
- Đổi thông điệp thành `Python Launcher py.exe was not found.` để không còn dấu ngoặc không escape trong khối IF.
- Bổ sung regression test Node.js và static audit để ngăn lỗi cú pháp CMD này quay lại.
- Không thay đổi Python runtime, requirements lock, model H16, 169 predictors, threshold, calibration, policy hoặc CORE4 snapshot.

# W07 – Runtime dependency alignment / release gate – 07/11/2026

- Sửa lỗi cấu hình môi trường: model H16 được đóng gói bằng CPython 3.14.0 nhưng `setup_windows.bat` trước đó tạo `.venv` bằng Python 3.12. Setup hiện yêu cầu CPython 3.14 64-bit và không dùng lại `.venv` sai phiên bản.
- Nếu `.venv` cũ không đúng Python 3.14, setup giữ nguyên thư mục đó dưới tên `.venv_backup`, `.venv_backup_1`, ... trước khi tạo môi trường mới.
- Cài đúng 13 package pin từ `backend_ml/model/requirements-lock.txt` bằng binary wheels; chạy `pip check` và strict runtime preflight. Không sửa requirements lock, metadata, model hoặc pipeline H16.
- Thêm `qa/w07_environment_check.py`: kiểm tra CPython 3.14, Windows x64, toàn bộ package pin, `pip check`, import NumPy/pandas/PyArrow/LightGBM/scikit-learn/joblib, Parquet round-trip, SHA-256 model và `joblib.load` không phát `InconsistentVersionWarning`, schema vẫn đúng 169 features.
- Fail-closed trước khi unpickle: nếu Python/Windows/package pin/`pip check` hoặc model hash chưa đạt, gate không gọi `joblib.load`; snapshot chỉ PASS khi kiểm tra được cả SHA-256 lẫn Parquet header.
- Bắt buộc runtime preflight trước W07 QA, API tests, full regression runner, H19 freeze verification và ML server startup; mismatch sẽ chặn thay vì tiếp tục chạy với cảnh báo.
- Đưa `.venv_backup*/` vào `.gitignore`.
- W07 source audit loại bỏ cảnh báo phụ thuộc của build sandbox khỏi static audit và xác nhận wiring của strict runtime gate.
- Node.js regression mới 97/97; W07 static audit 25 checks; API 18/18 cũ là diagnostic run ở Python 3.13.5 với warning và được lưu archive, không phải bằng chứng runtime release.
- Build container hiện không có Python 3.14 hoặc package-index network, nên strict runtime gate chưa thể được thực thi tại đây. Final release chỉ được chấp nhận sau khi Windows `setup_windows.bat`, `qa/w07_environment_check.py` và `run_w07_qa.bat` cùng PASS không warning.

# W07 – Overall QA & Release Gate – 07/11/2026

- Bổ sung runner `run_w07_qa.bat` để chạy Node.js regression, Python API tests và source/release audit; browser QA Playwright là bước tùy chọn trong môi trường QA tách biệt.
- Bổ sung 13 regression assertions cross-workspace cho route/renderer, thứ tự load module, W02 read-only và test-split 403, W04 repayment/no-API, W05 policy guardrails/i18n và W06 profile-before-H18/history/export.
- Bổ sung static/release audit 20 checks và browser DOM/layout QA cho 13 screens tại 390×844, 768×1024 và 1440×900; VI/EN nav checks 4/4.
- Ghi evidence Node.js 93/93, Python API 18/18, static audit 20/20, browser 39/39 và language checks 4/4; không có JavaScript page errors trong lượt browser test.
- Tạo release manifest SHA-256 bảo vệ 36 file trong `backend_ml/` và `evidence/h16/`; 36/36 khớp baseline W06.
- Thêm `.qa_venv/` vào `.gitignore` để cô lập Playwright khỏi môi trường ML.
- W07 không thay đổi API, model H16, 169 predictors, threshold, calibration, policy, backend ML hoặc H16 evidence. Live CORE4/Windows acceptance vẫn cần xác nhận trên máy triển khai.
- Cảnh báo môi trường sandbox: phiên bản Python runtime khác metadata model ở 6 package; API tests vẫn PASS nhưng có `InconsistentVersionWarning`. Không sửa model; yêu cầu Windows setup theo `requirements-lock.txt` và xác nhận bằng W07 audit.

# W06 – Reports & History – 07/11/2026

- Thêm tab W06 riêng để tạo báo cáo từ hồ sơ CORE4 read-only và tín hiệu hỗ trợ H18; gọi W02 profile trước, chỉ gọi H18 sau khi profile hợp lệ và mã hồ sơ khớp.
- Bổ sung allowlist đúng 38 trường/5 nhóm dữ liệu, xác thực nghiêm response, từ chối trường định danh/cấm và kiểm tra trạng thái test-split.
- Bổ sung preview gồm model/data/feature/policy metadata, risk score, demo threshold, review signal, quality flags, top-10 log-odds explanations, margin decomposition và Decision Trace 6 bước.
- Bổ sung lưu lịch sử chỉ khi người dùng chủ động bấm Save; localStorage key `finrisk.w06.report-history.v1`, tối đa 50 bản ghi, chỉ trong browser hiện tại, không đồng bộ server/PostgreSQL.
- Bổ sung xem lại, lọc theo mã hồ sơ, xóa một/xóa toàn bộ và export JSON/HTML (HTML có print stylesheet).
- Giữ nguyên báo cáo MOCK cũ; không phát hành APPROVE/REJECT, hạn mức hoặc điều khoản vay; business policy vẫn NOT_APPROVED và automatic decision disabled.
- Không sửa backend API, model H16, 169 predictors, threshold, calibration, policy, `backend_ml/` hoặc `evidence/h16/`.
- Regression: W06 tests 9/9 PASS; Node.js 80/80 PASS; Python API 18/18 PASS. Browser QA và live snapshot QA chờ xác nhận trên Windows.

# W05 i18n hotfix – 07/11/2026

- Sửa nhãn tab điều hướng W05 từ chuỗi tiếng Anh hard-code `Decision Engine` thành nhãn nguồn tiếng Việt `Bộ máy hỗ trợ quyết định`.
- Bổ sung ánh xạ i18n chính xác `Bộ máy hỗ trợ quyết định` → `Decision Engine`; cơ chế i18n hiện có sẽ phục hồi tiếng Việt khi chuyển EN → VI.
- Bổ sung regression assertion cho cả nhãn tiếng Việt và bản dịch tiếng Anh. Không thay đổi API, model, threshold, policy hoặc luồng W05.

# W05 – Decision Engine – 06/11/2026

- Thêm tab Decision Engine riêng, tra cứu hồ sơ CORE4 bằng API H18 `/api/decision/assess`.
- Bổ sung Decision Trace 6 bước: CORE4 profile → feature set → frozen LightGBM → threshold comparison → review signal → business-policy gate.
- Kiểm tra chặt response contract: H18 metadata, feature set, risk/threshold, signal, policy basis, automatic decision disabled và các trường đề xuất khoản vay phải null.
- Hiển thị model/data/policy versions, calibration status, threshold scope, quality flags, top-10 log-odds contributions và margin reconstruction qua panel H18 hiện có.
- Nêu rõ `business_policy_status=NOT_APPROVED`; không phát hành APPROVE/REJECT, hạn mức, số tiền khuyến nghị, kỳ hạn, lãi suất hoặc khoản thanh toán.
- W05 chỉ đọc/hiển thị, không ghi quyết định hay lịch sử; không thay đổi model, 169 predictors, threshold, policy hoặc calibration.
- Hồi quy sau W05: Node.js 71/71 PASS; Python API 18/18 PASS. Browser QA và live CORE4 test trên Windows chờ người dùng xác nhận.

# UI FINAL / VISUAL FREEZE – 29/08/2026

- User approved graph motion speed, enterprise footer and overall product/landing direction.
- UI design phase is now frozen on top of technical baseline `v0.6.2 RC1_CANDIDATE`.
- No additional redesign is planned; only bug, compatibility, accessibility or device-specific responsive fixes are allowed.
- Added `UI_FINAL_FREEZE_MANIFEST_20260829.md`.
- Guardrails and business logic remain unchanged.

# UI Refresh 08 – 29/08/2026

- Tăng tốc độ chuyển động của background graph để node bớt ì và sinh động hơn trên màn demo.
- Giữ nguyên mật độ node đậm của Refresh 07 nhưng tăng velocity từ mức chậm sang mức trung bình-nhẹ.
- Xây lại footer theo phong cách enterprise giống mẫu người dùng gửi: khối thương hiệu, thông tin liên hệ, nhóm liên kết giải pháp, khối dự án và ghi chú vận hành.
- Chuyển footer từ thanh đơn sang bố cục nhiều cột, phù hợp landing SaaS / product website.
- Tiếp tục giữ guardrail ở footer thay vì đầu trang.
- Không thay đổi logic nghiệp vụ hay automated baseline.

# UI Refresh 07 – 29/08/2026

- Visual Freeze Candidate trên nền Refresh 06.
- Tăng mật độ ambient graph: mobile 30 node, tablet 46, laptop 64, desktop lớn 76 node.
- Tăng độ đậm node/edge, bán kính node, link distance và glow; bổ sung nhiều node forest-green đậm hơn.
- Giữ tốc độ chuyển động chậm để background rõ hơn nhưng không gây nhiễu nội dung.
- Tuning riêng cho viewport 1366×768: compact header/workspace/hero và giảm khoảng trắng dọc.
- Tuning Full-HD: giới hạn line length và giữ layout thoáng.
- Tuning mobile: header/nav/hero/proof metrics và graph density phù hợp màn nhỏ.
- Không thay đổi validation/graph business engine/release/export/UAT logic.

# UI Refresh 06 – 29/08/2026

- Interaction polish trên nền Refresh 05; không thay đổi business engine.
- Thêm SVG icon system nội bộ, không phụ thuộc CDN; 9 workspace modules dùng icon thống nhất thay mã OV/IN/EV/VA...
- Thêm toast notification dùng `aria-live`; loại bỏ `window.alert()` khỏi luồng Input và UAT.
- Thêm button busy/loading state cho Apply và export/download operations.
- Thêm enhanced empty/error states cho Validation, Graph, Release và Export refusal.
- Trace Explorer có interactive Node Inspector: click node để xem type, status và connected relations.
- Validation filter có trạng thái `no matching issues` rõ ràng.
- Thêm Motion toggle để bật/tắt animated graph background; preference lưu localStorage và tôn trọng `prefers-reduced-motion`.
- Bổ sung focus-visible/accessibility và responsive polish cho tablet/mobile.
- Regression: 75/75 automated assertions PASS; localhost smoke assets = HTTP 200.

# UI Refresh 05 – 29/08/2026

- Tiếp tục giai đoạn polish & interaction trên nền UI Refresh 04.
- Thêm background động dạng graph-node toàn trang, lấy cảm hứng từ video tham chiếu nhưng chuyển sang palette xanh lá chủ đạo để phù hợp nhận diện CarbonGraph.
- Thêm `src/ambient-graph.js` để render canvas animation: node, edge, glow, pointer-reactive lines, reduced-motion support.
- Thêm lớp nền grid/glow/frosted overlay cho header, hero, footer và các panel để giao diện có chiều sâu hơn nhưng vẫn đọc dễ.
- Giữ nguyên toàn bộ các màn chuyên sâu của workspace: Input · Evidence · Validation · Trace · Release · Export · End-to-End · Test Center.
- Không thay đổi logic nghiệp vụ/guardrail: SYNTHETIC_DEMO, R-006 OPEN, NUMERIC BLOCKED / MASKED, COMPLIANCE NOT_EVALUATED.
- Regression suite vẫn PASS sau thay đổi giao diện động.

# UI Refresh 04 – 29/08/2026

- Deep workspace redesign trên toàn bộ 8 màn vận hành: Input Module, Evidence Queue, Validation, Trace Explorer, Release Gate, Working Export, End-to-End và Test Center.
- Input Module chuyển thành guided data builder theo 3 nhóm dữ liệu + sticky derived-state sidebar + audit timeline; giữ nguyên field IDs và pipeline events.
- Evidence Queue chuyển thành evidence control board có readiness meter, gap cards, reviewer metadata và synthetic/real separation rõ ràng.
- Validation chuyển thành issue-management dashboard có filter severity, classification sidebar và rerun pipeline.
- Trace Explorer chuyển thành visual graph lanes + relation registry; graph data vẫn lấy trực tiếp từ dynamic graph engine.
- Release Gate chuyển thành readiness checklist + masked-result panel + reason cards.
- Working Export chuyển thành Report Center với HTML/JSON product cards và live working-report preview.
- End-to-End chuyển thành pipeline console + safety-check cards.
- Test Center chuyển thành QA console, progress ring, reviewer identity panel và modern UAT case catalog.
- Section Kiểm kê/Báo cáo/Dự báo được gắn nhãn PRODUCT ROADMAP / CONCEPT UI; loại bỏ mọi con số phát thải mẫu và wording có thể bị hiểu là trạng thái verified thực.
- 75/75 automated assertions PASS sau thay đổi; localhost HTTP smoke test PASS cho index/CSS/logo/app.js.
- Không thay đổi core engine, R-006, numeric guardrail, persistence semantics hay UAT decision semantics.

# UI Refresh 03 – 29/08/2026

- Thay logo thương hiệu góc trái bằng logo CarbonGraph người dùng đã duyệt (`carbongraph-logo.png`).
- Gỡ ribbon guardrail ở đỉnh trang; chuyển trạng thái `SYNTHETIC_DEMO · R-006 OPEN · NUMERIC BLOCKED / MASKED · COMPLIANCE NOT_EVALUATED` xuống footer để bớt chiếm thị giác.
- Điều chỉnh typography theo hướng EcoCheck: cỡ chữ lớn hơn, spacing thoáng hơn, ưu tiên readability cho header / nav / section copy / cards.
- Ẩn scrollbar của thanh workspace navigation để giữ thẩm mỹ trong khi vẫn cuộn ngang được trên màn hình hẹp.
- Thêm section `Một nền tảng — trọn vòng đời phát thải` với 3 card marketing: Kiểm kê · Báo cáo · Dự báo.
- Giữ nguyên 9 module kỹ thuật: Tổng quan · Input Module · Evidence Queue · Validation · Trace Explorer · Release Gate · Working Export · End-to-End · Test Center.
- Không thay đổi engine C2/C3/C5/C6/C7/C8/C9; regression giữ nguyên PASS.

# UI Refresh 01 – 29/08/2026

- Front-end presentation refresh only; technical baseline remains `v0.6.2 RC1_CANDIDATE`.
- Replaced the left sidebar with a horizontal top navigation for all 9 modules.
- Added responsive sticky application header and clearer runtime guardrail badges.
- Reworked Overview into an enterprise-style dashboard with visible fail-closed status.
- Restyled cards, tables, forms, buttons, graph nodes, Test Center and flow strips.
- Added richer hover/focus states and `prefers-reduced-motion` support.
- No changes to validation, graph, release, export, persistence, UAT or numeric guardrail logic.

# CHANGELOG

## v0.6.2 – 27/08/2026

### C3 validation coverage hardening

- Thêm validator fail-closed cho VR-001–005, VR-011–013 và VR-016.
- Thêm periodStart/periodEnd, synthetic assumptions, evidence approval metadata, factor-source metadata và numeric input schema giữ null/HOLD.
- Blank/duplicate ID, out-of-scope values, CN khác 73063077, kỳ sai, numeric ngoài miền, evidence/factor thiếu duyệt và numeric attempt thiếu calculation version đều bị chặn.

### VR-019 claims guardrail

- Thêm `claims-engine.js` và T-CLM-002.
- Chặn legacy `100% tracked`, `-0.85 kg CO2e`, CBAM compliance/certification và verified-emissions claim chưa duyệt.
- Quét app/index/report/README đạt 0 finding; F1 vẫn phải quét deck/poster/brochure/video/script khi tạo.

### Tests and governance

- Thêm 13 case, nâng regression từ `62/62` lên `75/75 PASS`.
- Ma trận C3 v1.1 không còn rule ở trạng thái chính `PARTIAL/NOT IMPLEMENTED`; VR-006/007 và numeric content tiếp tục HOLD.
- Gói vẫn là `RC1_CANDIDATE / REVIEW`; D5 và các chữ ký D1/D3/D4/C3 còn chờ người thật.
- Thêm Claims Audit Register với trạng thái từng bề mặt và quy trình review/retest.
- Thêm Q&A Bank 30 câu theo năm nhóm; các câu pháp lý bám nguồn chính thức EU và không mở kết quả số.

## v0.6.1 – 26/08/2026

### D5 evidence hardening

- Thêm trường họ tên reviewer và lưu riêng khỏi runtime state.
- Chặn xuất UAT JSON nếu chưa 10/10 PASS hoặc chưa có tên reviewer thật.
- Reset manual result đồng thời xóa reviewer đã lưu.

### VR-022 trace repair

- Thêm direct relation `RESULT → VALIDATED_BY → RULE`.
- Đưa `VALIDATED_BY` vào core relation và working trace export.
- Mở rộng graph/formal tests, giữ tổng regression `62/62 PASS`.

### Governance artifacts

- Thêm ma trận VR-001–022; không ghi nhận PASS cho rule chưa đủ code/test/evidence.
- Thêm Bug Closure Log và test report v0.6.1.
- Gói chỉ là `RC1_CANDIDATE / REVIEW`; R-006 vẫn OPEN, numeric vẫn BLOCKED/MASKED.

## v0.6 – 22/08/2026

### Guided Test Center

- Thêm `acceptance-catalog.js` với 10 kịch bản UAT chi tiết.
- Thêm `acceptance-engine.js` để lưu PASS/FAIL/NOT_RUN độc lập với runtime state.
- Thêm màn `Test Center`, ghi chú người test và export UAT record JSON.
- `REVIEW_COMPLETE` chỉ khi 10/10 PASS; record luôn giữ `NOT_EVALUATED/OPEN/BLOCKED` và không quyết định Gate.

### C3 state semantics

- Field bắt buộc thiếu hiện `MISSING`.
- Classification/route branch ngoài phạm vi hiện `REVIEW`.
- Không mở rộng sang nhánh CN8 chưa được unit-test.

### D1–D4 formal boundary tests

- Thêm catalog/acceptance tests và formal D1–D4 suite.
- D2 chỉ đối chứng phi số; không tuyên bố accuracy của Calculation Engine.
- Tổng regression baseline: `62/62 PASS`.

### Documentation

- Thêm Test Plan + UAT Guide và non-numeric reconciliation note.
- Thêm official-source review cho definitive-period 2026 và danh sách thay đổi P0/P1 trước khi mở rộng VR-001–022.
- Cập nhật README, launcher, server label và handoff lên v0.6.

## v0.5 – 21/08/2026
### C7 Working Status Export
- Thêm `report-engine.js`.
- Thêm màn `Working Export` và nút download HTML/JSON chạy hoàn toàn local.
- Export ghi rõ `WORKING_ONLY`, `SYNTHETIC_DEMO`, `R-006 OPEN`, `BLOCKED/MASKED`.
- Không đưa numeric emission value hoặc SEE value vào model export.
- Fail closed nếu guardrail bị thay đổi ngoài phạm vi build.

### C8 Local End-to-End
- Thêm `e2e-engine.js` và màn `End-to-End`.
- Kiểm tra Input → Validation → Graph → Release → Working Export.
- Dùng trạng thái `SAFE_WORKING_FLOW_PASS` và `complianceStatus = NOT_EVALUATED` để tránh nhầm với dữ liệu ACCEPTED.

### Tests
- Giữ nguyên 32 baseline tests của v0.4.
- Thêm 8 tests cho C7.
- Thêm 4 tests cho C8.
- Mở rộng pipeline thêm 2 tests cho export và safety acceptance.
- Thêm 1 test tương thích dữ liệu localStorage từ v0.4 sang v0.5.
- Tổng: `47/47 PASS`.

## v0.4 – 20/08/2026
### C5 Dynamic Evidence Graph
- Thêm `graph-model.js` và `graph-engine.js`.
- Graph build lại theo batch ID/HRC lot ID hiện tại.
- Validation issue trở thành graph node.
- Issue liên kết tới validation rule.
- Result liên kết tới batch, trace, R-006 và validation issues.
- Kiểm tra uniqueness, orphan edge và core relations.

### C6 Dynamic Release State
- Thêm `release-engine.js`.
- Release state được derive từ `data_origin`, `R-006`, validation blockers và graph integrity.
- Numeric value luôn `null`; C6 không thay C4 Calculation Engine.

### Local persistence
- Thêm `persistence.js`.
- Chỉ persist working input whitelist.
- Derived/security/governance state không được persist từ browser patch.
- Refresh localhost giữ working input và recompute validation/graph/release.

### Localhost deployment
- Thêm `serve_local.py`.
- Thêm `run_localhost.bat` cho Windows.
- Thêm `run_tests.bat`.

### Tests
- Giữ C2/C3 tests.
- Thêm graph-engine tests.
- Thêm release-engine tests.
- Thêm persistence tests.
- Thêm end-to-end derived-state pipeline tests.

## v0.6.2 UI Refresh 02 — 2026-08-29
- Reframed Overview from a technical dashboard into a landing + product narrative + operational workspace.
- Added enterprise eco/tech visual system (forest, leaf, white/mint surfaces, semantic state colors).
- Added marketing header and product navigation while retaining the complete local workspace nav.
- Added hero app preview, readiness widget, capability cards, progressive workflow, comparison matrix, runtime transparency, FAQ and CTA.
- Added overview-target navigation and hashchange support.
- Technical engine and guardrails remain unchanged.

## 2026-09-15 — Language toggle refinement
- Removed the Motion/Pause control from the header; ambient background motion remains enabled according to the existing runtime/reduced-motion behavior.
- Converted the static `VI` chip into an interactive `VI ↔ EN` language toggle with a subtle flip transition.
- Added `src/i18n.js`, a local/offline UI translation layer that translates static and dynamically rendered CarbonGraph interface content without changing business logic, guardrails, test state, or release behavior.
- Language preference is persisted locally in `localStorage` under `cg-language`.


## UI navigation + news update — 2026-09-15
- Header navigation is now persistent/sticky across vertical scrolling.
- Added `Tin tức` / `News` overview navigation target.
- Added six-source News & Insights section (3 Vietnam, 3 international) with local SVG thumbnails and external article links.
- Added VI/EN translations for the new section without changing business logic.


## 2026-11-06 — W02 Customer Profile
- Added a dedicated `Hồ sơ khách hàng` workspace screen for read-only lookups by `sk_id_curr` against the configured CORE4 snapshot.
- Added `/api/customer/profile` with an explicit five-group field allowlist, null preservation, and train/validation-only access; final-test profiles remain blocked.
- Added bilingual profile labels, responsive layout, API/guard regression tests and Windows handoff instructions.
- Kept the frozen ML bundle, 169-feature contract, threshold policy and H16 release evidence unchanged.


# M08.2 — Data Contract & PostgreSQL Logical Design — 08/11/2026

- Bổ sung data contract cho dữ liệu ứng dụng: hồ sơ vay, kiểm tra chất lượng đầu vào, kịch bản W04, snapshot tín hiệu H18, báo cáo W06 và audit events.
- Bổ sung logical ERD, data dictionary, access/retention/backup design, API contract draft và SQL schema/roles proposal.
- Quy định PostgreSQL chỉ lưu dữ liệu do ứng dụng sở hữu; CORE4 Parquet và model H16 tiếp tục là nguồn ngoài, read-only. Không copy 169 predictors, TARGET hoặc model artifacts vào app database.
- Hồ sơ vay dùng `applicant_reference` riêng, không đồng nhất với `sk_id_curr`; tên người nộp lưu dạng ciphertext trong thiết kế.
- H18 assessment bắt buộc `business_policy_status=NOT_APPROVED`, `automatic_credit_decision=false`; không có cột quyết định duyệt/từ chối hoặc điều khoản vay.
- Rule registry chỉ cho DRAFT/NOT_APPROVED/RETIRED và `is_executable=false`.
- Tách `psycopg[binary]==3.3.6` thành dependency đề xuất cho M08.3; không thay đổi H16 runtime lock.
- M08.2 chỉ là logical/physical schema proposal; không tạo DB server, không apply SQL và không bật API ghi. Cần design sign-off trước M08.3.
- Design audit sau hardening: 19/19 PASS; focused M08.2 Node tests 16/16 PASS; full Node regression 124/124 PASS. Freeze 39/39 MATCH; M08.1 source audit 13/13 PASS. PostgreSQL live integration chưa được kiểm thử vì môi trường build không có PostgreSQL server/psql.


### M08.2 — least-privilege/security review addendum — 08/11/2026
- Siết grants theo bảng/cột: validation và H18 snapshots chỉ INSERT/SELECT; report chỉ archive; simulation chỉ soft-delete; loan application không thể đổi owner/creator.
- Cấp EXECUTE tường minh cho RLS helper và identity resolver; app runtime không có SELECT trực tiếp trên `app_users`.
- Bổ sung kiểm tra actor/owner trong RLS insert/update checks; JSON forbidden-key guard recursive, case-insensitive.
- Thu hẹp database access: revoke PUBLIC CONNECT và default PUBLIC grants cho tables/functions tương lai.
- Sửa M08.1 source audit để phân biệt 3 SQL design proposals với 0 active migrations.
- Thêm `run_m08_2_design_audit.bat`; không có SQL nào được apply và không thay đổi backend/model.


## 2026-11-09 — M08.3 PostgreSQL persistence foundation
- Added versioned PostgreSQL migrations, checksum/advisory-lock migration runner, loopback-only connection helper and sanitized DB health endpoint.
- Hardened actor identity fail-closed: removed caller-settable GUC identity and caller-parameterized SECURITY DEFINER resolver.
- Kept write APIs disabled pending trusted authentication and live RLS/grants validation.
- No CORE4/H16/H18/UI changes; no live database migration claimed.

## 2026-11-10 — M08.4 Real Dashboard & Data Management (initial increment)
- Added actor-scoped PostgreSQL operational KPI aggregation and the `/api/dashboard/summary` and `/api/data/health` endpoints.
- Added owner predicates and retained RLS; null trusted actor returns `AUTH_CONTEXT_REQUIRED` and null metrics without running aggregate queries.
- Replaced illustrative approval/high-risk KPI claims with live API-backed application, INPUT_QUALITY, H18 support-signal and active-report metrics.
- Added source-health/data-catalog view separating PostgreSQL operational records from read-only CORE4/H16.
- Kept localStorage demo records in a clearly labelled compatibility area, outside live KPIs and ML.
- Added Metric Glossary, Dashboard API Contract, M08.4 source audit and regression tests.
- No database migration, CRUD endpoint, authentication change, H16/CORE4 artifact change or H18 policy change. Target-Windows HTTP/UI verification remains pending.

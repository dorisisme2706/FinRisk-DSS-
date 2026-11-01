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

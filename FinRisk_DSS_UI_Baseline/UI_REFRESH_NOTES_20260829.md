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

# CarbonGraph UI Refresh 04 – Deep Workspace

## Scope
Front-end presentation and interaction layer only. Technical baseline remains v0.6.2 RC1_CANDIDATE.

## Deep screens
1. Input Module – guided input builder + derived state + audit timeline.
2. Evidence Queue – evidence readiness board and synthetic/real separation.
3. Validation – severity filters + issue cards + classification state.
4. Trace Explorer – visual graph lanes + relation registry.
5. Release Gate – readiness checklist + masked-result view + blocker reasons.
6. Working Export – local Report Center for HTML/JSON working artifacts.
7. End-to-End – pipeline console and technical safety checks.
8. Test Center – QA console, reviewer identity, progress and manual cases.

## Guardrails
- SYNTHETIC_DEMO remains locked.
- R-006 remains OPEN.
- Numeric remains BLOCKED/MASKED.
- Compliance remains NOT_EVALUATED.
- Product-roadmap cards are explicitly concept/roadmap UI and do not represent implemented production features.

## Verification
- JavaScript syntax check: PASS.
- Automated regression: 75/75 assertions PASS.
- Local HTTP smoke test: index.html, styles.css, logo asset and app.js = HTTP 200.

## Human review requested
Review each workspace screen at desktop width first, then at narrow browser width. Focus on readability, information density and whether technical meaning remains clear.

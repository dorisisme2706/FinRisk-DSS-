# UI Refresh 08 – 29/08/2026

- Tăng tốc độ chuyển động của background graph để node bớt ì và sinh động hơn trên màn demo.
- Giữ nguyên mật độ node đậm của Refresh 07 nhưng tăng velocity từ mức chậm sang mức trung bình-nhẹ.
- Xây lại footer theo phong cách enterprise giống mẫu người dùng gửi: khối thương hiệu, thông tin liên hệ, nhóm liên kết giải pháp, khối dự án và ghi chú vận hành.
- Chuyển footer từ thanh đơn sang bố cục nhiều cột, phù hợp landing SaaS / product website.
- Tiếp tục giữ guardrail ở footer thay vì đầu trang.
- Không thay đổi logic nghiệp vụ hay automated baseline.

# CarbonGraph UI Visual Freeze Checklist – Refresh 07 Candidate

Reference build: `CarbonGraph_MVP_Source_v0.6.2_UI-Refresh07_20260829`

## Automated baseline
- [x] `src/app.js` syntax PASS.
- [x] `src/ambient-graph.js` syntax PASS.
- [x] 75/75 automated assertions PASS.
- [x] Localhost smoke: index / CSS / logo / app.js / ambient-graph.js = HTTP 200.

## Responsive freeze targets
- [x] CSS profile added for 1366×768 demo laptop.
- [x] Full-HD spacing/line-length profile added.
- [x] Mobile <=640px profile refined.
- [x] Workspace horizontal scrollbar remains visually hidden while horizontal navigation remains available.

## Ambient graph target
- [x] Desktop density raised from 40 to 64–76 nodes depending on width.
- [x] Tablet density raised from 28 to 46 nodes.
- [x] Mobile density raised from 18 to 30 nodes.
- [x] Node radius and edge opacity increased.
- [x] Dark forest-green accent nodes increased.
- [x] Motion remains pauseable and respects reduced-motion.

## Manual visual review required on actual demo laptop/browser
- [ ] At 1366×768, header + workspace bar do not crowd the first hero viewport.
- [ ] At 1920×1080, page remains centered and does not become excessively wide.
- [ ] Green node background is clearly visible in gutters/transparent surfaces, but text remains easy to read.
- [ ] Node density feels active/technical rather than noisy or distracting.
- [ ] Motion pause/resume works and survives reload.
- [ ] Header logo renders sharply and does not crowd navigation.
- [ ] Workspace navigation icons and labels remain readable at desktop/tablet/mobile widths.
- [ ] Input Apply shows toast feedback and derived-state update remains correct.
- [ ] Validation severity filter works; no-match state appears when appropriate.
- [ ] Trace Explorer node click opens Node Inspector with correct connected relations.
- [ ] Release Gate remains BLOCKED/MASKED and contains no tCO2e/SEE numeric output.
- [ ] HTML/JSON exports download and show toast feedback.
- [ ] Test Center records case status/reviewer and UAT guardrail remains unchanged.
- [ ] Toasts do not cover essential buttons on 1366×768 or mobile screens.
- [ ] Keyboard focus ring is visible on buttons, nav, inputs and graph nodes.

## Freeze rule
Do not mark Visual Freeze PASS until all manual items above have been reviewed on the actual demo laptop/browser. Visual Freeze does not close R-006, approve compliance, validate numeric emissions, or change any Gate decision.

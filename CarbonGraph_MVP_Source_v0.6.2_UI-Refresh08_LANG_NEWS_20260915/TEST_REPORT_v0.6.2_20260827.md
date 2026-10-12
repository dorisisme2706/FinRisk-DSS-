# CARBONGRAPH MVP v0.6.2 – TEST REPORT

Ngày chạy: 27/08/2026  
Runtime: Node.js v24.19.0  
Kết quả: `75/75 PASS`  
Trạng thái phát hành: `RC1_CANDIDATE / REVIEW`, chưa phải release được phê duyệt.

## Phạm vi kiểm thử

| Suite | Case | Kết quả |
|---|---:|---|
| state | 9 | PASS |
| validation-engine | 8 | PASS |
| validation-coverage | 9 | PASS |
| claims-engine | 4 | PASS |
| graph-engine | 5 | PASS |
| release-engine | 4 | PASS |
| persistence | 4 | PASS |
| report-engine | 8 | PASS |
| e2e-engine | 4 | PASS |
| pipeline | 5 | PASS |
| acceptance-catalog | 4 | PASS |
| acceptance-engine | 6 | PASS |
| formal-d1-d4 | 5 | PASS |
| **Tổng** | **75** | **PASS** |

## Thay đổi được kiểm chứng

1. D5 export fail-closed khi thiếu tên reviewer; tên được normalize và lưu riêng khỏi derived runtime state.
2. VR-022 có direct `RESULT → VALIDATED_BY → RULE` và quan hệ này được tính là core relation.
3. Working trace export bảo toàn `HAS_TRACE`, `VALIDATED_BY`, `GATED_BY`.
4. VR-001–005, VR-011–013 và VR-016 có negative/fail-closed test chính thức.
5. VR-019 scanner chặn legacy/compliance/verification claim; bốn app surfaces hiện tại có 0 finding.
6. Numeric emissions vẫn `null`, UI/report vẫn `BLOCKED/MASKED`.

## Giới hạn kết luận

- `75/75 PASS` chỉ chứng minh regression kỹ thuật trong synthetic branch.
- Không chứng minh Calculation Engine chính xác, dữ liệu thật được thẩm tra hoặc tuân thủ CBAM.
- D5 cần xuất lại JSON bằng tên người duyệt thật.
- D1, D3, D4 và D5 vẫn cần người được phân công ký.
- R-006 vẫn `OPEN`; C4 và D2 numeric tiếp tục HOLD.

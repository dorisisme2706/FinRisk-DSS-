# GitHub Desktop — nội dung commit đề xuất

Chỉ thực hiện sau khi người dùng phê duyệt. Chưa stage/commit/push.

Summary:

```text
Tích hợp ML H13 và xác minh luồng CORE4 thật trên FinRisk DSS
```

Description:

```text
Đưa source ứng dụng từ ZIP gốc vào app để quản lý thay đổi.
Tái sử dụng ProfileScorer và policy gốc; cấu hình CORE4 qua --snapshot hoặc FINRISK_SNAPSHOT.
Kiểm hash/schema/split, chặn ID final test và bảo vệ tài nguyên model/data khỏi HTTP.
Hoàn thiện panel tra cứu hiện hữu và VI/EN; giữ nguyên layout, CSS, model, policy và các chức năng MOCK.

LIVE QA Linux/Chromium: 52 PASS, 0 FAIL, sáu hồ sơ tham chiếu.
100035: risk_score 0.15160322574159024, review_recommended true, explanation_status ok.
Đã đối chiếu top 10, policy >=, lỗi API, ID test và VI→EN→VI.
Regression trước đó: 31 tệp JS, 10 test backend; không ghi nhận là lượt chạy Windows.
Windows 10/11: NOT TESTED.

Bổ sung hướng dẫn Windows, evidence tổng hợp và công cụ đóng ZIP source sạch.
Model binary, split IDs, raw reference feature values và CORE4 là tài sản local bị ignore, không thêm vào commit.
PostgreSQL, hồ sơ mới, trace/báo cáo/lịch sử và E2E nghiệp vụ đầy đủ vẫn MOCK/chưa tích hợp.
ZIP gốc đã có trong commit nền chứa các tài sản dữ liệu; chưa xóa hoặc sửa lịch sử, cần trưởng nhóm quyết định xử lý.
Không triển khai production; chưa có phê duyệt policy/schema nghiệp vụ.
```

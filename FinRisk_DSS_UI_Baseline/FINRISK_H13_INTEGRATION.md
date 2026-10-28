# FinRisk H13 – Giai đoạn tích hợp ML (VI)

## Phạm vi
- Đã bổ sung API local `GET /api/ml/score?sk_id_curr=100007` và `GET /api/ml/health`.
- Đã thêm khu vực tra cứu ML thật trên màn hình **Đánh giá tín dụng** (#12). Kết quả MOCK cũ vẫn giữ nguyên và được phân biệt rõ.
- Không tạo hồ sơ mới từ form MOCK; không thay đổi mô hình, threshold hay policy; không tích hợp PostgreSQL.
- Không có `data/feature_matrix.parquet` trong gói backend gốc nên **không thể chạy dự đoán thật khi chưa nhận snapshot CORE4 đúng SHA256**.

## Chạy thử
1. Cài Python 64-bit, sau đó `pip install -r backend_ml/FinRisk_ML_For_GK/model/requirements-lock.txt`.
2. Nhận snapshot CORE4 từ TK. Thư mục snapshot phải chứa `data/feature_matrix.parquet` đúng hash được quy định trong README_GK_VI.md.
3. Tại thư mục gốc UI, chạy `python backend_api/server.py --snapshot "DUONG_DAN_SNAPSHOT" --port 8080`.
4. Mở `http://127.0.0.1:8080/#result`, nhập ID hồ sơ đã tồn tại, ví dụ `100007` (validation).
5. Nếu chưa có snapshot, có thể chạy `python backend_api/server.py`; giao diện vẫn hoạt động, `/api/ml/health` trả 503 và API không tạo điểm giả.

## QA và giới hạn
- Cần kiểm thử dự đoán/đối chiếu `contracts/response_examples.json` khi có snapshot đúng phiên bản.
- Cần kiểm thử trình duyệt thủ công VI→EN→VI, các ID lỗi, test reserved, chất lượng giải thích và responsive.
- Gói hiện tại không phải chứng nhận E2E hay nghiệm thu backend/PostgreSQL.
- Dịch chuỗi động mới dựa trên hệ thống i18n.js hiện hữu; cần QA thực tế để xác nhận đầy đủ.

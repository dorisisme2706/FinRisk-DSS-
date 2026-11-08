# FinRisk DSS — W02 Customer Profile

## Trạng thái
- W02 được triển khai trên nền `FinRisk_DSS_H19_M5_Candidate_W01_W03_1.zip` đã được nhóm xác nhận chạy Windows và GK sign-off.
- Phạm vi: tra cứu hồ sơ có trong CORE4 bằng `sk_id_curr`; chỉ đọc, không sửa snapshot và không ghi ngược dữ liệu.
- Nguồn: CORE4 snapshot đang cấu hình qua `FINRISK_SNAPSHOT` cho backend.

## Thành phần triển khai
- Navigation mới: `Hồ sơ khách hàng` (`customer`), độc lập với form hồ sơ vay MOCK (`data`).
- API mới: `GET /api/customer/profile?sk_id_curr=<positive_integer>`.
- API chỉ trả các trường allowlist thành 5 nhóm: thông tin hồ sơ, tài chính, Bureau, hồ sơ trước đây và lịch sử thanh toán kỳ góp.
- Giá trị NULL được giữ là null; không tự thay bằng 0. Các trường tài chính hiển thị theo đơn vị gốc dataset, không tự quy đổi sang VND.
- Hồ sơ thuộc split `test` bị chặn HTTP 403; mã không tồn tại trả 404; ID không hợp lệ trả 400; snapshot chưa sẵn sàng trả 503.
- Không trả tên, ngày sinh, giới tính, địa chỉ hoặc target. Không thay đổi pipeline, model, 169 features, threshold, policy, calibration hay release metadata.
- Giao diện hỗ trợ VI/EN; CSS W02 chỉ được thêm ở cuối `assets/styles.css`.

## Kiểm thử đã chạy trong môi trường đóng gói
- `node --check src/app.js`: PASS.
- `node --check src/i18n.js`: PASS.
- `node --test tests/*.test.js`: 58 tests PASS / 0 FAIL trong môi trường hiện tại.
- `python -m unittest backend_api.test_server -v`: 17 tests PASS / 0 FAIL trong môi trường hiện tại.
- Browser QA trên Windows với snapshot CORE4 của nhóm vẫn cần được xác nhận trực tiếp trước khi coi W02 là nghiệm thu cuối cùng.

## Hạn chế có chủ đích
- W02 là tra cứu theo ID, không phải danh bạ tìm kiếm theo tên vì CORE4 không cung cấp tên cá nhân.
- Không có CRUD: không tạo, sửa, xóa hoặc cập nhật hồ sơ CORE4.
- Không suy diễn tuổi, tên, địa chỉ, đơn vị tiền tệ hoặc ý nghĩa nghiệp vụ chưa được xác nhận.
- W02 không tự chạy hoặc thay thế panel dự đoán ML H18/W03.

## Chạy và kiểm tra trên Windows
1. Giải nén ZIP mới vào thư mục riêng; không ghi đè bản H19/W01-W03 đã sign-off.
2. Mở PowerShell tại thư mục `app`.
3. Dùng đúng thư mục snapshot CORE4 đã PASS ở W01/W03. Có thể truyền trực tiếp đường dẫn vào launcher: `run_with_ml.bat "D:\DUONG_DAN\FinRisk_CORE4_Snapshot"` (thay bằng đường dẫn thực tế trên máy). Thư mục snapshot cần chứa `data\feature_matrix.parquet`.
4. Chạy launcher và mở `http://127.0.0.1:8080/#customer`.
5. Mở tab `Hồ sơ khách hàng`, nhập `100035` và bấm `Tra cứu hồ sơ`. Đây là ID mẫu có trong bộ ví dụ đóng gói; nếu snapshot tại máy không chứa ID này, dùng ID tham chiếu hợp lệ khác từ QA.
6. Xác nhận 5 nhóm thông tin hiển thị; NULL hiện là `Không có dữ liệu`; không có tên/tuổi/địa chỉ; panel báo `READ ONLY`.
7. Thử ID không hợp lệ (`abc`) và ID không tồn tại để xác nhận thông báo phù hợp. Dùng `100009` (được ghi trong split manifest của gói là `test`) để xác nhận API trả 403 và UI chặn; không dùng ID test cho dự đoán.
8. Chuyển VI → EN → VI khi đã có kết quả; xác nhận tiêu đề, nhãn, trạng thái và nội dung nhóm đổi ngôn ngữ, dữ liệu không mất.
9. Kiểm tra viewport 1440px, 768px và 390px; xác nhận form không tràn, các nhóm chuyển thành một cột ở màn nhỏ.
10. Chạy `run_tests.bat` để chạy nhóm hồi quy Node.js và API Python (khi `.venv` tồn tại). Có thể chạy riêng API bằng `run_api_tests.bat` hoặc `python -m unittest backend_api.test_server -v`.

## Kết luận nghiệm thu
Bản đóng gói đã qua kiểm thử tự động phía frontend và backend trong môi trường hiện tại. Việc hiển thị dữ liệu CORE4 thật, thử split test, VI/EN và responsive trên Windows vẫn cần được xác nhận ở máy có snapshot CORE4 của nhóm; không tuyên bố đã thực hiện thay cho người dùng.

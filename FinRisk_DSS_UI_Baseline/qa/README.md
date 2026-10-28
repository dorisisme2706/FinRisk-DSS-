# Kiểm thử responsive #20

1. `pip install playwright`
2. `python -m playwright install chromium`
3. Tại thư mục gốc project chạy: `python qa/responsive_qa.py`

Script chạy ứng dụng HTML/CSS/JS hiện có trong sandbox trình duyệt, kiểm tra 18 độ rộng màn hình × 9 màn hình giao diện, kiểm tra active tab và không tràn ngang, đảm bảo News/Roadmap/Canvas, thay đổi Reduced Motion, lưu ảnh và JSON ở `evidence/item20/`.

Dùng `run_tests.bat` để chạy các test nghiệp vụ cũ + test #01/#02 + test tĩnh #20. Script Python là QA tùy chọn, không bắt buộc để chạy trang web.

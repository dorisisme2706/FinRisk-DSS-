# Chạy chatbot FinRisk

## Chạy local

Mở PowerShell tại thư mục `app`, sau đó chạy:

```powershell
.\tests\05_CHAY_CHATBOT.cmd
```

Nhập Groq API key tại lời nhắc ẩn. Key chỉ được truyền vào process backend hiện tại; không lưu vào file, không commit lên Git. Mỗi thành viên tự tạo và quản lý key riêng.

Khi được hỏi đường dẫn CORE4 snapshot:

- Nhấn Enter để dùng FAQ/chat hỏi đáp chung, không có tra cứu ML.
- Nhập thư mục snapshot nếu có `data\feature_matrix.parquet` và các report/schema tương ứng. Snapshot nằm ngoài Git và phải được nhóm cấp riêng.

Mở `http://127.0.0.1:8080`. Giữ cửa sổ PowerShell mở trong khi sử dụng; nhấn `Ctrl+C` để dừng server.

Không mở trực tiếp `index.html` bằng `file://`. Chatbox và các API H18 đều được phục vụ bởi cùng backend.

## Kiểm thử

Tại thư mục `app`, chạy:

```powershell
python tests\test_chat_integration.py
python backend_api\test_server.py
```

Chat integration test dùng provider giả lập và không gọi Groq thật. Backend test có thể cần các package ML được khai báo trong `backend_ml\model\requirements-lock.txt`.

## Bảo mật và giới hạn

- Không đưa API key vào source, `.env` được commit, log, ảnh chụp hoặc chat.
- Không nhập thông tin khách hàng thật. Khi hỏi về profile, ngữ cảnh ML được gửi tới Groq.
- Backend mặc định chỉ bind `127.0.0.1`; không mở ra mạng công cộng.
- FAQ có thể chạy khi không có CORE4 snapshot; profile lookup thì không.

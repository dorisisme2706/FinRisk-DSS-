# FinRisk DSS – Dọn nút So sánh (26/10/2026)

- Xóa duy nhất nút `So sánh` (`cg-compare`) khỏi header.
- Giữ bốn nút Giải pháp, Quy trình, Tin tức, Hỏi đáp theo thứ tự hiện tại.
- Xóa bản dịch riêng cho nút đã bỏ và selector CSS neo `cg-compare` không còn dùng.
- Cập nhật kiểm thử #03/#04 kỳ vọng bốn nút và thêm regression test.
- Không thay đổi các tab #12, #18, #19, giao diện xanh, animation, News hoặc Roadmap.
- Chỉ xác minh bằng static Node.js tests; chưa thực hiện browser UAT.

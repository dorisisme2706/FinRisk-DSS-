# FinRisk DSS — H18 Integrated Source

Đây là source mới nhất dùng `FINRISK-DSS--main--phase1-fixed.zip` làm base và tích hợp H18 với **model H16 đã khóa**.

Luồng thật hiện có:

`CORE4 snapshot → frozen LightGBM → ProfileScorer → H18 review adapter → local API → FinRisk UI`

Điểm quan trọng:
- Model, 169 feature và threshold **không được chỉnh lại sau H16**.
- Endpoint H18 chỉ tạo **tín hiệu review cho con người**. Không tự động APPROVE/REJECT.
- Hạn mức, kỳ hạn, lãi suất và monthly payment **không được model H16 tự sinh**; phần mô phỏng cũ vẫn tách riêng.
- Snapshot CORE4 vẫn để ngoài source.

Chạy trên Windows: xem `WINDOWS_RUN.md`.
Báo cáo H18: xem `H18_DELIVERY.md`.

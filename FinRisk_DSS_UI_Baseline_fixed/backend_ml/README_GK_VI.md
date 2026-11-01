# FinRisk — bàn giao mô hình và giải thích cho GK

Đây là mô-đun Python dùng trong backend/adapter, không chạy trực tiếp trong trình duyệt. Chưa sửa UI, chưa tạo API hay triển khai server. Giữ giao diện FinRisk cũ; khi thêm chuỗi UI, GK cập nhật src/i18n.js VI/EN và kiểm thử chuyển ngôn ngữ.

## Phụ thuộc và dữ liệu

Cần Python 64-bit và các gói trong model/requirements-lock.txt. Gói không chứa CSV gốc, full snapshot Parquet, mật khẩu hoặc .venv. TK cung cấp snapshot CORE4 đúng SHA256. Thư mục snapshot dùng cho --snapshot phải có data/feature_matrix.parquet với SHA256 a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0. Model/schema/split/policy đã kèm. Giữ nguyên cấu trúc src/finrisk_ml; joblib cần import được các class tương ứng.

Không giả lập 169 đặc trưng bằng 0 từ vài ô thu nhập/số tiền vay. MVP hiện là nhập ID đã tồn tại -> tra feature snapshot -> predict -> giải thích/tín hiệu review. Chưa hỗ trợ hồ sơ mới hoặc form tự do. Với form tương lai cần pipeline tạo đặc trưng và schema riêng đã xác nhận.

## Gọi mô-đun từ Python

Thêm thư mục src của bundle vào PYTHONPATH hoặc sys.path của backend, sau đó:

```python
from finrisk_ml.inference import ProfileScorer

# bundle_root là thư mục đã giải nén có model/, contracts/, splits/.
# snapshot_root là thư mục có data/feature_matrix.parquet.
scorer = ProfileScorer(snapshot_root, bundle_root)  # khởi tạo một lần mỗi process
response = scorer.score(100007)
```

Không khởi tạo ProfileScorer mỗi request vì mỗi lần phải kiểm hash và đọc snapshot. Không đưa full Parquet hoặc model vào static frontend. API, nếu học phần/yêu cầu tích hợp cần, được GK/TK chọn sau; bundle chưa phụ thuộc FastAPI hoặc Streamlit. Với nhiều worker, tính RAM cho từng snapshot riêng.

CLI minh họa sau khi đi vào thư mục bundle và dùng Python đúng môi trường:

```text
python src/score_hk_h13.py --run . --snapshot DUONG_DAN_SNAPSHOT --profile-id 100007
```

DUONG_DAN_SNAPSHOT là giá trị thay thế, không gõ nguyên văn. Với request lỗi, dùng code để hiển thị thông báo; không biến lỗi thành score0.

## Quy ước response

Request là sk_id_curr nguyên dương; bool, chuỗi, số âm không hợp lệ ở module. Nếu API nhận chuỗi phải xác thực/parse có chủ đích. ID không có -> PROFILE_NOT_FOUND; ID test -> PROFILE_RESERVED_FOR_FINAL_TEST trước predict. risk_score là điểm mô hình dương class1; calibration_status nói rõ raw đang được giữ, chưa được hiệu chỉnh thành công theo tiêu chí chọn. Không gọi score là xác suất vỡ nợ được bảo đảm.

review_recommended=True chỉ đề nghị chuyên viên xem xét theo ngưỡng demo F1. False không phải duyệt vay. Ngưỡng và comparator >= nằm trong threshold_policy.json, không hardcode0.5 hoặc làm tròn0.145 trước so sánh. Có thể làm tròn khi hiển thị, nhưng quyết định dùng giá trị gốc đầy đủ. Không đổi ngưỡng theo tuổi/giới.

explanations là top10 đặc trưng theo trị tuyệt đối đóng góp, có dấu tăng/giảm điểm và observed_value, NULL giữ null. Đơn vị là **raw_margin_log_odds**, không phải phần trăm xác suất. explanation_details có base_margin + tổng đóng góp = raw_margin; sigmoid(raw_margin) = raw_base_probability. Chỉ top10 không cộng đủ margin: phải cộng other_features_sum. Baseline margin là expected value nội bộ của mô hình cây, không phải một khách hàng cụ thể hay tỷ lệ nhãn1 chung.

Các đóng góp giải thích cách mô hình tính điểm, không chứng minh nguyên nhân tài chính hoặc việc thay giá trị sẽ làm rủi ro thực giảm. Với proxy/tương quan, không dùng để kết luận giới tính/tuổi không còn ảnh hưởng gián tiếp. Feature name/description từ contracts/feature_descriptions.json; bản dịch UI phải giữ nghĩa và key, không tự đổi đơn vị thu nhập thành VND hay annuity thành tiền trả tháng.

Nếu explanation_status=error: score vẫn có thể dùng làm demo nếu status=ok, nhưng hiển thị giải thích chưa khả dụng; không thay bằng lý do AI. Các lỗi version/model/data là lỗi setup, không tiếp tục suy luận bằng dữ liệu khác.

Global gain importance là giảm loss tích lũy của các split trong mô hình đã fit; không phải trung bình SHAP trên test, không phải nguyên nhân, không đưa chiều tăng/giảm cho mọi khách hàng.

## Kiểm thử tích hợp GK

- Dùng contracts/response_examples.json để hiểu format; đều là hồ sơ validation, không phải test. Chúng là ví dụ cho tích hợp, không phải một mẫu đánh giá ngẫu nhiên hay benchmark.
- Gọi lại cùng ID từ snapshot đúng, score/model/data/version/policy khớp ví dụ trong sai số1e-10.
- Thử ID sai, ID không tồn tại và ID test; lỗi đúng code, không sinh score giả.
- Kiểm tra chất lượng thiếu dữ liệu qua quality_flags; không giấu ANNUITY_MISSING/BUREAU_NOT_OBSERVED.
- Top contributions hiển thị đúng dấu/thang, không viết +0.2 thành +20% rủi ro.
- Giữ dữ liệu, model, pipeline cũ; không refit trong request và không log mật khẩu.
- Bổ sung i18n/QA/evidence UI sau khi có source giao diện chuẩn. Gói này chưa chứng nhận tích hợp UI hoặc nghiệm thu TK/GK.

# Rà soát bàn giao cuối — trước commit

Nhánh `integration/h13-core4`, nền `191011985916fe0ca338c5e2da5c6c4ff6bce035`. Chưa stage, commit, push, merge, tạo PR hoặc deploy. Source/API/UI không được thay đổi chức năng trong lượt rà soát; model, policy và CSS/index giữ nguyên byte gốc.

## Kết quả chính

- LIVE QA trước đó: 52 PASS, 0 FAIL trên Linux/Python 3.12.14/Chromium; cả sáu reference, schema 169 predictor, policy gốc và API/VI/EN đều PASS.
- Đã khôi phục source từ ZIP sạch ở thư mục riêng, bổ sung đúng ba tài sản ML riêng tư và chạy lại live suite: 52 PASS, 0 FAIL. Evidence tổng hợp: `app/evidence/h13/handoff-restore-results.json`. Kết quả này xác nhận source bàn giao không phụ thuộc helper tạm hoặc source ngoài checkout.
- Tài sản được cấp riêng cho lần khôi phục: pipeline.joblib, split_manifest.csv và response_examples.json. Snapshot gốc ở ngoài checkout. Không đổi hoặc tạo model/dữ liệu thay thế.
- Windows 10/11: **NOT TESTED**. Hướng dẫn hiện hành trong `WINDOWS_RUN.md`; không gọi kết quả Linux là xác nhận Windows.

## Rà soát Git và source

Đã đối chiếu tệp tracked, untracked và ignored; không chỉ dùng `git diff` vì app chưa được Git theo dõi ở commit nền. Tất cả 161 tệp trong ZIP gốc đã được đối chiếu với app; thay đổi chức năng nằm trong 8 tệp đã liệt kê ở H13_CHANGES.json. Các tệp nguyên trạng được phân biệt với tệp sửa thực sự. Không có Deleted.

8 tệp sửa so với source ZIP gốc:

- app/backend_api/server.py
- app/backend_ml/src/finrisk_ml/inference.py
- app/backend_ml/src/score_hk_h13.py
- app/backend_ml/contracts/inference_contract_h13.json
- app/backend_ml/BUNDLE_MANIFEST.json
- app/src/app.js
- app/src/i18n.js
- app/run_with_ml.bat

Trong lượt rà soát cuối, hai JSON metadata được đồng bộ từ BLOCKED cũ sang LIVE_PASS_LINUX_CHROMIUM_52_CHECKS và Windows NOT TESTED; cập nhật checksum contract trong manifest. Không đổi model metadata gốc, model binary, schema predictor gốc, split hoặc policy.

Added/Modified/Deleted đầy đủ cho Git được sinh từ `git ls-files --cached --others --exclude-standard` ở `H13_CHANGES.json`. Không stage để tạo diff; index vẫn không có thay đổi. Có thể dùng GitHub Desktop xem toàn bộ untracked sau phê duyệt. Tệp private bị ignore được liệt kê riêng, không bị xem là Deleted.

## Phát hiện và xử lý đóng gói

Lượt rà soát này phát hiện ZIP bàn giao cũ có tài sản ML gốc và dữ liệu ở cấp hồ sơ: split IDs, 60 observed_value trong response_examples, 60 observed_value trong smoke report và screenshot reference. Vì vậy không sử dụng các ZIP cũ để chia sẻ source sạch.

ZIP hiện hành: `/workspace/finrisk-delivery/FinRisk_DSS_H13_Source_Reviewed.zip`. SHA256 ở tệp cùng tên đuôi `.sha256`.

Công cụ `tools/package_source.py` tạo ZIP từ source trong checkout; không dùng /tmp helper. ZIP không chứa:

- CORE4, Parquet, feature_contract/model_candidate_columns gốc hoặc TARGET dataset.
- Model binary, split IDs, response_examples có observed values, fresh_process_smoke và screenshot reference.
- .env, key files, credentials đã phát hiện, archive lồng, cache/venv/node_modules, raw logs.
- Evidence/handoff legacy không cần cho runtime hoặc báo cáo cuối. Tài liệu legacy vẫn giữ trong checkout; ZIP ưu tiên hướng dẫn hiện hành.

Model/split/reference và screenshot được giữ nguyên ở local, không xóa tài sản gốc. `.gitignore` đảm bảo chúng không trở thành tệp Added mới khi dùng git add thông thường. Metadata/model policy, hashes, mô tả schema và evidence tổng hợp vẫn có trong source. Kết quả có score của sáu ID tham chiếu đã công khai trong bundle nền; không có feature values hoặc hàng khách hàng được xuất vào evidence mới.

Đã quét tên tệp, archive lồng của ZIP cũ và các mẫu private key/token/API-key literal; chưa phát hiện .env hay chuỗi credential phù hợp mẫu. Đây là bằng chứng quét tĩnh có phạm vi, không phải bảo đảm tuyệt đối rằng mọi loại bí mật đều được nhận diện. ZIP mới được kiểm CRC, duyệt toàn bộ entry và đối chiếu byte với source hiện tại; kết quả kiểm ở `app/evidence/h13/handoff-audit.json`.

## Điểm cần trưởng nhóm quyết định trước khi công bố repository

**ZIP gốc `FinRisk_DSS_H13_ML_Integration_Phase1_fixed.zip` đã được theo dõi trong commit nền và chứa model/split/reference values.** Ignore không xóa tệp tracked hoặc lịch sử. ZIP source sạch loại archive này nhưng checkout/history hiện tại vẫn có nó. Lượt này không xóa archive gốc hoặc rewrite lịch sử. Không tuyên bố toàn bộ repository/history sạch dữ liệu. Nếu yêu cầu áp dụng cho toàn bộ repository/history, đây là điểm chưa được giải quyết cần quyết định của chủ repository trước khi push/publish.

## Tái tạo ZIP source

Tại root checkout:

```bash
python tools/package_source.py --out /workspace/finrisk-delivery/FinRisk_DSS_H13_Source_Reviewed.zip
```

Trên Windows dùng đường dẫn đầu ra ngoài checkout, ví dụ `py -3.12 tools\package_source.py --out C:\FinRiskDelivery\FinRisk_DSS_H13_Source_Reviewed.zip`. Công cụ cần git và Python, không cần dữ liệu CORE4.

ZIP source chủ ý không tự chạy inference khi chưa cấp model/split/reference. Không dùng ZIP cũ công khai để lấp phần thiếu; tài sản gốc phải qua kênh nội bộ. `WINDOWS_RUN.md` hướng dẫn sao chép từng tệp, tránh ghi đè source tích hợp bằng cả thư mục backend_ml cũ.

## Bản nháp bàn giao

- `WINDOWS_RUN.md`: Python x64, dependency lock, tài sản ML, hash, cấu hình snapshot, khởi động API, test và xử lý lỗi trên Windows 10/11 — NOT TESTED.
- `COMMIT_VI.md`: Summary/Description để dùng GitHub Desktop.
- `PR_DRAFT_VI.md`: nội dung đề xuất cho trưởng nhóm; phân biệt LIVE PASS tra cứu CORE4 với PostgreSQL/hồ sơ mới/trace/báo cáo/lịch sử vẫn MOCK.
- `H13_CHANGES.json`: danh sách máy đọc của tệp mới/sửa/xóa và local ignored.

Không mở rộng phạm vi PASS sang production, phê duyệt tín dụng, Windows hoặc nghiệp vụ còn MOCK. Nội dung commit/PR chỉ là bản nháp chờ người dùng phê duyệt.

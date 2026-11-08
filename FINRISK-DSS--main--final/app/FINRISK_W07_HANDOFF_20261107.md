# FinRisk DSS – W07 Runtime Compatibility Fix & Release Gate

**Ngày:** 07/11/2026  
**Nền source:** `FinRisk_DSS_W07_Overall_QA_20261107.zip`  
**Mục tiêu:** Xử lý cảnh báo lệch Python/package versions và `InconsistentVersionWarning` trước khi kiểm thử phát hành. Không thay đổi model H16, 169 predictors, threshold, calibration hoặc policy.


## Hotfix bổ sung – lỗi CMD parser trong setup_windows.bat (07/11/2026)

Người dùng xác nhận `py -0p` và `py -3.14 --version` đều nhận diện CPython 3.14.7 x64, nhưng khi chạy `setup_windows.bat`, CMD in `Was was unexpected at this time.`. Nguyên nhân là dòng `echo [FAIL] Python Launcher (py.exe) was not found.` nằm bên trong khối `if errorlevel 1 (`. Dấu `)` trong nội dung echo bị CMD phân tích như dấu đóng khối, khiến từ `was` phía sau trở thành token bất ngờ.

Đã đổi thành `echo [FAIL] Python Launcher py.exe was not found.`; không có dấu ngoặc không escape trong câu echo bên trong khối IF. Thêm regression test vào `tests/finrisk-w07-overall-qa.test.js` và kiểm tra source tương ứng trong `qa/w07_overall_qa.py`.

**Giới hạn kiểm chứng:** môi trường build hiện không có Windows CMD, nên không thể thực thi batch trực tiếp ở đây. Đã xác minh source line, chạy Node regression và static audit. Cần chạy lại `setup_windows.bat` trên chính máy Windows để xác nhận không còn lỗi parser; việc này chưa được đánh dấu PASS trước khi người dùng xác nhận.

## 1. Root cause đã xác định

Model metadata `backend_ml/model/metadata.json` ghi môi trường đóng gói là **CPython 3.14.0**. Sáu package runtime của model được khóa lần lượt: pandas 3.1.0, pyarrow 26.0.0, NumPy 2.5.4, scikit-learn 1.9.1, LightGBM 4.7.0, joblib 1.6.0. File `requirements-lock.txt` khóa tổng cộng 13 package.

Tuy nhiên `setup_windows.bat` trước đó tạo `.venv` bằng `py -3.12`, nên hướng dẫn cài đặt không khớp interpreter ghi trong metadata. Lượt QA build-container dùng Python 3.13.5 và các package khác; cụ thể scikit-learn 1.8.0, pandas 2.2.3, NumPy 2.3.5, LightGBM 4.6.0, joblib 1.5.3 và không có PyArrow 26.0.0. Khi `joblib.load()` pipeline, scikit-learn phát `InconsistentVersionWarning`.

## 2. Cách xử lý trong source mới

1. `setup_windows.bat` yêu cầu **64-bit CPython 3.14** – minor version đúng theo model metadata.
2. Nếu `.venv` đang tồn tại nhưng dùng Python khác, nó được đổi tên thành `.venv_backup`, `.venv_backup_1`, ...; môi trường cũ không bị xóa.
3. Tạo `.venv` mới bằng `py -3.14 -m venv .venv`.
4. Nâng pip, cài 13 package chính xác từ `backend_ml/model/requirements-lock.txt` bằng `--only-binary=:all:`, sau đó chạy `pip check`.
5. `qa/w07_environment_check.py` là gate bắt buộc: so CPython 3.14/Windows x64, tất cả 13 package pin, dependency graph, import thư viện, PyArrow Parquet round-trip, model SHA-256, `joblib.load` không có `InconsistentVersionWarning`, và đúng schema 169 features. Gate có 10 checks cơ bản (11 checks khi truyền snapshot) và fail-closed: không unpickle model nếu bất kỳ điều kiện runtime/package/pip/hash nào chưa đạt; không cho snapshot PASS nếu chưa kiểm tra được Parquet header.
6. Gate được gọi từ `setup_windows.bat`, `run_w07_qa.bat`, `run_with_ml.bat`, `run_api_tests.bat`, `run_tests.bat` (trước API regression) và `03_H19_E2E_FREEZE.cmd`.
7. Khi có mismatch, launcher dừng, không khởi động ML API và không đánh dấu PASS.

Không đổi `requirements-lock.txt`, `metadata.json`, `pipeline.joblib`, policy hay H16 evidence để làm biến mất warning.

## 3. Khả năng tương thích Python 3.14 Windows x64

Các trang phát hành chính thức trên PyPI có wheel cho CPython 3.14 Windows x64 đối với scikit-learn 1.9.1, pandas 3.1.0, PyArrow 26.0.0, NumPy 2.5.4 và SciPy 1.18.1; LightGBM 4.7.0 có wheel `py3-none-win_amd64`. Nguồn: trang PyPI từng package và tài liệu cài đặt Apache Arrow. Package pin không bị thay đổi.

- scikit-learn 1.9.1 Windows x64 / CPython 3.14: https://pypi.org/project/scikit-learn/1.9.1/
- pandas 3.1.0 Windows x64 / CPython 3.14: https://pypi.org/project/pandas/3.1.0/
- PyArrow 26.0.0 Windows x64 / CPython 3.14: https://pypi.org/project/pyarrow/26.0.0/
- NumPy 2.5.4 Windows x64 / CPython 3.14: https://pypi.org/project/numpy/2.5.4/
- SciPy 1.18.1 Windows x64 / CPython 3.14: https://pypi.org/project/scipy/1.18.1/
- LightGBM 4.7.0 Windows x64: https://pypi.org/project/lightgbm/4.7.0/

Nếu PyArrow/LightGBM import báo thiếu DLL trên Windows, cài Microsoft Visual C++ Redistributable x64 mới nhất tại https://aka.ms/vc14/vc_redist.x64.exe rồi chạy lại preflight. Tài liệu Microsoft khuyến nghị gói Redistributable cùng kiến trúc với ứng dụng; tài liệu LightGBM cũng ghi nhận Windows cần VC runtime nếu máy chưa có Visual Studio.

## 4. Những kiểm tra tại môi trường đóng gói

- Node.js regression: **98/98 PASS** sau khi thêm test chặn lỗi CMD parser.
- W07 static/release source audit: **25/25 PASS**.
- Runtime preflight được source-kiểm tra; 10 checks cơ bản và 11 checks khi thêm snapshot. Build container hiện tại chủ ý FAIL gate vì không phải Windows/Python 3.14; không phát sinh model-unpickle warning vì gate dừng trước bước đó.
- Browser DOM/layout: **39/39 PASS**, VI/EN nav: **4/4 PASS** (storage giả lập, không gọi live API).
- Frozen H16 files: **36/36 SHA-256 MATCH**.
- Python API suite đã chạy 18/18 PASS trước khi bổ sung strict gate, nhưng ở Python 3.13.5 sai package versions và có warning. Log cũ được lưu thành `evidence/w07/api_tests_dev_container_20261107.txt`, không được xem là release-runtime evidence.

**Giới hạn cần nói rõ:** Build container hiện tại chỉ có Python 3.13.5 và không có package-index network; do đó không thể cài Python 3.14 hay dựng đúng runtime lock ở đây. Mình đã sửa installer và thêm gate nghiêm ngặt, nhưng không giả mạo kết quả rằng runtime gate đã PASS. Hệ thống vẫn là release candidate cho tới khi chạy gate trên Windows `.venv`.

## 5. Hướng dẫn Windows – xử lý cảnh báo

### Bước 1 – Kiểm tra Python 3.14

Mở PowerShell trong thư mục `app`:

```powershell
py -0p
py -3.14 --version
```

Yêu cầu CPython 3.14 64-bit. Tại ngày 07/11/2026, Python.org liệt kê Python 3.14.10 là bản 3.14 stable mới nhất; có thể tải Windows installer (64-bit) tại https://www.python.org/downloads/windows/. Chỉ dùng nhánh 3.14.x (không dùng 3.15.x), sau đó mở terminal mới và chạy lại `py -3.14 --version`.

### Bước 2 – Rebuild môi trường an toàn

```powershell
.\setup_windows.bat
```

Nếu `.venv` cũ dùng Python khác, script sẽ giữ lại dưới `.venv_backup*` và tạo `.venv` mới. Nó cài phiên bản đúng từ lock, chạy `pip check` và runtime preflight.

### Bước 3 – Xác nhận runtime gate độc lập

```powershell
.\.venv\Scripts\python.exe qa\w07_environment_check.py
```

Kỳ vọng tất cả check PASS, bao gồm:
- CPython 3.14.x, Windows x64 (`sys.platform == win32`).
- 13/13 package lock khớp chính xác.
- `pip check` không conflict.
- Import PyArrow/NumPy/pandas/LightGBM/scikit-learn/joblib.
- PyArrow in-memory Parquet round-trip PASS.
- SHA-256 pipeline đúng metadata.
- `joblib.load` không phát `InconsistentVersionWarning`.
- Schema pipeline đúng 169 features.

### Bước 4 – Chạy W07

```powershell
.\run_w07_qa.bat
```

Kỳ vọng Node 98/98, API 18/18, W07 static audit 25/25. `evidence/w07/environment_check_results.txt`, `node_tests.txt`, `api_tests.txt` được cập nhật trên máy bạn.

Có thể truyền snapshot để kiểm tra luôn Parquet hash/header:

```powershell
.\run_w07_qa.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```

### Bước 5 – Khởi động API

```powershell
.\run_with_ml.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```

Launcher chạy strict runtime gate và kiểm tra snapshot hash/header trước khi mở API. Chỉ khi gate PASS mới khởi động server. Sau đó xác nhận `ML: READY`, `/api/ml/health` và các luồng W02/W03/W05/W06 như W07 QA matrix.

## 6. File thay đổi so với W07 source trước đó

### Added – 3 files

| Đường dẫn | Mục đích |
|---|---|
| `app/qa/w07_environment_check.py` | Strict runtime preflight cho CPython 3.14/Windows x64, lock packages, pip graph, PyArrow, model unpickle có guard và optional snapshot |
| `app/evidence/w07/api_tests_dev_container_20261107.txt` | Archive log API 18/18 từ Python 3.13.5 sai lock; gắn nhãn diagnostic-only, không phải release evidence |
| `app/evidence/w07/runtime_gate_build_container_diagnostic_20261107.txt` | Bằng chứng gate chặn môi trường build Linux/Python 3.13.5 trước khi unpickle model |

### Modified – 17 files (13 source/config/docs + 4 evidence)

| Đường dẫn | Nội dung |
|---|---|
| `app/setup_windows.bat` | Bắt buộc CPython 3.14 x64; backup `.venv` sai phiên bản; install binary wheels; pip check + gate |
| `app/run_with_ml.bat` | Gate trước khi server nạp model; kiểm tra snapshot nếu truyền tham số |
| `app/run_w07_qa.bat` | Gate là bước 0; capture API/Node evidence mới |
| `app/run_api_tests.bat` | Không chạy bằng system Python; gate trước API tests |
| `app/run_tests.bat` | Gate trước Python API regression |
| `app/03_H19_E2E_FREEZE.cmd` | Gate trước H19 freeze verification |
| `app/qa/w07_overall_qa.py` | Static audit xác nhận gate wiring; không cảnh báo sai theo sandbox package set |
| `app/tests/finrisk-w07-overall-qa.test.js` | Thêm regression cho Python 3.14/runtime gate/launcher wiring |
| `app/.gitignore` | Bỏ qua `.venv_backup*/` |
| `app/CHANGELOG.md` | Ghi nhận xử lý dependency alignment |
| `app/qa/W07_OVERALL_QA_MATRIX.md` | Cập nhật root cause, gate và acceptance criteria |
| `app/FINRISK_W07_HANDOFF_20261107.md` | Cập nhật quy trình xử lý runtime, kết quả và danh sách file commit |
| `WINDOWS_RUN.md` | Sửa hướng dẫn Python 3.14.x Windows x64 và link Python.org |
| `app/evidence/w07/api_tests.txt` | Thay log cũ bằng placeholder chờ Windows runtime PASS; runner sẽ ghi đè |
| `app/evidence/w07/node_tests.txt` | Cập nhật kết quả Node 98/98 |
| `app/evidence/w07/overall_qa_results.json` | Cập nhật static audit 25/25 và runtime gate wiring |
| `app/evidence/w07/overall_qa_results.txt` | Cập nhật bản text của static audit 25/25 |

### Deleted – 0 files

Không xóa source, model, snapshot hay H16 evidence. Log API cũ được giữ nguyên nội dung trong file archive diagnostic; đường dẫn cũ `api_tests.txt` hiện là placeholder có chủ đích.

## 7. GitHub Desktop

**Summary**

```text
Khắc phục Python runtime và dependency gate cho W07
```

**Description**

```text
- Đồng bộ setup_windows.bat với CPython 3.14 theo model metadata.
- Bảo toàn .venv cũ sai phiên bản bằng .venv_backup*.
- Cài đúng 13 package từ requirements-lock bằng binary wheels.
- Thêm strict environment preflight: pip check, PyArrow Parquet, joblib load không warning, schema 169 features.
- Chặn ML/API launch và W07 tests khi runtime không tương thích.
- Cập nhật Windows run guide và W07 QA matrix.
- Không thay đổi model H16, pipeline, 169 predictors, threshold, calibration, policy hay H16 evidence.
- Node.js 98/98; static audit 25/25; browser layout 39/39; H16 hashes 36/36.
- Runtime/API release evidence cần tạo lại trên Windows bằng Python 3.14.
```

**Git add** từ repository root:

```bash
git add WINDOWS_RUN.md app/setup_windows.bat app/run_with_ml.bat app/run_w07_qa.bat app/run_api_tests.bat app/run_tests.bat app/03_H19_E2E_FREEZE.cmd app/qa/w07_environment_check.py app/qa/w07_overall_qa.py app/qa/W07_OVERALL_QA_MATRIX.md app/tests/finrisk-w07-overall-qa.test.js app/.gitignore app/CHANGELOG.md app/FINRISK_W07_HANDOFF_20261107.md app/evidence/w07
```

## 8. Release decision

This package fixes the installer/launcher mismatch and adds a fail-closed runtime gate. It is **not marked Final Release PASS yet** because the strict gate cannot be executed in the current Python 3.13.5 build container. Upgrade the target Windows environment with `setup_windows.bat`; release is accepted only after the new `environment_check_results.txt` shows all checks PASS and the live API starts with `ML: READY` without `InconsistentVersionWarning`.


## 9. File thay đổi trong hotfix CMD parser so với gói W07 Runtime Fix trước đó

**Modified – 8 files; Added – 0; Deleted – 0**

| Đường dẫn | Thay đổi |
|---|---|
| `app/setup_windows.bat` | Bỏ ngoặc trong thông điệp lỗi nằm trong khối IF để CMD không cắt khối lệnh sai. |
| `app/tests/finrisk-w07-overall-qa.test.js` | Thêm regression test cho thông điệp lỗi launcher. |
| `app/qa/w07_overall_qa.py` | Static audit xác nhận thông điệp đã an toàn, không hồi quy. |
| `app/CHANGELOG.md` | Ghi nhận nguyên nhân và cách sửa. |
| `app/FINRISK_W07_HANDOFF_20261107.md` | Bổ sung chẩn đoán, giới hạn kiểm chứng và hướng dẫn. |
| `app/qa/W07_OVERALL_QA_MATRIX.md` | Ghi nhận regression CMD parser và cập nhật số test Node. |
| `app/evidence/w07/node_tests.txt` | Lưu log regression 98/98. |
| `app/evidence/w07/overall_qa_results.json` | Cập nhật kết quả static audit từ source đã sửa. |

Không có file bị xóa; không thay đổi `requirements-lock.txt`, model H16, metadata, snapshot hoặc pipeline.

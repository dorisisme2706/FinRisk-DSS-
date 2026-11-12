# M08.5.3.1 — Hướng dẫn kiểm thử PostgreSQL trên test cluster riêng

**Mục tiêu:** chạy thật migrations `0001` → `0002` → `0003` và kiểm tra RLS, grants, trigger, các outcome mô phỏng và các guard nghiệp vụ trên PostgreSQL 17 riêng biệt.

**An toàn:** không dùng PostgreSQL service hiện tại ở cổng `5432`, không kết nối `finrisk_app_db` đang dùng, không đọc `.env`, không cần nhập mật khẩu database production. Script tạo một cluster PostgreSQL riêng trong thư mục `%LOCALAPPDATA%\FinRisk\M08_5_3_1_Test_Data`, bind chỉ vào `127.0.0.1:55432`, rồi dừng cluster test khi hoàn thành. Data directory test được giữ nguyên để xem lại; script không tự xóa thư mục nào.

## 1. Vì sao cần test cluster, không chỉ một database mới?

Migration `0002_runtime_grants.sql` có câu lệnh `REVOKE/GRANT CONNECT ON DATABASE finrisk_app_db`. Tên database được ghi cố định. Nếu chạy migration `0002` trong một database thử nghiệm khác nhưng vẫn cùng PostgreSQL cluster, câu lệnh có thể thay đổi ACL của database `finrisk_app_db` trên cluster đó. Vì vậy, test cluster riêng là ranh giới cách ly an toàn hơn: cluster test có database tên `finrisk_app_db` riêng, không dùng chung system catalogs hoặc ACL với cluster đang chạy.

## 2. Giải nén đúng vị trí

Giải nén gói test vào thư mục:

```text
FINRISK-DSS--main--final\app
```

Sau khi giải nén, cần có:

```text
app\database\migrations\0001_initial_schema.sql
app\database\migrations\0002_runtime_grants.sql
app\database\migrations\0003_business_rule_registry.sql
app\qa\M08_5_3_1_TEST_ROLE_BOOTSTRAP.sql
app\qa\run_m08_5_3_1_isolated_test.ps1
app\qa\M08_5_3_1_TEST_ASSERTIONS.sql
```

Không ghi đè hoặc sửa migrations `0001` và `0002`. Chỉ thêm `0003` và các tệp QA mới.

## 3. Xác nhận PostgreSQL binaries

Bộ script mặc định dùng đường dẫn PostgreSQL đã cài trên máy:

```text
C:\PostgreSQL\pgsql\bin
```

Thư mục cần có `initdb.exe`, `pg_ctl.exe`, `psql.exe`. Nếu PostgreSQL nằm ở nơi khác, truyền `-PgBin` khi chạy script. Script ưu tiên `app\.venv\Scripts\python.exe`; nếu chưa có, nó thử Python Launcher `py -3` nếu môi trường đó đã cài `psycopg`. Có thể chỉ định Python khác bằng `-PythonExe "D:\path\python.exe"`.

## 4. Chạy kiểm thử

Mở PowerShell tại thư mục `app`, không cần dừng service PostgreSQL đang dùng và không cần chạy PowerShell bằng Administrator vì test data mặc định nằm trong thư mục `%LOCALAPPDATA%` của tài khoản Windows.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\qa\run_m08_5_3_1_isolated_test.ps1
```

Nếu thư mục binary khác:

```powershell
.\qa\run_m08_5_3_1_isolated_test.ps1 -PgBin "D:\PostgreSQL\17\bin"
```

Trong lần chạy đầu tiên:

1. `initdb` yêu cầu tạo mật khẩu cho tài khoản `postgres` **của test cluster**. Hãy dùng mật khẩu riêng, không dùng mật khẩu production.
2. Script hỏi lại mật khẩu test cluster bằng input ẩn để chạy `psql`, kiểm tra server đang nghe đúng `127.0.0.1:55432`, và khôi phục các biến môi trường `PGPASSWORD`/`FINRISK_MIGRATION_DATABASE_URL` nếu trước đó đã tồn tại. Không ghi mật khẩu vào lệnh, file, Git hoặc `.env`.
3. Script dùng bản role-bootstrap riêng nằm trong `qa\M08_5_3_1_TEST_ROLE_BOOTSTRAP.sql`, tạo năm PostgreSQL group roles và database `finrisk_app_db` bên trong test cluster. File proposal gốc trong `database\proposals` không bị ghi đè.
4. Script tạm đặt `FINRISK_MIGRATION_DATABASE_URL` trong process thành DSN ở `127.0.0.1:55432`, rồi gọi chính `backend_api\migrate.py` của FinRisk. DSN này không được ghi vào `.env`; biến môi trường tạm sẽ bị xóa khi kết thúc.
5. Migration runner áp dụng 0001, 0002, 0003 theo đúng thứ tự, mỗi migration trong transaction riêng, kèm advisory lock và SHA-256 checksum. Lệnh `--status` được chạy tiếp theo để đối chiếu checksum.
6. Script chạy SQL assertions trên dữ liệu tổng hợp, sau đó dừng test cluster nếu chính script đã khởi động nó.

## 5. Các kiểm tra thực thi

Tệp `M08_5_3_1_TEST_ASSERTIONS.sql` kiểm tra:

- Tạo được Registry mở rộng và hai bảng test cases/test runs.
- Test-run trigger tự sao chép rule version, input snapshot và expected snapshot từ test case; các baseline giả do caller gửi bị ghi đè.
- Bốn outcome `MATCH`, `MISMATCH`, `ERROR`, `NOT_EVALUATED` được suy ra đúng bằng so sánh JSONB; không có mã quy tắc nào được chạy.
- `approved_at` khác NULL bị từ chối; `is_executable=true` bị từ chối.
- JSON snapshot có khóa nhạy cảm như `email` bị từ chối.
- `finrisk_app` có SELECT/INSERT nhưng không có UPDATE/DELETE/TRUNCATE. Do `current_actor_id()` vẫn NULL, INSERT trên cả ba bảng phải bị RLS chặn, kể cả khi có một fixture `RULE_MANAGER`.
- `finrisk_auditor` đọc được cả ba bảng nhưng không có quyền ghi.
- `finrisk_readonly` không được mở quyền đọc test payload hoặc simulation history.
- RLS được bật và FORCE trên cả ba bảng.

Việc kiểm tra runtime role sử dụng `SET ROLE finrisk_app` và `SET ROLE finrisk_auditor` từ superuser **bên trong test cluster**. Đây là kiểm tra chính sách/privilege của database role; nó không thay thế kiểm thử đăng nhập thực tế hoặc trusted authentication.

## 6. Kết quả mong đợi

PowerShell cuối cùng cần hiển thị:

```text
APPLY 0001_initial_schema (committed)
APPLY 0002_runtime_grants (committed)
APPLY 0003_business_rule_registry (committed)
...
APPLIED 0001_initial_schema
APPLIED 0002_runtime_grants
APPLIED 0003_business_rule_registry
...
M08.5.3.1 ISOLATED POSTGRESQL TEST: PASS
Production cluster/service on port 5432: NOT USED
Production database finrisk_app_db: NOT CONNECTED
```

Nếu chạy lại trên cùng test cluster đã có migrations với đúng checksum, dòng `APPLY` có thể là `SKIP ... (checksum verified)` thay vì `APPLY ... (committed)`. Phần `--status` vẫn phải hiển thị đủ ba phiên bản `APPLIED`.

Các dòng `PASS | ...` trong SQL assertions là bằng chứng cho từng trigger, RLS, ACL và governance guard. Nếu cluster test đã chạy trước đó, migrations có checksum đúng sẽ hiển thị `SKIP ... (checksum verified)`.

## 7. Nếu có lỗi

- Không chạy lại migration 0003 bằng tay trên database đang dùng.
- Gửi toàn bộ output PowerShell bắt đầu từ dòng `APPLY`/`MIGRATION` bị lỗi; không gửi mật khẩu hoặc `.env`.
- Log của test cluster (nếu có lỗi khởi động) nằm tại `%LOCALAPPDATA%\FinRisk\M08_5_3_1_Test_PostgreSQL.log`.
- Nếu cần sửa migration sau khi nó đã được apply thành công lên test cluster, không sửa migration đã ghi checksum trong test DB rồi chạy lại. Hãy dùng một test data directory/port mới hoặc chuẩn bị lại test cluster theo hướng dẫn được cung cấp riêng.

## 8. Ranh giới sau kiểm thử

Một lần test cluster PASS chỉ xác nhận migration chạy được trên môi trường PostgreSQL 17 test và các assertions trên test fixtures. Nó **không** có nghĩa migration đã được áp dụng vào database production, trusted authentication đã có, hay write API đã được mở. Chỉ xem xét migration trên database đang dùng sau khi test cluster PASS, kiểm tra lại registry production vẫn rỗng, xác minh checksum 0001/0002 và xác nhận backup/restore.

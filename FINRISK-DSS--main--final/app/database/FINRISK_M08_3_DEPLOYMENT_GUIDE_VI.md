# FINRisk DSS — Hướng dẫn triển khai M08.3 trên máy Windows mới

**Phiên bản tài liệu:** 1.0  
**Ngày lập:** 09/11/2026  
**Phạm vi:** PostgreSQL Foundation của M08.3  
**Môi trường tham chiếu đã kiểm chứng:** Windows, PostgreSQL 17.11, CPython 3.14.7 64-bit, `psycopg[binary]==3.3.6`.

> Tài liệu này hướng dẫn cài đặt một môi trường M08.3 mới trên một máy Windows. Tài liệu không thay thế hướng dẫn chạy FinRisk/H16 tổng thể, không triển khai trusted authentication, không mở CRUD API và không phải quy trình backup/restore dữ liệu.

---

## 1. Kiến trúc và nguyên tắc triển khai

M08.3 bổ sung tầng PostgreSQL cho FinRisk DSS:

- PostgreSQL chạy cục bộ trên cùng máy với FinRisk API trong phiên bản hiện tại.
- Database: `finrisk_app_db`.
- Schema: `finrisk_app`.
- Database engine được migration runner chấp nhận: PostgreSQL major version **16, 17 hoặc 18**.
- Runtime/API và migration sử dụng **hai tài khoản đăng nhập riêng biệt**.
- Chỉ cho phép database host loopback: `127.0.0.1`, `localhost` hoặc `::1`.
- Migration được quản lý bằng file SQL có version và SHA-256 checksum; chỉ chạy bằng `backend_api/migrate.py`.
- H16/CORE4 là thành phần riêng, không được đưa model artifact, Parquet hoặc dữ liệu snapshot vào PostgreSQL/Git.

### 1.1. Thành phần được lấy từ GitHub và thành phần phải thiết lập riêng

| Thành phần | Có trong source GitHub? | Xử lý trên máy mới |
|---|---:|---|
| Source code FinRisk | Có | Clone đúng repository, branch và commit đã bàn giao |
| Migrations `0001`, `0002` | Có | Áp dụng lên database mới một lần |
| Role bootstrap SQL | Có | DBA chạy một lần trên cluster PostgreSQL mới |
| Python `.venv` | Không | Tạo lại trên máy mới |
| `app/.env` | Không | Tạo riêng, nhập credential của máy mới |
| PostgreSQL service/database/roles | Không | Cài và tạo riêng trên máy mới |
| Dữ liệu nghiệp vụ của database cũ | Không | Chỉ chuyển bằng quy trình backup/restore đã được phê duyệt |
| CORE4 Snapshot | Không mặc định | Cung cấp riêng qua kênh được phê duyệt, lưu ngoài repository |

**Lưu ý:** Clone source từ GitHub không tự chuyển database, tài khoản PostgreSQL, mật khẩu, `.env`, `.venv` hoặc dữ liệu khách hàng từ máy cũ sang máy mới.

---

## 2. Điều kiện trước khi cài đặt

Trên máy mới, cần có:

1. Windows 10/11 64-bit.
2. Quyền Administrator để cài/register PostgreSQL Windows Service và cấp quyền thư mục dữ liệu.
3. CPython 3.14 64-bit và Python Launcher `py.exe`.
4. GitHub Desktop để clone repository và quản lý commit theo quy trình của dự án.
5. Kết nối Internet trong giai đoạn cài Python packages.
6. Source FinRisk DSS đúng branch/commit được bàn giao.

M08.3 yêu cầu PostgreSQL 16–18. Môi trường tham chiếu đã chạy thành công trên PostgreSQL 17.11 và CPython 3.14.7 64-bit.

### 2.1. Lấy source bằng GitHub Desktop

1. Mở GitHub Desktop.
2. Chọn **File → Clone Repository**.
3. Chọn repository FinRisk DSS đã được bàn giao.
4. Chọn branch/commit có M08.3 đã được review và commit.
5. Chọn thư mục local để lưu source.
6. Sau khi clone xong, dùng **Repository → Show in Explorer** để mở đúng thư mục repository.
7. Xác định thư mục `app/` trong repository.

Không clone một ZIP snapshot chưa được xác nhận là bản bàn giao cuối cùng nếu repository/branch chính thức đã có commit M08.3 mới hơn.

---

## 3. Cài PostgreSQL trên Windows

Có thể dùng PostgreSQL Windows installer hoặc binary ZIP chính thức. Dù chọn cách nào, PostgreSQL phải chạy local và migration runner phải kết nối được tới `127.0.0.1:5432` (hoặc host/port đã cấu hình phù hợp).

### 3.1. Cách thông thường — Windows installer

1. Cài PostgreSQL Server phiên bản 16, 17 hoặc 18 từ nguồn phân phối PostgreSQL đáng tin cậy.
2. Đặt mật khẩu mạnh cho tài khoản quản trị database `postgres` và lưu trong password manager.
3. Giữ service hoạt động sau khi cài đặt.
4. Không mở PostgreSQL ra Internet; phiên bản này chỉ dùng loopback.
5. Ghi lại đường dẫn `bin` của PostgreSQL, ví dụ `C:\Program Files\PostgreSQL\17\bin`.

Tên Windows Service có thể khác tùy phiên bản và cách cài. Kiểm tra bằng:

```powershell
Get-Service *postgres*
```

### 3.2. Phương án binary ZIP

Dùng phương án này nếu installer không phù hợp với máy. Chỉ tải binary ZIP Windows từ nguồn phân phối đáng tin cậy và chọn PostgreSQL 16–18.

Ví dụ bố trí thư mục chuẩn:

```text
C:\PostgreSQL\pgsql\bin\postgres.exe
C:\PostgreSQL\pgsql\bin\initdb.exe
C:\PostgreSQL\pgsql\bin\pg_ctl.exe
C:\PostgreSQL\pgsql\bin\psql.exe
C:\PostgreSQL\data\
```

Giải nén binary ZIP vào `C:\PostgreSQL\pgsql` sao cho các file thực thi nằm trong `C:\PostgreSQL\pgsql\bin`.

Mở **PowerShell bằng Run as administrator**. Các lệnh dưới đây dùng service name mẫu cho PostgreSQL 17; nếu cài phiên bản khác, đổi tên service cho nhất quán.

```powershell
New-Item -ItemType Directory -Force "C:\PostgreSQL\data" | Out-Null

icacls "C:\PostgreSQL\data" /grant "NT AUTHORITY\NETWORK SERVICE:(OI)(CI)F" /T

& "C:\PostgreSQL\pgsql\bin\initdb.exe" -D "C:\PostgreSQL\data" -U postgres -W -E UTF8
```

`initdb` chỉ được chạy một lần cho data directory mới. Lệnh sẽ yêu cầu tạo mật khẩu database superuser `postgres`; không gửi mật khẩu qua chat hoặc lưu trong source code.

Đăng ký Windows Service chạy dưới `NETWORK SERVICE`:

```powershell
& "C:\PostgreSQL\pgsql\bin\pg_ctl.exe" register -N "postgresql-x64-17" -D "C:\PostgreSQL\data" -U "NT AUTHORITY\NetworkService" -S auto
Start-Service -Name "postgresql-x64-17"
```

Xác minh:

```powershell
Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-17'" |
    Select-Object Name, State, StartMode, StartName

& "C:\PostgreSQL\pgsql\bin\psql.exe" -W -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "SELECT current_database(), current_user, version();"
```

Yêu cầu: service `Running`, chế độ khởi động `Auto` và `psql` kết nối thành công. Nếu dùng installer, thay đường dẫn và service name theo cấu hình thực tế.

> Không chạy `initdb` lại trên data directory đã được khởi tạo. Không xóa hoặc ghi đè `C:\PostgreSQL\data` để xử lý lỗi kết nối.

---

## 4. Provision database roles và database

Các bước trong mục này chỉ thực hiện một lần cho một PostgreSQL cluster/database mới, bằng tài khoản DBA `postgres`.

### 4.1. Đặt biến đường dẫn `psql`

Với binary ZIP:

```powershell
$psql = "C:\PostgreSQL\pgsql\bin\psql.exe"
```

Với installer, thay bằng đường dẫn `psql.exe` thực tế.

### 4.2. Tạo 5 nhóm quyền nền tảng

File bootstrap được dự án chỉ định:

```text
app/database/proposals/002_create_roles_draft.sql
```

Tên thư mục là `proposals`, nhưng file `002_create_roles_draft.sql` là bước cluster-role bootstrap được hướng dẫn triển khai trong tài liệu M08.3. Chỉ chạy file bootstrap nhóm quyền này; không tự chạy các proposal schema/grant khác.

Từ PowerShell, đặt `$app` thành đường dẫn thư mục `app` trong source clone, sau đó chạy:

```powershell
$app = "D:\<DUONG_DAN_REPOSITORY>\app"
$sqlFile = Join-Path $app "database\proposals\002_create_roles_draft.sql"

& $psql -W -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -p 5432 -d postgres -f $sqlFile
```

File này tạo các group role `NOLOGIN`:

- `finrisk_owner`
- `finrisk_migrator`
- `finrisk_app`
- `finrisk_auditor`
- `finrisk_readonly`

Nó cũng cấp membership `finrisk_owner` cho `finrisk_migrator` để migration runner có thể `SET LOCAL ROLE finrisk_owner`.

### 4.3. Tạo database

Mở kết nối DBA vào maintenance database `postgres`:

```powershell
& $psql -W -U postgres -h 127.0.0.1 -p 5432 -d postgres
```

Tại dấu nhắc `postgres=#`, chạy:

```sql
CREATE DATABASE finrisk_app_db
    OWNER finrisk_owner
    ENCODING 'UTF8'
    TEMPLATE template0;
```

Kết quả mong đợi: `CREATE DATABASE`.

Không chạy lại câu lệnh này nếu database đã tồn tại. Trước khi triển khai lại, kiểm tra database và owner để tránh tạo trùng hoặc ảnh hưởng database đang có dữ liệu.

### 4.4. Tạo hai login role riêng

Trong phiên `psql` đang đăng nhập bằng `postgres`, chạy:

```sql
CREATE ROLE finrisk_migrator_login LOGIN IN ROLE finrisk_migrator;
CREATE ROLE finrisk_api_login LOGIN IN ROLE finrisk_app;
```

Đặt password riêng và khác nhau bằng lệnh tương tác:

```text
\password finrisk_migrator_login
\password finrisk_api_login
```

Nhập password khi `psql` yêu cầu. Không viết password vào câu lệnh `CREATE ROLE`, file SQL, Git hoặc chat. Sau đó thoát:

```text
\q
```

Các lệnh `CREATE ROLE` cho login chỉ chạy một lần. Nếu role đã tồn tại, không chạy lại; kiểm tra membership và reset password theo quy trình DBA nếu cần.

### 4.5. Xác minh role, database và đăng nhập

Kiểm tra group/login role bằng DBA:

```powershell
& $psql -W -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname LIKE 'finrisk_%'
ORDER BY rolname;

SELECT datname, pg_get_userbyid(datdba) AS owner
FROM pg_database
WHERE datname = 'finrisk_app_db';
"
```

Kiểm tra từng login role (nhập password tương ứng khi được hỏi):

```powershell
& $psql -W -U finrisk_migrator_login -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "SELECT current_user, current_database();"
& $psql -W -U finrisk_api_login -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "SELECT current_user, current_database();"
```

Mong đợi:

- Database owner là `finrisk_owner`, encoding `UTF8`.
- Năm group role là `NOLOGIN`, không có `SUPERUSER`, `CREATEDB`, `CREATEROLE` hoặc `BYPASSRLS`.
- `finrisk_migrator_login` thuộc nhóm `finrisk_migrator`.
- `finrisk_api_login` thuộc nhóm `finrisk_app`.
- Cả hai login role kết nối được tới `finrisk_app_db`.

---

## 5. Tạo Python environment cho FinRisk

### 5.1. Kiểm tra Python

Mở PowerShell tại thư mục `app`:

```powershell
py -3.14 --version
py -0p
```

H16 runtime lock của source yêu cầu **CPython 3.14 64-bit**. Không dùng Python 3.12 hoặc Python 32-bit cho môi trường H16 của release này.

### 5.2. Tạo môi trường và cài H16 lock

Khuyến nghị dùng script setup đã có trong source:

```powershell
Set-Location "D:\<DUONG_DAN_REPOSITORY>\app"
.\setup_windows.bat
```

Script sẽ tạo/kiểm tra `.venv`, cài đúng `backend_ml\model\requirements-lock.txt`, chạy `pip check` và strict H16 runtime compatibility gate. Chỉ tiếp tục khi script kết thúc với `[PASS]`.

Nếu không dùng script, quy trình tương đương về phần môi trường Python là:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r backend_ml\model\requirements-lock.txt
```

Không nâng cấp tùy ý các gói trong H16 lock.

### 5.3. Cài PostgreSQL driver riêng

M08.3 giữ driver PostgreSQL tách khỏi H16 model lock:

```powershell
.\.venv\Scripts\python.exe -m pip install -r database\requirements-postgres.txt
.\.venv\Scripts\python.exe -m pip check
```

Phiên bản dự án ghim `psycopg[binary]==3.3.6`. Kết quả `pip check` mong đợi:

```text
No broken requirements found.
```

---

## 6. Tạo cấu hình `app/.env`

### 6.1. Tạo file từ mẫu

Tại thư mục `app`:

```powershell
Copy-Item database\.env.example .env
```

Mở `app/.env` bằng editor trên máy và thay placeholder `CHANGE_ME` trong hai URL bằng password tương ứng:

```ini
FINRISK_DATABASE_URL=postgresql://finrisk_api_login:<URL_ENCODED_PASSWORD>@127.0.0.1:5432/finrisk_app_db?sslmode=prefer
FINRISK_MIGRATION_DATABASE_URL=postgresql://finrisk_migrator_login:<URL_ENCODED_PASSWORD>@127.0.0.1:5432/finrisk_app_db?sslmode=prefer
FINRISK_DB_SCHEMA=finrisk_app
FINRISK_DB_CONNECT_TIMEOUT=5
FINRISK_DB_APP_NAME=finrisk-dss-local
FINRISK_PII_KEY_REFERENCE=SET_IN_WINDOWS_SECRET_STORE
```

Hai password phải thuộc đúng login role và phải là hai password riêng biệt.

### 6.2. Lưu ý URL encoding và bảo vệ secret

- Password trong URL phải được percent-encode nếu có ký tự dành riêng như `@`, `:`, `/`, `#`, `%`, `?` hoặc ký tự không an toàn khác.
- Không thêm dấu ngoặc nhọn `< >` vào giá trị thực tế.
- Không gửi file `.env`, password hoặc DSN đầy đủ qua chat/email không bảo mật.
- Không commit `app/.env`. `.gitignore` của dự án có quy tắc bỏ qua `.env` và `.env.*`, đồng thời cho phép `.env.example`.
- Không đưa khóa mã hóa PII thực tế vào source code hoặc `.env`. `FINRISK_PII_KEY_REFERENCE` hiện chỉ là tham chiếu tới Windows Secret Store; cần hoàn thiện secret-management theo thiết kế được phê duyệt trước khi xử lý PII thật.
- Không dùng `finrisk_migrator_login` làm tài khoản runtime. Backend chỉ dùng `FINRISK_DATABASE_URL` của `finrisk_api_login`.

---

## 7. Kiểm tra kết nối và chạy migrations

Tất cả lệnh dưới đây chạy từ thư mục `app`.

### 7.1. Kiểm tra hai connection URL

Dùng Python/psycopg để kiểm tra từng DSN sau khi load `.env`. Không in DSN hay password ra console. Có thể dùng script kiểm tra nội bộ được bàn giao kèm bằng chứng M08.3 hoặc kiểm tra đăng nhập riêng bằng `psql`.

Kết quả yêu cầu:

- Migration DSN đăng nhập bằng `finrisk_migrator_login` vào `finrisk_app_db`.
- Runtime DSN đăng nhập bằng `finrisk_api_login` vào `finrisk_app_db`.

### 7.2. Kiểm tra trạng thái trước khi áp dụng

```powershell
.\.venv\Scripts\python.exe backend_api\migrate.py --status
```

Trên database mới, trạng thái ban đầu mong đợi:

```text
PENDING 0001_initial_schema
PENDING 0002_runtime_grants
```

Nếu xuất hiện `CHECKSUM_MISMATCH`, dừng lại. Không sửa migration đã áp dụng, không xóa bảng lịch sử và không tự chạy file SQL thủ công.

### 7.3. Áp dụng migrations

Chỉ sau khi kiểm tra đúng database và hai migration đều `PENDING`, chạy:

```powershell
.\.venv\Scripts\python.exe backend_api\migrate.py
```

Kết quả mong đợi trên database mới:

```text
APPLY 0001_initial_schema (committed)
APPLY 0002_runtime_grants (committed)
```

Sau đó xác minh:

```powershell
.\.venv\Scripts\python.exe backend_api\migrate.py --status
```

Kết quả mong đợi:

```text
APPLIED 0001_initial_schema
APPLIED 0002_runtime_grants
```

**Chỉ `database/migrations/*.sql` là đầu vào migration được thực thi.** Không chạy trực tiếp `001_app_schema_draft.sql` hoặc `003_grants_draft.sql`. Không sửa nội dung migration sau khi đã apply vì runner so sánh SHA-256 checksum.

### 7.4. Xác minh cấu trúc sau migration

Bằng DBA, kiểm tra số bảng:

```powershell
$psql = "C:\PostgreSQL\pgsql\bin\psql.exe" # thay bằng đường dẫn thực tế nếu cài installer
& $psql -W -U postgres -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "
SELECT count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'finrisk_app' AND table_type = 'BASE TABLE';
"
```

Mốc tham chiếu M08.3: 12 bảng trong schema `finrisk_app`, trong đó 8 bảng bật `relrowsecurity=true` và `relforcerowsecurity=true`.

---

## 8. Kiểm thử sau triển khai

### 8.1. Chạy Source Audit và Python tests

Từ thư mục `app`:

```powershell
.\.venv\Scripts\python.exe qa\m08_3_persistence_audit.py
.\.venv\Scripts\python.exe -m unittest backend_api.test_database -v
.\.venv\Scripts\python.exe -m unittest backend_api.test_server -v
```

Mốc đã đạt trên môi trường tham chiếu:

- M08.3 Source Audit: 12/12 PASS.
- Database Unit Tests: 9/9 PASS.
- Server Tests: 19/19 PASS.
- `pip check`: `No broken requirements found.`

Các unit tests không thay thế kiểm thử database thật. Cần tiếp tục các bước 8.2–8.4.

### 8.2. Kiểm tra runtime database health trực tiếp

```powershell
.\.venv\Scripts\python.exe -c "from backend_api.db import load_local_env, database_health; load_local_env(); print(database_health())"
```

Kết quả mong đợi sau migrations:

```text
{'status': 'ready', 'code': 'DB_CONNECTED'}
```

### 8.3. Kiểm tra qua HTTP API

Khởi động server trong một PowerShell:

```powershell
.\.venv\Scripts\python.exe backend_api\server.py --host 127.0.0.1 --port 8080
```

Giữ cửa sổ này mở. Trong PowerShell thứ hai:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/db/health" -Method GET |
    ConvertTo-Json -Depth 5
```

Kết quả mong đợi:

```json
{
  "status": "ready",
  "code": "DB_CONNECTED",
  "integration_stage": "M08.3"
}
```

Khi hoàn tất kiểm thử server, nhấn `Ctrl+C` tại cửa sổ đang chạy backend. PostgreSQL Windows Service tiếp tục chạy.

### 8.4. Kiểm tra RLS và quyền runtime

Các kiểm tra tối thiểu được xác nhận trong môi trường tham chiếu:

- 12 bảng có trong `finrisk_app`.
- 8 bảng bật RLS và FORCE RLS.
- 11 RLS policies trên 8 bảng.
- Runtime API đọc được các giá trị `migration_version` `0001` và `0002`.
- Runtime API không có quyền SELECT toàn bảng `schema_migrations`, nhưng có quyền SELECT riêng cột `migration_version`.
- `audit_events`: API có SELECT/INSERT, không có UPDATE/DELETE/TRUNCATE.
- `current_actor_id()` hiện trả `NULL`.
- Thử set custom GUC `app.actor_id` không làm thay đổi actor được resolve.
- Truy vấn hồ sơ owner-scoped với actor NULL không trả hồ sơ người dùng.

Các truy vấn dưới đây có thể chạy để tái kiểm tra các kết quả trên. Thay `$psql` bằng đường dẫn `psql.exe` thực tế trên máy.

Kiểm tra 12 bảng, 8 bảng RLS/FORCE RLS và số policy:

```powershell
& $psql -W -U postgres -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "
SELECT count(*) AS table_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'finrisk_app' AND c.relkind = 'r';

SELECT count(*) AS rls_and_force_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'finrisk_app' AND c.relkind = 'r'
  AND c.relrowsecurity AND c.relforcerowsecurity;

SELECT count(*) AS policy_count, count(DISTINCT tablename) AS policy_table_count
FROM pg_policies WHERE schemaname = 'finrisk_app';
"
```

Kiểm tra grants quan trọng (dùng tài khoản DBA để xem catalog quyền):

```powershell
& $psql -W -U postgres -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "
SELECT
  has_table_privilege('finrisk_api_login', 'finrisk_app.audit_events', 'SELECT') AS audit_select,
  has_table_privilege('finrisk_api_login', 'finrisk_app.audit_events', 'INSERT') AS audit_insert,
  has_table_privilege('finrisk_api_login', 'finrisk_app.audit_events', 'UPDATE') AS audit_update,
  has_table_privilege('finrisk_api_login', 'finrisk_app.audit_events', 'DELETE') AS audit_delete,
  has_table_privilege('finrisk_api_login', 'finrisk_app.audit_events', 'TRUNCATE') AS audit_truncate,
  has_table_privilege('finrisk_api_login', 'finrisk_app.schema_migrations', 'SELECT') AS migration_table_select,
  has_column_privilege('finrisk_api_login', 'finrisk_app.schema_migrations', 'migration_version', 'SELECT') AS migration_version_select;
"
```

Giá trị mong đợi: `audit_select=true`, `audit_insert=true`, các quyền audit UPDATE/DELETE/TRUNCATE=false, `migration_table_select=false` và `migration_version_select=true`.

Kiểm tra migration history và actor fail-closed bằng tài khoản API:

```powershell
& $psql -W -U finrisk_api_login -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "
SELECT migration_version FROM finrisk_app.schema_migrations ORDER BY migration_version;
SELECT finrisk_app.current_actor_id() AS current_actor_id;
SELECT count(*) AS visible_loan_applications FROM finrisk_app.loan_applications;
"
```

Mong đợi có hai migration `0001`, `0002`; `current_actor_id` là NULL; số hồ sơ owner-scoped nhìn thấy là 0 khi chưa có trusted authentication.

Kiểm tra chống giả mạo custom GUC trong transaction chỉ đọc:

```powershell
& $psql -W -U finrisk_api_login -h 127.0.0.1 -p 5432 -d finrisk_app_db -c "
BEGIN;
SET LOCAL app.actor_id = '00000000-0000-0000-0000-000000000001';
SELECT current_setting('app.actor_id', true) AS supplied_actor_value,
       finrisk_app.current_actor_id() AS resolved_actor_id;
ROLLBACK;
"
```

Mong đợi giá trị `supplied_actor_value` có UUID thử nghiệm nhưng `resolved_actor_id` vẫn NULL. Transaction kết thúc bằng `ROLLBACK`. Không dùng UUID của người dùng thật trong thử nghiệm này.

Không tự tắt RLS, không cấp `BYPASSRLS`, không cấp superuser cho API.

---

## 9. Khởi động và dừng FinRisk

### 9.1. Khởi động PostgreSQL

Nếu PostgreSQL đã đăng ký Windows Service ở chế độ Automatic, service tự khởi động cùng Windows. Kiểm tra:

```powershell
Get-Service *postgres*
```

Nếu service đang dừng, dùng đúng service name thực tế, ví dụ:

```powershell
Start-Service -Name "postgresql-x64-17"
```

Không chạy `initdb` hoặc apply migrations lại khi chỉ khởi động lại máy.

### 9.2. Khởi động FinRisk API

Từ thư mục `app`:

```powershell
.\.venv\Scripts\python.exe backend_api\server.py --host 127.0.0.1 --port 8080
```

Mở trình duyệt:

```text
http://127.0.0.1:8080
```

Kiểm tra database:

```text
http://127.0.0.1:8080/api/db/health
```

### 9.3. CORE4 Snapshot là thành phần riêng

Snapshot CORE4 không nằm trong source ZIP. Nếu chưa cấu hình snapshot, backend có thể hiển thị:

```text
ML: UNAVAILABLE - SNAPSHOT_NOT_CONFIGURED
```

Điều này không đồng nghĩa PostgreSQL hỏng. Cần cung cấp snapshot riêng qua kênh được phê duyệt và cấu hình bằng `--snapshot <CORE4_ROOT>` hoặc biến môi trường `FINRISK_SNAPSHOT` theo hướng dẫn H16/H18. Không đưa snapshot, Parquet hoặc model artifact vào Git.

### 9.4. Tắt ứng dụng

- Dừng FinRisk API bằng `Ctrl+C` ở cửa sổ đang chạy server.
- PostgreSQL Windows Service có thể tiếp tục chạy nền.
- Có thể đóng PowerShell sau khi backend đã dừng.
- `.venv`, `.env`, PostgreSQL database, roles và migration history được lưu trên máy; không cần cài lại mỗi lần mở ứng dụng.

---

## 10. Khi triển khai trên máy mới, cập nhật source hoặc chuyển dữ liệu

### 10.1. Máy mới với database mới

Thực hiện đầy đủ các mục 2–9. Provision roles/database, tạo `.env` và apply migrations một lần.

### 10.2. Cập nhật source trên máy đã có database

1. Dùng GitHub Desktop checkout/pull đúng branch đã được review.
2. Không xóa database, không chạy `initdb`, không tạo lại roles/login.
3. Kiểm tra release notes và danh sách migration mới.
4. Chạy `migrate.py --status` trước.
5. Chỉ chạy migration nếu có migration mới được phát hành và trạng thái/checksum hợp lệ.
6. Không chỉnh sửa migration đã được apply.

### 10.3. Chuyển database có dữ liệu từ máy cũ

Backup/restore chưa được thực nghiệm và nghiệm thu trong phạm vi M08.3 hiện tại. Không chép trực tiếp data directory PostgreSQL khi service đang chạy và không coi copy repository là backup database.

Trước khi chuyển dữ liệu thật, cần có quy trình `pg_dump`/`pg_restore` hoặc phương án backup/restore được DBA phê duyệt; kiểm tra quyền sở hữu, role, secret, encryption key, RLS, row counts và tính toàn vẹn sau restore. Không dùng dữ liệu khách hàng thật trong thử nghiệm nếu chưa có phê duyệt và kiểm soát phù hợp.

---

## 11. Giới hạn bảo mật và chức năng hiện tại

M08.3 là PostgreSQL Foundation, không phải bản hoàn thiện CRUD/authentication. Các giới hạn cần giữ nguyên:

1. **Trusted Authentication chưa tích hợp.** `current_actor_id()` trả `NULL` cho tới khi có auth adapter đáng tin cậy.
2. **RLS fail-closed.** Owner-scoped records không được hiển thị/ghi bởi runtime khi actor chưa được xác thực.
3. **Không có write API nghiệp vụ.** Không tự thêm `POST`/`PUT`/`DELETE` endpoints hoặc nhận `owner_user_id` từ request để thay thế xác thực.
4. **Không dùng custom GUC từ client làm actor identity.** Không đưa `app.actor_id`, `finrisk.user_id` hoặc giá trị request tự khai báo vào cơ chế xác thực.
5. **API chỉ bind loopback.** Không dùng `0.0.0.0`, không expose port 8080 hoặc PostgreSQL ra Internet/mạng không tin cậy; API hiện chưa có authentication.
6. **PII key management chưa hoàn tất xác minh.** Không lưu key thật trong source control hoặc `.env`; cần secret manager/Windows protected store được phê duyệt.
7. **Chưa kiểm thử backup/restore.** Không tuyên bố có khả năng phục hồi dữ liệu trước khi kiểm thử riêng.
8. **Chưa chuyển localStorage sang PostgreSQL.** Các dữ liệu còn ở browser storage không tự động được lưu vào database.
9. **CORE4/H16/H18 guardrails giữ nguyên.** Không lưu Parquet/model artifacts vào database; không ánh xạ `customer_id` sang `sk_id_curr`; H18 chỉ là manual-review support signal; `automatic_credit_decision=false`; business rules chưa phê duyệt phải `is_executable=false`.

---

## 12. Bằng chứng môi trường tham chiếu M08.3

Trên một máy Windows triển khai tham chiếu, các kết quả sau đã được chạy và ghi nhận ngày 09/11/2026:

| Hạng mục | Kết quả |
|---|---|
| PostgreSQL | 17.11, Windows Service Running/Automatic |
| Python | CPython 3.14.7 64-bit |
| PostgreSQL driver | `psycopg[binary]==3.3.6` |
| H16 package lock | Cài khớp các phiên bản khóa; `pip check` PASS |
| Database | `finrisk_app_db`, owner `finrisk_owner`, UTF8 |
| Migrations | `0001`, `0002` APPLIED; checksum verified |
| Source Audit | 12/12 PASS |
| Database Unit Tests | 9/9 PASS |
| Server Tests | 19/19 PASS |
| API Database Health | HTTP `ready` / `DB_CONNECTED` |
| Tables | 12 |
| RLS | 8 bảng bật + FORCE RLS; 11 policies |
| API least privilege | Đã kiểm tra trên PostgreSQL thật |
| Actor spoofing check | Custom GUC không làm thay đổi `current_actor_id()`; trả NULL |

Các con số QA ở trên là kết quả chạy trực tiếp trong phiên triển khai tham chiếu. File JSON do `qa/m08_3_persistence_audit.py` tạo là **source audit tĩnh**; trường `live_database_tested=false` trong JSON mô tả rằng chính script audit không kết nối database, không phủ nhận các live checks được thực hiện riêng trong quá trình triển khai. Khi bàn giao cho team, nên lưu log/đầu ra các lệnh kiểm tra ở mục 8 vào một evidence record riêng của lần triển khai.

### 12.1. SHA-256 migrations đã áp dụng trên môi trường tham chiếu

Các giá trị sau thuộc chính xác nội dung migration đã được kiểm tra và áp dụng trên máy tham chiếu:

| File | SHA-256 |
|---|---|
| `0001_initial_schema.sql` | `F80659267ED3B8845D992837C5099C9C983E03BD453170679CDA057FD11B28A0` |
| `0002_runtime_grants.sql` | `0B73B2F877FB6B9CF2ED442D6440184A600F9F0ABEEA7AE906CFEC439ED54013` |

Trong `0002_runtime_grants.sql`, runtime API được cấp riêng quyền:

```sql
GRANT SELECT (migration_version)
ON finrisk_app.schema_migrations TO finrisk_app;
```

Quyền này cho phép health check đọc cột phiên bản migration mà không cấp SELECT toàn bảng `schema_migrations`.

**Quan trọng:** Nếu checksum trong source clone khác các giá trị trên, dừng triển khai và đối chiếu đúng branch/commit phát hành. Không chỉnh sửa migration đã áp dụng để cố làm checksum khớp.

---

## 13. Checklist triển khai máy mới

- [ ] Clone đúng repository, branch và commit bằng GitHub Desktop.
- [ ] Xác nhận CPython 3.14 64-bit.
- [ ] Cài PostgreSQL 16–18 và xác nhận Windows Service hoạt động.
- [ ] Xác nhận PostgreSQL chỉ được dùng qua loopback.
- [ ] Tạo 5 group roles bằng file bootstrap được chỉ định.
- [ ] Tạo `finrisk_app_db` owner `finrisk_owner`, encoding UTF8.
- [ ] Tạo hai login role riêng; đặt password tương tác.
- [ ] Tạo `.venv`, cài H16 lock và PostgreSQL requirements.
- [ ] `pip check` không có lỗi.
- [ ] Tạo `app/.env` với hai URL riêng, không commit `.env`.
- [ ] Kiểm tra login migrator và API.
- [ ] `migrate.py --status` hiển thị hai migration PENDING trên DB mới.
- [ ] Áp dụng migrations bằng `migrate.py`.
- [ ] `migrate.py --status` hiển thị hai migration APPLIED.
- [ ] Source Audit, Database Tests và Server Tests PASS.
- [ ] Python Database Health trả `ready` / `DB_CONNECTED`.
- [ ] HTTP `/api/db/health` trả `ready` / `DB_CONNECTED`.
- [ ] Kiểm tra bảng, RLS, grants và actor fail-closed.
- [ ] Cấu hình CORE4 Snapshot riêng nếu cần kiểm thử ML.
- [ ] Ghi nhận evidence và phiên bản môi trường đã triển khai.

---

## 14. Commit tài liệu bằng GitHub Desktop

Sau khi thêm tài liệu này vào repository tại:

```text
app/database/FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md
```

Mở GitHub Desktop, chọn đúng repository và branch, review Changes, xác nhận chỉ có file tài liệu mới (hoặc các thay đổi đã được duyệt khác), sau đó commit.

**Commit Summary đề xuất:**

```text
Bổ sung hướng dẫn triển khai M08.3 trên Windows
```

**Description đề xuất:**

```text
- Bổ sung hướng dẫn triển khai PostgreSQL Foundation trên máy Windows mới.
- Mô tả prerequisite, PostgreSQL service, roles, database và migration.
- Hướng dẫn tạo Python environment theo H16 lock và cài psycopg riêng.
- Hướng dẫn cấu hình app/.env an toàn, kiểm tra Database Health và RLS.
- Phân biệt cài mới, cập nhật source và chuyển database có dữ liệu.
- Ghi rõ giới hạn trusted authentication, CRUD, PII key management và backup/restore.
- Giữ nguyên CORE4/H16/H18 guardrails; không chứa credential hoặc dữ liệu khách hàng.
```

**Expected file change:** Added — `app/database/FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md`; Modified — 0; Deleted — 0 (nếu chỉ thêm riêng tài liệu này).

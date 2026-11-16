# FinRisk DSS - He Ho Tro Ra Quyet Dinh Danh Gia Rui Ro Tin Dung

He thong ho tro ra quyet dinh (Decision Support System - DSS) phuc vu tham dinh va danh gia rui ro tin dung, ket hop mo hinh hoc may dinh luong (LightGBM 169 dac trung) voi co so du lieu giao dich PostgreSQL 5432 bao mat da lop va bo mo phong kich ban tai chinh (What-If Analysis).

## 1. Kien truc he thong theo chuan ly thuyet DSS (Turban & Herbert Simon)
- **He quan tri du lieu:** PostgreSQL 5432 (schema finrisk_app voi Row-Level Security, chu ky HMAC-SHA256, ma hoa AES-GCM) ket hop kho dac trung chi doc CORE4 Parquet Snapshot (169 bien).
- **He quan tri mo hinh:** Mo hinh LightGBM H16 (494 cay quyet dinh, nguong tham chieu 0.144843), mo hinh toan tai chinh tra no W04 (Nien kim & Du no giam dan), va bo kiem tra chat luong dau vao #10 (INPUT_QUALITY).
- **He quan tri tri thuc & Giai thich:** Phan ra bien do log-odds (pred_contrib) chi ro 10 yeu to lam tang/giam rui ro, luong truy vet 6 buoc Decision Trace #11, va rao chan quan tri H18 (automatic_credit_decision: false).
- **He giao dien nguoi dung:** 5 phan he nghiep vu chuan ho tro 2 luong xu ly song song (Khach hang hien huu CORE4 & Ho so vay moi #09) cung khu vuc ky thuat noi bo QA / Admin.

## 2. Khoi chay va Kiem thu
1. Chay may chu: `..venv\Scripts\python.exe .\backend_api\server.py` trong thu muc `app`
2. Mo trinh duyet tai: `http://127.0.0.1:8080` (Ma mau tra cuu CORE4: 100035, 100002, va ma khoa kiem thu 100009).
3. Chay 116 bai kiem thu tu dong: `node --test tests/*.test.js`

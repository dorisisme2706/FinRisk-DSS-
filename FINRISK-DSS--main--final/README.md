# FinRisk DSS - He Ho Tro Ra Quyet Dinh Danh Gia Rui Ro Tin Dung

He thong ho tro ra quyet dinh (Decision Support System - DSS) phuc vu tham dinh va danh gia rui ro tin dung, ket hop mo hinh hoc may dinh luong (LightGBM 169 dac trung) voi co so du lieu giao dich PostgreSQL 5432 bao mat da lop, bo mo phong kich ban tai chinh (What-If Analysis) va tro ly Chatbox AI tuan thu rao chan quan tri H18 (Human-led Decision Support).

---

## 1. Kien truc he thong theo chuan ly thuyet DSS (Turban & Herbert Simon)

- **He quan tri du lieu (Data Management):** Co so du lieu giao dich PostgreSQL 5432 (`finrisk_app.loan_applications`) voi Row-Level Security, chu ky HMAC-SHA256, ma hoa AES-GCM ket hop kho dac trung chi doc CORE4 Parquet Snapshot (307.511 ban ghi, 169 bien).
- **He quan tri mo hinh (Model Management):** Mo hinh LightGBM H16 (494 cay quyet dinh, nguong tham chieu `0.144843`), mo hinh toan tai chinh tra no W04 (Nien kim & Du no giam dan), va bo kiem tra chat luong dau vao #10 (`INPUT_QUALITY`).
- **He quan tri tri thuc & Giai thich (Knowledge & Explanation):** Phan ra bien do log-odds (`pred_contrib`) chi ro 10 yeu to lam tang/giam rui ro, luong truy vet 6 buoc Decision Trace #11, tro ly Chatbox AI song ngu VI/EN va rao chan quan tri H18 (`automatic_credit_decision: false`).
- **He giao dien nguoi dung (User Interface):** 5 phan he nghiep vu chuan ho tro 2 luong xu ly song song (Khach hang hien huu CORE4 & Ho so vay moi #09) cung chuyen doi ngon ngu VI/EN toan trang.

---

## 2. Huong dan khoi chay trang web day du chuc nang

### Buoc 1: Mo PowerShell tai thu muc `app` va don tien trinh cu (neu co)
```powershell
cd app
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*server.py*" } \vert{} ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

### Buoc 2: Khoi dong may chu
- **Cach A - Chay day du tat ca chuc nang (ML CORE4 + PostgreSQL 5432 + Chatbox AI):**
```powershell
powershell -ExecutionPolicy Bypass -File .\tests\run_finrisk_chat.ps1 -Snapshot "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```
  *(Dan ma Groq API Key dang `gsk_...` tai loi nhac an va nhan Enter. Key chi nam trong bo nho phien hien tai, khong luu vao file hay day len GitHub).*

- **Cach B - Chay tieu chuan khong dung Chatbox AI (ML CORE4 + PostgreSQL 5432):**
```powershell
.\run_with_ml.bat
```

### Buoc 3: Mo trinh duyet va trai nghiem cac phan he
Khi cua so dong lenh hien thi `ML: READY` va `http://127.0.0.1:8080`, mo trinh duyet tai `http://127.0.0.1:8080`:
1. **Tong quan (Dashboard - M08.4):** Xem chi so KPI van hanh thuc te va thu nut chuyen doi ngon ngu VI / EN.
2. **Ho so khach hang (`W02` - CORE4):** Nhap ma mau `100035` hoac `100002` de tra cuu 38 chi tieu tai chinh & lich su tin dung (ma `100009` la ma khoa kiem thu bao mat 403).
3. **Ho so vay (`#09`, `#10`) & Mo phong dong tien (`W04`):** Nhap ho so vay moi tai `#09`, bam Luu & Kiem tra de xac thuc (`#10` bao `Valid: YES`) va ghi vao PostgreSQL `5432`, sau do tinh lich tra no tai `W04`.
4. **Danh gia rui ro & Ho tro quyet dinh (`W05`, `#12`, `#11`):** Nhap ma `100035` tai `W05` de chay mo hinh LightGBM 169 bien that + rao chan H18 (`Fail-Closed`), hoac thu kich ban gia lap What-If (`MOCK`) tai `#12` va `#11`.
5. **Bao cao tin dung & Lich su (`W06`):** Tao bao cao tong hop tu du lieu that CORE4 + H18, luu lich su va xuat tep JSON hoac HTML.
6. **Tro ly AI Chatbox (`Chat voi FinRisk`):** Bam nut o goc duoi ben phai; de trong ID ho so de hoi FAQ chung hoac nhap `100035` de AI phan tich truc tiep ho so CORE4.

---

## 3. Kiem thu chat luong tu dong (QA Gate)
Tai thu muc `app`, chay 3 bo kiem thu xac nhan toan he thong:
```powershell
# 1. Kiem thu giao dien, tich hop va rao chan H18 (116/116 PASS)
node --test tests/*.test.js

# 2. Cong tuong thich moi truong Python & chu ky SHA-256 mo hinh W07 (11/11 PASS)
.\.venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"

# 3. Kiem thu don vi may chu & bao mat API Backend (38/38 OK)
.\.venv\Scripts\python.exe -m unittest discover -s backend_api -p "test_*.py"
```

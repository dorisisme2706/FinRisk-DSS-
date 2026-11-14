# M08.5.4.3 ? Bi?n b?n Nghi?m thu T?ch h?p Migration 0004, Key Provisioning & Backend Actor Context

- **M? b?ng ch?ng:** `FINRISK_M08_5_4_3_INTEGRATION_TEST_20261113`
- **Th?i gian th?c thi (UTC):** `2026-11-13T12:20:40Z`
- **M?i tr??ng ki?m th?:** C?m PostgreSQL 17.11 c? l?p (`127.0.0.1:55432/finrisk_app_db`)
- **C?ng Production (`5432`):** `NOT TOUCHED`
- **Migration `0004_actor_assertion_verifier.sql` SHA-256:** `11c76d90f5d10302f20e66dcbc28fce2b931701969e7d9bb5477638ae141e6ba`
- **K?t qu? t?ng th?:** **PASS** (`10/10` nh?m k?ch b?n, `23/23` ki?m ??nh chi ti?t)

## Chi ti?t 10 Nh?m K?ch b?n Ki?m th? T?ch h?p

| M? | K?ch b?n ki?m th? | S? ki?m ??nh | Tr?ng th?i |
| :--- | :--- | :---: | :---: |
| `S01` | Migration 0004 applied via migrate.py and checksum-verified on re-run | 4/4 | **PASS** |
| `S02` | Verifier and dashboard_metrics fail closed before key provisioning | 2/2 | **PASS** |
| `S03` | Out-of-band provisioning activates key_id=1 without exposing key material | 2/2 | **PASS** |
| `S04` | db.bind_actor_assertion establishes transaction-bound identity and enforces RLS under finrisk_app | 2/2 | **PASS** |
| `S05` | dashboard_metrics(actor_user_id=...) returns strict owner-scoped aggregates | 3/3 | **PASS** |
| `S06` | Zero-downtime key rotation: key_id=2 becomes ACTIVE while key_id=1 remains accepted in VERIFY_ONLY | 3/3 | **PASS** |
| `S07` | Retired key rejection: key_id=1 in RETIRED state fails closed while key_id=2 continues working | 2/2 | **PASS** |
| `S08` | Cross-transaction replay and signature tampering fail closed | 2/2 | **PASS** |
| `S09` | Disabled app_users row fails closed even with valid signature from active key | 1/1 | **PASS** |
| `S10` | finrisk_app runtime role cannot access finrisk_private key table or private helper functions | 2/2 | **PASS** |


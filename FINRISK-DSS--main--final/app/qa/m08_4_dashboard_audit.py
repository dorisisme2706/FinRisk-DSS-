"""Static source audit for M08.4 live dashboard/data-source boundaries."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

checks = []
def check(label, condition):
    checks.append((label, bool(condition)))

server = read("backend_api/server.py")
db = read("backend_api/db.py")
ui = read("src/app.js")
glossary = read("qa/M08_4_METRIC_GLOSSARY_20261110.md")
contract = read("qa/M08_4_DASHBOARD_API_CONTRACT_20261110.yaml")

check("dashboard summary and data health endpoints exist", "/api/dashboard/summary" in server and "/api/data/health" in server)
check("metrics require finrisk_app.current_actor_id", "SELECT finrisk_app.current_actor_id()" in db)
check("null actor blocks aggregate queries", "AUTH_CONTEXT_REQUIRED" in db and "if actor_id is None" in db)
check("all aggregates are owner-scoped", db.count("owner_user_id = %s") >= 5)
check("validation metrics are INPUT_QUALITY only", "validation_scope = 'INPUT_QUALITY'" in db)
check("assessments remain support-only and NOT_APPROVED", "business_policy_status = 'NOT_APPROVED'" in db and "automatic_credit_decision = false" in db)
check("monthly trend uses application created_at", "a.created_at >= months.month_start" in db and "generate_series" in db)
check("CORE4/H16 source is marked read-only", '"source": "CORE4/H16"' in server and '"read_only": True' in server)
check("test split and risk-band metrics are explicitly excluded", '"test_split_included": False' in server and '"risk_band_metrics_enabled": False' in server)
check("UI fetches live summary API", 'fetch("/api/dashboard/summary"' in ui)
check("legacy MOCK storage remains separated and labelled", "Dữ liệu MOCK cục bộ" in ui and "không phải PostgreSQL" in ui)
check("glossary and API contract define the scope", "AUTH_CONTEXT_REQUIRED" in glossary and "CURRENT_ACTOR" in contract)
check("approval and high-risk KPI claims were removed from live dashboard", "1.248" not in ui and "68,4%" not in ui and "Tỷ lệ phê duyệt" not in ui)

failed = 0
print("M08.4 Dashboard Source Audit")
for label, passed in checks:
    print(("PASS" if passed else "FAIL") + " | " + label)
    failed += not passed
print(f"\nRESULT: {len(checks)-failed}/{len(checks)} PASS")
sys.exit(1 if failed else 0)

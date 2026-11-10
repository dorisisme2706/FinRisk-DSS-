"""Offline tests for M08.3 PostgreSQL adapter boundaries; no live DB is simulated as PASS."""
import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, Mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend_api"))
import db
import migrate


class DatabaseConfigTests(unittest.TestCase):
    def test_only_loopback_postgres_urls_are_allowed(self):
        self.assertEqual(db.validate_local_database_url(
            "postgresql://finrisk:secret@127.0.0.1:5432/finrisk_app_db"
        ), (True, "OK"))
        self.assertEqual(db.validate_local_database_url(
            "postgresql://finrisk:secret@localhost:5432/finrisk_app_db"
        ), (True, "OK"))
        self.assertEqual(db.validate_local_database_url(
            "postgresql://finrisk:secret@db.example.com:5432/finrisk_app_db"
        ), (False, "DB_HOST_NOT_LOCAL"))

    def test_invalid_scheme_and_missing_database_are_rejected(self):
        self.assertEqual(db.validate_local_database_url("https://localhost/finrisk"),
                         (False, "DB_URL_INVALID"))
        self.assertEqual(db.validate_local_database_url("postgresql://localhost"),
                         (False, "DB_NAME_MISSING"))

    def test_health_is_closed_when_database_is_not_configured(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(db, "load_local_env"):
            self.assertEqual(db.database_health(),
                             {"status": "unavailable", "code": "DB_NOT_CONFIGURED"})

    def test_health_does_not_return_connection_details(self):
        class Cursor:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def execute(self, _sql): pass
            def fetchone(self): return (160000, True)
            def fetchall(self): return [("0001",), ("0002",)]
        class Conn:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def cursor(self): return Cursor()
        with patch.dict(os.environ, {
            "FINRISK_DATABASE_URL": "postgresql://private-user:secret@127.0.0.1:5432/finrisk_app_db"
        }, clear=True), patch.object(db, "_connect", return_value=Conn()):
            result = db.database_health()
        self.assertEqual(result, {"status": "ready", "code": "DB_CONNECTED"})
        self.assertNotIn("secret", str(result))
        self.assertNotIn("private-user", str(result))


class DashboardMetricsTests(unittest.TestCase):
    def test_metrics_fail_closed_without_trusted_actor(self):
        class Cursor:
            def __init__(self): self.statements = []
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def execute(self, sql, params=None): self.statements.append((sql, params))
            def fetchone(self): return (None,)
            def fetchall(self): raise AssertionError("No aggregate query may run without an actor.")
        class Conn:
            def __init__(self): self.cur = Cursor()
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def cursor(self): return self.cur
        conn = Conn()
        with patch.object(db, "_connect", return_value=conn):
            result = db.dashboard_metrics(health={"status": "ready", "code": "DB_CONNECTED"})
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["code"], "AUTH_CONTEXT_REQUIRED")
        self.assertEqual(result["scope"], "CURRENT_ACTOR")
        self.assertTrue(all(value is None for value in result["counts"].values()))
        self.assertEqual(len(conn.cur.statements), 1)

    def test_metrics_aggregate_only_current_actor_and_allowed_signals(self):
        class Cursor:
            def __init__(self): self.fetchall_results = iter([
                [("DRAFT", 2), ("SUBMITTED", 1)],
                [("PASS", 3), ("WARN", 1)],
                [("MANUAL_REVIEW_RECOMMENDED", 1), ("NO_REVIEW_SIGNAL", 2)],
                [("2026-06", 0), ("2026-07", 3)],
            ]); self.statements = []; self.fetchone_results = iter([("actor-uuid",), (4,)])
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def execute(self, sql, params=None): self.statements.append((sql, params))
            def fetchone(self): return next(self.fetchone_results)
            def fetchall(self): return next(self.fetchall_results)
        class Conn:
            def __init__(self): self.cur = Cursor()
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def cursor(self): return self.cur
        conn = Conn()
        with patch.object(db, "_connect", return_value=conn):
            result = db.dashboard_metrics(health={"status": "ready", "code": "DB_CONNECTED"})
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["counts"]["applications_total"], 3)
        self.assertEqual(result["counts"]["validation_runs_total"], 4)
        self.assertEqual(result["counts"]["assessments_total"], 3)
        self.assertEqual(result["counts"]["manual_review_recommended"], 1)
        self.assertEqual(result["counts"]["active_reports"], 4)
        aggregate_sql = "\n".join(sql for sql, _ in conn.cur.statements[1:]).lower()
        self.assertIn("owner_user_id = %s", aggregate_sql)
        self.assertIn("validation_scope = 'input_quality'", aggregate_sql)
        self.assertIn("business_policy_status = 'not_approved'", aggregate_sql)
        self.assertNotIn("target", aggregate_sql)
        self.assertNotIn("split_manifest", aggregate_sql)

    def test_metrics_hide_database_exceptions(self):
        class BrokenConn:
            def __enter__(self): raise RuntimeError("password=private-secret")
            def __exit__(self, *args): return False
        with patch.object(db, "_connect", return_value=BrokenConn()):
            result = db.dashboard_metrics(health={"status": "ready", "code": "DB_CONNECTED"})
        self.assertEqual(result["code"], "DB_UNAVAILABLE")
        self.assertNotIn("private-secret", str(result))


class MigrationDesignTests(unittest.TestCase):
    def test_migrations_are_ordered_and_checksum_pinned(self):
        migrations = migrate.discover_migrations()
        self.assertEqual([m["version"] for m in migrations], ["0001", "0002"])
        self.assertTrue(all(len(m["checksum"]) == 64 for m in migrations))

    def test_initial_migration_fails_closed_for_actor_identity(self):
        sql = (ROOT / "database/migrations/0001_initial_schema.sql").read_text(encoding="utf-8")
        actor = sql.split("CREATE OR REPLACE FUNCTION finrisk_app.current_actor_id()", 1)[1].split("$function$;", 1)[0]
        self.assertIn("SELECT NULL::uuid", actor)
        self.assertNotIn("current_setting('finrisk.user_id'", sql)
        self.assertNotRegex(sql, r"CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+finrisk_app\\.resolve_identity")
        self.assertIn("updated_by = finrisk_app.current_actor_id()", sql)

    def test_migration_uses_a_separate_migrator_dsn(self):
        with patch.dict(os.environ, {
            "FINRISK_DATABASE_URL": "postgresql://api:api-pass@127.0.0.1:5432/finrisk_app_db",
            "FINRISK_MIGRATION_DATABASE_URL": "postgresql://migrator:mig-pass@127.0.0.1:5432/finrisk_app_db",
        }, clear=True):
            self.assertIn("migrator", migrate.migration_database_url())
            self.assertNotIn("migrator", db.database_url())

    def test_migration_runner_blocks_remote_database_urls(self):
        with patch.dict(os.environ, {
            "FINRISK_MIGRATION_DATABASE_URL": "postgresql://user:pass@db.example.com:5432/finrisk_app_db"
        }, clear=True):
            with self.assertRaisesRegex(migrate.MigrationError, "DB_HOST_NOT_LOCAL"):
                migrate.run_migrations()

    def test_runtime_can_read_only_migration_version_column(self):
        sql = (ROOT / "database/migrations/0002_runtime_grants.sql").read_text(encoding="utf-8")
        self.assertIn(
            "REVOKE ALL ON finrisk_app.schema_migrations FROM finrisk_app;",
            sql,
        )
        self.assertIn(
            "GRANT SELECT (migration_version) ON finrisk_app.schema_migrations TO finrisk_app;",
            sql,
        )
        self.assertNotRegex(
            sql,
            r"(?i)GRANT\s+SELECT\s+ON\s+finrisk_app\.schema_migrations\b",
        )

    def test_schema_migration_files_do_not_change_model_or_snapshot_contracts(self):
        for migration in migrate.discover_migrations():
            text = migration["sql"].lower()
            self.assertNotIn("pipeline.joblib", text)
            self.assertNotIn("split_manifest", text)
            self.assertNotRegex(text, r"create\\s+table\\s+[^;]*\\btarget\\b")
            self.assertNotRegex(text, r"(?im)^\\s*drop\\s+table\\b")
            self.assertNotRegex(text, r"(?im)^\\s*truncate\\s+(?:table\\s+)?")


if __name__ == "__main__":
    unittest.main(verbosity=2)

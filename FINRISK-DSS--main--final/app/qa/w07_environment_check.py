#!/usr/bin/env python3
"""Strict FinRisk W07 model-runtime preflight.

Run with the project's .venv before API tests or starting the ML API:
    .venv/Scripts/python.exe qa/w07_environment_check.py [--snapshot PATH]

The check is intentionally strict: it blocks model loading when Python/package
versions differ from the frozen metadata instead of allowing an sklearn
InconsistentVersionWarning to pass silently.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import re
import struct
import subprocess
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
METADATA_PATH = APP / "backend_ml" / "model" / "metadata.json"
LOCK_PATH = APP / "backend_ml" / "model" / "requirements-lock.txt"
MODEL_PATH = APP / "backend_ml" / "model" / "pipeline.joblib"
FEATURE_CONTRACT_PATH = APP / "backend_ml" / "contracts" / "model_features_v1.json"
RESULT_DIR = APP / "evidence" / "w07"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def read_lock() -> dict[str, str]:
    locked: dict[str, str] = {}
    for raw in LOCK_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Za-z0-9_.-]+)==([^\s;]+)", line)
        if not match:
            raise ValueError(f"Unsupported lock entry: {raw}")
        locked[normalize_name(match.group(1))] = match.group(2)
    return locked


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify exact H16 runtime dependencies and model load.")
    parser.add_argument("--snapshot", help="Optional CORE4 snapshot root; verifies Parquet hash/header only.")
    parser.add_argument("--no-write", action="store_true", help="Print checks without writing evidence files.")
    args = parser.parse_args()

    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    locked = read_lock()
    checks: list[dict] = []

    def record(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "status": "PASS" if passed else "FAIL", "detail": detail})

    # Model metadata contains a full sys.version string; only the major/minor
    # runtime line is locked so 3.14 patch updates remain valid.
    model_python_text = str(metadata.get("python", ""))
    python_match = re.match(r"(\d+)\.(\d+)\.(\d+)", model_python_text)
    expected_python = tuple(map(int, python_match.groups()[:2])) if python_match else None
    actual_python = (sys.version_info.major, sys.version_info.minor)
    python_ok = sys.implementation.name == "cpython" and expected_python == actual_python
    record(
        "CPython minor version matches frozen model metadata",
        python_ok,
        f"Expected CPython {expected_python}; running {sys.implementation.name} {sys.version.split()[0]}",
    )
    is_64_bit = struct.calcsize("P") == 8
    record("Python interpreter is 64-bit", is_64_bit, f"Pointer width: {struct.calcsize('P') * 8}-bit")
    is_windows = sys.platform == "win32"
    record("Runtime operating system is Windows", is_windows, f"Platform: {sys.platform}; expected win32")

    expected_versions = {
        normalize_name(key): str(value)
        for key, value in (metadata.get("versions") or {}).items()
    }
    lock_matches_metadata = bool(expected_versions) and all(
        locked.get(name) == version for name, version in expected_versions.items()
    )
    record(
        "Frozen model versions agree with the requirements lock",
        lock_matches_metadata,
        f"Compared {len(expected_versions)} metadata package versions with {len(locked)} locked packages",
    )

    mismatches = []
    for name, expected in sorted(locked.items()):
        try:
            actual = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            actual = None
        if actual != expected:
            mismatches.append({"package": name, "expected": expected, "installed": actual})
    record(
        "Every installed package matches the exact requirements lock",
        not mismatches,
        "All locked package versions match" if not mismatches else "; ".join(
            f"{x['package']}: expected {x['expected']}, installed {x['installed']}" for x in mismatches
        ),
    )

    pip_check = subprocess.run(
        [sys.executable, "-m", "pip", "check"], capture_output=True, text=True, check=False
    )
    pip_detail = (pip_check.stdout or "").strip() or (pip_check.stderr or "").strip() or "No dependency conflicts"
    record("pip dependency graph is consistent", pip_check.returncode == 0, pip_detail)

    import_error = None
    try:
        import numpy  # noqa: F401
        import pandas  # noqa: F401
        import pyarrow as pa
        import pyarrow.parquet as pq
        import lightgbm  # noqa: F401
        import sklearn  # noqa: F401
        import joblib  # noqa: F401
    except Exception as exc:
        import_error = f"{type(exc).__name__}: {exc}"
    record(
        "All model runtime libraries import successfully",
        import_error is None,
        "NumPy, pandas, PyArrow, LightGBM, scikit-learn and joblib import" if import_error is None else import_error,
    )

    if import_error is None:
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
            sink = pa.BufferOutputStream()
            table = pa.table({"_w07_probe_id": [1, 2], "_w07_probe_value": [1.25, 2.5]})
            pq.write_table(table, sink)
            restored = pq.read_table(pa.BufferReader(sink.getvalue()))
            parquet_ok = restored.equals(table)
            parquet_detail = "In-memory Parquet write/read round-trip succeeded"
        except Exception as exc:
            parquet_ok = False
            parquet_detail = f"{type(exc).__name__}: {exc}"
    else:
        parquet_ok = False
        parquet_detail = "Skipped because a required runtime library failed to import"
    record("PyArrow Parquet read/write works", parquet_ok, parquet_detail)

    model_hash_ok = MODEL_PATH.is_file() and sha256(MODEL_PATH) == metadata.get("model_sha256")
    record(
        "Frozen H16 pipeline SHA-256 matches metadata",
        model_hash_ok,
        f"Expected {metadata.get('model_sha256')}; actual {sha256(MODEL_PATH) if MODEL_PATH.is_file() else 'MISSING'}",
    )

    model_ok = False
    model_detail = "Skipped because package imports or model hash failed"
    strict_model_prerequisites = (
        python_ok and is_64_bit and is_windows and lock_matches_metadata
        and not mismatches and pip_check.returncode == 0 and import_error is None and model_hash_ok
    )
    if strict_model_prerequisites:
        try:
            sys.path.insert(0, str(APP / "backend_ml" / "src"))
            with warnings.catch_warnings(record=True) as captured:
                warnings.simplefilter("always")
                import joblib
                pipeline = joblib.load(MODEL_PATH)
            version_warnings = [
                item for item in captured
                if item.category.__name__ == "InconsistentVersionWarning"
            ]
            if version_warnings:
                model_detail = " | ".join(str(item.message) for item in version_warnings)
            else:
                contract = json.loads(FEATURE_CONTRACT_PATH.read_text(encoding="utf-8"))
                expected_features = list(contract["feature_order"])
                actual_features = list(pipeline.named_steps["schema"].features)
                feature_count = int(metadata.get("predictor_count_before_encoding", -1))
                model_ok = actual_features == expected_features and len(actual_features) == feature_count == 169
                model_detail = (
                    f"Pipeline unpickled without InconsistentVersionWarning; schema has {len(actual_features)} ordered features"
                )
                if not model_ok:
                    model_detail += "; model schema does not match the frozen 169-feature contract"
        except Exception as exc:
            model_detail = f"{type(exc).__name__}: {exc}"
    record("H16 pipeline unpickles without scikit-learn version warnings", model_ok, model_detail)

    if args.snapshot:
        snapshot_root = Path(args.snapshot).expanduser().resolve()
        parquet_path = snapshot_root / "data" / "feature_matrix.parquet"
        expected_hash = metadata.get("data_hash")
        snapshot_ok = parquet_path.is_file() and sha256(parquet_path) == expected_hash
        snapshot_detail = f"{parquet_path}: {'SHA-256 MATCH' if snapshot_ok else 'missing or SHA-256 mismatch'}"
        if snapshot_ok and import_error is None:
            try:
                import pyarrow.parquet as pq
                parquet_file = pq.ParquetFile(parquet_path)
                snapshot_ok = parquet_file.metadata.num_rows > 0 and "sk_id_curr" in parquet_file.schema.names
                snapshot_detail += f"; rows={parquet_file.metadata.num_rows}; sk_id_curr column present={snapshot_ok}"
            except Exception as exc:
                snapshot_ok = False
                snapshot_detail += f"; {type(exc).__name__}: {exc}"
        elif snapshot_ok:
            snapshot_ok = False
            snapshot_detail += "; Parquet header check skipped because a required runtime import failed"
        record("CORE4 snapshot hash and Parquet header are valid", snapshot_ok, snapshot_detail)

    failed = [item for item in checks if item["status"] == "FAIL"]
    result = {
        "schema_version": 1,
        "release": "FinRisk DSS W07 Runtime Compatibility Gate",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "python": sys.version,
        "python_executable": sys.executable,
        "expected_python_minor": ".".join(map(str, expected_python)) if expected_python else None,
        "locked_package_count": len(locked),
        "installed_package_mismatches": mismatches,
        "pip_check_returncode": pip_check.returncode,
        "snapshot_requested": bool(args.snapshot),
        "checks_total": len(checks),
        "checks_passed": len(checks) - len(failed),
        "checks_failed": len(failed),
        "status": "PASS" if not failed else "FAIL",
        "checks": checks,
    }

    lines = [
        f"W07 Runtime Compatibility Gate: {result['status']}",
        f"Checks: {result['checks_passed']}/{result['checks_total']} PASS; {result['checks_failed']} FAIL",
        f"Python: {sys.version.split()[0]} (expected {result['expected_python_minor']})",
        f"Locked package count: {len(locked)}; mismatches: {len(mismatches)}",
        f"pip check: {'PASS' if pip_check.returncode == 0 else 'FAIL'}",
    ]
    lines.extend(
        f"{'PASS' if item['status'] == 'PASS' else 'FAIL'} | {item['name']} | {item['detail']}"
        for item in checks
    )
    output_text = "\n".join(lines) + "\n"
    print(output_text, end="")

    if not args.no_write:
        RESULT_DIR.mkdir(parents=True, exist_ok=True)
        (RESULT_DIR / "environment_check_results.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        (RESULT_DIR / "environment_check_results.txt").write_text(output_text, encoding="utf-8")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())

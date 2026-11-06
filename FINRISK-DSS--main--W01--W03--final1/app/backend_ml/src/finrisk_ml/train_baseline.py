from __future__ import annotations
import argparse
import importlib.metadata
import logging
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import traceback
import warnings
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
                             f1_score, log_loss, precision_recall_curve, precision_score, recall_score,
                             roc_auc_score, roc_curve)
from threadpoolctl import threadpool_limits
from .common import PARQUET_HASH, DATA_VERSION, SEED, feature_spec, need, now, read_json, sha256, write_json
from .preprocessing import MISSING_TOKEN, make_pipeline
from .splitting import make_split, split_bytes, split_digest

def metrics(y, scores):
    pred = (scores >= 0.5).astype(int)
    fpr, tpr, _ = roc_curve(y, scores)
    precision, recall, _ = precision_recall_curve(y, scores)
    auc = float(roc_auc_score(y, scores))
    return {
        "population": "validation", "rows": len(y), "positive_count": int(np.asarray(y).sum()),
        "roc_auc": auc, "average_precision": float(average_precision_score(y, scores)),
        "pr_auc_trapezoid": float(np.trapezoid(precision[::-1], recall[::-1])),
        "gini": 2 * auc - 1, "ks": float(np.max(np.abs(tpr - fpr))),
        "brier": float(brier_score_loss(y, scores)), "log_loss": float(log_loss(y, scores)),
        "illustrative_threshold": 0.5, "threshold_selected_for_business": False,
        "accuracy": float(accuracy_score(y, pred)), "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)), "f1": float(f1_score(y, pred, zero_division=0)),
        "confusion_matrix_labels": [0, 1], "confusion_matrix": confusion_matrix(y, pred, labels=[0, 1]).tolist(),
    }

def train_eda(train, features, numeric, report):
    rows = []
    for col in features:
        s = train[col]
        row = {"column": col, "dtype": str(s.dtype), "missing_count": int(s.isna().sum()),
               "missing_rate": float(s.isna().mean()), "distinct_nonmissing": int(s.nunique(dropna=True))}
        if col in numeric:
            values = s.dropna()
            row.update({"min": values.min() if len(values) else None, "median": values.median() if len(values) else None,
                        "p99": values.quantile(0.99) if len(values) else None, "max": values.max() if len(values) else None})
        rows.append(row)
    pd.DataFrame(rows).to_csv(report / "train_feature_profile.csv", index=False, lineterminator="\n", encoding="utf-8-sig")
    cohorts = {}
    for col in ["bureau_history_observed", "previous_history_observed", "installments_history_observed"]:
        cohorts[col] = {str(k): int(v) for k, v in train[col].value_counts(dropna=False).items()}
    summary = {
        "scope": "train_only", "rows": len(train), "target_counts": {str(k): int(v) for k, v in train["target"].value_counts().items()},
        "all_missing_in_train": [r["column"] for r in rows if r["missing_count"] == len(train)],
        "constant_nonmissing_in_train": [r["column"] for r in rows if r["distinct_nonmissing"] <= 1],
        "columns_dropped": [], "history_observed_train_counts": cohorts,
        "feature_selection_performed": False, "rule": "Preserve approved candidates; no feature choice using validation/test EDA."
    }
    write_json(report / "train_eda.json", summary)
    return summary

def run(args, project, output, logger):
    started = time.perf_counter()
    reports, modeldir, splits, contracts = [output / name for name in ["reports", "model", "splits", "contracts"]]
    for folder in [reports, modeldir, splits, contracts]:
        folder.mkdir(parents=True, exist_ok=True)
    snapshot = args.snapshot.resolve() if args.snapshot else project / "data_snapshot/72780cc27cfe"
    logger.info("Checking pinned snapshot and 169 candidate columns.")
    features, numeric, categorical = feature_spec(snapshot)
    df = pd.read_parquet(snapshot / "data/feature_matrix.parquet")
    need(df.shape == (307511, 173), "Unexpected input shape.")
    need(df["target"].value_counts().to_dict() == {0: 282686, 1: 24825}, "TARGET population changed.")
    manifest, split_summary = make_split(df)
    again, _ = make_split(df.sample(frac=1, random_state=911))
    need(split_digest(manifest) == split_digest(again), "Split not reproducible across input row order.")
    locked_dir = project / "splits"
    locked_dir.mkdir(exist_ok=True)
    locked_path = locked_dir / "core4_seed42_manifest.csv"
    try:
        with locked_path.open("xb") as lock:
            lock.write(split_bytes(manifest))
    except FileExistsError:
        need(locked_path.read_bytes() == split_bytes(manifest), "Locked split differs; do not overwrite. Investigate version/config before proceeding.")
    (splits / "split_manifest.csv").write_bytes(split_bytes(manifest))
    write_json(splits / "split_summary.json", {
        "seed": SEED, "method": "sort IDs; stratified 15% test; 15/85 validation of remaining",
        "data_hash": PARQUET_HASH, "split_manifest_sha256": split_digest(manifest),
        "parts": split_summary, "pairwise_overlap": 0, "all_base_ids_preserved": True,
        "test_performance_evaluated": False,
    })
    logger.info("H06 PASS: %s", {k: v["rows"] for k, v in split_summary.items()})
    by_id = df.set_index("sk_id_curr", drop=False)
    train_ids = manifest.loc[manifest["split"] == "train", "sk_id_curr"].to_numpy()
    validation_ids = manifest.loc[manifest["split"] == "validation", "sk_id_curr"].to_numpy()
    train = by_id.loc[train_ids]
    validation = by_id.loc[validation_ids]
    eda = train_eda(train, features, numeric, reports)
    logger.info("H07 PASS: train-only EDA; no learned feature selection.")
    write_json(contracts / "model_features_v1.json", {
        "feature_set_version": "core4_169_baseline_v1", "feature_order": features,
        "numeric": numeric, "categorical": categorical, "data_hash": PARQUET_HASH,
        "implementation_authorization": {"by": "HK in current chat", "quote": "ok chốt, bắt đầu đi", "date_local": "2026-10-26",
                                         "scope": "Implement agreed H04/H05 defaults for baseline; no GK sign-off claimed."},
        "GK_review_recorded": False,
    })
    X_train, y_train = train[features], train["target"].astype(int)
    X_validation, y_validation = validation[features], validation["target"].astype(int)
    for col in categorical:
        need(not train[col].dropna().eq(MISSING_TOKEN).any(), "Reserved missing token collides with source category.")
    pipeline = make_pipeline(features, numeric, categorical, args.max_iter)
    logger.info("H08/H09: fitting median/encoder/scaler + Logistic Regression on train only; max_iter=%s.", args.max_iter)
    fit_start = time.perf_counter()
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        with threadpool_limits(limits=args.threads):
            pipeline.fit(X_train, y_train)
    fit_seconds = time.perf_counter() - fit_start
    warning_rows = [{"category": x.category.__name__, "message": str(x.message)} for x in captured]
    write_json(reports / "training_warnings.json", warning_rows)
    need(not any(issubclass(x.category, ConvergenceWarning) for x in captured), "LR did not converge; inspect warnings and rerun with a higher --max-iter without changing validation policy.")
    processor = pipeline.named_steps["preprocess"]
    number_pipeline = processor.named_transformers_["numeric"]
    imputer = number_pipeline.named_steps["imputer"]
    expected_medians = train[numeric].median(skipna=True).fillna(0).to_numpy(dtype=float)
    need(np.allclose(imputer.statistics_, expected_medians, rtol=1e-12, atol=1e-12), "Imputer statistics differ from train-only medians.")
    need(int(number_pipeline.named_steps["scaler"].n_samples_seen_) == len(train), "Scaler fitted on unexpected population.")
    learned_categories = processor.named_transformers_["categorical"].named_steps["onehot"].categories_
    for col, learned in zip(categorical, learned_categories):
        expected = set(train[col].dropna().tolist())
        if train[col].isna().any():
            expected.add(MISSING_TOKEN)
        need(set(learned) == expected, "Encoder categories differ from train-only categories: " + col)
    medians_before = imputer.statistics_.copy()
    with threadpool_limits(limits=args.threads):
        positive_index = list(pipeline.classes_).index(1)
        scores = pipeline.predict_proba(X_validation)[:, positive_index]
    need(np.isfinite(scores).all() and ((scores >= 0) & (scores <= 1)).all(), "Invalid validation scores.")
    need(np.array_equal(medians_before, imputer.statistics_), "Validation transform changed fitted statistics.")
    result = metrics(y_validation, scores)
    result.update({"model": "LogisticRegression", "calibration_status": "uncalibrated", "fit_seconds": fit_seconds,
                   "converged": True, "iterations": pipeline.named_steps["model"].n_iter_.tolist(), "test_scored_rows": 0})
    write_json(reports / "baseline_metrics.json", result)
    dummy_scores = np.full(len(y_validation), float(y_train.mean()))
    write_json(reports / "dummy_prevalence_metrics.json", metrics(y_validation, dummy_scores))
    pd.DataFrame({"sk_id_curr": validation_ids, "target": y_validation.to_numpy(), "risk_score": scores}).to_parquet(reports / "validation_predictions.parquet", index=False)
    fpr, tpr, thresholds = roc_curve(y_validation, scores)
    pd.DataFrame({"fpr": fpr, "tpr": tpr, "threshold": thresholds}).to_csv(reports / "validation_roc_curve.csv", index=False, lineterminator="\n")
    precision, recall, thresholds = precision_recall_curve(y_validation, scores)
    pd.DataFrame({"precision": precision, "recall": recall, "threshold": np.append(thresholds, np.nan)}).to_csv(reports / "validation_pr_curve.csv", index=False, lineterminator="\n")
    transformed_names = processor.get_feature_names_out().tolist()
    need(len(transformed_names) == pipeline.named_steps["model"].coef_.shape[1], "Transformed schema/coefficient mismatch.")
    write_json(modeldir / "transformed_feature_names.json", transformed_names)
    joblib.dump(pipeline, modeldir / "pipeline.joblib", compress=3)
    versions = {name: importlib.metadata.version(name) for name in ["pandas", "pyarrow", "numpy", "scikit-learn", "joblib", "scipy", "threadpoolctl"]}
    config = {"solver": "lbfgs", "C": 1.0, "l1_ratio": 0.0, "tol": 1e-4, "max_iter": args.max_iter,
              "class_weight": None, "seed": SEED, "threads": args.threads}
    metadata = {
        "model_version": "finrisk_lr_baseline_v0.1", "feature_set_version": "core4_169_baseline_v1",
        "data_version": DATA_VERSION, "data_hash": PARQUET_HASH, "split_hash": split_digest(manifest),
        "model_sha256": sha256(modeldir / "pipeline.joblib"), "calibration_status": "uncalibrated",
        "threshold_policy_version": None, "release_stage": "baseline_validation_only", "test_locked": True,
        "predictor_count_before_encoding": len(features), "transformed_feature_count": len(transformed_names),
        "numeric_count": len(numeric), "categorical_count": len(categorical),
        "python": sys.version, "platform": platform.platform(), "versions": versions, "config": config,
        "execution_context": args.execution_context, "created_utc": now(),
    }
    write_json(modeldir / "metadata.json", metadata)
    frozen = subprocess.run([sys.executable, "-m", "pip", "freeze"], check=True, capture_output=True, text=True)
    (modeldir / "requirements-lock.txt").write_text(frozen.stdout, encoding="utf-8")
    fit_audit = {
        "fit_population": "train_only", "fit_rows": len(train), "validation_scored_rows": len(validation), "test_scored_rows": 0,
        "train_medians_verified": True, "scaler_fit_rows_verified": True, "train_only_categories_verified": True,
        "validation_did_not_refit": True, "all_missing_numeric_train": eda["all_missing_in_train"],
        "all_missing_rule": "keep column; SimpleImputer uses 0 software placeholder plus missing indicator; not a recovered raw value.",
        "numeric_missing_indicator_columns": [numeric[i] for i in imputer.indicator_.features_],
    }
    write_json(reports / "fit_population_audit.json", fit_audit)
    robustness = {}
    probe = X_validation.iloc[[0]].copy()
    if categorical:
        col = categorical[0]
        probe[col] = probe[col].astype(object)
        probe.loc[:, col] = "__FINRISK_UNSEEN_QA_CATEGORY__"
        robustness["unseen_category_handled"] = bool(np.isfinite(pipeline.predict_proba(probe)).all())
    for name, data in [("missing_column_rejected", X_validation.iloc[[0]].drop(columns=[features[0]])),
                       ("target_in_X_rejected", X_validation.iloc[[0]].assign(target=0))]:
        try:
            pipeline.predict_proba(data)
            robustness[name] = False
        except ValueError as exc:
            robustness[name] = "SCHEMA_MISMATCH" in str(exc)
    need(all(robustness.values()), "Pipeline robustness check failed.")
    write_json(reports / "schema_robustness.json", robustness)
    # All smoke scores use validation IDs; no held-out test profile is scored.
    pools = [validation[(validation["amt_annuity_missing"] == 0) & (validation["bureau_history_observed"] == 1)],
             validation[validation["amt_annuity_missing"] == 1], validation[validation["bureau_history_observed"] == 0]]
    refs = []
    score_map = pd.Series(scores, index=validation_ids)
    for label, pool in zip(["history_observed", "annuity_missing", "bureau_not_observed"], pools):
        if len(pool):
            profile_id = int(pool.iloc[0]["sk_id_curr"])
            refs.append({"case": label, "sk_id_curr": profile_id, "split": "validation", "risk_score": float(score_map.loc[profile_id])})
    need(len(refs) >= 2, "Insufficient validation reference profiles.")
    write_json(reports / "smoke_reference.json", refs)
    logger.info("Validation AUC=%.6f AP=%.6f. Checking load/predict in a fresh process.", result["roc_auc"], result["average_precision"])
    verifier = Path(__file__).resolve().parents[1] / "score_hk_profile.py"
    env = os.environ.copy()
    env.update({"OMP_NUM_THREADS": str(args.threads), "OPENBLAS_NUM_THREADS": str(args.threads), "MKL_NUM_THREADS": str(args.threads)})
    fresh = subprocess.run([sys.executable, str(verifier), "--project", str(project), "--run", str(output), "--snapshot", str(snapshot), "--verify-references"],
                           check=False, capture_output=True, text=True, env=env)
    need(fresh.returncode == 0, "Fresh-process load failed: " + fresh.stderr + fresh.stdout)
    fresh_result = __import__("json").loads(fresh.stdout)
    need(fresh_result["status"] == "PASS", "Fresh process smoke checks failed.")
    write_json(reports / "fresh_process_smoke.json", fresh_result)
    need(sha256(snapshot / "data/feature_matrix.parquet") == PARQUET_HASH, "Input snapshot changed during run.")
    final = {
        "status": "PASS_BASELINE_VALIDATION_ONLY", "tasks_executed": ["H06", "H07", "H08", "H09"],
        "run": str(output), "snapshot": str(snapshot), "execution_context": args.execution_context,
        "completed_utc": now(), "runtime_seconds": time.perf_counter() - started,
        "splits": split_summary, "split_hash": split_digest(manifest), "validation_metrics": result,
        "test_performance_evaluated": False, "test_scored_rows": 0, "model_version": metadata["model_version"],
        "formal_TK_GK_review": "NOT_RECORDED", "next_task": "INT01 baseline integration; H10 LightGBM comparison on the same split",
    }
    write_json(reports / "run_summary.json", final)
    text = f'''# Logistic Regression baseline — kết quả thực chạy

Trạng thái: PASS_BASELINE_VALIDATION_ONLY. Bối cảnh: {args.execution_context}. Đây là baseline chưa hiệu chỉnh xác suất, chưa có threshold nghiệp vụ và chưa đánh giá test.

| Tập | Số dòng | Nhãn 1 |
|---|---:|---:|
| Train | {split_summary['train']['rows']} | {split_summary['train']['target_counts']['1']} |
| Validation | {split_summary['validation']['rows']} | {split_summary['validation']['target_counts']['1']} |
| Test giữ riêng | {split_summary['test']['rows']} | {split_summary['test']['target_counts']['1']} |

| Chỉ số trên validation | Giá trị |
|---|---:|
| ROC-AUC | {result['roc_auc']:.6f} |
| Average Precision | {result['average_precision']:.6f} |
| PR-AUC hình thang, cách tính riêng với AP | {result['pr_auc_trapezoid']:.6f} |
| KS | {result['ks']:.6f} |
| Gini | {result['gini']:.6f} |
| Brier | {result['brier']:.6f} |
| Precision tại ngưỡng minh họa 0.5 | {result['precision']:.6f} |
| Recall tại ngưỡng minh họa 0.5 | {result['recall']:.6f} |
| F1 tại ngưỡng minh họa 0.5 | {result['f1']:.6f} |

Fit {fit_seconds:.1f}s; số vòng lặp {result['iterations']}; hội tụ. {len(features)} predictor trước encoding, {len(transformed_names)} cột sau preprocessing. Median, scaler và encoder được đối chiếu là chỉ fit train. Validation chỉ transform/predict. Các tập không giao nhau; ID đủ quần thể; split tái tạo được dù thứ tự input thay đổi.

Ngưỡng 0.5 chỉ để minh họa confusion matrix, chưa phải chính sách duyệt vay. Score là đầu ra mô hình chưa calibration; test không được chấm. ID thuộc test bị module demo chặn bằng PROFILE_RESERVED_FOR_FINAL_TEST.

Đã lưu pipeline + schema + metadata + dependencies, kiểm load/predict ở tiến trình mới và đối chiếu score reference trong tolerance 1e-10. Các hồ sơ reference đều thuộc validation. Chi tiết trong fresh_process_smoke.json.

Giới hạn dữ liệu lịch sử, đơn vị tiền/annuity, cohort kỳ trả và fairness vẫn theo policy H04/H05. Baseline chưa chứng minh công bằng, drift theo thời gian hoặc hiệu quả cho vay thực. Chưa ghi nhận TK/GK review chính thức. Bước tiếp theo: tích hợp baseline và so sánh LightGBM cùng split, không tuning trên test.
'''
    (reports / "BAO_CAO_BASELINE.md").write_text(text, encoding="utf-8")
    (project / "reports").mkdir(exist_ok=True)
    (project / "reports/LATEST_HK_BASELINE.txt").write_text(str(output) + "\n", encoding="utf-8")
    logger.info("PASS_BASELINE_VALIDATION_ONLY\nREPORT: %s", output)
    return final

def main():
    p = argparse.ArgumentParser(description="H06-H09: reproducible split, train-only preprocessing and LR baseline; never score test.")
    p.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--snapshot", type=Path)
    p.add_argument("--threads", type=int, default=2)
    p.add_argument("--max-iter", type=int, default=1000)
    p.add_argument("--execution-context", choices=["hk_machine", "assistant_reference"], default="hk_machine")
    a = p.parse_args()
    need(1 <= a.threads <= 8 and a.max_iter > 0, "Invalid threads/max-iter.")
    project = a.project.resolve()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    output = project / "artifacts" / ("hk_lr_baseline_" + stamp)
    (output / "reports").mkdir(parents=True, exist_ok=False)
    logger = logging.getLogger("finrisk_baseline")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    for handler in [logging.StreamHandler(sys.stdout), logging.FileHandler(output / "reports/run.log", encoding="utf-8")]:
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    try:
        run(a, project, output, logger)
        return 0
    except Exception as exc:
        write_json(output / "reports/failure.json", {"status": "FAIL", "error": f"{type(exc).__name__}: {exc}",
                   "traceback": traceback.format_exc(), "execution_context": a.execution_context, "test_scored_rows": 0})
        logger.exception("FAIL. Report: %s", output)
        return 1

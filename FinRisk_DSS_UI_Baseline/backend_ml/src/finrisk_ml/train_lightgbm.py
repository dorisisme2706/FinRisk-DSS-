from __future__ import annotations
import argparse
from datetime import datetime, timezone
import importlib.metadata
import json
import logging
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time
import traceback
import warnings
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from threadpoolctl import threadpool_limits
from .boosting import NativeCategoryEncoder, LOCKED_SPLIT_HASH, configurations, resolve_baseline, training_positive_weight
from .common import PARQUET_HASH, DATA_VERSION, feature_spec, need, now, read_json, sha256, write_json
from .preprocessing import FeatureFrameValidator
from .train_baseline import metrics

def run(args, project, output, logger):
    started = time.perf_counter()
    reports, modeldir, splits, contracts, candidates_dir = [output / p for p in ["reports", "model", "splits", "contracts", "candidate_models"]]
    for folder in [reports, modeldir, splits, contracts, candidates_dir]:
        folder.mkdir(parents=True, exist_ok=True)
    baseline, resolved_by = resolve_baseline(project, args.baseline_run)
    baseline_summary = read_json(baseline / "reports/run_summary.json")
    baseline_metrics = baseline_summary["validation_metrics"]
    snapshot = project / "data_snapshot/72780cc27cfe"
    features, numeric, categorical = feature_spec(snapshot)
    need(read_json(baseline / "contracts/model_features_v1.json")["feature_order"] == features, "Baseline predictors differ.")
    shutil.copy2(baseline / "splits/split_manifest.csv", splits / "split_manifest.csv")
    manifest = pd.read_csv(splits / "split_manifest.csv")
    need(sha256(splits / "split_manifest.csv") == LOCKED_SPLIT_HASH, "Locked split changed.")
    df = pd.read_parquet(snapshot / "data/feature_matrix.parquet").set_index("sk_id_curr", drop=False)
    need(len(df) == 307511 and df.index.is_unique and set(manifest["sk_id_curr"]) == set(df.index), "Split/base population mismatch.")
    need(manifest["sk_id_curr"].is_unique and set(manifest["split"]) == {"train", "validation", "test"}, "Invalid split membership.")
    ids = {name: manifest.loc[manifest["split"] == name, "sk_id_curr"].to_numpy() for name in ["train", "validation", "test"]}
    need({k: len(v) for k, v in ids.items()} == {"train": 215257, "validation": 46127, "test": 46127}, "Split sizes changed.")
    train, validation = df.loc[ids["train"]], df.loc[ids["validation"]]
    X_train, y_train = train[features], train["target"].astype(int)
    X_val, y_val = validation[features], validation["target"].astype(int)
    positive_weight = training_positive_weight(y_train)
    configs = configurations()
    common = {"boosting_type": "gbdt", "objective": "binary", "metric": "auc", "learning_rate": 0.05,
              "n_estimators": 600, "min_child_samples": 50, "reg_lambda": 1.0,
              "subsample": 0.8, "subsample_freq": 1, "colsample_bytree": 0.9,
              "random_state": 42, "n_jobs": args.threads, "verbosity": -1,
              "deterministic": True, "force_col_wise": True}
    write_json(reports / "experiment_plan.json", {
        "locked_before_fitting": True, "configs": configs, "common_parameters": common,
        "positive_weight_from_train": positive_weight, "early_stopping_rounds": 40,
        "early_stopping_metric": "validation AUC, unweighted", "validation_ranking": ["roc_auc descending", "AP descending", "configuration ID"],
        "final_model_selection": False, "split_hash": LOCKED_SPLIT_HASH, "test_scored_rows": 0,
    })
    logger.info("Baseline resolved via %s: %s", resolved_by, baseline)
    logger.info("Reusing locked split; fitting categorical mappings on %s train rows only.", len(train))
    schema = FeatureFrameValidator(features, numeric, categorical).fit(X_train)
    normalized_train = schema.transform(X_train)
    normalized_val = schema.transform(X_val)
    native = NativeCategoryEncoder(categorical).fit(normalized_train)
    train_native = native.transform(normalized_train)
    val_native = native.transform(normalized_val)
    need(native.fit_rows_ == len(train), "Category encoder fit population differs.")
    for col in categorical:
        need(set(native.categories_[col]) == set(train[col].dropna()), "Category mapping is not train-only.")
    need(train_native[numeric].isna().equals(normalized_train[numeric].isna()), "Numeric missing changed unexpectedly.")
    mappings_before = {c: list(v) for c, v in native.categories_.items()}
    audit = {"fit_population": "train_only", "fit_rows": len(train), "validation_scored_rows": len(validation), "test_scored_rows": 0,
             "native_missing": True, "learned_imputation": False, "scaling": False,
             "categorical_mappings_train_only_verified": True, "numeric_NaN_preserved": True,
             "early_stopping_population": "validation", "validation_used_for_model_selection": True,
             "unseen_validation_category_cells": {c: int((validation[c].notna() & ~validation[c].isin(native.categories_[c])).sum()) for c in categorical},
             "positive_weight_from": "y_train only", "positive_weight": positive_weight}
    write_json(reports / "fit_population_audit_h10.json", audit)
    write_json(contracts / "categorical_mapping_train.json", native.categories_)
    shutil.copy2(baseline / "contracts/model_features_v1.json", contracts / "model_features_v1.json")
    results = []
    predictions = {}
    for item in configs:
        config_id = item["id"]
        parameters = dict(common, num_leaves=item["num_leaves"], scale_pos_weight=positive_weight if item["positive_weighted"] else 1.0)
        folder = candidates_dir / config_id
        folder.mkdir()
        logger.info("Training %s; num_leaves=%s scale_pos_weight=%.6f.", config_id, item["num_leaves"], parameters["scale_pos_weight"])
        model = lgb.LGBMClassifier(**parameters)
        history = {}
        begin = time.perf_counter()
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            with threadpool_limits(limits=args.threads):
                model.fit(train_native, y_train, eval_set=[(val_native, y_val)], eval_metric="auc",
                          callbacks=[lgb.early_stopping(40, first_metric_only=True, verbose=False),
                                     lgb.log_evaluation(100), lgb.record_evaluation(history)])
        fit_seconds = time.perf_counter() - begin
        write_json(folder / "training_warnings.json", [{"category": w.category.__name__, "message": str(w.message)} for w in caught])
        pipeline = Pipeline([("schema", schema), ("native_categories", native), ("model", model)])
        with threadpool_limits(limits=args.threads):
            scores = pipeline.predict_proba(X_val)[:, list(pipeline.classes_).index(1)]
        need(np.isfinite(scores).all() and ((scores >= 0) & (scores <= 1)).all(), "Invalid LGBM scores.")
        direct = model.predict_proba(val_native, num_iteration=model.best_iteration_)[:, list(model.classes_).index(1)]
        need(np.allclose(scores, direct, atol=1e-12, rtol=1e-12), "Pipeline and best-iteration prediction disagree.")
        result = metrics(y_val, scores)
        result.update({"configuration": config_id, "model": "LightGBM", "positive_weighted": item["positive_weighted"],
                       "scale_pos_weight": parameters["scale_pos_weight"], "num_leaves": item["num_leaves"],
                       "fit_seconds": fit_seconds, "best_iteration": int(model.best_iteration_),
                       "calibration_status": "uncalibrated", "test_scored_rows": 0})
        need(result["best_iteration"] > 0, "Early stopping did not record best iteration.")
        write_json(folder / "metrics.json", result)
        write_json(folder / "parameters.json", parameters)
        write_json(folder / "eval_history.json", history)
        joblib.dump(pipeline, folder / "pipeline.joblib", compress=3)
        predictions[config_id] = scores
        results.append(result)
        pd.DataFrame(results).drop(columns=["confusion_matrix", "confusion_matrix_labels"]).to_csv(reports / "experiment_log.csv", index=False, lineterminator="\n")
        logger.info("%s PASS: AUC=%.6f AP=%.6f Brier=%.6f best_iteration=%s.", config_id, result["roc_auc"], result["average_precision"], result["brier"], result["best_iteration"])
    need(native.categories_ == mappings_before, "Validation/prediction modified categorical mappings.")
    best = sorted(results, key=lambda r: (-r["roc_auc"], -r["average_precision"], r["configuration"]))[0]
    best_id = best["configuration"]
    shutil.copy2(candidates_dir / best_id / "pipeline.joblib", modeldir / "pipeline.joblib")
    write_json(modeldir / "transformed_feature_names.json", features)
    metadata = {
        "model_version": "finrisk_" + best_id + "_v0.1", "feature_set_version": "core4_169_baseline_v1",
        "preprocessing_version": "native_categories_train_only_v1", "data_version": DATA_VERSION, "data_hash": PARQUET_HASH,
        "split_hash": LOCKED_SPLIT_HASH, "model_sha256": sha256(modeldir / "pipeline.joblib"),
        "calibration_status": "uncalibrated", "threshold_policy_version": None, "release_stage": "lightgbm_comparison_provisional",
        "test_locked": True, "predictor_count_before_encoding": 169, "transformed_feature_count": 169,
        "best_configuration": best_id, "best_iteration": best["best_iteration"], "selection_is_provisional": True,
        "python": sys.version, "platform": platform.platform(), "execution_context": args.execution_context, "created_utc": now(),
        "versions": {k: importlib.metadata.version(k) for k in ["pandas", "pyarrow", "numpy", "scikit-learn", "lightgbm", "joblib"]},
    }
    write_json(modeldir / "metadata.json", metadata)
    frozen = subprocess.run([sys.executable, "-m", "pip", "freeze"], check=True, capture_output=True, text=True)
    (modeldir / "requirements-lock.txt").write_text(frozen.stdout, encoding="utf-8")
    pd.DataFrame({"sk_id_curr": ids["validation"], "target": y_val.to_numpy(), "risk_score": predictions[best_id]}).to_parquet(reports / "validation_predictions_provisional.parquet", index=False)
    baseline_row = dict(baseline_metrics, configuration="logistic_regression_baseline", positive_weighted=False, scale_pos_weight=1.0, best_iteration=None)
    comparison = [baseline_row] + results
    keys = ["configuration", "roc_auc", "average_precision", "pr_auc_trapezoid", "brier", "gini", "ks", "precision", "recall", "f1", "fit_seconds", "positive_weighted", "scale_pos_weight", "best_iteration"]
    pd.DataFrame([{k: r.get(k) for k in keys} for r in comparison]).to_csv(reports / "model_comparison.csv", index=False, lineterminator="\n")
    overall = sorted(comparison, key=lambda r: (-r["roc_auc"], -r["average_precision"], r["configuration"]))[0]
    write_json(reports / "provisional_leader.json", {"best_lightgbm": best_id, "overall_validation_leader": overall["configuration"],
               "ranking": "ROC-AUC primary; AP tie-break; configuration ID final tie-break", "final_model_selected": False,
               "next_reviews": ["H11 comparison/group audit", "H12 calibration/threshold policy"], "test_scored_rows": 0})
    refs = []
    score_map = pd.Series(predictions[best_id], index=ids["validation"])
    for item in read_json(baseline / "reports/smoke_reference.json"):
        pid = item["sk_id_curr"]
        need(pid in score_map.index, "Reference profile is not validation.")
        refs.append({"case": item["case"], "sk_id_curr": pid, "split": "validation", "risk_score": float(score_map.loc[pid])})
    write_json(reports / "smoke_reference.json", refs)
    verifier = Path(__file__).resolve().parents[1] / "score_hk_profile.py"
    env = os.environ.copy()
    env.update({"OMP_NUM_THREADS": str(args.threads), "OPENBLAS_NUM_THREADS": str(args.threads), "MKL_NUM_THREADS": str(args.threads)})
    fresh = subprocess.run([sys.executable, str(verifier), "--project", str(project), "--run", str(output), "--verify-references"],
                           capture_output=True, text=True, env=env)
    need(fresh.returncode == 0, "Fresh-process LGBM verification failed: " + fresh.stdout + fresh.stderr)
    fresh_data = json.loads(fresh.stdout)
    need(fresh_data["status"] == "PASS", "Fresh-process LGBM smoke failed.")
    write_json(reports / "fresh_process_smoke_h10.json", fresh_data)
    need(sha256(snapshot / "data/feature_matrix.parquet") == PARQUET_HASH and sha256(baseline / "splits/split_manifest.csv") == LOCKED_SPLIT_HASH, "Original data or baseline split changed.")
    summary = {
        "status": "PASS_LIGHTGBM_COMPARISON_VALIDATION_ONLY", "task": "H10", "execution_context": args.execution_context,
        "run": str(output), "baseline_run": str(baseline), "baseline_resolved_by": resolved_by, "completed_utc": now(),
        "runtime_seconds": time.perf_counter() - started, "split_hash": LOCKED_SPLIT_HASH, "data_hash": PARQUET_HASH,
        "fit_rows": len(train), "validation_rows": len(validation), "test_reserved_rows": len(ids["test"]), "test_scored_rows": 0,
        "configurations_completed": len(results), "baseline_metrics": baseline_metrics, "experiments": results,
        "provisional_best_lightgbm": best_id, "overall_validation_leader": overall["configuration"], "final_model_selected": False,
        "formal_TK_GK_review": "NOT_RECORDED", "next_task": "H11: comparison and group audit; H12 later calibrates and selects threshold",
    }
    write_json(reports / "run_summary_h10.json", summary)
    table = "\n".join(f"| {r['configuration']} | {r['roc_auc']:.6f} | {r['average_precision']:.6f} | {r['brier']:.6f} | {r['recall']:.6f} |" for r in comparison)
    report = f'''# H10 — so sánh LightGBM và Logistic Regression

Bối cảnh thực chạy: {args.execution_context}. Cùng 169 predictor và split {LOCKED_SPLIT_HASH}. Train {len(train)}; validation {len(validation)}; test {len(ids['test'])} giữ riêng, chưa chấm.

| Cấu hình | ROC-AUC | AP | Brier | Recall tại 0.5 |
|---|---:|---:|---:|---:|
{table}

Ứng viên LightGBM dẫn đầu validation theo quy tắc đã ghi trước: {best_id}. Dẫn đầu bảng tổng hợp: {overall['configuration']}. Đây là dẫn đầu tạm thời, chưa là model cuối.

Chỉ mappings categorical học từ train; numeric NaN giữ cho native missing. Early stopping theo AUC trên validation, tối đa 600 cây, patience 40. Trọng số dương = số âm/số dương trong train, không học từ validation/test. Không kết hợp thêm is_unbalance/class_weight. Tất cả xác suất hiện chưa calibration.

Trọng số lớp có thể làm score thay đổi thang và calibration kém hơn; recall tại 0.5 cao hơn không tự chứng minh model tốt hơn. AP và PR-AUC hình thang được báo riêng. Brier nhỏ hơn là tốt hơn cho sai số xác suất, nhưng calibration vẫn cần đánh giá riêng. Chưa chốt threshold nghiệp vụ, chưa dùng test chọn mô hình.

Model tạm thời đã lưu cùng mappings và schema, load trong tiến trình mới và score reference khớp. ID test bị chặn ở module demo. H11 cần group audit và quyết định cuối; H12 calibration/threshold; GK/TK review chưa được ghi nhận.
'''
    (reports / "BAO_CAO_H10.md").write_text(report, encoding="utf-8")
    (project / "reports/LATEST_HK_LIGHTGBM.txt").write_text(str(output) + "\n", encoding="utf-8")
    logger.info("PASS_LIGHTGBM_COMPARISON_VALIDATION_ONLY\nREPORT: %s", output)
    return summary

def main():
    p = argparse.ArgumentParser(description="Compare four fixed LGBM configurations with LR on the original locked split.")
    p.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--baseline-run", type=Path)
    p.add_argument("--threads", type=int, default=2)
    p.add_argument("--execution-context", choices=["hk_machine", "assistant_reference"], default="hk_machine")
    args = p.parse_args()
    need(1 <= args.threads <= 8, "Threads must be 1..8.")
    project = args.project.resolve()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    output = project / "artifacts" / ("hk_lightgbm_" + stamp)
    (output / "reports").mkdir(parents=True, exist_ok=False)
    logger = logging.getLogger("finrisk_lightgbm")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    for handler in [logging.StreamHandler(sys.stdout), logging.FileHandler(output / "reports/run.log", encoding="utf-8")]:
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    try:
        run(args, project, output, logger)
        return 0
    except Exception as exc:
        write_json(output / "reports/failure.json", {"status": "FAIL", "error": f"{type(exc).__name__}: {exc}",
                   "traceback": traceback.format_exc(), "execution_context": args.execution_context, "test_scored_rows": 0})
        logger.exception("H10 FAIL. Report: %s", output)
        return 1

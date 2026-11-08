from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import time
import traceback
import warnings
import zipfile
import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.exceptions import ConvergenceWarning
from sklearn.model_selection import StratifiedKFold
from threadpoolctl import threadpool_limits
from .common import PARQUET_HASH, need, now, read_json, sha256, write_json
from .boosting import LOCKED_SPLIT_HASH
from .audit_groups import group_metrics, group_labels, load_model
from .calibration import (LogitSigmoidCalibrator, CalibratedRiskPipeline, probability_metrics,
                          reliability_bins, choose_probability_variant, choose_demo_threshold)


def id_digest(ids):
    return hashlib.sha256("\n".join(map(str, sorted(map(int, ids)))).encode("ascii")).hexdigest()


def run(project, h11, output, threads, context):
    started = time.perf_counter()
    reports, models, splits, contracts = [output/x for x in ["reports", "model", "splits", "contracts"]]
    for path in [reports, models, splits, contracts]:
        path.mkdir(parents=True, exist_ok=True)
    s11 = read_json(h11/"reports/run_summary_h11.json")
    need(s11["status"] == "PASS_H11_DESCRIPTIVE_AUDIT" and not s11["fit_performed"] and s11["test_scored_rows"] == 0, "H11 prerequisites not met.")
    selection = read_json(h11/"reports/selection_review.json")
    need(s11["selection"] == selection and selection["candidate_for_H12"] == "LightGBM_H10_leader", "H11 candidate changed: manual investigation needed.")
    h10 = Path(s11["h10_run"])
    s10 = read_json(h10/"reports/run_summary_h10.json")
    need(s10["status"] == "PASS_LIGHTGBM_COMPARISON_VALIDATION_ONLY" and s10["test_scored_rows"] == 0, "H10 not PASS.")
    snapshot = project/"data_snapshot/72780cc27cfe"
    need(sha256(snapshot/"data/feature_matrix.parquet") == PARQUET_HASH == s11["data_hash"] == s10["data_hash"], "DATA_VERSION_MISMATCH")
    shutil.copy2(h10/"splits/split_manifest.csv", splits/"split_manifest.csv")
    need(sha256(splits/"split_manifest.csv") == LOCKED_SPLIT_HASH == s11["split_hash"], "SPLIT_VERSION_MISMATCH")
    base, features, meta = load_model(h10, LOCKED_SPLIT_HASH, PARQUET_HASH)
    for name, version in meta["versions"].items():
        need(importlib.metadata.version(name) == version, "Environment differs from H10: "+name)
    need(len(features) == 169 and not set(features) & {"target", "sk_id_curr", "code_gender", "days_birth"}, "Forbidden predictors.")
    manifest = pd.read_csv(splits/"split_manifest.csv")
    ids = {k: manifest.loc[manifest["split"].eq(k), "sk_id_curr"].to_numpy() for k in ["train", "validation", "test"]}
    need({k: len(v) for k, v in ids.items()} == {"train": 215257, "validation": 46127, "test": 46127} and manifest["sk_id_curr"].is_unique, "Split population changed.")
    frame = pd.read_parquet(snapshot/"data/feature_matrix.parquet").set_index("sk_id_curr", drop=False)
    train, val = frame.loc[ids["train"]], frame.loc[ids["validation"]]
    X, y = train[features], train["target"].astype(int).to_numpy()
    yv = val["target"].astype(int).to_numpy()
    best_iteration = int(meta["best_iteration"])
    plan = {"declared_before_H12_fit": True, "base_configuration": meta["best_configuration"], "fixed_trees": best_iteration,
            "folds": 3, "cv": "StratifiedKFold(shuffle=True, random_state=42) inside original train only",
            "fold_preprocessing": "Schema and native categorical mappings refit on fold training rows only; unknown category -> NaN",
            "calibration": "Logistic recalibration: sigmoid(intercept + slope*logit(p_raw)); C=1e6, no class weights",
            "difference_from_sklearn_sigmoid": "Explicit logit input, not sigmoid on raw probability; no Platt target smoothing",
            "selection": "Choose calibration only if validation Brier AND log loss each improve >1e-8 and ROC-AUC/AP do not drop >1e-6; otherwise retain raw",
            "threshold": "Max F1 on validation; ties within 1e-12 choose highest threshold; >= comparator",
            "threshold_scope": "Demo review recommendation, no lending approval/rejection, no monetary cost assumptions",
            "group_policy": "One common threshold, no protected-group thresholds; rerun same 5 marginal audits",
            "test_scored_rows": 0, "new_hyperparameter_search": False,
            "development_limit": "H10 hyperparameters/early-stop iteration selected using validation; OOF is conditional on this development choice, not a nested unbiased benchmark."}
    write_json(reports/"experiment_plan_h12.json", plan)
    print(f"H12: 3-fold calibration inside TRAIN only; {best_iteration} fixed trees; no early stopping or test scoring.", flush=True)
    oof, assigned = np.full(len(train), np.nan), np.zeros(len(train), dtype=int)
    fold_assignment = np.full(len(train), -1, dtype=int)
    fold_audit = []
    for fold, (fit_idx, held_idx) in enumerate(StratifiedKFold(3, shuffle=True, random_state=42).split(X, y)):
        begin = time.perf_counter()
        fit_ids, held_ids = set(map(int, ids["train"][fit_idx])), set(map(int, ids["train"][held_idx]))
        need(not fit_ids & held_ids and fit_ids | held_ids == set(map(int, ids["train"])), "OOF fold overlap/population error.")
        fold_model = clone(base)
        fold_model.set_params(model__n_estimators=best_iteration, model__n_jobs=threads)
        with threadpool_limits(limits=threads):
            fold_model.fit(X.iloc[fit_idx], y[fit_idx])
            p = fold_model.predict_proba(X.iloc[held_idx])[:, list(fold_model.classes_).index(1)]
        encoder = fold_model.named_steps["native_categories"]
        need(encoder.fit_rows_ == len(fit_idx), "Fold encoder fit row mismatch.")
        for col in encoder.categorical:
            need(set(encoder.categories_[col]) == set(X.iloc[fit_idx][col].dropna()), "Fold categorical mapping leakage.")
        normalized = fold_model.named_steps["schema"].transform(X.iloc[held_idx])
        encoded = encoder.transform(normalized)
        numeric = fold_model.named_steps["schema"].numeric
        need(encoded[numeric].isna().equals(normalized[numeric].isna()), "Numeric missing unexpectedly changed.")
        need(fold_model.named_steps["model"].n_estimators_ == best_iteration, "Fixed tree count changed.")
        oof[held_idx] = p
        assigned[held_idx] += 1
        fold_assignment[held_idx] = fold
        mapping_hash = hashlib.sha256(json.dumps(encoder.categories_, sort_keys=True).encode()).hexdigest()
        fold_audit.append({"fold": fold, "fit_rows": len(fit_idx), "held_out_rows": len(held_idx),
                           "fit_positive": int(y[fit_idx].sum()), "held_out_positive": int(y[held_idx].sum()),
                           "fit_id_sha256": id_digest(fit_ids), "held_out_id_sha256": id_digest(held_ids),
                           "disjoint_verified": True, "encoder_fit_rows": encoder.fit_rows_, "categories_fit_fold_only_verified": True,
                           "numeric_NaN_preserved": True, "mapping_sha256": mapping_hash,
                           "actual_trees": best_iteration, "validation_used_in_fit": False, "test_used_in_fit_or_predict": False,
                           "fit_predict_seconds": time.perf_counter()-begin})
        write_json(reports/"fold_fit_audit.json", fold_audit)
        print(f"Fold {fold+1}/3 PASS: fit {len(fit_idx)}, out-of-fold predict {len(held_idx)}.", flush=True)
        del fold_model
    need(np.isfinite(oof).all() and (assigned == 1).all(), "OOF missing/duplicate predictions.")
    pd.DataFrame({"sk_id_curr": ids["train"], "fold": fold_assignment}).to_csv(splits/"calibration_folds_train_only.csv", index=False, lineterminator="\n")
    pd.DataFrame({"sk_id_curr": ids["train"], "target": y, "oof_risk_score": oof}).to_parquet(reports/"train_oof_predictions.parquet", index=False)
    with warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        calibrator = LogitSigmoidCalibrator().fit(oof, y)
    need(calibrator.fit_rows_ == 215257, "Calibrator fit population changed.")
    joblib.dump(calibrator, models/"candidate_logit_calibrator.joblib", compress=3)
    candidate = CalibratedRiskPipeline(base, calibrator)
    with threadpool_limits(limits=threads):
        raw = base.predict_proba(val[features])[:, list(base.classes_).index(1)]
        cal = candidate.predict_proba(val[features])[:, 1]
    expected = read_json(h11/"reports/overall_reloaded_metrics.json")["LightGBM_H10_leader"]
    comparisons = {"raw_h10": probability_metrics(yv, raw), "oof_logit_sigmoid": probability_metrics(yv, cal)}
    need(abs(comparisons["raw_h10"]["roc_auc"]-expected["roc_auc"]) < 1e-10 and abs(comparisons["raw_h10"]["brier"]-expected["brier"]) < 1e-10, "H11/H12 raw model predictions differ.")
    reliability = []
    for variant, p in [("raw_h10", raw), ("oof_logit_sigmoid", cal)]:
        bins, ece = reliability_bins(yv, p, variant)
        reliability.extend(bins)
        comparisons[variant]["ece_10_equal_width_descriptive"] = ece
    chosen = choose_probability_variant(comparisons["raw_h10"], comparisons["oof_logit_sigmoid"])
    chosen_model, chosen_p = (candidate, cal) if chosen == "oof_logit_sigmoid" else (base, raw)
    write_json(reports/"calibration_comparison.json", comparisons)
    pd.DataFrame([dict(variant=k, **v) for k, v in comparisons.items()]).to_csv(reports/"calibration_comparison.csv", index=False, lineterminator="\n")
    pd.DataFrame(reliability).to_csv(reports/"reliability_bins.csv", index=False, lineterminator="\n")
    decision, table = choose_demo_threshold(yv, chosen_p)
    table.to_csv(reports/"threshold_candidates_validation.csv", index=False, lineterminator="\n")
    policy = {"threshold_policy_version": "finrisk_demo_f1_validation_v1", "scope": "demo_only_pending_review",
              "selected_probability_variant": chosen, "threshold": decision["threshold"], "comparator": ">=",
              "objective": "maximum validation F1; ties within 1e-12 use highest threshold", "selection_population": "validation",
              "validation_rows": len(val), "validation_operating_point": decision,
              "business_costs_provided": False, "business_optimality_claimed": False,
              "action_if_above": "recommend_manual_review", "action_if_below": "no_review_signal_under_demo_policy",
              "automatic_approval_or_rejection": False, "group_specific_thresholds": False,
              "test_used": False, "formal_TK_GK_review": "NOT_RECORDED"}
    write_json(models/"threshold_policy.json", policy)
    # Bounded alternative operating points, descriptive only; not adaptive extra tuning.
    alternatives = []
    for target_recall in [.2, .4, .6, .8]:
        point = table.loc[table["recall"] >= target_recall].sort_values("threshold", ascending=False).iloc[0].to_dict()
        alternatives.append(dict(target_recall=target_recall, **point))
    write_json(reports/"recall_scenarios.json", alternatives)
    group_records = []
    for label, p, t in [("raw_h10_at_0.5", raw, .5), ("selected_at_0.5", chosen_p, .5), ("selected_at_demo_threshold", chosen_p, decision["threshold"])]:
        for dimension, labels in group_labels(val).items():
            for group in sorted(labels.unique()):
                mask = labels.eq(group).to_numpy()
                group_records.append(dict(variant=label, dimension=dimension, group=str(group), **group_metrics(yv[mask], p[mask], threshold=t)))
    pd.DataFrame(group_records).to_csv(reports/"group_audit_h12.csv", index=False, encoding="utf-8-sig", lineterminator="\n")
    joblib.dump(chosen_model, models/"pipeline.joblib", compress=3)
    shutil.copy2(h10/"contracts/model_features_v1.json", contracts/"model_features_v1.json")
    shutil.copy2(h10/"model/requirements-lock.txt", models/"requirements-lock.txt")
    metadata = dict(meta, model_version="finrisk_lgbm_h12_demo_v0.2", model_sha256=sha256(models/"pipeline.joblib"),
                    calibration_status="oof_logit_sigmoid_train_only" if chosen == "oof_logit_sigmoid" else "uncalibrated_candidate_not_selected",
                    threshold_policy_version=policy["threshold_policy_version"], threshold_policy_sha256=sha256(models/"threshold_policy.json"),
                    release_stage="h12_demo_pending_review", selection_is_provisional=True, test_locked=True, created_utc=now(),
                    execution_context=context, source_h10_model_sha256=meta["model_sha256"], selected_probability_variant=chosen,
                    python=sys.version, platform=platform.platform(),
                    calibration_method_tested="logistic_recalibration_on_logit_OOF", calibration_fit_rows=215257)
    write_json(models/"metadata.json", metadata)
    audit = {"base_model_source": str(h10), "base_model_retrained_on_all_train": False, "base_model_unchanged": True,
             "base_fit_population": "original_train_only", "oof_fit_population": "original_train_only", "oof_rows": len(train),
             "oof_fold_count": 3, "each_train_row_predicted_once_out_of_fold": True, "calibrator_fit_rows": len(train),
             "validation_fit_rows": 0, "test_fit_or_scored_rows": 0, "validation_scored_rows": len(val),
             "validation_used_for_calibration_selection_and_threshold": True, "folds": fold_audit,
             "calibrator_slope": calibrator.slope_, "calibrator_intercept": calibrator.intercept_,
             "calibrator_formula": "sigmoid(intercept + slope * logit(clip(raw_p,1e-12,1-1e-12)))",
             "limitation": "Fold models see 2/3 of train; deployed H10 base sees full train. Validation selects variant; final test remains required.",
             "validation_not_independent_final_benchmark": True}
    write_json(reports/"fit_population_audit_h12.json", audit)
    pd.DataFrame({"sk_id_curr": ids["validation"], "target": yv, "raw_h10": raw, "oof_logit_sigmoid": cal, "selected_score": chosen_p}).to_parquet(reports/"validation_predictions_h12.parquet", index=False)
    scoremap = pd.Series(chosen_p, index=ids["validation"])
    refs = [dict(item, risk_score=float(scoremap.loc[item["sk_id_curr"]])) for item in read_json(h10/"reports/smoke_reference.json")]
    write_json(reports/"smoke_reference.json", refs)
    verifier = Path(__file__).resolve().parents[1]/"score_hk_profile.py"
    env = dict(os.environ, OMP_NUM_THREADS=str(threads), OPENBLAS_NUM_THREADS=str(threads), MKL_NUM_THREADS=str(threads))
    fresh = subprocess.run([sys.executable, str(verifier), "--project", str(project), "--run", str(output), "--verify-references"], capture_output=True, text=True, env=env)
    need(fresh.returncode == 0, "Fresh process H12 failed: "+fresh.stdout+fresh.stderr)
    smoke = json.loads(fresh.stdout)
    need(smoke["status"] == "PASS" and smoke["test_profiles_scored"] == 0, "H12 smoke not PASS.")
    for item in smoke["references"]:
        actual = item["actual"]
        need(actual["threshold_policy_version"] == policy["threshold_policy_version"] and actual["decision_threshold"] == policy["threshold"], "Policy missing from inference.")
        need(actual["review_recommended"] == (actual["risk_score"] >= policy["threshold"]) and actual["calibration_status"] == metadata["calibration_status"], "Inference policy/calibration mismatch.")
    write_json(reports/"fresh_process_smoke_h12.json", smoke)
    need(sha256(snapshot/"data/feature_matrix.parquet") == PARQUET_HASH and sha256(h10/"model/pipeline.joblib") == meta["model_sha256"], "Source data/model changed.")
    summary = {"status": "PASS_H12_CALIBRATION_THRESHOLD_VALIDATION_ONLY", "task": "H12", "execution_context": context,
               "run": str(output), "h11_run": str(h11), "h10_run": str(h10), "completed_utc": now(),
               "runtime_seconds": time.perf_counter()-started, "data_hash": PARQUET_HASH, "split_hash": LOCKED_SPLIT_HASH,
               "train_rows": len(train), "validation_rows": len(val), "test_reserved_rows": len(ids["test"]), "test_scored_rows": 0,
               "selected_probability_variant": chosen, "calibration_status": metadata["calibration_status"], "calibration_comparison": comparisons,
               "demo_policy": policy, "group_audit_rows": len(group_records), "fresh_process_status": smoke["status"],
               "final_model_selected": False, "fairness_certified": False, "formal_TK_GK_review": "NOT_RECORDED",
               "next_task": "H13 integration/explanations and review; final test stays sealed until protocol lock"}
    write_json(reports/"run_summary_h12.json", summary)
    report = f'''# H12 — hiệu chỉnh xác suất và ngưỡng demo

Bối cảnh thực chạy: {context}. H11 PASS; dữ liệu và split cố định. Train 215.257, validation 46.127, test 46.127 giữ riêng.

## Quy trình đã chạy
1. Clone pipeline H10 thành ba mô hình fold. Mỗi fold học schema/mappings trên 2/3 train, dự đoán 1/3 còn lại. Không early stopping, giữ {best_iteration} cây đã chọn ở H10. Không học mappings từ validation hay fold giữ lại.
2. Mỗi hồ sơ train có đúng một dự đoán ngoài fold. Fit một logistic recalibrator trên logit điểm OOF, không trọng số lớp: sigmoid(a + b*logit(p)). Đây là logit recalibration, không giống hoàn toàn method sigmoid-on-probability của CalibratedClassifierCV và không dùng Platt target smoothing.
3. Giữ nguyên mô hình H10 full-train. So sánh raw và hiệu chỉnh trên validation. Chỉ chọn hiệu chỉnh nếu Brier và log loss đều cải thiện theo quy tắc experiment_plan_h12.json. Không bắt buộc chọn hiệu chỉnh nếu kết quả xấu hơn.
4. Biến thể chọn: **{chosen}**. Chọn ngưỡng tối đa F1 trên validation, hòa thì chọn ngưỡng lớn nhất. Ngưỡng demo **{decision['threshold']:.9f}**; precision {decision['precision']:.4f}, recall {decision['recall']:.4f}, F1 {decision['f1']:.4f}, tỷ lệ gợi ý review {decision['review_fraction']:.4f}.
5. Audit lại nhóm ở 0.5 và ngưỡng mới. Lưu model, policy riêng có hash, rồi load tiến trình mới để kiểm tra ba ID validation và chặn test/ID sai. Không chấm test.

## Diễn giải đúng
ROC-AUC/AP đo thứ tự; Brier/log loss đánh giá sai số dự báo xác suất và còn chịu ảnh hưởng discrimination, không phải chứng nhận calibration. Reliability bins/ECE 10 khoảng chỉ mô tả, phụ thuộc chia bin. Hiệu chỉnh không bảo đảm xác suất đúng cho từng cá nhân. Công thức tăng đơn điệu giữ gần nguyên ranking, trong khi ngưỡng thay đổi số hồ sơ cần review.

F1 = 2*precision*recall/(precision+recall), không đưa tiền lãi, thiệt hại hay năng lực chuyên viên vào tối ưu. Nhóm chưa có chi phí nghiệp vụ nên đây chỉ là điểm vận hành demo. Tín hiệu dưới ngưỡng không phải phê duyệt vay; trên ngưỡng chỉ đề nghị người đánh giá xem xét. Không tạo ngưỡng riêng theo tuổi/giới.

## Giới hạn và nghiệm thu
Validation đã dùng chọn cấu hình/số cây H10, biến thể calibration và threshold H12; các chỉ số validation là số phát triển, có thể lạc quan. OOF trong train có điều kiện trên cấu hình đã phát triển, không phải nested CV. Fold chỉ thấy 2/3 train, trong khi base triển khai thấy full train; sai khác này được đánh giá trên validation nhưng chưa có kết luận từ test. Random stratified split do thời gian ẩn danh không kiểm chứng temporal drift. Audit nhóm là mô tả biên, không chứng nhận fairness.

Kết quả kỹ thuật PASS chưa là nghiệm thu TK/GK. Không có model cuối hoặc quyền mở test tự động. Dữ liệu/mô hình cũ không bị ghi đè. Xem run_summary_h12.json, calibration_comparison.json, fit_population_audit_h12.json, threshold_policy.json và group_audit_h12.csv.
'''
    (reports/"BAO_CAO_H12.md").write_text(report, encoding="utf-8")
    with zipfile.ZipFile(reports/"H12_BANG_CHUNG.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for filename in ["run_summary_h12.json", "calibration_comparison.json", "fit_population_audit_h12.json",
                         "fresh_process_smoke_h12.json", "group_audit_h12.csv", "experiment_plan_h12.json", "reliability_bins.csv", "BAO_CAO_H12.md"]:
            z.write(reports/filename, filename)
        z.write(models/"threshold_policy.json", "threshold_policy.json")
    (project/"reports/LATEST_HK_H12.txt").write_text(str(output)+"\n", encoding="utf-8")
    print("PASS_H12_CALIBRATION_THRESHOLD_VALIDATION_ONLY\nREPORT: "+str(output), flush=True)
    return summary


def main():
    p = argparse.ArgumentParser(description="H12 train-only OOF recalibration and validation-only demo threshold")
    p.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--h11-run", type=Path)
    p.add_argument("--threads", type=int, default=2)
    p.add_argument("--execution-context", choices=["hk_machine", "assistant_reference"], default="hk_machine")
    a = p.parse_args()
    project = a.project.resolve()
    output = project/"artifacts"/("hk_h12_calibration_"+datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f"))
    (output/"reports").mkdir(parents=True)
    try:
        need(1 <= a.threads <= 8, "Threads must be 1..8.")
        h11 = a.h11_run or Path((project/"reports/LATEST_HK_H11.txt").read_text(encoding="utf-8-sig").strip())
        run(project, h11, output, a.threads, a.execution_context)
        return 0
    except Exception as exc:
        write_json(output/"reports/failure.json", {"status": "FAIL", "error": str(exc), "traceback": traceback.format_exc(), "execution_context": a.execution_context})
        print("H12 FAIL: "+str(exc)+"\nREPORT: "+str(output), file=sys.stderr)
        return 1

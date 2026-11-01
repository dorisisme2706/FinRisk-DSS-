from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import traceback
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from threadpoolctl import threadpool_limits
from .common import PARQUET_HASH, need, now, read_json, sha256, write_json
from .boosting import LOCKED_SPLIT_HASH, validate_baseline

def wilson(successes, total):
    if total == 0:
        return None, None
    z = 1.959963984540054
    p = successes / total
    denominator = 1 + z*z/total
    center = (p + z*z/(2*total))/denominator
    margin = z*math.sqrt(p*(1-p)/total + z*z/(4*total*total))/denominator
    low = 0. if successes == 0 else max(0., center-margin)
    high = 1. if successes == total else min(1., center+margin)
    return low, high

def group_metrics(y, probability, threshold=0.5):
    y, probability = np.asarray(y, dtype=int), np.asarray(probability, dtype=float)
    need(len(y) > 0 and len(y) == len(probability), "Invalid group population.")
    need(set(np.unique(y)) <= {0, 1} and np.isfinite(probability).all() and ((probability >= 0) & (probability <= 1)).all(), "Invalid group values.")
    need(np.isfinite(threshold) and 0 <= threshold <= 1, "Invalid decision threshold.")
    pred = probability >= threshold
    pos, neg = int((y == 1).sum()), int((y == 0).sum())
    tp, fp = int(((y == 1) & pred).sum()), int(((y == 0) & pred).sum())
    fn, tn = pos-tp, neg-fp
    tpr_lo, tpr_hi = wilson(tp, pos)
    fpr_lo, fpr_hi = wilson(fp, neg)
    both = pos > 0 and neg > 0
    return {"rows": len(y), "positive_count": pos, "negative_count": neg, "positive_rate": pos/len(y),
            "roc_auc": float(roc_auc_score(y, probability)) if both else None,
            "average_precision": float(average_precision_score(y, probability)) if both else None,
            "brier": float(brier_score_loss(y, probability)), "mean_score": float(probability.mean()),
            "threshold": float(threshold), "predicted_positive_rate": float(pred.mean()), "tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "recall_tpr": tp/pos if pos else None, "false_positive_rate": fp/neg if neg else None,
            "precision": tp/(tp+fp) if tp+fp else None,
            "tpr_wilson95_low": tpr_lo, "tpr_wilson95_high": tpr_hi,
            "fpr_wilson95_low": fpr_lo, "fpr_wilson95_high": fpr_hi,
            "ranking_metrics_status": "both_classes_present" if both else "undefined_single_class_group"}

def group_labels(frame):
    age = -frame["days_birth"].astype(float)/365.25
    bins = pd.cut(age, bins=[0, 25, 35, 45, 55, 65, np.inf], right=False,
                  labels=["under_25", "25_to_34", "35_to_44", "45_to_54", "55_to_64", "65_plus"])
    result = {"code_gender": frame["code_gender"].astype(object).where(frame["code_gender"].notna(), "UNKNOWN"),
              "age_approx": bins.astype(object).where(bins.notna(), "UNKNOWN")}
    for col in ["bureau_history_observed", "previous_history_observed", "installments_history_observed"]:
        need(frame[col].isin([0, 1]).all(), "Invalid history flag " + col)
        result[col] = pd.Series(np.where(frame[col].eq(1), "observed", "not_observed"), index=frame.index)
    return result

def load_model(run, split_hash, data_hash):
    meta = read_json(run / "model/metadata.json")
    need(meta["data_hash"] == data_hash and meta["split_hash"] == split_hash, "Model version/split mismatch.")
    need(sha256(run / "model/pipeline.joblib") == meta["model_sha256"], "Model checksum mismatch.")
    features = read_json(run / "contracts/model_features_v1.json")["feature_order"]
    model = joblib.load(run / "model/pipeline.joblib")
    need(features == model.named_steps["schema"].features, "Feature schema mismatch.")
    return model, features, meta

def execute(project, h10, output, context):
    print("Checking H10, LR baseline and original split...", flush=True)
    S = read_json(h10 / "reports/run_summary_h10.json")
    need(S["status"] == "PASS_LIGHTGBM_COMPARISON_VALIDATION_ONLY" and S["test_scored_rows"] == 0 and S["configurations_completed"] == 4, "H10 not accepted technically.")
    baseline = Path(S["baseline_run"])
    validate_baseline(baseline)
    snapshot = project / "data_snapshot/72780cc27cfe/data/feature_matrix.parquet"
    need(sha256(snapshot) == S["data_hash"] == PARQUET_HASH, "DATA_VERSION_MISMATCH")
    need(sha256(h10 / "splits/split_manifest.csv") == S["split_hash"] == LOCKED_SPLIT_HASH, "SPLIT_VERSION_MISMATCH")
    manifest = pd.read_csv(h10 / "splits/split_manifest.csv")
    ids = manifest.loc[manifest["split"] == "validation", "sk_id_curr"].to_numpy()
    need(len(ids) == len(set(ids)) == 46127, "Validation IDs changed.")
    frame = pd.read_parquet(snapshot).set_index("sk_id_curr", drop=False).loc[ids]
    labels = group_labels(frame)
    rows = []
    globals_ = {}
    for label, path in [("LogisticRegression", baseline), ("LightGBM_H10_leader", h10)]:
        model, features, meta = load_model(path, LOCKED_SPLIT_HASH, PARQUET_HASH)
        need(len(features) == 169 and not set(features) & {"sk_id_curr", "target", "code_gender", "days_birth"}, "Forbidden predictors.")
        with threadpool_limits(limits=2):
            probability = model.predict_proba(frame[features])[:, list(model.classes_).index(1)]
        overall = group_metrics(frame["target"], probability)
        expected = S["baseline_metrics"] if label == "LogisticRegression" else next(x for x in S["experiments"] if x["configuration"] == S["provisional_best_lightgbm"])
        need(abs(overall["roc_auc"] - expected["roc_auc"]) < 1e-10 and abs(overall["average_precision"] - expected["average_precision"]) < 1e-10,
             "Reloaded metrics differ from H10; audit stopped.")
        globals_[label] = dict(overall, model_version=meta["model_version"])
        for dimension, series in labels.items():
            for group in sorted(series.unique()):
                mask = series.eq(group).to_numpy()
                record = group_metrics(frame["target"].to_numpy()[mask], probability[mask])
                rows.append(dict(model=label, dimension=dimension, group=str(group), **record))
            need(sum(r["rows"] for r in rows if r["model"] == label and r["dimension"] == dimension) == len(frame), "Group coverage changed.")
        print(label + ": group audit done on validation only.", flush=True)
    reports = output / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(reports / "group_audit.csv", index=False, encoding="utf-8-sig", lineterminator="\n")
    write_json(reports / "group_audit.json", rows)
    write_json(reports / "overall_reloaded_metrics.json", globals_)
    write_json(reports / "audit_protocol.json", {
        "population": "validation_only", "rows": 46127, "models_audited": ["LR", "H10 best LightGBM"],
        "dimensions": list(labels), "age_definition": "approximate -DAYS_BIRTH/365.25; fixed left-closed bins",
        "threshold": 0.5, "threshold_is_illustrative": True,
        "null_policy": "Single-class groups have null ROC-AUC/AP; zero denominators produce null rates, not invented zeros.",
        "intervals": "Wilson 95% descriptive intervals for TPR/FPR; no multiple-testing or fairness certification claim.",
        "fit_performed": False, "test_scored_rows": 0,
        "limitations": ["Separate marginal groups; no intersectional or causal audit.", "Group AP depends on positive prevalence.",
                        "No group-specific thresholds or feature exclusion chosen from these results.", "Other LGBM configs compared globally in H10, not each audited here."]})
    recommendation = "LightGBM_H10_leader" if globals_["LightGBM_H10_leader"]["roc_auc"] > globals_["LogisticRegression"]["roc_auc"] else "LogisticRegression"
    selection = {"candidate_for_H12": recommendation, "status": "RECOMMENDED_FOR_CALIBRATION_PENDING_REVIEW",
                 "reason": "H10 global ranking and descriptive H11 finalist audit; no predefined fairness pass/fail threshold exists.",
                 "final_model_selected": False, "fairness_certified": False, "TK_GK_signoff": "NOT_RECORDED"}
    write_json(reports / "selection_review.json", selection)
    summary = {"status": "PASS_H11_DESCRIPTIVE_AUDIT", "task": "H11", "execution_context": context,
               "run": str(output), "h10_run": str(h10), "baseline_run": str(baseline), "completed_utc": now(),
               "data_hash": PARQUET_HASH, "split_hash": LOCKED_SPLIT_HASH, "validation_rows": 46127,
               "group_metric_rows": len(rows), "models_audited": 2, "dimensions": len(labels),
               "test_scored_rows": 0, "fit_performed": False, "selection": selection, "next_task": "H12 calibration and threshold policy"}
    write_json(reports / "run_summary_h11.json", summary)
    table = "\n".join(f"| {r['model']} | {r['dimension']} | {r['group']} | {r['rows']} | {r['positive_count']} | {r['recall_tpr'] if r['recall_tpr'] is not None else 'NA'} | {r['false_positive_rate'] if r['false_positive_rate'] is not None else 'NA'} |" for r in rows)
    (reports / "BAO_CAO_H11.md").write_text(f'''# H11 — audit mô tả theo nhóm

Bối cảnh: {context}. Chỉ validation 46.127 ID. Không fit thêm và không chấm test. Giới tính/tuổi chỉ dùng audit, không vào X.

| Model | Chiều nhóm | Nhóm | N | Nhãn 1 | TPR tại 0.5 | FPR tại 0.5 |
|---|---|---|---:|---:|---:|---:|
{table}

Chi tiết ROC-AUC/AP/Brier, base rate, confusion counts và Wilson intervals nằm trong group_audit.csv/json. Nhóm một lớp có ranking metric null; nhóm nhỏ không được diễn giải như bằng chứng chắc chắn. AP giữa nhóm có base rate khác nhau không thể tự coi là so sánh fairness trực tiếp.

Kết quả này chưa chứng minh công bằng hay nguyên nhân của khác biệt. Cần xem cỡ mẫu, khoảng bất định, proxy và bối cảnh. Threshold 0.5 chỉ minh họa, chưa chọn threshold nghiệp vụ; phải audit lại sau H12 vì thay threshold/calibration có thể đổi TPR/FPR. Không dùng kết quả để tự áp dụng threshold theo giới tính/tuổi.

Ứng viên đề nghị đưa sang H12: {recommendation}. Đây là đề nghị kỹ thuật chờ review, chưa model cuối, chưa chứng nhận fairness. Không có một ngưỡng fairness pass/fail đã được nhóm thống nhất nên chương trình không tự bịa ra. H10 so sánh toàn bộ 4 cấu hình; H11 này audit sâu hai ứng viên LR và LightGBM dẫn đầu.
''', encoding="utf-8")
    need(sha256(snapshot) == PARQUET_HASH, "Snapshot changed during audit.")
    (project / "reports/LATEST_HK_H11.txt").write_text(str(output) + "\n", encoding="utf-8")
    print("PASS_H11_DESCRIPTIVE_AUDIT\nREPORT: " + str(output), flush=True)
    return summary

def main():
    p = argparse.ArgumentParser(description="H11: descriptive group audit of LR and best H10 LightGBM on validation only.")
    p.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--h10-run", type=Path)
    p.add_argument("--execution-context", choices=["hk_machine", "assistant_reference"], default="hk_machine")
    a = p.parse_args()
    project = a.project.resolve()
    output = project / "artifacts" / ("hk_h11_audit_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f"))
    (output / "reports").mkdir(parents=True)
    try:
        h10 = a.h10_run or Path((project / "reports/LATEST_HK_LIGHTGBM.txt").read_text(encoding="utf-8-sig").strip())
        execute(project, h10, output, a.execution_context)
        return 0
    except Exception as exc:
        write_json(output / "reports/failure.json", {"status": "FAIL", "error": str(exc), "traceback": traceback.format_exc()})
        print("H11 FAIL: " + str(exc) + "\nREPORT: " + str(output), file=sys.stderr)
        return 1

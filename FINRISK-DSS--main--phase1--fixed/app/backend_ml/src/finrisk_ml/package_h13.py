from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import traceback
import zipfile
import pandas as pd
from .common import PARQUET_HASH, need, now, read_json, sha256, write_json
from .boosting import LOCKED_SPLIT_HASH
from .inference import ProfileScorer
from .explanations import EXPLANATION_VERSION, global_gain_importance


GK_GUIDE = '''# FinRisk — bàn giao mô hình và giải thích cho GK

Đây là mô-đun Python dùng trong backend/adapter, không chạy trực tiếp trong trình duyệt. Chưa sửa UI, chưa tạo API hay triển khai server. Giữ giao diện FinRisk cũ; khi thêm chuỗi UI, GK cập nhật src/i18n.js VI/EN và kiểm thử chuyển ngôn ngữ.

## Phụ thuộc và dữ liệu

Cần Python 64-bit và các gói trong model/requirements-lock.txt. Gói không chứa CSV gốc, full snapshot Parquet, mật khẩu hoặc .venv. TK cung cấp snapshot CORE4 đúng SHA256. Thư mục snapshot dùng cho --snapshot phải có data/feature_matrix.parquet với SHA256 a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0. Model/schema/split/policy đã kèm. Giữ nguyên cấu trúc src/finrisk_ml; joblib cần import được các class tương ứng.

Không giả lập 169 đặc trưng bằng 0 từ vài ô thu nhập/số tiền vay. MVP hiện là nhập ID đã tồn tại -> tra feature snapshot -> predict -> giải thích/tín hiệu review. Chưa hỗ trợ hồ sơ mới hoặc form tự do. Với form tương lai cần pipeline tạo đặc trưng và schema riêng đã xác nhận.

## Gọi mô-đun từ Python

Thêm thư mục src của bundle vào PYTHONPATH hoặc sys.path của backend, sau đó:

```python
from finrisk_ml.inference import ProfileScorer

# bundle_root là thư mục đã giải nén có model/, contracts/, splits/.
# snapshot_root là thư mục có data/feature_matrix.parquet.
scorer = ProfileScorer(snapshot_root, bundle_root)  # khởi tạo một lần mỗi process
response = scorer.score(100007)
```

Không khởi tạo ProfileScorer mỗi request vì mỗi lần phải kiểm hash và đọc snapshot. Không đưa full Parquet hoặc model vào static frontend. API, nếu học phần/yêu cầu tích hợp cần, được GK/TK chọn sau; bundle chưa phụ thuộc FastAPI hoặc Streamlit. Với nhiều worker, tính RAM cho từng snapshot riêng.

CLI minh họa sau khi đi vào thư mục bundle và dùng Python đúng môi trường:

```text
python src/score_hk_h13.py --run . --snapshot DUONG_DAN_SNAPSHOT --profile-id 100007
```

DUONG_DAN_SNAPSHOT là giá trị thay thế, không gõ nguyên văn. Với request lỗi, dùng code để hiển thị thông báo; không biến lỗi thành score0.

## Quy ước response

Request là sk_id_curr nguyên dương; bool, chuỗi, số âm không hợp lệ ở module. Nếu API nhận chuỗi phải xác thực/parse có chủ đích. ID không có -> PROFILE_NOT_FOUND; ID test -> PROFILE_RESERVED_FOR_FINAL_TEST trước predict. risk_score là điểm mô hình dương class1; calibration_status nói rõ raw đang được giữ, chưa được hiệu chỉnh thành công theo tiêu chí chọn. Không gọi score là xác suất vỡ nợ được bảo đảm.

review_recommended=True chỉ đề nghị chuyên viên xem xét theo ngưỡng demo F1. False không phải duyệt vay. Ngưỡng và comparator >= nằm trong threshold_policy.json, không hardcode0.5 hoặc làm tròn0.145 trước so sánh. Có thể làm tròn khi hiển thị, nhưng quyết định dùng giá trị gốc đầy đủ. Không đổi ngưỡng theo tuổi/giới.

explanations là top10 đặc trưng theo trị tuyệt đối đóng góp, có dấu tăng/giảm điểm và observed_value, NULL giữ null. Đơn vị là **raw_margin_log_odds**, không phải phần trăm xác suất. explanation_details có base_margin + tổng đóng góp = raw_margin; sigmoid(raw_margin) = raw_base_probability. Chỉ top10 không cộng đủ margin: phải cộng other_features_sum. Baseline margin là expected value nội bộ của mô hình cây, không phải một khách hàng cụ thể hay tỷ lệ nhãn1 chung.

Các đóng góp giải thích cách mô hình tính điểm, không chứng minh nguyên nhân tài chính hoặc việc thay giá trị sẽ làm rủi ro thực giảm. Với proxy/tương quan, không dùng để kết luận giới tính/tuổi không còn ảnh hưởng gián tiếp. Feature name/description từ contracts/feature_descriptions.json; bản dịch UI phải giữ nghĩa và key, không tự đổi đơn vị thu nhập thành VND hay annuity thành tiền trả tháng.

Nếu explanation_status=error: score vẫn có thể dùng làm demo nếu status=ok, nhưng hiển thị giải thích chưa khả dụng; không thay bằng lý do AI. Các lỗi version/model/data là lỗi setup, không tiếp tục suy luận bằng dữ liệu khác.

Global gain importance là giảm loss tích lũy của các split trong mô hình đã fit; không phải trung bình SHAP trên test, không phải nguyên nhân, không đưa chiều tăng/giảm cho mọi khách hàng.

## Kiểm thử tích hợp GK

- Dùng contracts/response_examples.json để hiểu format; đều là hồ sơ validation, không phải test. Chúng là ví dụ cho tích hợp, không phải một mẫu đánh giá ngẫu nhiên hay benchmark.
- Gọi lại cùng ID từ snapshot đúng, score/model/data/version/policy khớp ví dụ trong sai số1e-10.
- Thử ID sai, ID không tồn tại và ID test; lỗi đúng code, không sinh score giả.
- Kiểm tra chất lượng thiếu dữ liệu qua quality_flags; không giấu ANNUITY_MISSING/BUREAU_NOT_OBSERVED.
- Top contributions hiển thị đúng dấu/thang, không viết +0.2 thành +20% rủi ro.
- Giữ dữ liệu, model, pipeline cũ; không refit trong request và không log mật khẩu.
- Bổ sung i18n/QA/evidence UI sau khi có source giao diện chuẩn. Gói này chưa chứng nhận tích hợp UI hoặc nghiệm thu TK/GK.
'''


def run(project, h12, output, context):
    begin = time.perf_counter()
    reports, models, contracts, splits = [output/x for x in ["reports", "model", "contracts", "splits"]]
    for folder in [reports, models, contracts, splits]:
        folder.mkdir(parents=True, exist_ok=True)
    s12 = read_json(h12/"reports/run_summary_h12.json")
    need(s12["status"] == "PASS_H12_CALIBRATION_THRESHOLD_VALIDATION_ONLY" and s12["test_scored_rows"] == 0, "H12 not PASS.")
    need(s12["selected_probability_variant"] == "raw_h10", "This H13 release validates the raw H12 branch only.")
    need(s12["data_hash"] == PARQUET_HASH and s12["split_hash"] == LOCKED_SPLIT_HASH, "H12 data/split changed.")
    snapshot = project/"data_snapshot/72780cc27cfe"
    source = ProfileScorer(snapshot, h12)
    need(source.metadata.get("threshold_policy_version") == s12["demo_policy"]["threshold_policy_version"], "H12 policy mismatch.")
    for rel in ["model/pipeline.joblib", "model/requirements-lock.txt", "model/threshold_policy.json", "contracts/model_features_v1.json", "splits/split_manifest.csv"]:
        shutil.copy2(h12/rel, output/rel)
    meta = dict(source.metadata, explanation_version=EXPLANATION_VERSION, explanation_scale="raw_margin_log_odds",
                release_stage="h13_demo_handoff_pending_review", execution_context=context, packaged_utc=now())
    write_json(models/"metadata.json", meta)
    scorer = ProfileScorer(snapshot, output)
    need(sha256(models/"pipeline.joblib") == source.metadata["model_sha256"] and sha256(splits/"split_manifest.csv") == LOCKED_SPLIT_HASH, "H13 altered predictor/split.")
    candidates = pd.read_parquet(h12/"reports/validation_predictions_h12.parquet")
    refs = read_json(h12/"reports/smoke_reference.json")
    chosen = [int(r["sk_id_curr"]) for r in refs]
    threshold = s12["demo_policy"]["threshold"]
    # Existing validation examples + first two IDs above threshold + nearest threshold.
    above = candidates.loc[candidates["selected_score"] >= threshold].sort_values("sk_id_curr")
    pool = above["sk_id_curr"].head(2).astype(int).tolist()
    pool += candidates.assign(distance=(candidates["selected_score"]-threshold).abs()).sort_values(["distance", "sk_id_curr"])["sk_id_curr"].astype(int).tolist()
    for pid in pool:
        if pid not in chosen:
            chosen.append(pid)
        if len(chosen) >= 6:
            break
    need(len(chosen) == 6 and all(scorer.parts.loc[i] == "validation" for i in chosen), "Demo must use validation only.")
    responses = []
    for pid in chosen:
        response = scorer.score(pid)
        need(response["status"] == "ok" and response.get("explanation_status") == "ok", "Explanation failed for "+str(pid))
        need(abs(response["risk_score"]-float(candidates.loc[candidates["sk_id_curr"].eq(pid), "selected_score"].iloc[0])) <= 1e-10, "H12/H13 score changed.")
        detail = response["explanation_details"]
        need(detail["feature_count"] == 169 and detail["reconstruction_error_margin"] <= 1e-7, "Margin reconstruction error.")
        need(abs(detail["raw_base_probability"]-response["risk_score"]) <= 1e-10, "Raw branch reconstruction mismatch.")
        responses.append(response)
        print(f"Profile {pid}: explanation PASS, score={response['risk_score']:.6f}, review={response['review_recommended']}", flush=True)
    need(any(r["review_recommended"] for r in responses) and any(not r["review_recommended"] for r in responses), "Missing above/below-threshold examples.")
    write_json(contracts/"response_examples.json", responses)
    dictionary = pd.read_csv(snapshot/"reports/data_dictionary.csv")
    feature_order = read_json(contracts/"model_features_v1.json")["feature_order"]
    feature_rows = dictionary.loc[dictionary["table"].eq("feature_matrix")].set_index("column")
    need(all(name in feature_rows.index for name in feature_order), "Feature descriptions missing.")
    descriptions = [{"feature": name, "postgres_type": feature_rows.loc[name, "postgres_type"],
                     "description": feature_rows.loc[name, "description"], "origin": feature_rows.loc[name, "origin"],
                     "null_policy": feature_rows.loc[name, "null_policy"]} for name in feature_order]
    write_json(contracts/"feature_descriptions.json", descriptions)
    gain = global_gain_importance(scorer.pipeline)
    pd.DataFrame(gain).to_csv(reports/"global_gain_importance.csv", index=False, lineterminator="\n")
    write_json(contracts/"inference_contract_h13.json", {
        "request": {"sk_id_curr": "positive integer; bool/string invalid at module boundary"},
        "population": "existing snapshot profiles; demo test IDs blocked before predictor",
        "response_examples": "response_examples.json", "predictors": 169,
        "score": "positive-class model estimate; raw_h10 retained; not a guaranteed individual PD",
        "explanations": "Top10 absolute native LightGBM contributions, signed, raw_margin_log_odds scale",
        "reconstruction": "base_margin + displayed_contributions_sum + other_features_sum = raw_margin; sigmoid(raw_margin)=raw_base_probability",
        "review": "risk_score >= full-precision threshold; advisory demo only",
        "partial_failure": "explanation_status=error leaves explanations=[] and valid score intact; never invent reasons",
        "model_version": meta["model_version"], "data_hash": PARQUET_HASH, "split_hash": LOCKED_SPLIT_HASH,
        "explanation_version": EXPLANATION_VERSION, "threshold_policy_version": meta["threshold_policy_version"],
        "error_codes": ["INVALID_PROFILE_ID", "PROFILE_NOT_FOUND", "PROFILE_RESERVED_FOR_FINAL_TEST", "PREDICTION_FAILED"],
        "ui_integration_completed": False, "api_server_implemented": False, "formal_TK_GK_review": "NOT_RECORDED"})
    # All six examples verified again by loading the model in a new process.
    write_json(reports/"smoke_reference.json", [{"case": "h13_validation_demo", "sk_id_curr": r["sk_id_curr"], "split": "validation", "risk_score": r["risk_score"]} for r in responses])
    verifier = Path(__file__).resolve().parents[1]/"score_hk_profile.py"
    fresh = subprocess.run([sys.executable, str(verifier), "--project", str(project), "--run", str(output), "--verify-references"],
                           capture_output=True, text=True, env=dict(os.environ, OMP_NUM_THREADS="2", OPENBLAS_NUM_THREADS="2", MKL_NUM_THREADS="2"))
    need(fresh.returncode == 0, "H13 fresh process failed: "+fresh.stdout+fresh.stderr)
    smoke = json.loads(fresh.stdout)
    need(smoke["status"] == "PASS" and all(x["actual"].get("explanation_status") == "ok" for x in smoke["references"]), "H13 explanation reload failed.")
    write_json(reports/"fresh_process_smoke_h13.json", smoke)
    (output/"README_GK_VI.md").write_text(GK_GUIDE, encoding="utf-8")
    src = Path(__file__).resolve().parents[1]
    portable = output/"handoff/FinRisk_ML_For_GK"
    for part in ["model", "contracts", "splits"]:
        shutil.copytree(output/part, portable/part)
    shutil.copytree(src/"finrisk_ml", portable/"src/finrisk_ml", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy2(src/"score_hk_h13.py", portable/"src/score_hk_h13.py")
    shutil.copy2(output/"README_GK_VI.md", portable/"README_GK_VI.md")
    shutil.copy2(reports/"fresh_process_smoke_h13.json", portable/"fresh_process_smoke_h13.json")
    shutil.copy2(reports/"global_gain_importance.csv", portable/"global_gain_importance.csv")
    portable_files = {str(f.relative_to(portable)): sha256(f) for f in portable.rglob("*") if f.is_file()}
    write_json(portable/"BUNDLE_MANIFEST.json", {"files_sha256": portable_files, "contains_full_snapshot": False,
               "data_hash_required": PARQUET_HASH, "fit_performed": False, "test_scored_rows": 0, "ui_integration_completed": False})
    bundle_zip = output/"handoff/FinRisk_ML_For_GK.zip"
    with zipfile.ZipFile(bundle_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(portable.rglob("*")):
            if f.is_file(): z.write(f, "FinRisk_ML_For_GK/"+str(f.relative_to(portable)))
    bundle_hash = sha256(bundle_zip)
    (output/"handoff/FinRisk_ML_For_GK.zip.sha256.txt").write_text(bundle_hash+"  FinRisk_ML_For_GK.zip\n", encoding="utf-8")
    need(sha256(snapshot/"data/feature_matrix.parquet") == PARQUET_HASH and sha256(h12/"model/pipeline.joblib") == meta["model_sha256"], "Source data/model changed.")
    summary = {"status": "PASS_H13_EXPLANATIONS_HANDOFF_VALIDATION_ONLY", "task": "H13", "execution_context": context,
               "run": str(output), "h12_run": str(h12), "completed_utc": now(), "runtime_seconds": time.perf_counter()-begin,
               "data_hash": PARQUET_HASH, "split_hash": LOCKED_SPLIT_HASH, "model_hash_unchanged": True,
               "fit_performed": False, "validation_profiles_explained": len(responses), "demo_ids": chosen,
               "demo_above_threshold": sum(r["review_recommended"] for r in responses),
               "max_margin_reconstruction_error": max(r["explanation_details"]["reconstruction_error_margin"] for r in responses),
               "explanation_version": EXPLANATION_VERSION, "explanation_scale": "raw_margin_log_odds",
               "fresh_process_status": smoke["status"], "test_scored_rows": 0,
               "bundle_zip": str(bundle_zip), "bundle_sha256": bundle_hash,
               "full_snapshot_in_bundle": False, "ui_integration_completed": False, "api_server_implemented": False,
               "formal_TK_GK_review": "NOT_RECORDED", "fairness_certified": False, "final_model_selected": False,
               "next_task": "GK/TK adapter and UI integration, method review; keep final test sealed until protocol lock"}
    write_json(reports/"run_summary_h13.json", summary)
    (reports/"BAO_CAO_H13.md").write_text(f'''# H13 — giải thích mô hình và đóng gói

Context: {context}. Không fit thêm, không đổi model score hoặc ngưỡng H12, không chấm test. Sáu ID validation minh họa: {chosen}. Đây là mẫu có chủ đích để kiểm thử giao diện, không phải benchmark hoặc đại diện quần thể.

LightGBM native pred_contrib giải thích margin trước sigmoid. Base value + toàn bộ169 đóng góp = raw margin, sai số lớn nhất {summary['max_margin_reconstruction_error']:.3g}; sigmoid của margin khớp điểm raw H12. Top10 theo trị tuyệt đối được trả cùng phần đóng góp còn lại. Không coi đóng góp là phần trăm xác suất, nguyên nhân thực tế hoặc thay thế thẩm định.

Bundle đã có model/policy/schema/split, module Python, feature descriptions và ví dụ response. Không kèm full Parquet; GK cần snapshot từ TK cùng SHA256. Chưa thêm API hoặc thay source UI. Đọc README_GK_VI.md để gắn vào adapter và giữ i18n VI/EN. Không hardcode0.5, không điền169 feature bằng0 từ form vài trường.

Technical PASS trên môi trường này không tự là nghiệm thu TK/GK, fairness hay kết quả test cuối. Test vẫn bị chặn, cả trường hợp score và giải thích. Gói GK tại handoff/FinRisk_ML_For_GK.zip, SHA256 {bundle_hash}.
''',encoding="utf-8")
    with zipfile.ZipFile(reports/"H13_BANG_CHUNG.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in [reports/"run_summary_h13.json", reports/"fresh_process_smoke_h13.json", reports/"global_gain_importance.csv", reports/"BAO_CAO_H13.md", contracts/"response_examples.json", contracts/"inference_contract_h13.json"]:
            z.write(f, f.name)
    (project/"reports/LATEST_HK_H13.txt").write_text(str(output)+"\n",encoding="utf-8")
    print("PASS_H13_EXPLANATIONS_HANDOFF_VALIDATION_ONLY\nREPORT: "+str(output)+"\nGK BUNDLE: "+str(bundle_zip),flush=True)
    return summary


def main():
    p = argparse.ArgumentParser(description="H13 native LightGBM contributions and portable handoff, no fit/test scoring")
    p.add_argument("--project",type=Path,default=Path(__file__).resolve().parents[2])
    p.add_argument("--h12-run",type=Path)
    p.add_argument("--execution-context",choices=["hk_machine","assistant_reference"],default="hk_machine")
    a=p.parse_args(); project=a.project.resolve()
    output=project/"artifacts"/("hk_h13_handoff_"+datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f"))
    (output/"reports").mkdir(parents=True)
    try:
        h12=a.h12_run or Path((project/"reports/LATEST_HK_H12.txt").read_text(encoding="utf-8-sig").strip())
        run(project,h12,output,a.execution_context)
        return 0
    except Exception as exc:
        write_json(output/"reports/failure.json",{"status":"FAIL","error":str(exc),"traceback":traceback.format_exc(),"execution_context":a.execution_context})
        print("H13 FAIL: "+str(exc)+"\nREPORT: "+str(output),file=sys.stderr)
        return 1

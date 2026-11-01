"""Real CORE4 verification only. Exit 2 = BLOCKED; no replacement data."""
import argparse, json, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"backend_ml/src"))
from finrisk_ml.inference import ProfileScorer

def main():
    p=argparse.ArgumentParser();p.add_argument("--snapshot",default=os.environ.get("FINRISK_SNAPSHOT"));a=p.parse_args()
    required=["data/feature_matrix.parquet","reports/feature_contract.json","reports/model_candidate_columns.json"]
    missing=required if not a.snapshot else [f for f in required if not (Path(a.snapshot)/f).is_file()]
    if missing:
        print(json.dumps({"status":"BLOCKED","missing":missing,"inference_executed":False}));return 2
    try: scorer=ProfileScorer(a.snapshot,ROOT/"backend_ml")
    except Exception as exc:
        print(json.dumps({"status":"FAIL","setup_error":str(exc)}));return 1
    refs=json.loads((ROOT/"backend_ml/contracts/response_examples.json").read_text())
    checks=[]
    for ref in refs:
        actual=scorer.score(ref["sk_id_curr"])
        ok=actual.get("status")=="ok" and abs(actual["risk_score"]-ref["risk_score"])<=1e-10
        for key in ("review_recommended","explanation_status","model_version","threshold_policy_version","quality_flags"):
            ok=ok and actual.get(key)==ref.get(key)
        ok=ok and actual.get("decision_threshold")==ref.get("decision_threshold")
        xs,ys=actual.get("explanations",[]),ref.get("explanations",[])
        ok=ok and len(xs)==len(ys)==10
        for x,y in zip(xs,ys):
            ok=ok and x["feature"]==y["feature"] and abs(x["contribution"]-y["contribution"])<=1e-10 and x["scale"]==y["scale"]
        if ref["sk_id_curr"]==100035:
            ok=ok and abs(actual["risk_score"]-0.15160322574159024)<=1e-10 and actual["review_recommended"] is True and actual["explanation_status"]=="ok"
        checks.append({"id":ref["sk_id_curr"],"passed":ok})
    reserved=int(scorer.parts[scorer.parts=="test"].index[0])
    guards={"unknown":scorer.score(int(scorer.df.index.max())+1)["code"]=="PROFILE_NOT_FOUND",
            "reserved":scorer.score(reserved)["code"]=="PROFILE_RESERVED_FOR_FINAL_TEST"}
    passed=all(c["passed"] for c in checks) and all(guards.values())
    print(json.dumps({"status":"PASS" if passed else "FAIL","references":checks,"guards":guards}));return 0 if passed else 1
if __name__=="__main__":raise SystemExit(main())

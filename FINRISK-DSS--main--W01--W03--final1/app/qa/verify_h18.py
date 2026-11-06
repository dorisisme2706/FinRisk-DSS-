"""Canonical H18 verification against CORE4 Parquet + frozen H16 model.
Exit 2 = BLOCKED due missing input; 1 = FAIL; 0 = PASS.
"""
import argparse, json, os, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend_ml/src'))
sys.path.insert(0,str(ROOT/'backend_api'))
from finrisk_ml.inference import ProfileScorer
from decision_engine import build_decision_support


def main():
    p=argparse.ArgumentParser(); p.add_argument('--snapshot',default=os.environ.get('FINRISK_SNAPSHOT')); a=p.parse_args()
    required=['data/feature_matrix.parquet','reports/feature_contract.json','reports/model_candidate_columns.json']
    missing=required if not a.snapshot else [f for f in required if not (Path(a.snapshot)/f).is_file()]
    if missing:
        print(json.dumps({'status':'BLOCKED','missing':missing,'inference_executed':False},ensure_ascii=False)); return 2
    release=json.loads((ROOT/'evidence/h16/release_metadata_h16.json').read_text(encoding='utf-8'))
    refs=json.loads((ROOT/'backend_ml/contracts/response_examples.json').read_text(encoding='utf-8'))
    try: scorer=ProfileScorer(a.snapshot,ROOT/'backend_ml')
    except Exception as exc:
        print(json.dumps({'status':'FAIL','setup_error':str(exc)},ensure_ascii=False)); return 1
    checks=[]
    for ref in refs:
        actual=scorer.score(ref['sk_id_curr'])
        ok=actual.get('status')=='ok' and abs(actual['risk_score']-ref['risk_score'])<=1e-10
        for key in ('review_recommended','explanation_status','model_version','threshold_policy_version','quality_flags'):
            ok=ok and actual.get(key)==ref.get(key)
        decision=build_decision_support(actual,release) if actual.get('status')=='ok' else None
        if decision:
            ok=ok and decision['automatic_credit_decision'] is False and decision['scenario_changes_model_score'] is False
            ok=ok and all(decision[k] is None for k in ('recommended_amount','recommended_term_months','interest_rate','monthly_payment'))
            ok=ok and decision['signal']==('MANUAL_REVIEW_RECOMMENDED' if actual['review_recommended'] else 'NO_REVIEW_SIGNAL')
        checks.append({'id':ref['sk_id_curr'],'passed':bool(ok),'signal':decision['signal'] if decision else None})
    reserved=int(scorer.parts[scorer.parts=='test'].index[0])
    guards={
        'unknown':scorer.score(int(scorer.df.index.max())+1)['code']=='PROFILE_NOT_FOUND',
        'reserved':scorer.score(reserved)['code']=='PROFILE_RESERVED_FOR_FINAL_TEST',
    }
    passed=all(c['passed'] for c in checks) and all(guards.values())
    print(json.dumps({'status':'PASS' if passed else 'FAIL','task':'H18','references':checks,'guards':guards,
                      'test_profiles_scored':0,'model_version':scorer.metadata['model_version'],
                      'data_version':scorer.metadata['data_version'],'threshold_policy_version':scorer.metadata['threshold_policy_version'],
                      'h16_release_stage':release.get('release_stage')},ensure_ascii=False,indent=2))
    return 0 if passed else 1

if __name__=='__main__': raise SystemExit(main())

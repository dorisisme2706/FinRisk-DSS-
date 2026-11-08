"""H18 real-model QA using the Core4 CSV representation only for this QA environment.
Product runtime still requires the canonical Parquet snapshot through ProfileScorer.
No reserved final-test IDs are scored here.
"""
from __future__ import annotations
import argparse, json, sys, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend_ml/src'))
sys.path.insert(0,str(ROOT/'backend_api'))
from decision_engine import build_decision_support


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--csv',required=True)
    ap.add_argument('--out',default=str(ROOT/'evidence/h18/real_reference_results.json'))
    args=ap.parse_args()
    bundle=ROOT/'backend_ml'
    meta=json.loads((bundle/'model/metadata.json').read_text(encoding='utf-8'))
    release=json.loads((ROOT/'evidence/h16/release_metadata_h16.json').read_text(encoding='utf-8'))
    contract=json.loads((bundle/'contracts/model_features_v1.json').read_text(encoding='utf-8'))
    refs=json.loads((bundle/'contracts/response_examples.json').read_text(encoding='utf-8'))
    parts=pd.read_csv(bundle/'splits/split_manifest.csv').set_index('sk_id_curr')['split']
    expected={int(x['sk_id_curr']):x for x in refs if x.get('status')=='ok'}
    ref_ids=set(expected)
    if any(parts.loc[i]=='test' for i in ref_ids): raise RuntimeError('REFERENCE_SET_CONTAINS_TEST')
    features=contract['feature_order']; nums=contract['numeric']; cats=contract['categorical']
    rows=[]
    for c in pd.read_csv(args.csv,usecols=['sk_id_curr']+features,chunksize=50000,low_memory=False,keep_default_na=True):
        z=c[c.sk_id_curr.isin(ref_ids)].copy()
        if len(z): rows.append(z)
    frame=pd.concat(rows).set_index('sk_id_curr')
    for col in nums: frame[col]=pd.to_numeric(frame[col],errors='coerce')
    for col in cats: frame[col]=frame[col].where(frame[col].notna(),np.nan).map(lambda v:str(v) if pd.notna(v) else np.nan)
    with warnings.catch_warnings(record=True) as ws:
        warnings.simplefilter('always')
        model=joblib.load(bundle/'model/pipeline.joblib')
    probs=model.predict_proba(frame[features])[:,list(model.classes_).index(1)]
    threshold=float(json.loads((bundle/'model/threshold_policy.json').read_text())['threshold'])
    results=[]
    for pid,prob in zip(frame.index,probs):
        ref=expected[int(pid)]; score=float(prob); review=score>=threshold
        score_result={'status':'ok','sk_id_curr':int(pid),'risk_score':score,'decision_threshold':threshold,
                      'review_recommended':review,'threshold_policy_version':meta['threshold_policy_version']}
        decision=build_decision_support(score_result,release)
        err=abs(score-float(ref['risk_score']))
        results.append({'sk_id_curr':int(pid),'split':str(parts.loc[int(pid)]),'expected':float(ref['risk_score']),
                        'actual':score,'abs_error':err,'score_match':err<=1e-12,
                        'review_match':review==bool(ref['review_recommended']),
                        'decision_signal':decision['signal'],'automatic_credit_decision':decision['automatic_credit_decision'],
                        'terms_all_null':all(decision[k] is None for k in ['recommended_amount','recommended_term_months','interest_rate','monthly_payment'])})
    passed=all(r['score_match'] and r['review_match'] and not r['automatic_credit_decision'] and r['terms_all_null'] and r['split']!='test' for r in results)
    out={'status':'PASS' if passed else 'FAIL','task':'H18','reference_count':len(results),'test_profiles_scored':0,
         'model_version':meta['model_version'],'data_version':meta['data_version'],'threshold_policy_version':meta['threshold_policy_version'],
         'h16_release_stage':release['release_stage'],'results':results,
         'runtime_warnings':[str(w.message) for w in ws]}
    p=Path(args.out);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False,indent=2))
    return 0 if passed else 1

if __name__=='__main__': raise SystemExit(main())

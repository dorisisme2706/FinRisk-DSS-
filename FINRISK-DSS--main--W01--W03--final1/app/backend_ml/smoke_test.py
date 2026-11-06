#!/usr/bin/env python
from __future__ import annotations
import argparse, json, sys, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
from finrisk_ml.inference import ProfileScorer

TOL = 1e-10

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def main() -> int:
    p=argparse.ArgumentParser(description='H15 fresh-process smoke test')
    p.add_argument('--snapshot', required=True, type=Path)
    p.add_argument('--output', type=Path, default=ROOT/'smoke_test_runtime.json')
    a=p.parse_args()
    refs=json.loads((ROOT/'contracts/response_examples.json').read_text(encoding='utf-8'))
    scorer=ProfileScorer(a.snapshot, ROOT)
    checked=[]
    for exp in refs:
        pid=int(exp['sk_id_curr'])
        actual=scorer.score(pid)
        passed=(actual.get('status')=='ok' and abs(actual['risk_score']-float(exp['risk_score']))<=TOL
                and actual.get('review_recommended')==exp.get('review_recommended')
                and actual.get('model_version')==exp.get('model_version'))
        checked.append({'sk_id_curr':pid,'passed':passed,'expected_risk_score':exp['risk_score'],
                        'actual_risk_score':actual.get('risk_score'),'review_recommended':actual.get('review_recommended')})
    unknown=int(scorer.df.index.max())+1
    reserved=int(scorer.parts[scorer.parts=='test'].index[0])
    error_checks={
        'unknown_id': scorer.score(unknown).get('code')=='PROFILE_NOT_FOUND',
        'negative_id': scorer.score(-1).get('code')=='INVALID_PROFILE_ID',
        'boolean_id': scorer.score(True).get('code')=='INVALID_PROFILE_ID',
        'reserved_test_id': scorer.score(reserved).get('code')=='PROFILE_RESERVED_FOR_FINAL_TEST',
    }
    result={'status':'PASS' if all(x['passed'] for x in checked) and all(error_checks.values()) else 'FAIL',
            'package':'finrisk_model_v1','references':checked,'error_checks':error_checks,
            'test_profiles_scored':0,'model_sha256':sha256(ROOT/'model/pipeline.joblib')}
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0 if result['status']=='PASS' else 1
if __name__=='__main__': raise SystemExit(main())

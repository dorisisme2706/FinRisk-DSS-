"""Live CORE4/API/Chromium QA. No response fixtures or substitute data.
Writes evidence outside the checkout; does not export rows, TARGET or feature values.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', default=os.environ.get('FINRISK_SNAPSHOT'))
    parser.add_argument('--out', type=Path, default=Path('/workspace/finrisk-data/evidence/live'))
    args = parser.parse_args()
    if not args.snapshot:
        print('BLOCKED: --snapshot or FINRISK_SNAPSHOT required')
        return 2
    snapshot = Path(args.snapshot).resolve()
    out = args.out.resolve()
    if out.is_relative_to(ROOT.parent):
        raise ValueError('Evidence must stay outside the repository')
    out.mkdir(parents=True, exist_ok=True)
    parquet = snapshot / 'data/feature_matrix.parquet'
    digest = hashlib.sha256(parquet.read_bytes()).hexdigest()
    if digest != 'a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0':
        raise ValueError('DATA_VERSION_MISMATCH')
    refs = json.loads((ROOT / 'backend_ml/contracts/response_examples.json').read_text())
    policy = json.loads((ROOT / 'backend_ml/model/threshold_policy.json').read_text())
    spec = json.loads((ROOT / 'backend_ml/contracts/model_features_v1.json').read_text())
    import pandas as pd
    parts = pd.read_csv(ROOT / 'backend_ml/splits/split_manifest.csv')
    reserved = int(parts.loc[parts['split'] == 'test', 'sk_id_curr'].iloc[0])
    unknown = int(parts['sk_id_curr'].max()) + 1
    checks = []
    results = []
    completed = False

    def check(name, condition):
        checks.append({'name': name, 'status': 'PASS' if condition else 'FAIL'})
        if not condition:
            raise AssertionError(name)

    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    env = dict(os.environ, FINRISK_SNAPSHOT=str(snapshot), PYTHONDONTWRITEBYTECODE='1',
               OMP_NUM_THREADS='2', OPENBLAS_NUM_THREADS='2')
    log = (out / 'server.log').open('w')
    server = subprocess.Popen([sys.executable, 'backend_api/server.py', '--port', str(port)],
                              cwd=ROOT, env=env, stdout=log, stderr=log)

    def get(path):
        try:
            response = urlopen(base + path, timeout=30)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, json.loads(response.read())

    try:
        for _ in range(300):
            if server.poll() is not None:
                raise RuntimeError('Backend exited during startup; inspect private server.log')
            try:
                status, health = get('/api/ml/health')
                break
            except URLError:
                time.sleep(.1)
        else:
            raise TimeoutError('Backend startup timeout')
        check('Live API health ready', status == 200 and health['status'] == 'ready')
        forbidden = {'target', 'code_gender', 'days_birth', 'feature_matrix', 'snapshot'}

        def clean_keys(value):
            if isinstance(value, dict):
                return not (set(k.lower() for k in value) & forbidden) and all(clean_keys(v) for v in value.values())
            if isinstance(value, list):
                return all(clean_keys(v) for v in value)
            return True

        for ref in refs:
            status, actual = get('/api/ml/score?sk_id_curr=' + str(ref['sk_id_curr']))
            check(f'API reference {ref["sk_id_curr"]} score', status == 200 and actual['status'] == 'ok' and
                  abs(actual['risk_score'] - ref['risk_score']) <= 1e-10)
            check(f'API reference {ref["sk_id_curr"]} policy',
                  actual['decision_threshold'] == policy['threshold'] == ref['decision_threshold'] and
                  actual['threshold_policy_version'] == policy['threshold_policy_version'] and
                  actual['review_recommended'] == ref['review_recommended'] == (actual['risk_score'] >= policy['threshold']))
            xs, ys = actual['explanations'], ref['explanations']
            check(f'API reference {ref["sk_id_curr"]} top10', actual['explanation_status'] == 'ok' and len(xs) == len(ys) == 10 and
                  all(x['feature'] == y['feature'] and x['feature'] in spec['feature_order'] and
                      abs(x['contribution'] - y['contribution']) <= 1e-10 and
                      x['scale'] == y['scale'] == 'raw_margin_log_odds' and
                      x['observed_value'] == y['observed_value'] for x, y in zip(xs, ys)))
            check(f'API reference {ref["sk_id_curr"]} privacy', clean_keys(actual))
            results.append({'id': ref['sk_id_curr'], 'risk_score': actual['risk_score'],
                            'review_recommended': actual['review_recommended'],
                            'explanation_status': actual['explanation_status']})
        for value, expected, code in [('abc',400,'INVALID_PROFILE_ID'), ('0',400,'INVALID_PROFILE_ID'),
                                      (str(unknown),404,'PROFILE_NOT_FOUND'),
                                      (str(reserved),403,'PROFILE_RESERVED_FOR_FINAL_TEST')]:
            status, actual = get('/api/ml/score?sk_id_curr=' + value)
            check('API guard ' + code + (' zero' if value == '0' else ''),
                  status == expected and actual['code'] == code and actual.get('risk_score') is None)
        for path in ['/backend_ml/model/pipeline.joblib', '/data/feature_matrix.parquet',
                     '/backend_ml/splits/split_manifest.csv', '/backend_api/server.py']:
            check('Private resource blocked ' + path, get(path)[0] == 404)

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                        args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':1366, 'height':900})
            errors = []
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.goto(base + '/#result')
            field = page.locator('#fr-ml-profile-id')
            field.wait_for()
            output = page.locator('#fr-ml-response')

            def wait_text(value):
                page.wait_for_function('(s)=>document.querySelector("#fr-ml-response").textContent.includes(s)', arg=value)

            def submit(value):
                field.fill(str(value))
                with page.expect_response(lambda r: '/api/ml/score?' in r.url) as response:
                    page.locator('#fr-ml-lookup-form button').click()
                return response.value

            for ref in refs:
                response = submit(ref['sk_id_curr'])
                live = response.json()
                wait_text(f'{ref["risk_score"] * 100:.3f}%')
                check(f'Chromium real E2E {ref["sk_id_curr"]}', response.status == 200 and
                      abs(live['risk_score'] - ref['risk_score']) <= 1e-10 and output.locator('li').count() == 10)
            submit(100035)
            wait_text('15.160%')
            check('100035 actual requirement', any(r['id'] == 100035 and abs(r['risk_score'] - 0.15160322574159024) <= 1e-10 and
                  r['review_recommended'] is True and r['explanation_status'] == 'ok' for r in results))
            check('Vietnamese actual review', 'Đề nghị chuyên viên xem xét' in output.inner_text())
            page.locator('#language-toggle').click()
            wait_text('Manual review recommended')
            check('Actual result VI to EN', 'Model risk score' in output.inner_text() and field.input_value() == '100035' and output.locator('li').count() == 10)
            page.locator('#language-toggle').click()
            wait_text('Đề nghị chuyên viên xem xét')
            check('Actual result EN to VI', field.input_value() == '100035' and output.locator('li').count() == 10)
            for value, expected, vi, en in [(unknown,404,'Không tìm thấy hồ sơ','Profile not found'),
                                            (reserved,403,'Hồ sơ dành riêng','Profile reserved')]:
                response = submit(value)
                wait_text(vi)
                check('Chromium actual guard ' + str(expected), response.status == expected)
                page.locator('#language-toggle').click()
                wait_text(en)
                page.locator('#language-toggle').click()
                wait_text(vi)
                check('Actual guard VI EN VI ' + str(expected), True)
            field.fill('abc')
            page.locator('#fr-ml-lookup-form button').click()
            wait_text('ID không hợp lệ')
            check('Chromium invalid ID validation', True)
            page.set_viewport_size({'width':390,'height':844})
            check('Existing panel mobile width', page.locator('.finrisk-ml-live-panel').evaluate('(e)=>e.getBoundingClientRect().right <= innerWidth+1'))
            check('MOCK selector retained', page.locator('select').count() > 0)
            check('No browser runtime exceptions', not errors)
            # Real failure by terminating our server; no network interception or fake responses.
            server.terminate()
            server.wait(timeout=10)
            field.fill('100035')
            page.locator('#fr-ml-lookup-form button').click()
            wait_text('Không kết nối được backend')
            page.locator('#language-toggle').click()
            wait_text('Backend connection failed')
            check('Real backend outage localized VI EN', True)
            browser.close()
            completed = True
    finally:
        if server.poll() is None:
            server.terminate()
            server.wait(timeout=10)
        log.close()
        report = {'status':'PASS' if completed and checks and all(c['status']=='PASS' for c in checks) else 'FAIL',
                  'scope':'Live CORE4 -> ProfileScorer -> original policy -> HTTP API -> Chromium; no fixtures',
                  'parquet_sha256':digest, 'references':results, 'checks':checks}
        (out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'status':report['status'], 'checks':len(checks), 'references':results}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

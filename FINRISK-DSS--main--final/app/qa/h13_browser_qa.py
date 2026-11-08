"""Browser integration tests. Reference responses are UI fixtures, NOT live inference."""
import json, os, socket, subprocess, sys, time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence/h13';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,ok,kind):
    checks.append({'name':name,'status':'PASS' if ok else 'FAIL','scope':kind})
    assert ok,name
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
env=os.environ.copy();env.pop('FINRISK_SNAPSHOT',None);env['PYTHONDONTWRITEBYTECODE']='1'
server=subprocess.Popen([sys.executable,'backend_api/server.py','--port',str(port)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    base=f'http://127.0.0.1:{port}'
    for _ in range(100):
        try:
            with urlopen(base) as response:break
        except URLError:time.sleep(.05)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1366,'height':900})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/#result');page.locator('#fr-ml-profile-id').wait_for()
        output=page.locator('#fr-ml-response');field=page.locator('#fr-ml-profile-id')
        def submit(value):
            field.fill(str(value));page.locator('#fr-ml-lookup-form button').click()
        def text(expected):
            page.wait_for_function('(s)=>document.querySelector("#fr-ml-response").textContent.includes(s)',arg=expected)
        submit(100035);text('ML chưa sẵn sàng')
        check('Actual backend without CORE4 returns unavailable',True,'live API, no inference')
        submit('abc');text('ID không hợp lệ')
        check('Invalid ID rejected in browser',True,'browser validation')
        ref=next(x for x in json.loads((ROOT/'backend_ml/contracts/response_examples.json').read_text()) if x['sk_id_curr']==100035)
        page.route('**/api/ml/score?*',lambda route:route.fulfill(status=200,json=ref))
        submit(100035);text('15.160%')
        check('100035 reference renders 10 contributions and review',output.locator('li').count()==10 and 'Đề nghị chuyên viên' in output.inner_text(),'reference fixture UI only; inference BLOCKED')
        page.screenshot(path=str(OUT/'reference-vi.png'),full_page=True)
        page.locator('#language-toggle').click();text('Manual review recommended')
        check('English title and reference output',page.locator('.finrisk-ml-live-panel h2').inner_text()=='Look up ML prediction by profile ID' and 'Model risk score' in output.inner_text(),'browser VI→EN')
        page.screenshot(path=str(OUT/'reference-en.png'),full_page=True)
        page.locator('#language-toggle').click();text('Đề nghị chuyên viên')
        check('Vietnamese restored, reference retained',output.locator('li').count()==10 and field.input_value()=='100035','browser EN→VI')
        for code,status,vi,en in [
            ('PROFILE_NOT_FOUND',404,'Không tìm thấy hồ sơ','Profile not found'),
            ('PROFILE_RESERVED_FOR_FINAL_TEST',403,'Hồ sơ dành riêng','Profile reserved'),
            ('PREDICTION_FAILED',500,'Backend không thể','The backend could not'),
            ('ML_NOT_READY',503,'ML chưa sẵn sàng','ML is not ready')]:
            page.unroute('**/api/ml/score?*')
            page.route('**/api/ml/score?*',lambda route,request,c=code,s=status:route.fulfill(status=s,json={'status':'error','code':c}))
            submit(100035);text(vi);page.locator('#language-toggle').click();text(en)
            page.locator('#language-toggle').click();text(vi)
            check(code+' localized',True,'error fixture UI only')
        page.unroute('**/api/ml/score?*');page.route('**/api/ml/score?*',lambda route:route.abort())
        submit(100035);text('Không kết nối được backend')
        check('Network failure handled',True,'browser network abort')
        page.unroute('**/api/ml/score?*');page.route('**/api/ml/score?*',lambda route:route.fulfill(status=200,json={'status':'ok','risk_score':None}))
        submit(100035);text('Phản hồi API không đúng')
        check('Malformed response fails closed',True,'invalid response fixture')
        page.set_viewport_size({'width':390,'height':844})
        check('Mobile ML panel within viewport',page.locator('.finrisk-ml-live-panel').evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth+1'),'browser 390px')
        check('MOCK controls retained',page.locator('#finrisk-risk-scenario').count()>0 or page.locator('select').count()>0,'existing UI')
        check('No browser runtime errors',not errors,'browser')
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
    (OUT/'browser-results.json').write_text(json.dumps({'checks':checks,'real_inference':'BLOCKED: original CORE4 files absent'},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'failed':0,'real_inference':'BLOCKED'}))

const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const i18n=fs.readFileSync(path.join(__dirname,'../src/i18n.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const checks=[
['VI/EN toggle exists',()=>assert(html.includes('id="language-toggle"'))],
['Language storage persists',()=>assert(i18n.includes('localStorage.setItem(STORAGE_KEY, language)'))],
['Saved language restored',()=>assert(i18n.includes('localStorage.getItem(STORAGE_KEY)'))],
['HTML lang synchronized',()=>assert(i18n.includes('document.documentElement.lang = language'))],
['Hero translations',()=>assert(i18n.includes('Understand risk more clearly.'))],
['Dashboard translations',()=>assert(i18n.includes('Loan portfolio overview'))],
['News translations',()=>assert(i18n.includes('Finance, lending and risk management news'))],
['Roadmap translations',()=>assert(i18n.includes('credit decision support roadmap'))],
['Footer translations',()=>assert(i18n.includes('replace professional financial underwriting'))],
['Translation on dynamic DOM',()=>assert(i18n.includes('MutationObserver'))],
['VI restoration supported',()=>assert(i18n.includes('restoreVietnamese()'))],
['Existing 6 news cards',()=>assert.equal((app.match(/class="news-card"/g)||[]).length,6)],
['Existing 3 roadmap cards',()=>assert.equal((app.match(/class="suite-card"/g)||[]).length,3)],
['Ambient animation retained',()=>assert(html.includes('ambient-graph-canvas'))],
['No backend integration added',()=>assert(!i18n.includes('fetch('))]
];
let fail=0;
for(const [name,fn] of checks){try{fn();console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+' '+e.message)}}
console.log(`${checks.length-fail}/${checks.length} PASS`);if(fail)process.exitCode=1;

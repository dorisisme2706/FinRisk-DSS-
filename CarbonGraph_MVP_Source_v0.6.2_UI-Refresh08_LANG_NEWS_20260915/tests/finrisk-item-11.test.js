const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const store=new Map();const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const window={localStorage};const ctx={window,globalThis:window,console};
for(const file of ['finrisk-loan.js','finrisk-decision-mock.js','finrisk-decision-trace.js'])vm.runInNewContext(fs.readFileSync(path.join(base,'src',file),'utf8'),ctx,{filename:file});
const loan=window.FinRiskLoan,engine=window.FinRiskDecisionMock,trace=window.FinRiskDecisionTrace;
let count=0;function check(name,fn){fn();count++;console.log('PASS',name);}
const valid=loan.normalize(loan.example);
check('six stages',()=>assert.equal(trace.build(valid,'low').steps.length,6));
check('stage order',()=>assert.equal(trace.build(valid,'low').steps.map(x=>x.id).join(','),'customer,features,ml,risk,decision,recommendation'));
for(const [scenario,status,score] of [['low','APPROVE',20],['medium','REVIEW',55],['high','REJECT',85],['missing','UNAVAILABLE',null]]){
 check(scenario+' status',()=>assert.equal(trace.build(valid,scenario).assessment.status,status));
 check(scenario+' score',()=>assert.equal(trace.build(valid,scenario).assessment.score,score));
 check(scenario+' six stages',()=>assert.equal(trace.build(valid,scenario).steps.length,6));
}
check('invalid input blocks',()=>assert.equal(trace.build({...valid,monthly_income:'-1'},'low').assessment.status,'INVALID_INPUT'));
check('invalid input blocks ML',()=>assert.equal(trace.build({...valid,monthly_income:'-1'},'low').steps[2].status,'BLOCKED'));
check('missing ML status',()=>assert.equal(trace.build(valid,'missing').steps[2].status,'UNAVAILABLE'));
check('MOCK source',()=>assert.equal(trace.build(valid,'low').source,'MOCK'));
check('no side effects on scenario',()=>{engine.setScenario('high');trace.build(valid,'low');assert.equal(engine.getScenario(),'high');});
check('safe missing customer id',()=>assert.equal(trace.build({...valid,customer_id:''},'low').customerId,'—'));
const app=fs.readFileSync(path.join(base,'src/app.js'),'utf8');const html=fs.readFileSync(path.join(base,'index.html'),'utf8');const i18n=fs.readFileSync(path.join(base,'src/i18n.js'),'utf8');
check('renamed navigation',()=>assert.match(app,/\["trace", "Giải thích quyết định"/));
check('trace module loaded',()=>assert.match(html,/src\/finrisk-decision-trace\.js/));
check('VI EN label',()=>assert.match(i18n,/"Giải thích quyết định": "Decision Trace"/));
check('no old graph in trace render',()=>{const body=app.split('function renderTrace() {')[1].split('function renderResult() {')[0];assert.doesNotMatch(body,/state\.graph|Candidate CN8|HRC/);});
console.log(`TOTAL ${count}/${count} PASS`);

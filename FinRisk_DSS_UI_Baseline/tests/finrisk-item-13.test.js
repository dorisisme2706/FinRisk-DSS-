const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={console,Date,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}};context.window=context;vm.createContext(context);
for(const f of ['src/finrisk-loan.js','src/finrisk-decision-mock.js','src/finrisk-credit-report.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
const engine=context.FinRiskCreditReport;const sample=context.FinRiskLoan.example;
let count=0;function test(label,fn){fn();count++;console.log('PASS',label)}
test('report schema and MOCK disclaimer',()=>{const r=engine.build(sample,'low');assert.equal(r.schema,'finrisk.credit-report.v1-mock');assert.match(r.disclaimer,/MOCK/)});
test('application fields present',()=>{const r=engine.build(sample,'low');assert.equal(r.application.customer_id,'KH001');assert.equal(Object.keys(r.application).length,9)});
test('validation PASS',()=>assert.equal(engine.build(sample,'low').validation.valid,true));
test('invalid application flagged',()=>{const r=engine.build({...sample,age:'abc'},'low');assert.equal(r.validation.valid,false);assert.equal(r.assessment.status,'INVALID_INPUT')});
for(const [scenario,status,score] of [['low','APPROVE',20],['medium','REVIEW',55],['high','REJECT',85],['missing','UNAVAILABLE',null]])test('scenario '+scenario,()=>{const r=engine.build(sample,scenario);assert.equal(r.assessment.status,status);assert.equal(r.assessment.score,score)});
test('JSON export parseable',()=>{const r=engine.build(sample,'medium');assert.equal(JSON.parse(engine.renderJson(r)).assessment.status,'REVIEW')});
test('HTML standalone with disclaimer',()=>{const h=engine.renderHtml(engine.build(sample,'medium'));assert.match(h,/<!doctype html>/);assert.match(h,/KH001/);assert.match(h,/MOCK/)});
test('HTML escapes customer name',()=>{const h=engine.renderHtml(engine.build({...sample,full_name:'<script>alert(1)</script>'},'low'));assert.doesNotMatch(h,/<script>/);assert.match(h,/&lt;script&gt;/)});
test('filenames sanitized',()=>{const r=engine.build({...sample,customer_id:'../foo'},'low');assert.doesNotMatch(engine.fileName(r,'json'),/\.\./)});
test('unsupported export blocked',()=>assert.throws(()=>engine.fileName(engine.build(sample,'low'),'exe')));
test('tab and script wired',()=>{const app=fs.readFileSync('src/app.js','utf8');const index=fs.readFileSync('index.html','utf8');assert.match(app,/\["export", "Báo cáo tín dụng"/);assert.match(index,/src\/finrisk-credit-report\.js/)});
console.log(`${count}/${count} PASS`);

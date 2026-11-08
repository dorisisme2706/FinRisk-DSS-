const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = new Map();
const context = { localStorage: {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)} };
context.window=context;
vm.createContext(context);
for(const name of ['src/finrisk-loan.js','src/finrisk-decision-mock.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
const {FinRiskLoan:loan,FinRiskDecisionMock:engine}=context;
const sample={...loan.example};
const cases=[
 ['low risk',()=>assert.equal(engine.assess(sample,'low').status,'APPROVE')],
 ['medium risk',()=>assert.equal(engine.assess(sample,'medium').status,'REVIEW')],
 ['high risk',()=>assert.equal(engine.assess(sample,'high').status,'REJECT')],
 ['missing ML',()=>assert.equal(engine.assess(sample,'missing').status,'UNAVAILABLE')],
 ['invalid income',()=>assert.equal(engine.assess({...sample,monthly_income:'-1'},'low').status,'INVALID_INPUT')],
 ['invalid amount',()=>assert.equal(engine.assess({...sample,loan_amount:'0'},'high').score,null)],
 ['missing score',()=>assert.equal(engine.assess(sample,'missing').score,null)],
 ['invalid scenario',()=>assert.throws(()=>engine.assess(sample,'bad'))],
 ['scenario persistence',()=>{engine.setScenario('high');assert.equal(engine.getScenario(),'high')}],
 ['invalid saved scenario',()=>assert.throws(()=>engine.setScenario('bad'))],
 ['loan contract',()=>assert.equal(loan.validate(sample).valid,true)],
 ['no fetch',()=>assert.doesNotMatch(fs.readFileSync(path.join(root,'src/finrisk-decision-mock.js'),'utf8'),/\bfetch\s*\(/)],
 ['assessment UI',()=>assert.match(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),/finrisk-risk-scenario/)],
 ['renamed tab',()=>assert.match(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),/\["result", "Đánh giá tín dụng"/)],
 ['#09 #10 retained',()=>assert.match(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),/\["validation", "Kiểm tra tài chính"/)],
 ['script order',()=>{const h=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(h.indexOf('src/finrisk-decision-mock.js')<h.indexOf('src/app.js'))}],
 ['VI EN',()=>assert.match(fs.readFileSync(path.join(root,'src/i18n.js'),'utf8'),/"Đánh giá tín dụng": "Credit Assessment"/)],
 ['MOCK label',()=>assert.match(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),/MOCK ONLY/)]
];
let fail=0;for(const [label,fn] of cases){try{fn();console.log('PASS',label)}catch(e){fail++;console.error('FAIL',label,e.message)}}
console.log(`${cases.length-fail}/${cases.length} PASS`);if(fail)process.exitCode=1;

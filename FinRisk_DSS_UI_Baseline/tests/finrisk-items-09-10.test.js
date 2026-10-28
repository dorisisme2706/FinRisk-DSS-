const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const memory=new Map();
const ctx={window:{},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}};
ctx.window.localStorage=ctx.localStorage;
vm.runInNewContext(fs.readFileSync(path.join(root,'src/finrisk-loan.js'),'utf8'),ctx);
const loan=ctx.window.FinRiskLoan;
assert.equal(loan.validate(loan.example).valid,true);
for(const [field,value] of [['customer_id',''],['full_name','A'],['age','17'],['monthly_income','-1'],['monthly_income','abc'],['monthly_expenses','999999999'],['existing_monthly_debt','999999999'],['loan_amount','0'],['loan_term_months','1.5'],['loan_purpose','']]){
 const result=loan.validate({...loan.example,[field]:value});
 assert.equal(result.valid,false,field);
 assert.ok(result.errors[field],field);
}
const edited={...loan.example,customer_id:'KH999'};
loan.save(edited);assert.equal(loan.load().customer_id,'KH999');
loan.reset();assert.equal(loan.load().customer_id,loan.example.customer_id);
const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
assert.ok(app.includes('function renderInputModule()'));
assert.ok(app.includes('function renderValidation()'));
assert.ok(app.includes('window.FinRiskLoan'));
assert.ok(!app.slice(app.indexOf('function renderInputModule()'),app.indexOf('function renderEvidence()')).includes('HRC lot'));
assert.ok(!app.slice(app.indexOf('function renderValidation()'),app.indexOf('function renderTrace()')).includes('Candidate CN8'));
assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('src/finrisk-loan.js'));
assert.ok(fs.readFileSync(path.join(root,'src/i18n.js'),'utf8').includes('Loan application'));
console.log('PASS: #09/#10 18 checks (schema, valid/invalid, save/reset, integration, VI/EN)');

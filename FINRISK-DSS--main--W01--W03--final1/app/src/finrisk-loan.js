(function(){
'use strict';
const KEY='finrisk.loan.application.mock.v1';
const fields=['customer_id','full_name','age','monthly_income','monthly_expenses','existing_monthly_debt','loan_amount','loan_term_months','loan_purpose'];
const example={customer_id:'KH001',full_name:'Nguyễn Văn A',age:'30',monthly_income:'15000000',monthly_expenses:'5000000',existing_monthly_debt:'1000000',loan_amount:'200000000',loan_term_months:'24',loan_purpose:'personal'};
function normalize(v){return Object.fromEntries(fields.map(k=>[k,String(v&&v[k]!=null?v[k]:'')]));}
function load(){try{const raw=localStorage.getItem(KEY);return raw?normalize(JSON.parse(raw)):normalize(example);}catch(_){return normalize(example);}}
function save(v){const d=normalize(v);localStorage.setItem(KEY,JSON.stringify(d));return d;}
function reset(){localStorage.removeItem(KEY);}
function validate(v){const d=normalize(v),errors={};
if(!/^[A-Za-z0-9_-]{2,30}$/.test(d.customer_id))errors.customer_id='Mã khách hàng cần 2–30 ký tự chữ/số, dấu _ hoặc -.';
if(d.full_name.trim().length<2||d.full_name.length>120)errors.full_name='Họ tên phải có từ 2 đến 120 ký tự.';
function number(k,label,allowZero=false,integer=false,max=1e15){const raw=d[k].trim(),n=Number(raw);if(!raw||!Number.isFinite(n)||n<(allowZero?0:1)||(integer&&!Number.isInteger(n))||n>max)errors[k]=label+' phải là '+(integer?'số nguyên ':'')+(allowZero?'không âm.':'lớn hơn 0.');return n;}
const age=number('age','Tuổi',false,true,120);if(!errors.age&&(age<18||age>100))errors.age='Tuổi minh họa phải từ 18 đến 100.';
const income=number('monthly_income','Thu nhập',false,false,1e12),expenses=number('monthly_expenses','Chi phí',true,false,1e12),debt=number('existing_monthly_debt','Khoản trả nợ',true,false,1e12);
number('loan_amount','Số tiền vay',false,false,1e13);number('loan_term_months','Thời hạn vay',false,true,600);
if(!errors.monthly_income&&!errors.monthly_expenses&&expenses>income)errors.monthly_expenses='Chi phí không được vượt thu nhập (quy tắc MOCK).';
if(!errors.monthly_income&&!errors.existing_monthly_debt&&debt>income)errors.existing_monthly_debt='Khoản trả nợ không được vượt thu nhập (quy tắc MOCK).';
if(!['personal','business','education','housing','other'].includes(d.loan_purpose))errors.loan_purpose='Vui lòng chọn mục đích vay.';
return {valid:Object.keys(errors).length===0,errors};}
window.FinRiskLoan=Object.freeze({fields,example,normalize,load,save,reset,validate});
})();

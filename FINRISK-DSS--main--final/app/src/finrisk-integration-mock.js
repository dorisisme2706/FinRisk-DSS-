(function(){
"use strict";
const DATA_KEY="finrisk.integration.records.mock.v1",RUN_KEY="finrisk.integration.last-run.mock.v1";
function read(){try{const x=JSON.parse(localStorage.getItem(DATA_KEY)||"[]");return {mode:"MOCK",backend:"OFFLINE",records:Array.isArray(x)?x:[]};}catch(_){return {mode:"MOCK",backend:"OFFLINE",records:[]};}}
function saveLoan(loan){const x=read().records;const id=String(loan.customer_id||"").trim();if(!id)throw Error("Missing customer ID");const record={id:"FR-"+id,customer_id:id,full_name:String(loan.full_name||""),saved_at:new Date().toISOString(),source:"MOCK"};const idx=x.findIndex(r=>r.customer_id===id);if(idx>=0)x[idx]=record;else x.push(record);localStorage.setItem(DATA_KEY,JSON.stringify(x));return record;}
function lastRun(){try{return JSON.parse(localStorage.getItem(RUN_KEY)||"null");}catch(_){return null;}}
function run(loan,validate){const valid=validate(loan).valid;const timestamp=new Date().toISOString();const steps=["PostgreSQL","ML","Decision Engine","UI","History"].map(name=>({name,status:valid?"SIMULATED":"BLOCKED"}));const result={id:"SIM-"+Date.now(),timestamp,mode:"MOCK",status:valid?"SIMULATED":"BLOCKED",decision:valid?"MOCK_ONLY":"INVALID_INPUT",steps,message:valid?"Đã mô phỏng 5 bước. Không gọi database, ML hay API thật.":"Hồ sơ không hợp lệ; không thể mô phỏng luồng."};localStorage.setItem(RUN_KEY,JSON.stringify(result));return result;}
window.FinRiskIntegrationMock=Object.freeze({read,saveLoan,lastRun,run});
})();

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/styles.css'),'utf8');
const i18n=fs.readFileSync(path.join(__dirname,'../src/i18n.js'),'utf8');
const checks=[
['No visible #16 demo section',()=>assert(!app.includes('id="finrisk-feedback-demo"'))],
['No demo feedback buttons',()=>assert(!app.includes('data-finrisk-feedback'))],
['No demo binding',()=>assert(!app.includes('bindFinRiskFeedback'))],
['No feedback demo CSS',()=>assert(!css.includes('.finrisk-feedback-demo'))],
['Shared toast retained',()=>assert(app.includes('function showToast('))],
['FinRisk default toast title',()=>assert(app.includes('title = "FinRisk DSS"'))],
['Toast error style',()=>assert(app.includes('type === "danger"'))],
['Toast dismiss button',()=>assert(app.includes('toast-close'))],
['Loading button helper',()=>assert(app.includes('function setButtonBusy('))],
['Busy action helper',()=>assert(app.includes('function runBusyAction('))],
['Busy button disabled',()=>assert(app.includes('button.disabled = true'))],
['Busy button reenabled',()=>assert(app.includes('button.disabled = false'))],
['Existing VI/EN translations',()=>assert(i18n.includes('Loan portfolio overview'))],
['Six news cards preserved',()=>assert.equal((app.match(/class="news-card"/g)||[]).length,6)],
['Three roadmap cards preserved',()=>assert.equal((app.match(/class="suite-card"/g)||[]).length,3)]
];let failed=0;for(const [name,fn] of checks){try{fn();console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}console.log(`${checks.length-failed}/${checks.length} PASS`);if(failed)process.exitCode=1;

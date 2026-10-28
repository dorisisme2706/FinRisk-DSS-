// Static regression checks for #05/#06. Browser UAT is separate.
const fs=require('node:fs'); const assert=require('node:assert/strict'); const path=require('node:path');
const root=path.resolve(__dirname,'..'); const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8'); const css=fs.readFileSync(path.join(root,'assets/styles.css'),'utf8');
const checks=[['FinRisk hero heading',()=>assert.match(app,/Hiểu rủi ro rõ hơn/)],['FinRisk overview',()=>assert.match(app,/FinRisk DSS · Tổng quan/)],['CTA to application',()=>assert.match(app,/Nhập hồ sơ vay/)],['CTA to trace',()=>assert.match(app,/Xem luồng đánh giá/)],['Dashboard section',()=>assert.match(app,/id="finrisk-kpi-dashboard"/)],['Dashboard CSS',()=>assert.match(css,/\.finrisk-dashboard/)],['Demo disclosure in source',()=>assert.match(app,/MOCK|DEMO|demo|dữ liệu minh họa/)],['Existing theme stylesheet',()=>assert.ok(css.length>1000)]];
for(const [name,fn] of checks){fn();console.log('PASS '+name)}
console.log(`${checks.length} static checks passed; browser behavior NOT tested`);

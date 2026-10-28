const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'../assets/styles.css'),'utf8');
const footer = html.match(/<footer class="app-footer"[\s\S]*?<\/footer>/)?.[0] || '';
const checks = [
  ['Footer exists', ()=>assert(footer.length>0)],
  ['FinRisk brand', ()=>assert(footer.includes('FinRisk DSS'))],
  ['No legacy CBAM in footer', ()=>assert(!/CarbonGraph|CBAM|TerraMetric|teeracarbon/i.test(footer))],
  ['Four footer columns', ()=>assert.equal((footer.match(/<section class="footer-/g)||[]).length,4)],
  ['News anchor', ()=>assert(footer.includes('data-overview-target="cg-news"'))],
  ['Roadmap anchor', ()=>assert(footer.includes('data-overview-target="cg-suite"'))],
  ['FAQ anchor', ()=>assert(footer.includes('data-overview-target="cg-faq"'))],
  ['Mock label', ()=>assert(footer.includes('MOCK DATA'))],
  ['Financial disclaimer', ()=>assert(footer.includes('không thay thế thẩm định'))],
  ['No invented contact', ()=>assert(!/096\.9216\.067|69\/68|@graph\.vn/.test(footer))],
  ['Footer responsive rules retained', ()=>assert(css.includes('@media (max-width: 860px)')&&css.includes('.footer-shell'))],
  ['Existing animation canvas retained', ()=>assert(html.includes('ambient-graph-canvas'))],
];
let failed=0;
for(const [name,fn] of checks){try{fn();console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}
console.log(`${checks.length-failed}/${checks.length} PASS`);
if(failed)process.exitCode=1;

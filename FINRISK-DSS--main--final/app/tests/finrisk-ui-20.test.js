"use strict";
// Static checks for scope #20, independent of any npm dependencies.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const css = read("assets/styles.css");
const html = read("index.html");
const app = read("src/app.js");
let n = 0;
function check(message, ok) {
  assert.ok(ok, message);
  console.log("PASS", message);
  n++;
}
for (const file of ["assets/styles.css", "src/app.js", "src/ambient-graph.js", "src/i18n.js",
  "src/state.js", "src/validation-engine.js", "src/graph-engine.js", "src/release-engine.js",
  "src/report-engine.js", "src/persistence.js", "qa/responsive_qa.py"]) {
  check(`Required file: ${file}`, fs.existsSync(path.join(root, file)));
}
for (const match of html.matchAll(/<script\s+src="([^"]+)"/g)) {
  check(`Script exists: ${match[1]}`, fs.existsSync(path.join(root, match[1])));
}
for (const match of html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)) {
  check(`Stylesheet exists: ${match[1]}`, fs.existsSync(path.join(root, match[1])));
}
for (const name of ["credit-policy.svg", "risk-management.svg", "financial-access.svg", "credit-data.svg", "digital-savings.svg", "vietnam-findex.svg"]) {
  check(`FinRisk news asset retained: ${name}`, fs.existsSync(path.join(root, "assets", "news", name)));
}
for (const label of ["overview", "data", "evidence", "validation", "trace", "result", "export", "e2e", "acceptance"]) {
  check(`Workspace screen preserved: ${label}`, app.includes(`"${label}"`));
}
check("Mobile overflow fixes scoped to <=640", css.includes("FINRISK UI BASELINE #20") && css.includes("@media (max-width: 640px)"));
check("Long technical titles wrap", css.includes(".e2e-hero h2,") && css.includes(".evidence-work-main h3") && css.includes("overflow-wrap: anywhere"));
check("Forest palette unchanged", css.includes("--forest: #003c33;") && css.includes("--leaf: #9fe870;"));
check("Ambient engine not removed", fs.existsSync(path.join(root, "src", "ambient-graph.js")));
check("Roadmap retained", app.includes("PRODUCT ROADMAP · CONCEPT UI"));
check("News retained", app.includes('id="cg-news"'));
check("Selected mobile workspace tab kept visible", app.includes("nav.scrollLeft += tab.right") && app.includes("nav.scrollLeft -= viewport.left"));
console.log(`All ${n} FinRisk UI #20 static assertions PASS.`);

const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/styles.css", "utf8");
assert.match(css, /\.finrisk-trace-screen \.finrisk-trace-canvas/);
assert.match(css, /repeat\(5, minmax\(185px, 1fr\) 28px\) minmax\(185px, 1fr\)/);
assert.match(css, /overflow-x: auto/);
assert.match(css, /@media \(max-width: 720px\)/);
assert.match(css, /word-break: normal/);
console.log("PASS: 5 scoped responsive layout assertions for #11");

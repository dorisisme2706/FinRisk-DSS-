"use strict";
// Run with: node tests/finrisk-ui-01-02.test.js
// Guards the design decisions approved for FinRisk without changing CBAM logic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root,'assets','styles.css'),'utf8');
const js = fs.readFileSync(path.join(root,'src','ambient-graph.js'),'utf8');
function test(name, predicate) {
  assert.ok(predicate, name);
  console.log('PASS', name);
}
for (const [key, color] of Object.entries({
  'forest':'#003c33', 'forest-deep':'#002820',
  'leaf':'#9fe870', 'mint':'#edf8e6', 'sage':'#c5edab'
})) test(`Brand palette ${key} preserved`,css.includes(`--${key}: ${color}`));
test('Accessible workspace labels',css.includes('color: var(--workspace-ink)'));
test('Marketing gradients remain',css.includes('linear-gradient(135deg, rgba(6, 47, 32, 0.96)'));
test('Canvas / graph still driven by requestAnimationFrame',js.includes('window.requestAnimationFrame(tick)'));
test('Original responsive node density preserved',js.includes('window.innerWidth < 640 ? 30 : window.innerWidth < 1024 ? 46 : window.innerWidth < 1440 ? 64 : 76'));
test('Pointer glow still supported',js.includes('glowDistance: 220') && js.includes('window.addEventListener("pointermove"'));
test('Reduced-motion media changes supported',js.includes('motionQuery.addEventListener("change", onMotionPreferenceChange)'));
test('Resizing preserves particle positions',js.includes('node.x * width / previousWidth'));
console.log('All FinRisk UI #01/#02 preservation assertions PASS.');

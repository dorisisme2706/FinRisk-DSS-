const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('W02 customer profile is a separate, navigable workspace screen', () => {
  const app = read('src/app.js');
  assert.match(app, /\["customer",\s*"Hồ sơ khách hàng",\s*"CORE4 · READ ONLY"/);
  assert.match(app, /customer:\s*renderCustomerProfile/);
  assert.match(app, /function renderCustomerProfile\(\)/);
});

test('W02 uses the read-only CORE4 profile endpoint and validates its response contract', () => {
  const app = read('src/app.js');
  assert.match(app, /\/api\/customer\/profile\?sk_id_curr=/);
  assert.match(app, /data\.read_only === true/);
  assert.match(app, /data\.source === "CORE4"/);
  assert.match(app, /groupKeyList\.every/);
  assert.match(app, /PROFILE_RESERVED_FOR_FINAL_TEST/);
});

test('W02 displays the five documented CORE4 profile groups without inventing personal identity fields', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function renderCustomerProfile()');
  const end = app.indexOf('function renderEvidence()', start);
  assert.ok(start >= 0 && end > start);
  const w02 = app.slice(start, end);
  for (const group of ['customer_context', 'financial_snapshot', 'bureau_history', 'previous_applications', 'installment_history']) {
    assert.ok(w02.includes(`${group}:`), group);
  }
  for (const forbidden of ['days_birth', 'code_gender', 'full_name', 'target']) {
    assert.ok(!w02.includes(forbidden), forbidden);
  }
  assert.match(w02, /không tự quy đổi sang VNĐ/);
  assert.match(w02, /NULL được giữ là không có dữ liệu/);
});

test('W02 additive responsive styles and bilingual labels are present', () => {
  const css = read('assets/styles.css');
  assert.match(css, /\.finrisk-customer-profile/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /customer-profile-fields\{grid-template-columns:1fr/);
  const app = read('src/app.js');
  assert.match(app, /Customer profile lookup/);
  assert.match(app, /Tra cứu hồ sơ khách hàng/);
});

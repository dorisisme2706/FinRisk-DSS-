const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }

test('H18 frontend calls real decision-support endpoint and keeps H16 separation', () => {
  const app = read('src/app.js');
  assert.match(app, /H18 · FROZEN LIGHTGBM · API/);
  assert.match(app, /\/api\/decision\/assess\?sk_id_curr=/);
  assert.match(app, /automatic_credit_decision === false/);
  assert.match(app, /recommended_amount === null/);
  assert.match(app, /scenario_changes_model_score === false/);
});

test('H18 i18n contains VI and EN decision-support messages', () => {
  const i18n = read('src/i18n.js');
  for (const key of ['dataVersion','h16Stage','decisionSignal','businessPolicyNotApproved','h18Separation']) {
    assert.match(i18n, new RegExp(key + ':'));
  }
});

test('H18 backend includes frozen model and H16 evidence', () => {
  for (const rel of [
    'backend_ml/model/pipeline.joblib',
    'backend_ml/model/metadata.json',
    'backend_ml/model/threshold_policy.json',
    'backend_ml/splits/split_manifest.csv',
    'evidence/h16/release_metadata_h16.json',
    'evidence/h16/final_test.json'
  ]) assert.ok(fs.existsSync(path.join(root, rel)), rel);
});

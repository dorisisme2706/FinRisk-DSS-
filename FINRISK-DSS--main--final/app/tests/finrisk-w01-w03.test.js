const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function liveMlSource(app) {
  const start = app.indexOf('function marginDetailsValid');
  const end = app.indexOf('function renderResult()');
  assert.ok(start > 0 && end > start);
  return app.slice(start, end);
}

test('W03 live ML panel shows calibration, threshold scope, quality-flag text and log-odds breakdown', () => {
  const src = liveMlSource(read('src/app.js'));
  for (const needle of ['calibration_status', 'threshold_scope', 'other_features_sum', 'displayed_contributions_sum', 'base_margin', 'raw_margin', 'flagText']) {
    assert.ok(src.includes(needle), needle);
  }
});

test('W03 does not invent Low/Medium/High risk levels or loan terms in the live ML panel', () => {
  const src = liveMlSource(read('src/app.js'));
  assert.doesNotMatch(src, /low risk|medium risk|high risk|rủi ro (thấp|cao|trung bình)/i);
  assert.match(src, /recommended_amount === null/);
  assert.match(src, /automatic_credit_decision === false/);
});

test('W03 margin decomposition validator accepts a consistent decomposition and rejects others', () => {
  const src = liveMlSource(read('src/app.js'));
  const m = src.match(/function marginDetailsValid[\s\S]*?\n  }\n/);
  assert.ok(m, 'validator source');
  const fn = new Function(m[0] + '; return marginDetailsValid;')();
  const good = {base_margin: -2.8589359803718417, displayed_contributions_sum: 1.0, other_features_sum: 0.1368543107963558, raw_margin: -2.8589359803718417 + 1.0 + 0.1368543107963558};
  assert.equal(fn(good), true);
  assert.equal(fn({...good, raw_margin: good.raw_margin + 0.01}), false);
  assert.equal(fn({...good, other_features_sum: NaN}), false);
  assert.equal(fn({...good, base_margin: '1'}), false);
  assert.equal(fn(null), false);
});

test('W03 i18n: every new key has VI and EN text', () => {
  const i18n = read('src/i18n.js');
  for (const key of ['calibration', 'calibUncalibrated', 'thresholdScope', 'scopeDemoPending', 'unknownStatus', 'flagAnnuityMissing', 'flagBureauNotObserved', 'marginTitle', 'marginBase', 'marginTop10', 'marginOther', 'marginRaw', 'marginNote']) {
    const m = i18n.match(new RegExp(key + ':\\s*\\["([^"]+)",\\s*"([^"]+)"\\]'));
    assert.ok(m && m[1].length > 2 && m[2].length > 2, key);
    assert.notEqual(m[1], m[2], key + ' VI/EN must differ');
  }
});

test('W01 legacy CarbonGraph/CBAM translation lines are gone from i18n', () => {
  const i18n = read('src/i18n.js');
  for (const legacy of ['TerraMetric', 'Thị trường thép', 'Evidence Graph', 'numeric release', 'tCO₂e', 'HRC']) {
    assert.ok(!i18n.includes(legacy), legacy);
  }
});

test('W01 responsive rules for the live ML panel exist and the launcher exposes an optional host', () => {
  const css = read('assets/styles.css');
  assert.match(css, /finrisk-ml-live-panel #fr-ml-response \{ overflow-wrap: anywhere; \}/);
  assert.match(css, /@media \(max-width: 560px\) \{\s*\.finrisk-ml-live-panel/);
  const bat = read('run_with_ml.bat');
  assert.match(bat, /--host %HOST%/);
  assert.match(bat, /set "HOST=127\.0\.0\.1"/);
  assert.match(read('backend_api/server.py'), /--host/);
});

test('W01 polish: no double parentheses, natural English policy wording, edit button aligned', () => {
  const app = read('src/app.js');
  assert.ok(app.includes(' · ${d.calibration_status}`') && app.includes(' · ${d.threshold_scope}`'));
  assert.ok(!app.includes('(${d.calibration_status})') && !app.includes('(${d.threshold_scope})'));
  const i18n = read('src/i18n.js');
  assert.ok(i18n.includes('No approval/rejection policy has been approved yet'));
  assert.ok(!i18n.includes('No approved approval/rejection policy'));
  assert.match(read('assets/styles.css'), /\.masked-result-panel #finrisk-decision-edit \{ margin: 8px 18px 0; \}/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
require('../src/finrisk-simulation.js');
const engine = global.FinRiskSimulation;

test('W04 annuity schedule supports a zero-interest scenario', () => {
  const result = engine.calculate({ principal: 120000000, termMonths: 24, annualRatePercent: 0, method: 'annuity' });
  assert.equal(result.schedule.length, 24);
  assert.ok(Math.abs(result.firstInstallment - 5000000) < 1e-7);
  assert.ok(Math.abs(result.totalInterest) < 1e-7);
  assert.ok(Math.abs(result.totalRepayment - 120000000) < 1e-6);
  assert.equal(result.schedule.at(-1).closingBalance, 0);
});

test('W04 annuity schedule returns a level scheduled payment for a positive rate', () => {
  const result = engine.calculate({ principal: 120000000, termMonths: 24, annualRatePercent: 12, method: 'annuity' });
  assert.ok(result.firstInstallment > 5000000);
  assert.ok(Math.abs(result.firstInstallment - result.lastInstallment) < 1e-6);
  assert.ok(result.totalInterest > 0);
  assert.ok(Math.abs(result.totalRepayment - (result.principal + result.totalInterest)) < 1e-6);
  assert.ok(result.schedule.every(row => row.principalPayment > 0 && row.interestPayment >= 0));
});

test('W04 equal-principal schedule keeps principal constant and installments decline', () => {
  const result = engine.calculate({ principal: 120000000, termMonths: 12, annualRatePercent: 12, method: 'equal_principal' });
  const principalPayments = result.schedule.map(row => row.principalPayment);
  assert.ok(principalPayments.every(value => Math.abs(value - 10000000) < 1e-6));
  assert.ok(result.firstInstallment > result.lastInstallment);
  assert.ok(result.schedule.every((row, index, rows) => index === 0 || row.totalPayment <= rows[index - 1].totalPayment + 1e-6));
});

test('W04 amortization schedule closes the balance and reconciles principal, interest and repayment', () => {
  for (const method of ['annuity', 'equal_principal']) {
    const result = engine.calculate({ principal: 250000001, termMonths: 37, annualRatePercent: 8.75, method });
    const principalPaid = result.schedule.reduce((sum, row) => sum + row.principalPayment, 0);
    const interestPaid = result.schedule.reduce((sum, row) => sum + row.interestPayment, 0);
    const closing = result.schedule.at(-1).closingBalance;
    assert.ok(Math.abs(principalPaid - result.principal) < 1e-5);
    assert.ok(Math.abs(interestPaid - result.totalInterest) < 1e-6);
    assert.equal(closing, 0);
    assert.ok(Math.abs(result.totalRepayment - principalPaid - interestPaid) < 1e-5);
  }
});

test('W04 validates all input boundaries and rejects unknown repayment methods', () => {
  const valid = { principal: 1, termMonths: 1, annualRatePercent: 0, method: 'annuity' };
  assert.equal(engine.validateInputs(valid).valid, true);
  assert.equal(engine.validateInputs({ ...valid, principal: 0 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, termMonths: 0 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, termMonths: 1.5 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, termMonths: 601 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, annualRatePercent: -0.01 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, annualRatePercent: 100.01 }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, annualRatePercent: '' }).valid, false);
  assert.equal(engine.validateInputs({ ...valid, method: 'approve' }).valid, false);
  assert.throws(() => engine.calculate({ ...valid, principal: 0 }), error => error.code === 'INVALID_SIMULATION_INPUT');
});

test('W04 reference cash flow is arithmetic only and does not emit a pass/fail decision', () => {
  const result = engine.calculateReferenceCashflow({ monthlyIncome: 15000000, monthlyExpenses: 5000000, existingMonthlyDebt: 1000000 }, 6000000);
  assert.equal(result.residualBeforeNewLoan, 9000000);
  assert.equal(result.residualAfterFirstInstallment, 3000000);
  assert.equal(result.firstInstallmentToIncomePercent, 40);
  assert.equal('decision' in result, false);
  assert.equal(engine.calculateReferenceCashflow({ monthlyIncome: 0, monthlyExpenses: 100, existingMonthlyDebt: 0 }, 10), null);
});

test('W04 is registered as a separate screen and loads its local-only simulation engine', () => {
  const app = read('src/app.js');
  const html = read('index.html');
  assert.match(app, /\["simulation",\s*"Mô phỏng khoản vay",\s*"W04 · Kịch bản trả nợ"/);
  assert.match(app, /simulation:\s*renderLoanSimulation/);
  assert.match(app, /function renderLoanSimulation\(\)/);
  assert.match(app, /FinRiskSimulation/);
  assert.match(html, /src="src\/finrisk-simulation\.js"/);
  assert.match(app, /w04-export-csv/);
  assert.match(app, /Không gửi backend, không gọi ML/);
  assert.match(app, /lãi suất tháng = lãi suất năm \/ 12/);
});

test('W04 has explicit VI/EN copy and responsive rules for mobile, tablet and desktop layouts', () => {
  const i18n = read('src/i18n.js');
  const css = read('assets/styles.css');
  for (const [vi, en] of [
    ['"Mô phỏng khoản vay": "Loan simulation"', 'Loan simulation'],
    ['"Lãi suất giả định (%/năm)": "Assumed annual interest rate (%)"', 'Assumed annual interest rate (%)'],
    ['"Tải lịch trả nợ CSV": "Download repayment schedule CSV"', 'Download repayment schedule CSV'],
    ['"Quy ước tính: lãi suất tháng', 'Calculation convention: monthly rate'],
    ['"Đây là kết quả tính toán theo giả định đầu vào', 'This result is calculated from the entered assumptions']
  ]) {
    assert.ok(i18n.includes(vi), en);
  }
  assert.match(css, /\.finrisk-w04-screen/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /\.w04-table-wrap\{width:100%;overflow-x:auto/);
});

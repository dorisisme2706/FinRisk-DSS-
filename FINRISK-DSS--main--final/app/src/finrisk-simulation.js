(function (root) {
  "use strict";

  const MAX_PRINCIPAL = 1e13;
  const MAX_TERM_MONTHS = 600;
  const MAX_ANNUAL_RATE_PERCENT = 100;
  const METHODS = Object.freeze({
    annuity: "annuity",
    equalPrincipal: "equal_principal"
  });

  function asNumber(value) {
    if (typeof value === "string" && value.trim() === "") return NaN;
    return Number(value);
  }

  function validateInputs(input) {
    const source = input || {};
    const principal = asNumber(source.principal);
    const termMonths = asNumber(source.termMonths);
    const annualRatePercent = asNumber(source.annualRatePercent);
    const method = String(source.method || "");
    const errors = {};

    if (!Number.isFinite(principal) || principal <= 0 || principal > MAX_PRINCIPAL) {
      errors.principal = "Vui lòng nhập số tiền vay lớn hơn 0 và không vượt 10.000.000.000.000 VNĐ.";
    }
    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > MAX_TERM_MONTHS) {
      errors.termMonths = "Thời hạn vay phải là số nguyên từ 1 đến 600 tháng.";
    }
    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > MAX_ANNUAL_RATE_PERCENT) {
      errors.annualRatePercent = "Lãi suất giả định phải từ 0 đến 100%/năm. Nhập 0 nếu muốn mô phỏng không lãi.";
    }
    if (![METHODS.annuity, METHODS.equalPrincipal].includes(method)) {
      errors.method = "Vui lòng chọn phương thức trả nợ hợp lệ.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      normalized: { principal, termMonths, annualRatePercent, method }
    };
  }

  function calculate(input) {
    const validation = validateInputs(input);
    if (!validation.valid) {
      const error = new Error("Invalid loan simulation inputs.");
      error.code = "INVALID_SIMULATION_INPUT";
      error.errors = validation.errors;
      throw error;
    }

    const { principal, termMonths, annualRatePercent, method } = validation.normalized;
    const monthlyRate = annualRatePercent / 100 / 12;
    const annuityPayment = method === METHODS.annuity
      ? (monthlyRate === 0
          ? principal / termMonths
          : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)))
      : null;

    if (method === METHODS.annuity && !Number.isFinite(annuityPayment)) {
      throw new Error("Unable to calculate the annuity payment for these assumptions.");
    }

    const schedule = [];
    let balance = principal;
    for (let month = 1; month <= termMonths; month += 1) {
      const openingBalance = balance;
      const interestPayment = openingBalance * monthlyRate;
      let principalPayment;

      if (method === METHODS.annuity) {
        principalPayment = month === termMonths
          ? openingBalance
          : Math.min(openingBalance, annuityPayment - interestPayment);
      } else {
        principalPayment = month === termMonths
          ? openingBalance
          : Math.min(openingBalance, principal / termMonths);
      }

      // Keep the final balance exactly zero and absorb floating-point residue in the last period.
      const closingBalance = month === termMonths
        ? 0
        : Math.max(0, openingBalance - principalPayment);
      const actualPrincipalPayment = month === termMonths ? openingBalance : principalPayment;
      const totalPayment = actualPrincipalPayment + interestPayment;

      schedule.push({
        month,
        openingBalance,
        principalPayment: actualPrincipalPayment,
        interestPayment,
        totalPayment,
        closingBalance
      });
      balance = closingBalance;
    }

    const totalInterest = schedule.reduce((sum, row) => sum + row.interestPayment, 0);
    const totalRepayment = schedule.reduce((sum, row) => sum + row.totalPayment, 0);
    const payments = schedule.map((row) => row.totalPayment);
    const firstInstallment = payments[0];
    const lastInstallment = payments[payments.length - 1];

    return {
      principal,
      termMonths,
      annualRatePercent,
      monthlyRate,
      method,
      schedule,
      firstInstallment,
      lastInstallment,
      averageInstallment: totalRepayment / termMonths,
      minimumInstallment: Math.min(...payments),
      maximumInstallment: Math.max(...payments),
      totalInterest,
      totalRepayment
    };
  }

  function calculateReferenceCashflow(input, firstInstallment) {
    const source = input || {};
    const monthlyIncome = asNumber(source.monthlyIncome);
    const monthlyExpenses = asNumber(source.monthlyExpenses);
    const existingMonthlyDebt = asNumber(source.existingMonthlyDebt);
    const newInstallment = asNumber(firstInstallment);

    if (
      !Number.isFinite(monthlyIncome) || monthlyIncome <= 0 ||
      !Number.isFinite(monthlyExpenses) || monthlyExpenses < 0 ||
      !Number.isFinite(existingMonthlyDebt) || existingMonthlyDebt < 0 ||
      !Number.isFinite(newInstallment) || newInstallment < 0
    ) return null;

    const residualBeforeNewLoan = monthlyIncome - monthlyExpenses - existingMonthlyDebt;
    return {
      monthlyIncome,
      monthlyExpenses,
      existingMonthlyDebt,
      residualBeforeNewLoan,
      residualAfterFirstInstallment: residualBeforeNewLoan - newInstallment,
      firstInstallmentToIncomePercent: newInstallment / monthlyIncome * 100
    };
  }

  root.FinRiskSimulation = Object.freeze({
    METHODS,
    MAX_PRINCIPAL,
    MAX_TERM_MONTHS,
    MAX_ANNUAL_RATE_PERCENT,
    validateInputs,
    calculate,
    calculateReferenceCashflow
  });
})(typeof window !== "undefined" ? window : globalThis);

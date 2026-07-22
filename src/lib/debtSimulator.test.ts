import { describe, expect, it } from 'vitest';
import { generatePlanOptions, getMonthlyRatePercent, simulateDebtPayment, type DebtSimulationInput } from './debtSimulator';

const baseInput: Omit<DebtSimulationInput, 'paymentAmountSatang'> = {
  balanceSatang: 1000000, // ฿10,000
  interestRatePercent: 12, // 12% annual
  interestRatePeriod: 'annual',
  minimumPaymentSatang: 100000, // ฿1,000
  dueDate: '2026-08-19',
  extraPaymentBehavior: 'reduce_principal',
};

describe('getMonthlyRatePercent', () => {
  it('divides an annual rate by 12', () => {
    expect(getMonthlyRatePercent(12, 'annual')).toBe(1);
  });

  it('uses a monthly rate directly', () => {
    expect(getMonthlyRatePercent(2.75, 'monthly')).toBe(2.75);
  });

  it('treats a zero or negative rate as zero', () => {
    expect(getMonthlyRatePercent(0, 'annual')).toBe(0);
    expect(getMonthlyRatePercent(-5, 'annual')).toBe(0);
  });
});

describe('simulateDebtPayment', () => {
  it('splits a minimum payment into interest then principal', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 100000 });
    expect(res.interestPaidThisPaymentSatang).toBe(10000); // 10,000 * 1%
    expect(res.principalPaidThisPaymentSatang).toBe(90000);
    expect(res.balanceAfterPaymentSatang).toBe(910000);
  });

  it('reduces more principal and remaining interest as payment increases', () => {
    const min = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 100000 });
    const extra = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 200000 });
    expect(extra.principalPaidThisPaymentSatang).toBeGreaterThan(min.principalPaidThisPaymentSatang);
    expect(extra.balanceAfterPaymentSatang).toBeLessThan(min.balanceAfterPaymentSatang);
    expect(extra.estimatedInstallmentsRemaining!).toBeLessThan(min.estimatedInstallmentsRemaining!);
    expect(extra.estimatedRemainingInterestSatang!).toBeLessThan(min.estimatedRemainingInterestSatang!);
  });

  it('warns when payment is below the period interest (debt grows)', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 5000 }); // interest is ฿100
    expect(res.warnings).toContain('ยอดชำระน้อยกว่าดอกเบี้ยที่เกิดขึ้นในงวดนี้ ซึ่งจะทำให้ยอดหนี้สะสมเพิ่มขึ้น');
  });

  it('warns and reports no payoff when payment exactly equals the period interest', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 10000 }); // exactly ฿100 interest
    expect(res.warnings).toContain('ยอดชำระเท่ากับดอกเบี้ยพอดี ซึ่งจะไม่ลดเงินต้นเลย');
    expect(res.estimatedInstallmentsRemaining).toBeNull();
  });

  it('caps an overpayment at the payoff amount plus any early-payoff fee', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 2000000, earlyPayoffFeeSatang: 50000 });
    expect(res.paymentAmountSatang).toBe(1060000); // 10,000 balance + 100 interest + 500 fee
    expect(res.balanceAfterPaymentSatang).toBe(0);
  });

  it('handles a zero-interest debt as pure principal reduction', () => {
    const res = simulateDebtPayment({ ...baseInput, interestRatePercent: 0, paymentAmountSatang: 200000 });
    expect(res.interestPaidThisPaymentSatang).toBe(0);
    expect(res.principalPaidThisPaymentSatang).toBe(200000);
    expect(res.balanceAfterPaymentSatang).toBe(800000);
  });

  it('does not claim interest savings for advance_installment', () => {
    const res = simulateDebtPayment({ ...baseInput, extraPaymentBehavior: 'advance_installment', paymentAmountSatang: 200000 });
    expect(res.interestSavedVsMinimumSatang).toBe(0);
    expect(res.warnings.some((w) => w.includes('ยอดชำระล่วงหน้า'))).toBe(true);
  });

  it('reports limited precision and no projection at all for unknown lender behavior', () => {
    const res = simulateDebtPayment({ ...baseInput, extraPaymentBehavior: 'unknown', paymentAmountSatang: 200000 });
    expect(res.precisionLevel).toBe('limited');
    expect(res.interestSavedVsMinimumSatang).toBeNull();
    expect(res.estimatedInstallmentsRemaining).toBeNull();
    expect(res.estimatedPayoffDate).toBeNull();
  });

  it('returns insufficient_data affordability with no financial context', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 200000 });
    expect(res.affordabilityStatus).toBe('insufficient_data');
    expect(res.cashRemainingAfterPaymentSatang).toBeNull();
  });

  describe('affordability tiers', () => {
    const context = {
      plannedIncomeSatang: 3000000, // ฿30,000
      currentMonthSpendingSatang: 1500000, // ฿15,000
      debtPaymentsThisMonthSatang: 200000, // ฿2,000
      minimumCashReserveSatang: 500000, // ฿5,000
      safeBufferSatang: 300000, // ฿3,000
    };

    it('is safe when cash remains above reserve + buffer', () => {
      const res = simulateDebtPayment({ ...baseInput, ...context, paymentAmountSatang: 200000 });
      expect(res.affordabilityStatus).toBe('safe');
    });

    it('is tight when cash remains above reserve but below reserve + buffer', () => {
      const res = simulateDebtPayment({ ...baseInput, ...context, paymentAmountSatang: 600000 });
      expect(res.affordabilityStatus).toBe('tight');
    });

    it('is risky when cash remaining falls below the reserve', () => {
      const res = simulateDebtPayment({ ...baseInput, ...context, paymentAmountSatang: 900000 });
      expect(res.affordabilityStatus).toBe('risky');
    });
  });

  it('never returns a negative balance even for a very large overpayment', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 5000000 });
    expect(res.balanceAfterPaymentSatang).toBe(0);
    expect(res.interestPaidThisPaymentSatang).toBeGreaterThanOrEqual(0);
  });

  it('caps the amortization horizon instead of looping forever', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 10100 }); // barely above ฿100 interest
    expect(res.estimatedInstallmentsRemaining).toBeLessThanOrEqual(600);
  });

  it('estimates the payoff month as a plain YYYY-MM key', () => {
    const res = simulateDebtPayment({ ...baseInput, paymentAmountSatang: 200000 });
    expect(res.estimatedPayoffDate).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns no payoff date when the debt has no due date', () => {
    const res = simulateDebtPayment({ ...baseInput, dueDate: undefined, paymentAmountSatang: 200000 });
    expect(res.estimatedPayoffDate).toBeNull();
  });
});

describe('generatePlanOptions', () => {
  const context = {
    plannedIncomeSatang: 2000000, // ฿20,000
    currentMonthSpendingSatang: 1200000, // ฿12,000
    debtPaymentsThisMonthSatang: 200000, // ฿2,000
    minimumCashReserveSatang: 500000, // ฿5,000
    safeBufferSatang: 300000, // ฿3,000
  };

  it('recommends the affordable cash amount when it exceeds the minimum', () => {
    const plans = generatePlanOptions({ ...baseInput, ...context, plannedIncomeSatang: 3000000 });
    // available = 30k - 12k - 2k - 5k - 3k = 8k
    expect(plans.recommendedAmountSatang).toBe(800000);
    expect(plans.recommended.affordabilityStatus).toBe('safe');
  });

  it('returns no recommendation and a shortfall when cash flow is negative', () => {
    const plans = generatePlanOptions({ ...baseInput, ...context, plannedIncomeSatang: 1000000, currentMonthSpendingSatang: 1200000 });
    expect(plans.recommendedAmountSatang).toBeNull();
    expect(plans.minimum.shortfallSatang).toBe(100000); // ฿1,000 minimum, ฿0 affordable
  });

  it('keeps the accelerated plan at or above the minimum cash reserve', () => {
    const plans = generatePlanOptions({ ...baseInput, ...context, plannedIncomeSatang: 3000000 });
    expect(plans.accelerated.cashRemainingAfterPaymentSatang).toBeGreaterThanOrEqual(500000);
  });
});

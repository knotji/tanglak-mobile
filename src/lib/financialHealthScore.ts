import type { Debt } from '@/lib/debts';
import { filterActiveDebts } from '@/lib/debtPortfolioStrategy';
import { formatTHB } from '@/lib/money';

export interface FinancialHealthResult {
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  dtiPercent: number; // e.g. 32.5%
  savingsRatePercent: number;
  advice: string;
  color: string;
  statusLabel: string;
}

export function calculateFinancialHealthScore(
  debts: Debt[],
  monthlyExpensesSatang: number,
  monthlyIncomeSatang: number,
): FinancialHealthResult {
  const activeDebts = filterActiveDebts(debts);
  const totalDebtMinimumsSatang = activeDebts.reduce(
    (sum, d) => sum + (d.minimumPaymentSatang ?? d.amountDueSatang ?? 0),
    0,
  );

  // Baseline income if user hasn't recorded income yet
  const income = monthlyIncomeSatang > 0 ? monthlyIncomeSatang : Math.max(30000_00, monthlyExpensesSatang + totalDebtMinimumsSatang);

  // 1. DTI Score (40 points max) - Debt to Income Ratio
  const dtiRatio = totalDebtMinimumsSatang / income;
  const dtiPercent = Math.round(dtiRatio * 100 * 10) / 10;
  let dtiScore = 40;
  if (dtiRatio <= 0.30) {
    dtiScore = 40;
  } else if (dtiRatio <= 0.40) {
    dtiScore = 30;
  } else if (dtiRatio <= 0.50) {
    dtiScore = 20;
  } else if (dtiRatio <= 0.65) {
    dtiScore = 10;
  } else {
    dtiScore = 0;
  }

  // 2. Surplus / Savings Rate Score (30 points max)
  const netRemainingSatang = income - monthlyExpensesSatang - totalDebtMinimumsSatang;
  const savingsRatio = netRemainingSatang / income;
  const savingsRatePercent = Math.max(0, Math.round(savingsRatio * 100 * 10) / 10);
  let savingsScore = 0;
  if (savingsRatio >= 0.25) {
    savingsScore = 30;
  } else if (savingsRatio >= 0.15) {
    savingsScore = 24;
  } else if (savingsRatio >= 0.05) {
    savingsScore = 16;
  } else if (savingsRatio >= 0) {
    savingsScore = 8;
  } else {
    savingsScore = 0;
  }

  // 3. Debt Load / Risk Score (30 points max)
  let debtScore = 30;
  if (activeDebts.length === 0) {
    debtScore = 30;
  } else if (activeDebts.length <= 2) {
    debtScore = 24;
  } else if (activeDebts.length <= 4) {
    debtScore = 18;
  } else {
    debtScore = 10;
  }

  const totalScore = Math.min(100, Math.max(0, dtiScore + savingsScore + debtScore));

  let grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' = 'B';
  let color = '#4f46e5';
  let statusLabel = 'สภาพคล่องปานกลาง';
  let advice = 'พยายามรักษาวินัยการชำระหนี้ตรงเวลา และควบคุมค่าใช้จ่ายฟุ่มเฟือย';

  if (totalScore >= 90) {
    grade = 'A+';
    color = '#10b981';
    statusLabel = 'สุขภาพการเงินดีเยี่ยม';
    advice = 'การเงินของคุณแข็งแกร่งมาก มีสภาพคล่องสูงและภาระหนี้อยู่ในระดับปลอดภัย';
  } else if (totalScore >= 80) {
    grade = 'A';
    color = '#059669';
    statusLabel = 'สุขภาพการเงินดีมาก';
    advice = 'ภาระหนี้สินอยู่ในเกณฑ์ดี ควรโปะหนี้เพิ่มเพื่อประหยัดดอกเบี้ยในระยะยาว';
  } else if (totalScore >= 70) {
    grade = 'B+';
    color = '#6366f1';
    statusLabel = 'สภาพคล่องปลอดภัย';
    advice = `ภาระหนี้ต่อรายได้ (DTI) อยู่ที่ ${dtiPercent}% ควบคุมรายจ่ายและเพิ่มเงินออมฉุกเฉิน`;
  } else if (totalScore >= 60) {
    grade = 'B';
    color = '#d97706';
    statusLabel = 'ภาระหนี้เริ่มตึงตัว';
    advice = `ภาระหนี้ขั้นต่ำคิดเป็น ${dtiPercent}% ของรายได้ แนะนำใช้แผน Snowball เพื่อเร่งปิดหนี้ก้อนเล็ก`;
  } else if (totalScore >= 50) {
    grade = 'C';
    color = '#ea580c';
    statusLabel = 'เฝ้าระวังภาระหนี้';
    advice = `DTI อยู่ที่ ${dtiPercent}% เกินเกณฑ์มาตรฐาน 40% ควรชะลอการสร้างหนี้ใหม่ทันที`;
  } else {
    grade = 'D';
    color = '#ef4444';
    statusLabel = 'เสี่ยงขาดสภาพคล่อง';
    advice = `ภาระหนี้รวมสูงเกินไป (${formatTHB(totalDebtMinimumsSatang)}/เดือน) ควรพิจารณาปรับโครงสร้างหนี้`;
  }

  return {
    score: totalScore,
    grade,
    dtiPercent,
    savingsRatePercent,
    advice,
    color,
    statusLabel,
  };
}

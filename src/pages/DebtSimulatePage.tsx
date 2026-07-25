import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import { getDebtById, type Debt } from '@/lib/debts';
import { getOverviewSnapshot } from '@/lib/overview';
import { formatTHB } from '@/lib/money';
import { formatThaiDateLabel, formatThaiMonthYearLabel } from '@/lib/date';
import {
  generatePlanOptions,
  simulateDebtPayment,
  SIMULATOR_ASSUMPTIONS,
  LENDER_RISK_WARNING,
  UNKNOWN_BEHAVIOR_EXPLANATION,
  type AffordabilityStatus,
  type DebtSimulationOutput,
  type ExtraPaymentBehavior,
} from '@/lib/debtSimulator';

const AFFORDABILITY_LABEL: Record<AffordabilityStatus, string> = {
  safe: 'ปลอดภัย',
  tight: 'เงินตึง',
  risky: 'เสี่ยงเงินไม่พอใช้',
  insufficient_data: 'ข้อมูลยังไม่พอ',
};

const AFFORDABILITY_TONE: Record<AffordabilityStatus, { bg: string; fg: string }> = {
  safe: { bg: '#ecfdf5', fg: '#047857' },
  tight: { bg: '#fef3c7', fg: '#b45309' },
  risky: { bg: '#fee2e2', fg: '#dc2626' },
  insufficient_data: { bg: '#f1f5f9', fg: '#64748b' },
};

const EXTRA_BEHAVIOR_LABEL: Record<ExtraPaymentBehavior, string> = {
  unknown: 'ไม่ทราบเงื่อนไขผู้ให้กู้ (ประเมินคร่าวๆ)',
  reduce_principal: 'ลดต้นลดดอก (ลดดอกเบี้ยจริง)',
  advance_installment: 'จ่ายงวดล่วงหน้า (ไม่ลดเงินต้นทันที)',
};

function AffordabilityBadge({ status }: { status: AffordabilityStatus }) {
  const tone = AFFORDABILITY_TONE[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>
      {AFFORDABILITY_LABEL[status]}
    </span>
  );
}

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ background: 'var(--tl-primary-soft)', padding: '10px 12px', borderRadius: 'var(--tl-radius-sm)' }}>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 700, color: tone ?? 'var(--ion-text-color)', fontVariantNumeric: 'tabular-nums' }}>{children}</p>
    </div>
  );
}

type PlanKey = 'minimum' | 'recommended' | 'accelerated' | 'custom';

const PLAN_LABEL: Record<PlanKey, string> = {
  minimum: 'ขั้นต่ำ',
  recommended: 'แนะนำ',
  accelerated: 'เร่งปิด',
  custom: 'ยอดที่ระบุเอง',
};

const DebtSimulatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const [plannedIncome, setPlannedIncome] = useState('');
  const [spending, setSpending] = useState('');
  const [debtPayments, setDebtPayments] = useState('');
  const [minReserve, setMinReserve] = useState('5000');
  const [safeBuffer, setSafeBuffer] = useState('3000');
  const [extraBehavior, setExtraBehavior] = useState<ExtraPaymentBehavior>('unknown');
  const [showSettings, setShowSettings] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('minimum');
  const [customAmount, setCustomAmount] = useState('');
  const [snapshotLoadFailed, setSnapshotLoadFailed] = useState(false);

  useIonViewWillEnter(() => {
    setLoading(true);
    setNotFound(false);
    setError('');
    setSnapshotLoadFailed(false);
    void Promise.all([getDebtById(id), Promise.allSettled([getOverviewSnapshot()])])
      .then(([loadedDebt, [snapshotResult]]) => {
        if (!loadedDebt) {
          setNotFound(true);
          return;
        }
        setDebt(loadedDebt);
        if (snapshotResult.status === 'fulfilled') {
          const snapshot = snapshotResult.value;
          setPlannedIncome(snapshot.plannedIncomeSatang > 0 ? String(snapshot.plannedIncomeSatang / 100) : '');
          setSpending(snapshot.totals.livingExpenseSatang > 0 ? String(snapshot.totals.livingExpenseSatang / 100) : '');
          setDebtPayments(snapshot.totals.debtPaymentSatang > 0 ? String(snapshot.totals.debtPaymentSatang / 100) : '');
        } else {
          // Pre-fill failed -- the fields below stay editable/blank rather
          // than silently showing zeros that look like real financial data.
          setSnapshotLoadFailed(true);
        }
        setSelectedPlan('minimum');
        setCustomAmount('');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลหนี้ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  });

  const parseToSatang = (value: string): number | undefined => {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  };

  const context = useMemo(
    () => ({
      plannedIncomeSatang: parseToSatang(plannedIncome),
      currentMonthSpendingSatang: parseToSatang(spending),
      debtPaymentsThisMonthSatang: parseToSatang(debtPayments),
      minimumCashReserveSatang: parseToSatang(minReserve) ?? 0,
      safeBufferSatang: parseToSatang(safeBuffer) ?? 0,
    }),
    [plannedIncome, spending, debtPayments, minReserve, safeBuffer],
  );
  const hasContext = context.plannedIncomeSatang !== undefined;

  const balanceSatang = debt?.outstandingBalanceSatang ?? 0;
  const interestRatePercent = debt?.interestRateAnnual ?? 0;
  const minimumPaymentSatang = debt?.minimumPaymentSatang ?? debt?.amountDueSatang ?? 0;

  const plans = useMemo(() => {
    if (!debt) return null;
    return generatePlanOptions({
      balanceSatang,
      interestRatePercent,
      interestRatePeriod: 'annual',
      minimumPaymentSatang,
      dueDate: debt.dueDate,
      extraPaymentBehavior: extraBehavior,
      ...context,
    });
  }, [debt, balanceSatang, interestRatePercent, minimumPaymentSatang, extraBehavior, context]);

  const activePaymentSatang = useMemo(() => {
    if (selectedPlan === 'minimum') return minimumPaymentSatang;
    if (selectedPlan === 'recommended') return plans?.recommendedAmountSatang ?? minimumPaymentSatang;
    if (selectedPlan === 'accelerated') return plans?.acceleratedAmountSatang ?? minimumPaymentSatang;
    const parsed = Number(customAmount.replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
  }, [selectedPlan, customAmount, minimumPaymentSatang, plans]);

  const activeSimulation: DebtSimulationOutput | null = useMemo(() => {
    if (!debt) return null;
    return simulateDebtPayment({
      balanceSatang,
      interestRatePercent,
      interestRatePeriod: 'annual',
      minimumPaymentSatang,
      paymentAmountSatang: activePaymentSatang,
      dueDate: debt.dueDate,
      extraPaymentBehavior: extraBehavior,
      ...context,
    });
  }, [debt, balanceSatang, interestRatePercent, minimumPaymentSatang, activePaymentSatang, extraBehavior, context]);

  const handleSelectPlan = (plan: 'minimum' | 'recommended' | 'accelerated') => {
    setSelectedPlan(plan);
    if (plan === 'minimum') setCustomAmount(String(minimumPaymentSatang / 100));
    else if (plan === 'recommended') setCustomAmount(String((plans?.recommendedAmountSatang ?? minimumPaymentSatang) / 100));
    else setCustomAmount(String((plans?.acceleratedAmountSatang ?? minimumPaymentSatang) / 100));
  };

  const bumpCustomAmount = (deltaBaht: number) => {
    setSelectedPlan('custom');
    const current = Number(customAmount.replace(/,/g, '')) || 0;
    setCustomAmount(String(current + deltaBaht));
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/debts" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="วางแผนจ่ายหนี้" subtitle={debt?.name} />

        {loading && <div className="ion-text-center ion-margin-top"><IonSpinner /></div>}
        {notFound && <div className="tl-card tl-empty"><p>ไม่พบหนี้นี้</p></div>}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {debt && plans && activeSimulation && (
          <>
            <div className="tl-card">
              <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>ยอดคงเหลือ</p>
              <p className="tl-amount" style={{ fontSize: 28, margin: '4px 0 0' }}>{formatTHB(balanceSatang)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <Stat label="ขั้นต่ำที่ต้องจ่าย">{formatTHB(minimumPaymentSatang)}</Stat>
                <Stat label="อัตราดอกเบี้ย">{interestRatePercent}% ต่อปี</Stat>
                <Stat label="วันครบกำหนด">{debt.dueDate ? (formatThaiDateLabel(debt.dueDate) ?? debt.dueDate) : 'ไม่ระบุ'}</Stat>
                <Stat label="ชำระส่วนเกิน">{EXTRA_BEHAVIOR_LABEL[extraBehavior]}</Stat>
              </div>
            </div>

            {extraBehavior === 'unknown' && (
              <div className="tl-card" style={{ background: '#FBF0DD', borderColor: '#f0dcae' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--tl-debt)' }}>เงื่อนไขการตัดยอดชำระส่วนเกิน</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--tl-debt)' }}>{UNKNOWN_BEHAVIOR_EXPLANATION}</p>
              </div>
            )}

            <div className="tl-card">
              <button
                type="button"
                className="tl-tap-row"
                onClick={() => setShowSettings((v) => !v)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14, padding: '6px 0' }}
              >
                <span>ปรับแต่งข้อมูลทางการเงิน {showSettings ? '(ปิด)' : '(ขยาย)'}</span>
                <span>{showSettings ? '▲' : '▼'}</span>
              </button>

              {showSettings && (
                <div style={{ marginTop: 14 }}>
                  {snapshotLoadFailed && (
                    <IonText color="warning">
                      <p style={{ fontSize: 12, marginTop: 0, marginBottom: 10 }}>
                        โหลดข้อมูลรายรับ-รายจ่ายอัตโนมัติไม่สำเร็จ กรุณากรอกด้วยตนเอง
                      </p>
                    </IonText>
                  )}
                  <FieldLabel>รายได้รวมเดือนนี้ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={plannedIncome} onIonInput={(e) => setPlannedIncome(e.detail.value ?? '')} />

                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>ค่าใช้จ่ายทั่วไปเดือนนี้ (บาท)</FieldLabel>
                    <IonInput fill="outline" type="number" inputmode="decimal" value={spending} onIonInput={(e) => setSpending(e.detail.value ?? '')} />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>ชำระหนี้อื่นไปแล้วเดือนนี้ (บาท)</FieldLabel>
                    <IonInput fill="outline" type="number" inputmode="decimal" value={debtPayments} onIonInput={(e) => setDebtPayments(e.detail.value ?? '')} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div>
                      <FieldLabel>เงินสำรองขั้นต่ำ (บาท)</FieldLabel>
                      <IonInput fill="outline" type="number" inputmode="decimal" value={minReserve} onIonInput={(e) => setMinReserve(e.detail.value ?? '')} />
                    </div>
                    <div>
                      <FieldLabel>เงินเผื่อปลอดภัย (บาท)</FieldLabel>
                      <IonInput fill="outline" type="number" inputmode="decimal" value={safeBuffer} onIonInput={(e) => setSafeBuffer(e.detail.value ?? '')} />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>เงื่อนไขเมื่อจ่ายส่วนเกินขั้นต่ำ</FieldLabel>
                    <IonSelect fill="outline" interface="action-sheet" value={extraBehavior} onIonChange={(e) => setExtraBehavior(e.detail.value)}>
                      {(Object.keys(EXTRA_BEHAVIOR_LABEL) as ExtraPaymentBehavior[]).map((key) => (
                        <IonSelectOption key={key} value={key}>{EXTRA_BEHAVIOR_LABEL[key]}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 8px' }}>เปรียบเทียบทางเลือกการชำระเงิน</p>

            {(['minimum', 'recommended', 'accelerated'] as const).map((plan) => {
              const detail = plans[plan];
              const amount = plan === 'minimum' ? minimumPaymentSatang : plan === 'recommended' ? plans.recommendedAmountSatang : plans.acceleratedAmountSatang;
              const isSelected = selectedPlan === plan;
              return (
                <button
                  key={plan}
                  type="button"
                  className="tl-tap-row"
                  style={{ marginTop: 10 }}
                  onClick={() => handleSelectPlan(plan)}
                >
                  <div className="tl-card" style={{ borderColor: isSelected ? 'var(--ion-color-primary)' : undefined, borderWidth: isSelected ? 2 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tl-text-secondary)', background: 'var(--tl-muted)', borderRadius: 999, padding: '3px 10px' }}>
                        {PLAN_LABEL[plan]}
                      </span>
                      <AffordabilityBadge status={detail.affordabilityStatus} />
                    </div>
                    {amount !== null ? (
                      <p className="tl-amount" style={{ fontSize: 22, margin: '10px 0 0' }}>{formatTHB(amount)}</p>
                    ) : (
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tl-overdue)', margin: '10px 0 0' }}>
                        {plan === 'minimum' ? 'ยังไม่ระบุยอดขั้นต่ำ' : 'ไม่มีข้อเสนอแนะที่ปลอดภัย'}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 10, color: 'var(--tl-text-secondary)' }}>
                      <span>{detail.estimatedInstallmentsRemaining ? `เหลือ ${detail.estimatedInstallmentsRemaining} งวด` : extraBehavior === 'unknown' ? 'ยังประเมินไม่ได้' : 'หนี้ไม่ลดลง'}</span>
                      <span>{detail.interestSavedVsMinimumSatang !== null ? `ประหยัด ${formatTHB(detail.interestSavedVsMinimumSatang)}` : ''}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="tl-card" style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>หรือระบุยอดชำระที่ต้องการ (บาท)</p>
              <IonInput
                fill="outline"
                type="number"
                inputmode="decimal"
                placeholder="0.00"
                value={customAmount}
                onIonInput={(e) => { setSelectedPlan('custom'); setCustomAmount(e.detail.value ?? ''); }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <IonButton size="small" fill="outline" onClick={() => { setSelectedPlan('custom'); setCustomAmount(String(minimumPaymentSatang / 100)); }}>ขั้นต่ำ</IonButton>
                <IonButton size="small" fill="outline" onClick={() => bumpCustomAmount(500)}>+฿500</IonButton>
                <IonButton size="small" fill="outline" onClick={() => bumpCustomAmount(1000)}>+฿1,000</IonButton>
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={() => {
                    setSelectedPlan('custom');
                    const monthlyRate = interestRatePercent / 12;
                    const interest = Math.round(balanceSatang * (monthlyRate / 100));
                    setCustomAmount(String((balanceSatang + interest) / 100));
                  }}
                >
                  ปิดยอด
                </IonButton>
              </div>
            </div>

            <div className="tl-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>ประมาณการผลลัพธ์</p>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tl-text-secondary)', background: 'var(--tl-muted)', borderRadius: 999, padding: '3px 10px' }}>
                  {PLAN_LABEL[selectedPlan]}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <Stat label="จ่ายงวดนี้">{formatTHB(activeSimulation.paymentAmountSatang)}</Stat>
                <Stat label="ดอกเบี้ยโดยประมาณ">{formatTHB(activeSimulation.interestPaidThisPaymentSatang)}</Stat>
                <Stat label="เงินต้นที่ลดได้" tone="var(--tl-income)">{formatTHB(activeSimulation.principalPaidThisPaymentSatang)}</Stat>
                <Stat label="ยอดคงเหลือหลังจ่าย">{formatTHB(activeSimulation.balanceAfterPaymentSatang)}</Stat>
                <Stat label="ดอกเบี้ยงวดถัดไป">{formatTHB(activeSimulation.nextPeriodInterestSatang)}</Stat>
                <Stat label="เหลืออีกประมาณ">
                  {activeSimulation.estimatedInstallmentsRemaining !== null ? `${activeSimulation.estimatedInstallmentsRemaining} งวด` : 'ประเมินไม่ได้'}
                </Stat>
                <Stat label="คาดว่าหมดหนี้เมื่อไร">
                  {activeSimulation.estimatedPayoffDate ? (formatThaiMonthYearLabel(activeSimulation.estimatedPayoffDate) ?? activeSimulation.estimatedPayoffDate) : 'ประเมินไม่ได้'}
                </Stat>
                <Stat label="ประหยัดดอกเบี้ยเทียบขั้นต่ำ" tone="var(--tl-income)">
                  {activeSimulation.interestSavedVsMinimumSatang !== null ? formatTHB(activeSimulation.interestSavedVsMinimumSatang) : 'ยังประเมินไม่ได้'}
                </Stat>
              </div>

              {hasContext && (
                <div style={{ marginTop: 16 }}>
                  <Stat label="เงินเหลือใช้เดือนนี้">
                    {activeSimulation.cashRemainingAfterPaymentSatang !== null ? formatTHB(activeSimulation.cashRemainingAfterPaymentSatang) : 'ข้อมูลยังไม่พอ'}
                  </Stat>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--tl-border)', marginTop: 16, paddingTop: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>สถานะความพร้อมในการจ่าย</span>
                <AffordabilityBadge status={activeSimulation.affordabilityStatus} />
              </div>

              {activeSimulation.warnings.length > 0 && (
                <div style={{ marginTop: 14, background: '#FBE9E7', borderRadius: 12, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--tl-overdue)' }}>ข้อควรระวัง</p>
                  <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                    {activeSimulation.warnings.map((w) => (
                      <li key={w} style={{ fontSize: 12, color: 'var(--tl-overdue)', marginTop: 4 }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="tl-card" style={{ marginTop: 12, marginBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
              <button
                type="button"
                className="tl-tap-row"
                onClick={() => setShowAssumptions((v) => !v)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14, padding: '6px 0' }}
              >
                <span>สมมติฐานและคำชี้แจงในการคำนวณ {showAssumptions ? '(ปิด)' : '(ขยาย)'}</span>
                <span>{showAssumptions ? '▲' : '▼'}</span>
              </button>
              {showAssumptions && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tl-text-secondary)' }}>
                  <ol style={{ margin: 0, paddingInlineStart: 18 }}>
                    {activeSimulation.assumptions.map((a) => <li key={a} style={{ marginTop: 4 }}>{a}</li>)}
                    {SIMULATOR_ASSUMPTIONS.map((a) => <li key={a} style={{ marginTop: 4 }}>{a}</li>)}
                  </ol>
                  <p style={{ marginTop: 10, fontWeight: 700, color: 'var(--ion-text-color)' }}>คำชี้แจงด้านความเสี่ยงการจัดสรรเงินส่วนเกิน</p>
                  <p style={{ marginTop: 4 }}>{LENDER_RISK_WARNING}</p>
                </div>
              )}
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default DebtSimulatePage;

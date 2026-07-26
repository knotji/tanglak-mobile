import { useState } from 'react';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import CategoryDonutChart, { type CategoryDonutItem } from '@/components/CategoryDonutChart';
import CashFlowBarChart, { type MonthlyCashFlowPoint } from '@/components/CashFlowBarChart';
import FinancialHealthCard from '@/components/FinancialHealthCard';
import { getOverviewSnapshot, type OverviewSnapshot } from '@/lib/overview';
import { listTransactionsForMonth } from '@/lib/transactions';
import { listDebts, type Debt } from '@/lib/debts';
import { currentBangkokMonth, shiftBangkokMonth } from '@/lib/bangkokDate';
import { calculateFinancialHealthScore } from '@/lib/financialHealthScore';
import { usePrivacyMode, maskAmount } from '@/lib/privacyStore';
import { formatTHB } from '@/lib/money';

const PALETTE = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f97316'];

const FlowRow: React.FC<{ label: string; amountSatang: number; direction: 'in' | 'out' }> = ({ label, amountSatang, direction }) => {
  const isExpense = direction === 'out';
  const isPrivacy = usePrivacyMode();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tl-text-secondary)' }}>{label}</span>
      <span className={`tl-amount ${isExpense ? 'tl-amount--expense' : ''}`} style={{ fontSize: 15 }}>
        {maskAmount(formatTHB(isExpense ? -amountSatang : amountSatang, { showPositiveSign: !isExpense }), isPrivacy)}
      </span>
    </div>
  );
};

const OverviewPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [donutItems, setDonutItems] = useState<CategoryDonutItem[]>([]);
  const [totalExpenseSatang, setTotalExpenseSatang] = useState(0);
  const [cashFlowHistory, setCashFlowHistory] = useState<MonthlyCashFlowPoint[]>([]);
  const [error, setError] = useState('');
  const [partialLoadWarning, setPartialLoadWarning] = useState('');
  const isPrivacy = usePrivacyMode();

  useIonViewWillEnter(() => {
    const currentMonth = currentBangkokMonth();
    // The 3 prior months for the trend chart -- currentMonth itself is
    // fetched once below and reused for both the category breakdown and the
    // trend chart's last bar, instead of querying it a second time.
    const priorMonths = [shiftBangkokMonth(currentMonth, -3), shiftBangkokMonth(currentMonth, -2), shiftBangkokMonth(currentMonth, -1)];

    void Promise.all([
      listTransactionsForMonth(currentMonth),
      Promise.all(priorMonths.map((m) => listTransactionsForMonth(m))),
      Promise.allSettled([listDebts()]),
    ])
      .then(async ([currentMonthTxs, priorMonthsTxs, [debtsResult]]) => {
        // Reuses currentMonthTxs instead of getOverviewSnapshot() querying
        // this same month's transactions a second time.
        const snap = await getOverviewSnapshot(currentMonthTxs);
        setSnapshot(snap);

        const debtList = debtsResult.status === 'fulfilled' ? debtsResult.value : [];
        setDebts(debtList);
        // Debts failing to load doesn't invalidate the rest of the page (cash
        // flow / category breakdown don't depend on it), but it does mean the
        // financial-health score below is computed on a possibly-empty debt
        // list rather than a genuinely debt-free one -- flag it rather than
        // silently showing a healthier-looking score than reality.
        setPartialLoadWarning(
          debtsResult.status === 'rejected'
            ? 'โหลดข้อมูลหนี้ไม่สำเร็จ — คะแนนสุขภาพการเงินด้านล่างอาจไม่ครบถ้วน'
            : '',
        );

        // Calculate Category Breakdown
        const categoryMap = new Map<string, number>();
        let sumExpenseSatang = 0;
        for (const tx of currentMonthTxs) {
          if (tx.type === 'expense' || tx.type === 'debt_payment') {
            const cat = tx.categoryLabel || 'อื่นๆ';
            categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + tx.amountSatang);
            sumExpenseSatang += tx.amountSatang;
          }
        }

        const items: CategoryDonutItem[] = Array.from(categoryMap.entries())
          .map(([label, amountSatang], idx) => ({
            label,
            amountSatang,
            color: PALETTE[idx % PALETTE.length],
          }))
          .sort((a, b) => b.amountSatang - a.amountSatang);

        setDonutItems(items);
        setTotalExpenseSatang(sumExpenseSatang);

        // Build the 4-month historical trend from the 3 prior months already
        // fetched above plus the current month's transactions already in hand.
        const months = [...priorMonths, currentMonth];
        const monthTxLists = [...priorMonthsTxs, currentMonthTxs];
        const trend: MonthlyCashFlowPoint[] = monthTxLists.map((mList, i) => {
          let inc = 0;
          let exp = 0;
          for (const t of mList) {
            if (t.type === 'income' || t.type === 'refund') inc += t.amountSatang;
            if (t.type === 'expense' || t.type === 'debt_payment') exp += t.amountSatang;
          }
          return { monthLabel: `${months[i].split('-')[1]}`, incomeSatang: inc, expenseSatang: exp };
        });
        setCashFlowHistory(trend);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดภาพรวมไม่สำเร็จ'));
  });

  const health = calculateFinancialHealthScore(
    debts,
    totalExpenseSatang,
    snapshot?.plannedIncomeSatang ?? 0,
  );

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/more" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="ภาพรวม" subtitle="เดือนนี้" />

        {snapshot === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}
        {!error && partialLoadWarning && (
          <IonText color="warning"><p style={{ fontSize: 12.5 }}>{partialLoadWarning}</p></IonText>
        )}

        {snapshot && (
          <>
            <div className="tl-hero-card" style={{ textAlign: 'center', padding: '28px 18px', marginBottom: 14 }}>
              <span className="tl-hero-title">เหลือใช้จริงเดือนนี้</span>
              <div
                className="tl-hero-amount"
                style={{
                  color: snapshot.cashRemainingSatang < 0 ? '#f87171' : '#34d399',
                  fontSize: 34,
                }}
              >
                {maskAmount(formatTHB(snapshot.cashRemainingSatang), isPrivacy)}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                จากรายรับรวม {maskAmount(formatTHB(snapshot.plannedIncomeSatang), isPrivacy)}
              </p>
            </div>

            {/* Financial Health Score Card */}
            <FinancialHealthCard health={health} />

            {/* Category Donut Breakdown */}
            <CategoryDonutChart items={donutItems} totalSatang={totalExpenseSatang} />

            {/* Cash Flow Historical Trend */}
            <CashFlowBarChart data={cashFlowHistory} />

            <div className="tl-card" style={{ padding: '8px 18px', marginTop: 14, marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
              <FlowRow label="รายรับวางแผนไว้" amountSatang={snapshot.plannedIncomeSatang} direction="in" />
              <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                <FlowRow label="ค่าใช้ชีวิต" amountSatang={snapshot.totals.livingExpenseSatang} direction="out" />
              </div>
              <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                <FlowRow label="จ่ายหนี้สิน" amountSatang={snapshot.totals.debtPaymentSatang} direction="out" />
              </div>
              {snapshot.totals.refundSatang > 0 && (
                <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                  <FlowRow label="เงินคืน" amountSatang={snapshot.totals.refundSatang} direction="in" />
                </div>
              )}
            </div>

            {snapshot.debtCount > 0 && (
              <div className="tl-card" style={{ marginTop: 14, marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
                <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ion-text-color)' }}>
                  ภาพรวมหนี้สิน ({snapshot.debtCount} รายการ)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'var(--tl-primary-soft)', padding: 12, borderRadius: 'var(--tl-radius-sm)' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>ยอดคงเหลือรวม</p>
                    <p className="tl-amount tl-amount--debt" style={{ fontSize: 18, margin: '4px 0 0' }}>{formatTHB(snapshot.totalOutstandingSatang)}</p>
                  </div>
                  <div style={{ background: 'var(--tl-primary-soft)', padding: 12, borderRadius: 'var(--tl-radius-sm)' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>ขั้นต่ำที่ยังขาด</p>
                    <p className="tl-amount tl-amount--debt" style={{ fontSize: 18, margin: '4px 0 0' }}>{formatTHB(snapshot.totalMinimumDueSatang)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default OverviewPage;

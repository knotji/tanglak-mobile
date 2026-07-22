import { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { chevronForwardOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import { listDebts, type Debt } from '@/lib/debts';
import { getOverviewSnapshot } from '@/lib/overview';
import { formatTHB } from '@/lib/money';
import { formatThaiMonthYearLabel } from '@/lib/date';
import {
  buildDebtPortfolioComparison,
  portfolioStrategyLabel,
  recommendFocusDebt,
  type DebtStrategy,
} from '@/lib/debtPortfolioStrategy';

const DebtStrategyPage: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [error, setError] = useState('');
  const [extraBudget, setExtraBudget] = useState('0');
  const [strategy, setStrategy] = useState<DebtStrategy>('avalanche');

  useIonViewWillEnter(() => {
    setLoading(true);
    setError('');
    void Promise.all([listDebts(), getOverviewSnapshot().catch(() => null)])
      .then(([loadedDebts, snapshot]) => {
        setDebts(loadedDebts);
        if (snapshot) {
          const available = snapshot.plannedIncomeSatang - snapshot.totals.livingExpenseSatang - snapshot.totals.debtPaymentSatang;
          setExtraBudget(available > 0 ? String(Math.round(available / 100)) : '0');
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลหนี้ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  });

  const extraBudgetSatang = useMemo(() => {
    const n = Number(extraBudget.replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) * 100 : 0;
  }, [extraBudget]);

  const comparison = useMemo(() => {
    try {
      return buildDebtPortfolioComparison(debts, extraBudgetSatang);
    } catch {
      return null;
    }
  }, [debts, extraBudgetSatang]);

  const recommendation = comparison ? recommendFocusDebt(comparison) : null;
  const result = comparison?.[strategy];
  const debtById = useMemo(() => new Map(debts.map((d) => [d.id, d])), [debts]);

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
        <PageHeader title="เทียบกลยุทธ์ผ่อนหนี้" subtitle="ควรโปะหนี้ก้อนไหนก่อน" />

        {loading && <div className="ion-text-center ion-margin-top"><IonSpinner /></div>}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {!loading && comparison && comparison.activeDebtCount < 2 && (
          <div className="tl-card tl-empty">
            <p>ต้องมีหนี้ที่ยังผ่อนอยู่อย่างน้อย 2 รายการ ถึงจะเปรียบเทียบกลยุทธ์ได้</p>
          </div>
        )}

        {!loading && comparison && comparison.activeDebtCount >= 2 && result && (
          <>
            <div className="tl-card">
              <FieldLabel>เงินที่จ่ายเพิ่มได้ต่อเดือน (บาท)</FieldLabel>
              <IonInput fill="outline" type="number" inputmode="decimal" value={extraBudget} onIonInput={(e) => setExtraBudget(e.detail.value ?? '')} />
              <p style={{ fontSize: 12, color: 'var(--tl-text-secondary)', margin: '6px 0 0' }}>
                ทุกหนี้จ่ายขั้นต่ำตามปกติ ส่วนนี้คือเงินก้อนพิเศษที่จะทุ่มให้หนี้ตัวที่โฟกัสก่อนตามแต่ละกลยุทธ์
              </p>
            </div>

            {recommendation && (
              <div className="tl-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', marginTop: 14, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#047857' }}>
                  💡 แนะนำ: {portfolioStrategyLabel(recommendation.recommendedStrategy)}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#065f46', lineHeight: 1.5, fontWeight: 500 }}>{recommendation.reason}</p>
              </div>
            )}

            <IonSegment value={strategy} onIonChange={(e) => setStrategy(e.detail.value as DebtStrategy)}>
              <IonSegmentButton value="avalanche"><IonText>ลดดอกเบี้ยก่อน</IonText></IonSegmentButton>
              <IonSegmentButton value="snowball"><IonText>ปิดก้อนเล็กก่อน</IonText></IonSegmentButton>
            </IonSegment>

            <div className="tl-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)' }}>ดอกเบี้ยคงเหลือรวมโดยประมาณ</p>
                  <p className="tl-amount tl-amount--debt" style={{ fontSize: 20, margin: '4px 0 0' }}>{formatTHB(result.totalEstimatedRemainingInterestSatang)}</p>
                </div>
                {comparison.interestDifferenceSatang !== 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)' }}>ต่างจากอีกกลยุทธ์</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>
                      {formatTHB(Math.abs(comparison.interestDifferenceSatang))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px' }}>ลำดับที่แนะนำ</p>
            {result.simulations.map((sim, index) => {
              const debt = debtById.get(sim.debtId);
              if (!debt) return null;
              const isFocus = sim.debtId === result.focusDebtId;
              return (
                <button
                  key={sim.debtId}
                  type="button"
                  className="tl-tap-row"
                  style={{ marginTop: index === 0 ? 0 : 10 }}
                  onClick={() => history.push(`/debts/${debt.id}/edit`)}
                >
                  <div className="tl-card" style={{ borderColor: isFocus ? 'var(--ion-color-primary)' : undefined, borderWidth: isFocus ? 2 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>#{index + 1}</span>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{debt.name}</p>
                          {isFocus && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ion-color-primary)', background: 'var(--tl-primary-soft)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>
                              โฟกัสก่อน
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)' }}>
                          จ่าย {formatTHB(sim.monthlyPaymentSatang)}/เดือน
                          {sim.estimatedInstallmentsRemaining ? ` · เหลือ ${sim.estimatedInstallmentsRemaining} งวด` : ''}
                          {sim.estimatedPayoffDate ? ` · หมดหนี้ ~${formatThaiMonthYearLabel(sim.estimatedPayoffDate) ?? sim.estimatedPayoffDate}` : ''}
                        </p>
                      </div>
                      <IonIcon icon={chevronForwardOutline} color="medium" style={{ fontSize: 16, opacity: 0.6, flexShrink: 0, marginTop: 3 }} />
                    </div>
                  </div>
                </button>
              );
            })}

            <p style={{ fontSize: 11.5, color: 'var(--tl-text-secondary)', marginTop: 14, lineHeight: 1.6 }}>
              ตัวเลขเป็นการประมาณการเพื่อช่วยวางแผนเท่านั้น ไม่ใช่ยอดยืนยันจากสถาบันการเงิน สมมติว่าดอกเบี้ยและยอดขั้นต่ำคงที่ตลอด และจ่ายตรงเวลาทุกงวด
            </p>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default DebtStrategyPage;

import { useState } from 'react';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import { getOverviewSnapshot, type OverviewSnapshot } from '@/lib/overview';
import { formatTHB } from '@/lib/money';

const FlowRow: React.FC<{ label: string; amountSatang: number; direction: 'in' | 'out' }> = ({ label, amountSatang, direction }) => {
  const isExpense = direction === 'out';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tl-text-secondary)' }}>{label}</span>
      <span className={`tl-amount ${isExpense ? 'tl-amount--expense' : ''}`} style={{ fontSize: 15 }}>
        {formatTHB(isExpense ? -amountSatang : amountSatang, { showPositiveSign: !isExpense })}
      </span>
    </div>
  );
};

const OverviewPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [error, setError] = useState('');

  useIonViewWillEnter(() => {
    void getOverviewSnapshot()
      .then(setSnapshot)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดภาพรวมไม่สำเร็จ'));
  });

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

        {snapshot && (
          <>
            <div className="tl-card" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>เหลือใช้จริงเดือนนี้</p>
              <p
                className={`tl-amount ${snapshot.cashRemainingSatang < 0 ? 'tl-amount--overdue' : 'tl-amount--income'}`}
                style={{ fontSize: 32, margin: '6px 0 0' }}
              >
                {formatTHB(snapshot.cashRemainingSatang)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)' }}>
                จากรายรับ {formatTHB(snapshot.plannedIncomeSatang)}
              </p>
            </div>

            <div className="tl-card" style={{ padding: '4px 16px' }}>
              <FlowRow label="รายรับ" amountSatang={snapshot.plannedIncomeSatang} direction="in" />
              <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                <FlowRow label="ค่าใช้ชีวิต" amountSatang={snapshot.totals.livingExpenseSatang} direction="out" />
              </div>
              <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                <FlowRow label="จ่ายหนี้" amountSatang={snapshot.totals.debtPaymentSatang} direction="out" />
              </div>
              {snapshot.totals.refundSatang > 0 && (
                <div style={{ borderTop: '1px solid var(--tl-border)' }}>
                  <FlowRow label="เงินคืน" amountSatang={snapshot.totals.refundSatang} direction="in" />
                </div>
              )}
            </div>

            {snapshot.debtCount > 0 && (
              <div className="tl-card">
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>หนี้สินรวม ({snapshot.debtCount} รายการ)</p>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)' }}>ยอดคงเหลือรวม</p>
                    <p className="tl-amount tl-amount--debt" style={{ fontSize: 18, margin: '2px 0 0' }}>{formatTHB(snapshot.totalOutstandingSatang)}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)' }}>ขั้นต่ำที่ยังขาด</p>
                    <p className="tl-amount tl-amount--debt" style={{ fontSize: 18, margin: '2px 0 0' }}>{formatTHB(snapshot.totalMinimumDueSatang)}</p>
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

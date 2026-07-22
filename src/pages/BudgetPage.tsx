import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { pencilOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { getBudgetSummaryForCurrentMonth, type BudgetSummary, type CategorySummary } from '@/lib/budget';
import { formatTHB } from '@/lib/money';

const STATUS_COLOR: Record<CategorySummary['status'], string> = {
  healthy: 'var(--tl-income)',
  near_limit: 'var(--tl-debt)',
  overspent: 'var(--tl-overdue)',
  no_budget: 'var(--tl-text-secondary)',
};

const CategoryRow: React.FC<{ category: CategorySummary }> = ({ category }) => (
  <div style={{ padding: '10px 0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
      <span style={{ fontWeight: 600 }}>{category.label}</span>
      <span style={{ fontWeight: 700 }}>
        {formatTHB(category.spentSatang)}
        {category.budgetedSatang > 0 && <span style={{ color: 'var(--tl-text-secondary)', fontWeight: 500 }}> จาก {formatTHB(category.budgetedSatang)}</span>}
      </span>
    </div>
    {category.budgetedSatang > 0 && (
      <div style={{ height: 6, borderRadius: 999, background: 'var(--tl-muted)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, (category.usagePercent ?? 0) * 100)}%`,
            background: STATUS_COLOR[category.status],
            borderRadius: 999,
          }}
        />
      </div>
    )}
    {category.budgetedSatang <= 0 && (
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--tl-text-secondary)' }}>ยังไม่ได้ตั้งงบ</p>
    )}
  </div>
);

const BudgetPage: React.FC = () => {
  const history = useHistory();
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [error, setError] = useState('');

  useIonViewWillEnter(() => {
    void getBudgetSummaryForCurrentMonth()
      .then(setSummary)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดงบประมาณไม่สำเร็จ'));
  });

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/more" text="" />
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/budget/edit')} aria-label="แก้ไขงบประมาณ">
              <IonIcon icon={pencilOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="งบประมาณ" subtitle="งบประมาณเดือนนี้" />

        {summary === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {summary && !summary.hasBudget && summary.categories.length === 0 && (
          <div className="tl-card tl-empty">
            <p>ยังไม่ได้ตั้งงบประมาณเดือนนี้</p>
            <IonButton className="ion-margin-top" onClick={() => history.push('/budget/edit')}>ตั้งงบประมาณ</IonButton>
          </div>
        )}

        {summary && (summary.hasBudget || summary.categories.length > 0) && (
          <>
            <div className="tl-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>ใช้ไปแล้ว</p>
                <p className="tl-amount tl-amount--expense" style={{ fontSize: 22, margin: '4px 0 0' }}>{formatTHB(summary.spentTotalSatang)}</p>
              </div>
              {summary.plannedTotalSatang > 0 && (
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>คงเหลือจากงบ</p>
                  <p
                    className={`tl-amount ${summary.remainingTotalSatang < 0 ? 'tl-amount--overdue' : 'tl-amount--income'}`}
                    style={{ fontSize: 22, margin: '4px 0 0' }}
                  >
                    {formatTHB(summary.remainingTotalSatang)}
                  </p>
                </div>
              )}
            </div>

            {summary.categories.length > 0 && (
              <div className="tl-card" style={{ padding: '4px 16px' }}>
                {summary.categories.map((category, index) => (
                  <div key={category.label} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)' }}>
                    <CategoryRow category={category} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default BudgetPage;

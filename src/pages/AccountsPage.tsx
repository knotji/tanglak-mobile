import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonToolbar,
} from '@ionic/react';
import { cardOutline, walletOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import { listAccounts, ACCOUNT_TYPE_LABELS, maskLastFour, type Account } from '@/lib/accounts';
import { useIonViewData } from '@/lib/useIonViewData';

const AccountsPage: React.FC = () => {
  const { data: accounts, error } = useIonViewData<Account[]>(listAccounts, 'โหลดรายการบัญชีไม่สำเร็จ');

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
        <PageHeader title="บัญชี" subtitle="บัญชีธนาคาร บัตร และกระเป๋าเงินของคุณ" />

        {accounts === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {accounts?.length === 0 && (
          <div className="tl-card tl-empty">
            <p style={{ margin: 0, fontWeight: 600 }}>ยังไม่มีบัญชี</p>
          </div>
        )}

        {accounts && accounts.length > 0 && (
          <div className="tl-card" style={{ padding: '6px 16px', marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            {accounts.map((account, index) => {
              const isCard = account.accountType.includes('card');
              return (
                <div
                  key={account.id}
                  style={{
                    padding: '14px 0',
                    borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div className={`tl-icon-badge ${isCard ? 'tl-icon-badge--debt' : 'tl-icon-badge--transfer'}`}>
                    <IonIcon icon={isCard ? cardOutline : walletOutline} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ion-text-color)' }}>{account.name}</p>
                      {account.isDefault && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: '#e0e7ff',
                            color: '#3730a3',
                          }}
                        >
                          ค่าเริ่มต้น
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
                      {ACCOUNT_TYPE_LABELS[account.accountType]}
                      {account.institutionName ? ` · ${account.institutionName}` : ''}
                      {` · ${maskLastFour(account.lastFour)}`}
                    </p>
                  </div>
                  {!account.isActive && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: '#f1f5f9',
                        color: '#64748b',
                      }}
                    >
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AccountsPage;

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
          <div className="tl-card tl-list-card">
            {accounts.map((account) => {
              const isCard = account.accountType.includes('card');
              return (
                <div key={account.id} className="tl-list-row">
                  <div className={`tl-icon-badge ${isCard ? 'tl-icon-badge--expense' : 'tl-icon-badge--transfer'}`}>
                    <IonIcon aria-hidden="true" icon={isCard ? cardOutline : walletOutline} />
                  </div>
                  <div className="tl-list-row__body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p className="tl-list-row__title">{account.name}</p>
                      {account.isDefault && (
                        <span className="tl-status-badge tl-status-badge--accent">ค่าเริ่มต้น</span>
                      )}
                    </div>
                    <p className="tl-list-row__meta">
                      {ACCOUNT_TYPE_LABELS[account.accountType]}
                      {account.institutionName ? ` · ${account.institutionName}` : ''}
                      {` · ${maskLastFour(account.lastFour)}`}
                    </p>
                  </div>
                  {!account.isActive && (
                    <span className="tl-status-badge">ปิดใช้งาน</span>
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

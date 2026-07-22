import { useState } from 'react';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonText,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import { listAccounts, ACCOUNT_TYPE_LABELS, maskLastFour, type Account } from '@/lib/accounts';

const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState('');

  useIonViewWillEnter(() => {
    void listAccounts()
      .then(setAccounts)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดรายการบัญชีไม่สำเร็จ'));
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
        <PageHeader title="บัญชี" subtitle="บัญชีธนาคาร บัตร และกระเป๋าเงินของคุณ" />

        {accounts === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {accounts?.length === 0 && (
          <div className="tl-card tl-empty">
            <p>ยังไม่มีบัญชี</p>
          </div>
        )}

        {accounts && accounts.length > 0 && (
          <IonList className="tl-card" style={{ padding: 0 }} lines="full">
            {accounts.map((account) => (
              <IonItem key={account.id}>
                <IonLabel>
                  <h2 style={{ fontWeight: 700 }}>
                    {account.name}
                    {account.isDefault && <IonBadge color="primary" style={{ marginInlineStart: 8 }}>ค่าเริ่มต้น</IonBadge>}
                  </h2>
                  <p>
                    {ACCOUNT_TYPE_LABELS[account.accountType]}
                    {account.institutionName ? ` · ${account.institutionName}` : ''}
                    {` · ${maskLastFour(account.lastFour)}`}
                  </p>
                </IonLabel>
                {!account.isActive && <IonBadge slot="end" color="medium">ปิดใช้งาน</IonBadge>}
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AccountsPage;

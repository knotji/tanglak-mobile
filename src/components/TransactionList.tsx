import { useState } from 'react';
import { IonActionSheet, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import TransactionRow from '@/components/TransactionRow';
import type { Transaction } from '@/lib/transactions';
import { deleteTransaction } from '@/lib/saveTransaction';

interface TransactionListProps {
  transactions: Transaction[];
  onChanged: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onChanged }) => {
  const history = useHistory();
  const [active, setActive] = useState<Transaction | null>(null);
  // Separate from `active`: the action sheet's onDidDismiss fires (and
  // clears `active`) the instant its own isOpen flips to false, which
  // happens as soon as "ลบรายการนี้" is tapped (isOpen depends on
  // pendingDelete being unset). Without this second piece of state, that
  // dismiss-driven clear raced ahead of the alert's own delete handler,
  // so handleDelete always saw active === null and silently no-opped.
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteTransaction(pendingDelete.id);
      onChanged();
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <div className="tl-card" style={{ padding: '4px 16px' }}>
        {transactions.map((transaction, index) => (
          <div key={transaction.id} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)' }}>
            <button type="button" className="tl-tap-row" onClick={() => setActive(transaction)}>
              <TransactionRow transaction={transaction} />
            </button>
          </div>
        ))}
      </div>

      <IonActionSheet
        isOpen={active !== null && pendingDelete === null}
        onDidDismiss={() => setActive(null)}
        header={active?.merchant || active?.categoryLabel || 'รายการ'}
        buttons={[
          ...(active && active.type !== 'debt_payment'
            ? [{ text: 'แก้ไข', handler: () => history.push(`/transactions/${active.id}/edit`) }]
            : []),
          { text: 'ลบรายการนี้', role: 'destructive', handler: () => setPendingDelete(active) },
          { text: 'ยกเลิก', role: 'cancel' },
        ]}
      />

      <IonAlert
        isOpen={pendingDelete !== null}
        onDidDismiss={() => setPendingDelete(null)}
        header="ลบรายการนี้?"
        message="ลบแล้วกู้คืนไม่ได้"
        buttons={[
          { text: 'ยกเลิก', role: 'cancel', handler: () => setPendingDelete(null) },
          { text: busy ? 'กำลังลบ…' : 'ลบ', role: 'destructive', handler: () => { void handleDelete(); } },
        ]}
      />
    </>
  );
};

export default TransactionList;

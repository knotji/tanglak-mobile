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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await deleteTransaction(active.id);
      onChanged();
    } finally {
      setBusy(false);
      setConfirmDelete(false);
      setActive(null);
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
        isOpen={active !== null && !confirmDelete}
        onDidDismiss={() => setActive(null)}
        header={active?.merchant || active?.categoryLabel || 'รายการ'}
        buttons={[
          ...(active && active.type !== 'debt_payment'
            ? [{ text: 'แก้ไข', handler: () => history.push(`/transactions/${active.id}/edit`) }]
            : []),
          { text: 'ลบรายการนี้', role: 'destructive', handler: () => setConfirmDelete(true) },
          { text: 'ยกเลิก', role: 'cancel' },
        ]}
      />

      <IonAlert
        isOpen={confirmDelete}
        header="ลบรายการนี้?"
        message="ลบแล้วกู้คืนไม่ได้"
        buttons={[
          { text: 'ยกเลิก', role: 'cancel', handler: () => { setConfirmDelete(false); setActive(null); } },
          { text: busy ? 'กำลังลบ…' : 'ลบ', role: 'destructive', handler: () => { void handleDelete(); } },
        ]}
      />
    </>
  );
};

export default TransactionList;

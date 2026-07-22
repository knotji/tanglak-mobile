import { IonIcon } from '@ionic/react';
import { arrowDownCircle, arrowUpCircle, cardOutline, chevronForwardOutline, swapHorizontal } from 'ionicons/icons';
import type { Transaction } from '@/lib/transactions';
import { formatTHB } from '@/lib/money';
import { formatThaiDateTimeLabel, isoInstantToBangkokDatetimeLocal } from '@/lib/date';

const TYPE_ICON: Record<Transaction['type'], string> = {
  income: arrowDownCircle,
  refund: arrowDownCircle,
  expense: arrowUpCircle,
  debt_payment: cardOutline,
  transfer: swapHorizontal,
};

const TYPE_TONE: Record<Transaction['type'], 'income' | 'expense' | 'debt' | 'overdue'> = {
  income: 'income',
  refund: 'income',
  expense: 'expense',
  debt_payment: 'debt',
  transfer: 'expense',
};

const TYPE_LABEL: Record<Transaction['type'], string> = {
  income: 'รายรับ',
  refund: 'เงินคืน',
  expense: 'รายจ่าย',
  debt_payment: 'จ่ายหนี้',
  transfer: 'โอนเงิน',
};

const BADGE_CLASS: Record<Transaction['type'], string> = {
  income: 'tl-icon-badge--income',
  refund: 'tl-icon-badge--income',
  expense: 'tl-icon-badge--expense',
  debt_payment: 'tl-icon-badge--debt',
  transfer: 'tl-icon-badge--transfer',
};

const TransactionRow: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const isIncoming = transaction.type === 'income' || transaction.type === 'refund';
  const tone = TYPE_TONE[transaction.type];
  const signedSatang = isIncoming ? transaction.amountSatang : -transaction.amountSatang;
  const time = formatThaiDateTimeLabel(isoInstantToBangkokDatetimeLocal(transaction.occurredAt));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <div className={`tl-icon-badge ${BADGE_CLASS[transaction.type]}`}>
        <IonIcon icon={TYPE_ICON[transaction.type]} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ion-text-color)' }}>
          {transaction.merchant || transaction.categoryLabel || TYPE_LABEL[transaction.type]}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
          {time ?? transaction.occurredAt}
          {transaction.categoryLabel && transaction.merchant ? ` · ${transaction.categoryLabel}` : ''}
        </p>
      </div>
      <span className={`tl-amount tl-amount--${tone}`} style={{ fontSize: 15, fontWeight: 700 }}>
        {formatTHB(signedSatang, { showPositiveSign: isIncoming })}
      </span>
      <IonIcon icon={chevronForwardOutline} style={{ fontSize: 16, flexShrink: 0, color: '#94a3b8', opacity: 0.7 }} />
    </div>
  );
};

export default TransactionRow;

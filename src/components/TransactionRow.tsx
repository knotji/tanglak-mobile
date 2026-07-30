import { IonIcon } from '@ionic/react';
import { arrowDownCircle, arrowUpCircle, chevronForwardOutline, swapHorizontal } from 'ionicons/icons';
import type { Transaction } from '@/lib/transactions';
import { formatTHB } from '@/lib/money';
import { formatThaiDateTimeLabel, isoInstantToBangkokDatetimeLocal } from '@/lib/date';
import { usePrivacyMode, maskAmount } from '@/lib/privacyStore';

const TYPE_ICON: Record<Transaction['type'], string> = {
  income: arrowDownCircle,
  refund: arrowDownCircle,
  expense: arrowUpCircle,
  debt_payment: arrowUpCircle,
  transfer: swapHorizontal,
};

const TYPE_TONE: Record<Transaction['type'], 'income' | 'expense' | 'overdue'> = {
  income: 'income',
  refund: 'income',
  expense: 'expense',
  debt_payment: 'expense',
  transfer: 'expense',
};

const TYPE_LABEL: Record<Transaction['type'], string> = {
  income: 'รายรับ',
  refund: 'เงินคืน',
  expense: 'รายจ่าย',
  debt_payment: 'รายจ่าย',
  transfer: 'โอนเงิน',
};

const BADGE_CLASS: Record<Transaction['type'], string> = {
  income: 'tl-icon-badge--income',
  refund: 'tl-icon-badge--income',
  expense: 'tl-icon-badge--expense',
  debt_payment: 'tl-icon-badge--expense',
  transfer: 'tl-icon-badge--transfer',
};

const TransactionRow: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const isIncoming = transaction.type === 'income' || transaction.type === 'refund';
  const tone = TYPE_TONE[transaction.type];
  const signedSatang = isIncoming ? transaction.amountSatang : -transaction.amountSatang;
  const time = formatThaiDateTimeLabel(isoInstantToBangkokDatetimeLocal(transaction.occurredAt));
  const isPrivacy = usePrivacyMode();

  return (
    <div className="tl-transaction-row">
      <div className={`tl-icon-badge ${BADGE_CLASS[transaction.type]}`}>
        <IonIcon aria-hidden="true" icon={TYPE_ICON[transaction.type]} />
      </div>
      <div className="tl-transaction-row__body">
        <p className="tl-transaction-row__title">
          {transaction.merchant || transaction.categoryLabel || TYPE_LABEL[transaction.type]}
        </p>
        <p className="tl-transaction-row__meta">
          {time ?? transaction.occurredAt}
          {transaction.categoryLabel && transaction.merchant ? ` · ${transaction.categoryLabel}` : ''}
        </p>
      </div>
      <span className={`tl-amount tl-amount--${tone}`} style={{ fontSize: 15 }}>
        {maskAmount(formatTHB(signedSatang, { showPositiveSign: isIncoming }), isPrivacy)}
      </span>
      <IonIcon aria-hidden="true" className="tl-transaction-row__chevron" icon={chevronForwardOutline} />
    </div>
  );
};

export default TransactionRow;

import { supabase } from '@/lib/supabaseClient';

export type AccountType = 'bank_account' | 'cash' | 'credit_card' | 'e_wallet' | 'loan_account' | 'other';

export interface Account {
  id: string;
  name: string;
  institutionName: string | null;
  accountType: AccountType;
  lastFour: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface AccountRow {
  id: string;
  name: string;
  institution_name: string | null;
  account_type: AccountType | null;
  last_four: string | null;
  account_last_four: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
}

const COLUMNS = 'id, name, institution_name, account_type, last_four, account_last_four, is_default, is_active';

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    institutionName: row.institution_name,
    accountType: row.account_type ?? 'other',
    lastFour: row.last_four ?? row.account_last_four,
    isDefault: row.is_default ?? false,
    isActive: row.is_active ?? true,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select(COLUMNS)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error('โหลดรายการบัญชีไม่สำเร็จ');
  return (data ?? []).map(mapRow);
}

// Ported from tanglak/src/features/accounts/account-labels.ts
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank_account: 'บัญชีธนาคาร',
  cash: 'เงินสด',
  credit_card: 'บัตรเครดิต',
  e_wallet: 'วอลเล็ต',
  loan_account: 'บัญชีสินเชื่อ',
  other: 'อื่นๆ',
};

export function maskLastFour(lastFour: string | null): string {
  return lastFour ? `•••• ${lastFour}` : 'ยังไม่ระบุเลขท้าย';
}

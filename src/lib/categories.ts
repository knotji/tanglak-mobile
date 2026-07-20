// Trimmed from tanglak/src/lib/finance/categories.ts -- id/label/kind only,
// enough to display an extracted categoryId and drive the review form's
// category picker. Keep in sync with the category list embedded in
// supabase/functions/extract-document/index.ts.
export interface CategoryOption {
  id: string;
  label: string;
  kind: 'expense' | 'income';
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'food', label: 'อาหารและเครื่องดื่ม', kind: 'expense' },
  { id: 'groceries', label: 'ของใช้และซูเปอร์มาร์เก็ต', kind: 'expense' },
  { id: 'transport', label: 'การเดินทาง', kind: 'expense' },
  { id: 'housing', label: 'ที่อยู่อาศัย', kind: 'expense' },
  { id: 'utilities', label: 'ค่าน้ำ ไฟ และสาธารณูปโภค', kind: 'expense' },
  { id: 'debt', label: 'หนี้และสินเชื่อ', kind: 'expense' },
  { id: 'health', label: 'สุขภาพและการแพทย์', kind: 'expense' },
  { id: 'fitness', label: 'ออกกำลังกายและกีฬา', kind: 'expense' },
  { id: 'personal_care', label: 'ดูแลตัวเอง', kind: 'expense' },
  { id: 'shopping', label: 'ช้อปปิ้ง', kind: 'expense' },
  { id: 'entertainment', label: 'ความบันเทิง', kind: 'expense' },
  { id: 'subscriptions', label: 'สมาชิกและบริการรายเดือน', kind: 'expense' },
  { id: 'travel', label: 'ท่องเที่ยว', kind: 'expense' },
  { id: 'education', label: 'การศึกษาและพัฒนาตัวเอง', kind: 'expense' },
  { id: 'family', label: 'ครอบครัวและคนสำคัญ', kind: 'expense' },
  { id: 'gifts', label: 'ของขวัญและบริจาค', kind: 'expense' },
  { id: 'insurance', label: 'ประกันภัย', kind: 'expense' },
  { id: 'taxes_fees', label: 'ภาษีและค่าธรรมเนียม', kind: 'expense' },
  { id: 'pets', label: 'สัตว์เลี้ยง', kind: 'expense' },
  { id: 'work', label: 'ค่าใช้จ่ายเกี่ยวกับงาน', kind: 'expense' },
  { id: 'transfers', label: 'โอนเงินและปรับยอด', kind: 'expense' },
  { id: 'other', label: 'อื่น ๆ', kind: 'expense' },
  { id: 'salary', label: 'เงินเดือน', kind: 'income' },
  { id: 'freelance', label: 'งานเสริม/ฟรีแลนซ์', kind: 'income' },
  { id: 'bonus', label: 'โบนัส', kind: 'income' },
  { id: 'interest', label: 'ดอกเบี้ย/ผลตอบแทน', kind: 'income' },
  { id: 'refund', label: 'เงินคืน', kind: 'income' },
  { id: 'gift_income', label: 'เงินให้/เงินสนับสนุน', kind: 'income' },
  { id: 'sale', label: 'รายได้จากการขาย', kind: 'income' },
  { id: 'other_income', label: 'รายรับอื่น ๆ', kind: 'income' },
];

const BY_ID = new Map(CATEGORY_OPTIONS.map((option) => [option.id, option]));

export function categoryLabel(id?: string): string {
  if (!id) return '';
  return BY_ID.get(id)?.label ?? id;
}

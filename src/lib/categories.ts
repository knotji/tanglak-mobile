// Trimmed from tanglak/src/lib/finance/categories.ts -- id -> Thai label only,
// enough to display an extracted categoryId. Keep in sync with the category
// list embedded in supabase/functions/extract-document/index.ts.
export const CATEGORY_LABELS: Record<string, string> = {
  food: 'อาหารและเครื่องดื่ม',
  groceries: 'ของใช้และซูเปอร์มาร์เก็ต',
  transport: 'การเดินทาง',
  housing: 'ที่อยู่อาศัย',
  utilities: 'ค่าน้ำ ไฟ และสาธารณูปโภค',
  debt: 'หนี้และสินเชื่อ',
  health: 'สุขภาพและการแพทย์',
  fitness: 'ออกกำลังกายและกีฬา',
  personal_care: 'ดูแลตัวเอง',
  shopping: 'ช้อปปิ้ง',
  entertainment: 'ความบันเทิง',
  subscriptions: 'สมาชิกและบริการรายเดือน',
  travel: 'ท่องเที่ยว',
  education: 'การศึกษาและพัฒนาตัวเอง',
  family: 'ครอบครัวและคนสำคัญ',
  gifts: 'ของขวัญและบริจาค',
  insurance: 'ประกันภัย',
  taxes_fees: 'ภาษีและค่าธรรมเนียม',
  pets: 'สัตว์เลี้ยง',
  work: 'ค่าใช้จ่ายเกี่ยวกับงาน',
  transfers: 'โอนเงินและปรับยอด',
  other: 'อื่น ๆ',
  salary: 'เงินเดือน',
  freelance: 'งานเสริม/ฟรีแลนซ์',
  bonus: 'โบนัส',
  interest: 'ดอกเบี้ย/ผลตอบแทน',
  refund: 'เงินคืน',
  gift_income: 'เงินให้/เงินสนับสนุน',
  sale: 'รายได้จากการขาย',
  other_income: 'รายรับอื่น ๆ',
};

export function categoryLabel(id?: string): string {
  if (!id) return '';
  return CATEGORY_LABELS[id] ?? id;
}

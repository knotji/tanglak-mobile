const STORAGE_KEY = 'tl_merchant_category_rules';

// Pre-seeded rules for common Thai merchants
const PRESEEDED_RULES: Record<string, string> = {
  '7-eleven': 'groceries',
  'เซเว่น': 'groceries',
  'lotus': 'groceries',
  'โลตัส': 'groceries',
  'big c': 'groceries',
  'บิ๊กซี': 'groceries',
  'cj more': 'groceries',
  'ซีเจ': 'groceries',
  'tops': 'groceries',
  'ท็อปส์': 'groceries',

  'cafe amazon': 'food',
  'อเมซอน': 'food',
  'starbucks': 'food',
  'สตาร์บัคส์': 'food',
  'inthanin': 'food',
  'อินทนิล': 'food',
  'chatramue': 'food',
  'ชาตรามือ': 'food',
  'kfc': 'food',
  'เคเอฟซี': 'food',
  'mcdonalds': 'food',
  'แมคโดนัลด์': 'food',
  'mk': 'food',
  'เอ็มเค': 'food',

  'ptt': 'transport',
  'ปตท': 'transport',
  'bangchak': 'transport',
  'บางจาก': 'transport',
  'shell': 'transport',
  'เชลล์': 'transport',
  'bts': 'transport',
  'mrt': 'transport',
  'grab': 'transport',
  'แกร็บ': 'transport',
  'lineman': 'transport',
  'ไลน์แมน': 'transport',

  'shopee': 'shopping',
  'ช้อปปี้': 'shopping',
  'lazada': 'shopping',
  'ลาซาด้า': 'shopping',
  'tiktok': 'shopping',

  'ais': 'utilities',
  'true': 'utilities',
  'dtac': 'utilities',
  'การไฟฟ้า': 'utilities',
  'การประปา': 'utilities',
};

function normalizeMerchant(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getLearnedMerchantRules(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function learnMerchantCategoryRule(merchantName: string, categoryId: string): void {
  if (!merchantName || !categoryId) return;
  const normalized = normalizeMerchant(merchantName);
  if (!normalized) return;

  const current = getLearnedMerchantRules();
  current[normalized] = categoryId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors
  }
}

export function findCategoryForMerchant(merchantName: string): string | null {
  if (!merchantName) return null;
  const normalized = normalizeMerchant(merchantName);
  if (!normalized) return null;

  // 1. Check user-learned rules first
  const learned = getLearnedMerchantRules();
  if (learned[normalized]) {
    return learned[normalized];
  }

  // 2. Check exact pre-seeded rules
  if (PRESEEDED_RULES[normalized]) {
    return PRESEEDED_RULES[normalized];
  }

  // 3. Check partial keyword match against pre-seeded rules
  for (const [key, categoryId] of Object.entries(PRESEEDED_RULES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return categoryId;
    }
  }

  return null;
}

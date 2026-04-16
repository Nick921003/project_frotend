export const PRODUCT_CATEGORIES = [
  '洗臉產品',
  '化妝水',
  '精華液',
  '乳液',
  '面膜',
  '眼霜',
  '防曬',
  '其他'
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

const CATEGORY_ALIAS_MAP: Record<string, ProductCategory> = {
  // Canonical Chinese keys
  '洗臉產品': '洗臉產品',
  '化妝水': '化妝水',
  '精華液': '精華液',
  '乳液': '乳液',
  '面膜': '面膜',
  '眼霜': '眼霜',
  '防曬': '防曬',
  '其他': '其他',

  // Common legacy Chinese labels
  潔面: '洗臉產品',
  洗面乳: '洗臉產品',
  卸妝: '洗臉產品',
  精華: '精華液',
  面霜: '乳液',
  防晒: '防曬',

  // English aliases
  cleanser: '洗臉產品',
  facewash: '洗臉產品',
  facecleanser: '洗臉產品',
  makeupremover: '洗臉產品',
  cleansingoil: '洗臉產品',
  toner: '化妝水',
  serum: '精華液',
  essence: '精華液',
  ampoule: '精華液',
  emulsion: '乳液',
  moisturizer: '乳液',
  cream: '乳液',
  mask: '面膜',
  sheetmask: '面膜',
  eyecream: '眼霜',
  sunscreen: '防曬',
  sunblock: '防曬',
  spf: '防曬'
};

function normalizeCategoryKey(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function resolveProductCategory(category?: string | null): ProductCategory | null {
  const raw = String(category || '').trim();
  if (!raw) return null;

  if (CATEGORY_ALIAS_MAP[raw]) {
    return CATEGORY_ALIAS_MAP[raw];
  }

  const key = normalizeCategoryKey(raw);
  return CATEGORY_ALIAS_MAP[key] || null;
}

export function normalizeProductCategory(
  category?: string | null,
  fallback: ProductCategory = '其他'
): ProductCategory {
  return resolveProductCategory(category) || fallback;
}

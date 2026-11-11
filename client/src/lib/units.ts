// AgroBozor Birliklar (Units) va formatlash yordamchisi
export type ProductUnit = 'KG' | 'DONA' | 'LITR' | 'BANKA' | 'QUTI';

export const ALLOWED_UNITS: readonly ProductUnit[] = [
  'KG',
  'DONA',
  'LITR',
  'BANKA',
  'QUTI',
] as const;

export const UNIT_LABELS: Record<ProductUnit, string> = {
  KG: 'kg',
  DONA: 'dona',
  LITR: 'litr',
  BANKA: 'banka',
  QUTI: 'quti',
};

export const UNIT_OPTIONS: Array<{ value: ProductUnit; label: string }> = [
  { value: 'KG', label: 'Kilogramm (kg)' },
  { value: 'DONA', label: 'Dona' },
  { value: 'LITR', label: 'Litr' },
  { value: 'BANKA', label: 'Banka' },
  { value: 'QUTI', label: 'Quti' },
];

/**
 * Birlik nomini qisqa formatda qaytaradi: KG -> "kg", DONA -> "dona", va h.k.
 */
export function formatUnitName(unit?: string | null): string {
  if (!unit) return 'kg';
  const u = unit.toUpperCase() as ProductUnit;
  return UNIT_LABELS[u] || 'kg';
}

/**
 * formatQty(qty, unit): KG → “kg”, DONA → “dona”, LITR → “litr”, BANKA → “banka”, QUTI → “quti”.
 * Butun sonlarni kasrsiz, kasrlarni 1–2 xona bilan ko'rsatadi.
 * Masalan: formatQty(5, 'KG') -> "5 kg", formatQty(2.5, 'LITR') -> "2.5 litr"
 */
export function formatQty(qty: number, unit?: string | null): string {
  const num = typeof qty === 'number' ? qty : Number(qty) || 0;
  const label = formatUnitName(unit);
  const formattedNum = Number.isInteger(num)
    ? num.toString()
    : Number(num.toFixed(2)).toString();
  return `${formattedNum} ${label}`;
}

export function toNumber(v) {
    if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim()))
        return NaN;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
}
export function positiveNumber(v) {
    const n = toNumber(v);
    return n > 0 ? n : null;
}
export function positiveInt(v) {
    const n = toNumber(v);
    return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}
export function cleanText(v, max) {
    return String(v ?? '').trim().slice(0, max);
}
export function isHttpUrl(v) {
    if (typeof v !== 'string' || v.length > 1000)
        return false;
    try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'http:';
    }
    catch {
        return false;
    }
}
// +998901234567 formatiga keltiradi; noto'g'ri bo'lsa null
export function normalizePhone(v) {
    const digits = String(v ?? '').replace(/\D/g, '');
    if (digits.length === 9)
        return '+998' + digits;
    if (digits.length === 12 && digits.startsWith('998'))
        return '+' + digits;
    return null;
}
// Pasport/STIR ni maskalaydi: AA1234567 -> AA***4567
export function maskId(v) {
    if (!v)
        return '';
    if (v.length <= 4)
        return '****';
    return v.slice(0, 2) + '***' + v.slice(-4);
}
export const CATEGORIES = ['MEVALAR', 'SABZAVOTLAR', 'POLIZ', 'SUT_GOSHT', 'DON'];
export const PUBLIC_ROLES = ['FARMER', 'BUYER_B2C', 'BUYER_B2B', 'COURIER'];
export const ALLOWED_UNITS = ['KG', 'DONA', 'LITR', 'BANKA', 'QUTI'];
export const UNIT_LABELS = {
    KG: 'kg',
    DONA: 'dona',
    LITR: 'litr',
    BANKA: 'banka',
    QUTI: 'quti',
};
export function formatUnitName(unit) {
    if (!unit)
        return 'kg';
    return UNIT_LABELS[unit.toUpperCase()] || 'kg';
}
export const ALLOWED_PICKUP_TIME_SLOTS = [
    '06:00–09:00',
    '09:00–12:00',
    '12:00–16:00',
    '16:00–20:00',
];

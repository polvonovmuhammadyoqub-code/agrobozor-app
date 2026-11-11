export function toNumber(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : NaN;
}
export function positiveNumber(v) {
    const n = toNumber(v);
    return n > 0 ? n : null;
}
export function positiveInt(v) {
    const n = toNumber(v);
    return n > 0 ? Math.round(n) : null;
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

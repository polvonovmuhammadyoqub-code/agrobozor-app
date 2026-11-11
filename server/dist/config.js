// Markaziy sozlamalar. Production'da maxfiy kalitlar majburiy.
export const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
function requireSecret() {
    const s = process.env.JWT_SECRET;
    if (s && s.length >= 32)
        return s;
    if (isProd) {
        throw new Error("JWT_SECRET o'rnatilmagan yoki juda qisqa (kamida 32 belgi). Vercel > Settings > Environment Variables ga qo'shing.");
    }
    return 'dev-only-insecure-secret-change-me-0123456789';
}
export const JWT_SECRET = requireSecret();
// Fermerlarni qo'lda tekshirmasdan avtomatik tasdiqlash (faqat demo/pilot uchun!)
export const AUTO_APPROVE_KYC = process.env.AUTO_APPROVE_KYC === 'true';
// Emailga kod yuborilmasa javobda kodni qaytarish (faqat dev/staging uchun!)
export const ALLOW_DEV_CODES = process.env.ALLOW_DEV_CODES === 'true' || !isProd;
// 'mock' | 'disabled' (| kelajakda 'click' | 'payme')
export const PAYMENT_MODE = process.env.PAYMENT_MODE || (isProd ? 'disabled' : 'mock');
export const DELIVERY_FEE = 15000;
export const COURIER_PAYOUT = 12000;
export const LOGISTICS_MARGIN = DELIVERY_FEE - COURIER_PAYOUT;
export const COMMISSION_RATE = 0.1;
export const PAYMENT_TIMEOUT_MIN = 30; // oddiy to'lov muddati
export const INVOICE_TIMEOUT_HOURS = 72; // B2B hisob-faktura muddati
export const DISPUTE_WINDOW_HOURS = 24; // yetkazilgandan keyin shikoyat oynasi
// Supabase Storage sozlamalari (server-side only, maxfiy kalitlar)
export const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Kodda belgilangan standart rasm havolalari
export const DEFAULT_PRODUCT_IMAGES = {
    MEVALAR: 'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=800&q=80',
    SABZAVOTLAR: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    POLIZ: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    SUT_GOSHT: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80',
    DON: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
};
export function isAllowedDefaultImage(url) {
    return Object.values(DEFAULT_PRODUCT_IMAGES).includes(url);
}
/**
 * Rasm URL'i o'z Supabase storage domenimizga va aynan so'rov yuborayotgan fermer papkasiga tegishli ekanini tekshiradi.
 * SUPABASE_URL bo'lmasa qat'iy false qaytaradi (dev fallback yo'q).
 * Hostname aynan teng bo'lishi va yo'l /storage/v1/object/public/product-images/<userId>/ bilan boshlanishi shart.
 */
export function isSupabaseStorageUrl(url, userId) {
    if (!url || typeof url !== 'string' || !userId || !SUPABASE_URL)
        return false;
    try {
        const parsed = new URL(url);
        const base = new URL(SUPABASE_URL);
        if (parsed.hostname !== base.hostname)
            return false;
        const requiredPrefix = `/storage/v1/object/public/product-images/${userId}/`;
        return parsed.pathname.startsWith(requiredPrefix);
    }
    catch {
        return false;
    }
}

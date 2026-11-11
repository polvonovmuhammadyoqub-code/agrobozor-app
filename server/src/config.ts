import './env.js';

// Markaziy sozlamalar. Production'da maxfiy kalitlar majburiy.
export const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function requireSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) {
    throw new Error(
      "JWT_SECRET o'rnatilmagan yoki juda qisqa (kamida 32 belgi). Vercel > Settings > Environment Variables ga qo'shing."
    );
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

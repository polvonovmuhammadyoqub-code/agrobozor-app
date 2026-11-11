import { PAYMENT_MODE } from '../config.js';
/**
 * To'lov shlyuzi adapteri.
 *  - PAYMENT_MODE=mock     -> sinov to'lovlari (real pul yechilmaydi, faqat demo simulyatsiyasi)
 *  - PAYMENT_MODE=disabled -> onlayn to'lov rad etiladi (faqat B2B bank hisob-faktura ishlaydi)
 * Haqiqiy integratsiyada Click Merchant / Payme Business Webhook handlerlari orqali imzolanadi.
 */
export async function chargeOrder(orderId, amount, method) {
    const validOnlineMethods = ['CLICK', 'PAYME', 'UZCARD', 'HUMO'];
    if (!validOnlineMethods.includes(method)) {
        return {
            ok: false,
            error: `Noma'lum to'lov usuli: ${method}`,
        };
    }
    if (PAYMENT_MODE === 'mock') {
        return {
            ok: true,
            reference: `DEMO-${method}-${orderId}`,
            is_demo: true,
        };
    }
    return {
        ok: false,
        error: "Onlayn to'lov tizimlari (Click/Payme) hozircha test rejimida. Iltimos, B2B hisob-faktura orqali to'lang yoki administrator bilan bog'laning.",
    };
}
/**
 * Qaytarish jarayoni (Refund) uchun to'lov qaytarish adapteri
 */
export async function refundOrder(orderId, amount, reference) {
    if (PAYMENT_MODE === 'mock') {
        return {
            ok: true,
            refundReference: `REFUND-DEMO-${orderId.slice(0, 8)}-${Date.now()}`,
        };
    }
    return { ok: false };
}

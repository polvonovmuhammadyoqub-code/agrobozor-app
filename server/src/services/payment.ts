import { PAYMENT_MODE } from '../config.js';

export interface ChargeResult {
  ok: boolean;
  reference?: string;
  error?: string;
}

/**
 * To'lov adapteri. HOZIRCHA haqiqiy Click/Payme ulanmagan.
 *  - PAYMENT_MODE=mock     -> test to'lov (haqiqiy pul harakatlanmaydi!)
 *  - PAYMENT_MODE=disabled -> to'lov rad etiladi (production'da standart)
 * Haqiqiy integratsiya redirect + webhook (Click/Payme merchant API) bo'ladi;
 * u shu yerga ulanadi va markPaid() ni webhook ichidan chaqiradi.
 */
export async function chargeOrder(orderId: string, amount: number, method: string): Promise<ChargeResult> {
  if (PAYMENT_MODE === 'mock') {
    return { ok: true, reference: `MOCK-${orderId.slice(0, 8)}-${Date.now()}` };
  }
  return {
    ok: false,
    error: "Onlayn to'lov tizimi hali ulanmagan. Iltimos, keyinroq urinib ko'ring yoki B2B hisob-faktura tanlang.",
  };
}

export function paymentMode() {
  return process.env.PAYMENT_MODE || 'disabled';
}
export function paymeConfig() {
  const merchant = process.env.PAYME_MERCHANT_ID || '';
  const key = process.env.PAYME_KEY || '';
  let appUrl = '';
  try {
    const u = new URL(process.env.APP_URL || '');
    if (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    )
      appUrl = u.origin;
  } catch {}
  const sandbox = process.env.PAYME_SANDBOX === 'true';
  return {
    merchant,
    key,
    appUrl,
    sandbox,
    ready: /^[a-f0-9]{24}$/i.test(merchant) && !!key && !!appUrl,
  };
}
export function paymentOptions() {
  const mode = paymentMode();
  const c = paymeConfig();
  return {
    mode,
    methods:
      mode === 'mock'
        ? ['CLICK', 'PAYME', 'UZCARD', 'HUMO']
        : mode === 'payme' && c.ready
          ? ['PAYME']
          : [],
    message:
      mode === 'mock'
        ? 'Sinov rejimi: haqiqiy pul yechilmaydi.'
        : mode === 'payme' && c.ready
          ? c.sandbox
            ? 'Payme sinov muhiti: haqiqiy pul yechilmaydi.'
            : 'To‘lov Payme sahifasida bajariladi. Tasdiq kelmaguncha buyurtma to‘lanmagan hisoblanadi.'
          : 'Onlayn to‘lov hali ulanmagan. Hozir haqiqiy pul qabul qilinmaydi.',
  };
}
export function paymeCheckout(order: { id: string; total_paid: number }) {
  const c = paymeConfig();
  if (paymentMode() !== 'payme' || !c.ready)
    throw new Error('PAYME_NOT_CONFIGURED');
  const data = `m=${c.merchant};ac.order_id=${order.id};a=${order.total_paid * 100};l=uz;c=${c.appUrl}/?payment_return=${order.id};ct=3000`;
  return `${c.sandbox ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz'}/${Buffer.from(data).toString('base64')}`;
}

// Buyurtma amallari servisi — route va bot bir xil mantiqni ishlatadi
// Atomik updateMany va egalik tekshiruvlari saqlanadi
import prisma from '../db.js';
import type { Prisma } from '@prisma/client';
import { chargeOrder } from './payment.js';
import { holdInEscrow, settleOrder } from './settlement.js';
import type { AuthUser } from '../middleware/auth.js';

type Tx = Prisma.TransactionClient;

// Xatolik turlari — route yoki bot tegishli HTTP/xabar qaytaradi
export class OrderActionError extends Error {
  constructor(public code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_STATE' | 'PAYMENT_FAILED' | 'STOCK' | 'VALIDATION', message: string) {
    super(message);
    this.name = 'OrderActionError';
  }
}

// ——— To'lov: PENDING_PAYMENT → PAID_IN_ESCROW ———
export async function payOrder(actor: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyer_id !== actor.id) {
    throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new OrderActionError('BAD_STATE', "Bu buyurtma to'lov kutmayapti");
  }

  // B2B hisob-faktura: admin tasdiqlaguncha kutadi
  if (order.payment_method === 'INVOICE_B2B') {
    return { order, pending_invoice: true, message: "Hisob-faktura shakllandi. To'lov tasdiqlangach buyurtma faollashadi." };
  }

  const charge = await chargeOrder(order.id, order.total_paid, order.payment_method);
  if (!charge.ok) {
    throw new OrderActionError('PAYMENT_FAILED', charge.error || "To'lov amalga oshmadi");
  }

  const updated = await prisma.$transaction(async (tx: Tx) => {
    const r = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID_IN_ESCROW', paid_at: new Date() },
    });
    if (r.count !== 1) throw new OrderActionError('BAD_STATE', "Buyurtma holati o'zgargan, sahifani yangilang");
    await holdInEscrow(tx, order);
    return tx.order.findUnique({ where: { id: order.id } });
  });

  return { order: updated, reference: charge.reference };
}

// ——— Fermer tasdiqlashi: PAID_IN_ESCROW → CONFIRMED_BY_FARMER ———
export async function farmerConfirm(actor: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
  if (actor.role !== 'FARMER' || order.farmer_id !== actor.id) {
    throw new OrderActionError('FORBIDDEN', 'Faqat buyurtma egasi fermer tasdiqlay oladi');
  }

  const result = await prisma.order.updateMany({
    where: { id: order.id, status: 'PAID_IN_ESCROW' },
    data: { status: 'CONFIRMED_BY_FARMER', confirmed_at: new Date() },
  });
  if (result.count !== 1) {
    throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas yoki allaqachon o'zgargan");
  }
  return prisma.order.findUnique({ where: { id: order.id } });
}

// ——— Fermer rad etishi: PAID_IN_ESCROW → REFUNDED ———
export async function farmerReject(actor: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
  if (actor.role !== 'FARMER' || order.farmer_id !== actor.id) {
    throw new OrderActionError('FORBIDDEN', 'Faqat buyurtma egasi fermer rad eta oladi');
  }

  await prisma.$transaction(async (tx: Tx) => {
    const r = await tx.order.updateMany({
      where: { id: order.id, status: 'PAID_IN_ESCROW' },
      data: { status: 'REFUNDED' },
    });
    if (r.count !== 1) throw new OrderActionError('BAD_STATE', 'Buyurtma hozirgi holatida rad etilmaydi');
    await tx.product.update({
      where: { id: order.product_id },
      data: { available_quantity_kg: { increment: order.quantity_kg } },
    });
    await settleOrder(tx, order, order.product_total_amount);
  });

  return { message: "Buyurtma rad etildi, mablag' xaridorga qaytarildi" };
}

// ——— Kuryer buyurtmani oladi: CONFIRMED_BY_FARMER → IN_TRANSIT ———
// Atomik claim: bir buyurtmani ikki kuryer ola olmaydi
export async function courierPickup(actor: AuthUser, orderId: string) {
  if (actor.role !== 'COURIER') {
    throw new OrderActionError('FORBIDDEN', 'Faqat kuryer buyurtmani olishi mumkin');
  }
  if (actor.kyc_status !== 'APPROVED') {
    throw new OrderActionError('FORBIDDEN', 'Kuryer profili hali tasdiqlanmagan');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');

  const result = await prisma.order.updateMany({
    where: { id: order.id, status: 'CONFIRMED_BY_FARMER', courier_id: null },
    data: { status: 'IN_TRANSIT', courier_id: actor.id, picked_up_at: new Date() },
  });
  if (result.count !== 1) {
    throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas yoki boshqa kuryer allaqachon olgan");
  }
  return prisma.order.findUnique({ where: { id: order.id } });
}

// ——— Kuryer yetkazdi: IN_TRANSIT → DELIVERED ———
// PIN tekshiruvi E bo'lakda qo'shiladi; hozir PIN'siz ishlaydi (mavjud xatti-harakat saqlanadi)
export async function courierDeliver(actor: AuthUser, orderId: string) {
  if (actor.role !== 'COURIER') {
    throw new OrderActionError('FORBIDDEN', 'Faqat biriktirilgan kuryer yetkazildi deb belgilay oladi');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
  if (order.courier_id !== actor.id) {
    throw new OrderActionError('FORBIDDEN', 'Faqat biriktirilgan kuryer yetkazildi deb belgilay oladi');
  }

  const result = await prisma.order.updateMany({
    where: { id: order.id, status: 'IN_TRANSIT', courier_id: actor.id },
    data: { status: 'DELIVERED', delivered_at: new Date() },
  });
  if (result.count !== 1) {
    throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas yoki allaqachon o'zgargan");
  }
  return prisma.order.findUnique({ where: { id: order.id } });
}

// ——— Xaridor «Qabul qildim»: DELIVERED → COMPLETED ———
export async function buyerComplete(actor: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyer_id !== actor.id) {
    throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
  }
  if (order.status === 'DISPUTED') {
    throw new OrderActionError('BAD_STATE', "Bu buyurtma bo'yicha nizo ochilgan");
  }
  if (order.status !== 'DELIVERED') {
    throw new OrderActionError('BAD_STATE', 'Mahsulot yetkazilgandan keyingina qabul qilish mumkin');
  }

  const completed = await prisma.$transaction(async (tx: Tx) => {
    const r = await tx.order.updateMany({
      where: { id: order.id, status: 'DELIVERED' },
      data: { status: 'COMPLETED' },
    });
    if (r.count !== 1) throw new OrderActionError('BAD_STATE', "Buyurtma allaqachon yakunlangan yoki holati o'zgargan");
    await settleOrder(tx, order, 0);
    return tx.order.findUnique({ where: { id: order.id } });
  });

  return { message: "Buyurtma yakunlandi! Mablag'lar fermer va kuryerga o'tkazildi.", order: completed };
}

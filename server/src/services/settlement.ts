import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

interface OrderMoney {
  payment_method?: string;
  id: string;
  buyer_id: string;
  farmer_id: string;
  courier_id: string | null;
  product_total_amount: number;
  delivery_fee: number;
  total_paid: number;
  farmer_payout: number;
  courier_payout: number;
}

async function platformUserId(tx: Tx): Promise<string> {
  const admin = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!admin) {
    throw new Error("Platforma hisobi (ADMIN foydalanuvchi) topilmadi. 'npm run create-admin' ni ishga tushiring.");
  }
  return admin.id;
}

/** To'lov escrow'ga tushganda: pul platformada, fermer escrow balansida ko'rinadi. */
export async function holdInEscrow(tx: Tx, order: OrderMoney) {
  if(order.payment_method === 'DIRECT_FARMER') throw new Error('Direct payments never enter platform escrow');
  await tx.user.update({
    where: { id: order.farmer_id },
    data: { wallet_escrow: { increment: order.farmer_payout } },
  });
  await tx.transaction.create({
    data: { order_id: order.id, user_id: order.buyer_id, amount: order.total_paid, type: 'ESCROW_HOLD' },
  });
}

/**
 * Buyurtmani yakuniy hisob-kitob qilish. Bitta joyda — pul saqlanish qonuni buzilmasligi uchun:
 *   total_paid = xaridorga qaytgan + fermerga + kuryerga + platformaga
 * productRefund — mahsulot summasidan xaridorga qaytariladigan qism (0..product_total).
 * Yetkazish haqi faqat kuryer biriktirilmagan va to'liq qaytarishda qaytariladi.
 */
export async function settleOrder(tx: Tx, order: OrderMoney, productRefund: number) {
  if(order.payment_method === 'DIRECT_FARMER') {
    if(productRefund !== 0) throw new Error('Direct refunds must be arranged with the farmer');
    return {farmerGets:0,buyerGets:0,courierGets:0,platformGets:0};
  }
  const pt = order.product_total_amount;
  const r = Math.min(Math.max(Math.round(productRefund), 0), pt);

  const farmerGets = pt > 0 ? Math.round(order.farmer_payout * ((pt - r) / pt)) : 0;
  const courierGets = order.courier_id ? order.courier_payout : 0;
  const deliveryRefund = r === pt && !order.courier_id ? order.delivery_fee : 0;
  const buyerGets = r + deliveryRefund;
  const platformGets = order.total_paid - buyerGets - farmerGets - courierGets;

  if (platformGets < 0) throw new Error('Hisob-kitobda xatolik: platforma ulushi manfiy');

  // Fermer: escrow'dan ayiramiz, ulushini yechiladigan balansga o'tkazamiz
  await tx.user.update({
    where: { id: order.farmer_id },
    data: {
      wallet_escrow: { decrement: order.farmer_payout },
      wallet_available: { increment: farmerGets },
    },
  });
  if (farmerGets > 0) {
    await tx.transaction.create({
      data: { order_id: order.id, user_id: order.farmer_id, amount: farmerGets, type: 'ESCROW_RELEASE_FARMER' },
    });
  }

  if (buyerGets > 0) {
    await tx.user.update({ where: { id: order.buyer_id }, data: { wallet_available: { increment: buyerGets } } });
    await tx.transaction.create({
      data: { order_id: order.id, user_id: order.buyer_id, amount: buyerGets, type: 'REFUND' },
    });
  }

  if (courierGets > 0 && order.courier_id) {
    await tx.user.update({ where: { id: order.courier_id }, data: { wallet_available: { increment: courierGets } } });
    await tx.transaction.create({
      data: { order_id: order.id, user_id: order.courier_id, amount: courierGets, type: 'COURIER_FEE' },
    });
  }

  if (platformGets > 0) {
    const pid = await platformUserId(tx);
    await tx.user.update({ where: { id: pid }, data: { wallet_available: { increment: platformGets } } });
    await tx.transaction.create({
      data: { order_id: order.id, user_id: pid, amount: platformGets, type: 'PLATFORM_COMMISSION' },
    });
  }

  return { farmerGets, buyerGets, courierGets, platformGets };
}

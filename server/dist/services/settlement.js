async function platformUserId(tx) {
    const admin = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admin)
        return admin.id;
    // Agar admin hali yaratilmagan bo'lsa, platforma to'lovlari to'xtab qolmasligi uchun tizim hisobi yaratiladi
    const systemAdmin = await tx.user.create({
        data: {
            phone: '+998712000000',
            email: 'system@agrobozor.uz',
            password_hash: '$2a$10$Defau1tAgroBozorP1atformAdminHashKeyNotForLoginDirect1y',
            full_name: 'AgroBozor Platforma',
            role: 'ADMIN',
            region: 'Toshkent',
            tin_or_passport: 'SYSTEM',
            kyc_status: 'APPROVED',
        },
        select: { id: true },
    });
    return systemAdmin.id;
}
/** To'lov escrow'ga tushganda: pul platformada, fermer escrow balansida ko'rinadi. */
export async function holdInEscrow(tx, order) {
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
export async function settleOrder(tx, order, productRefund) {
    const pt = order.product_total_amount;
    const r = Math.min(Math.max(Math.round(productRefund), 0), pt);
    const farmerGets = pt > 0 ? Math.round(order.farmer_payout * ((pt - r) / pt)) : 0;
    const courierGets = order.courier_id ? order.courier_payout : 0;
    const deliveryRefund = r === pt && !order.courier_id ? order.delivery_fee : 0;
    const buyerGets = r + deliveryRefund;
    const platformGets = order.total_paid - buyerGets - farmerGets - courierGets;
    if (platformGets < 0)
        throw new Error('Hisob-kitobda xatolik: platforma ulushi manfiy');
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

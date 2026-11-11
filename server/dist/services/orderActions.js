// Buyurtma amallari servisi — route va bot bir xil mantiqni ishlatadi
// Atomik updateMany va egalik tekshiruvlari saqlanadi
import crypto from 'crypto';
import prisma from '../db.js';
import { chargeOrder } from './payment.js';
import { holdInEscrow, settleOrder } from './settlement.js';
// Xatolik turlari — route yoki bot tegishli HTTP/xabar qaytaradi
export class OrderActionError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'OrderActionError';
    }
}
/** 4 xonali (0000–9999) xavfsiz tasodifiy yetkazish PIN kodi */
export function generateDeliveryPin() {
    return crypto.randomInt(0, 10000).toString().padStart(4, '0');
}
// ——— To'lov: PENDING_PAYMENT → PAID_IN_ESCROW ———
export async function payOrder(actor, orderId) {
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
    const deliveryPin = generateDeliveryPin();
    const updated = await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING_PAYMENT' },
            data: {
                status: 'PAID_IN_ESCROW',
                paid_at: new Date(),
                delivery_pin: deliveryPin,
                delivery_pin_attempts: 0,
            },
        });
        if (r.count !== 1)
            throw new OrderActionError('BAD_STATE', "Buyurtma holati o'zgargan, sahifani yangilang");
        await holdInEscrow(tx, order);
        return tx.order.findUnique({ where: { id: order.id } });
    });
    return { order: updated, reference: charge.reference };
}
// ——— Fermer tasdiqlashi: PAID_IN_ESCROW → CONFIRMED_BY_FARMER ———
export async function farmerConfirm(actor, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
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
export async function farmerReject(actor, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
    if (actor.role !== 'FARMER' || order.farmer_id !== actor.id) {
        throw new OrderActionError('FORBIDDEN', 'Faqat buyurtma egasi fermer rad eta oladi');
    }
    await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({
            where: { id: order.id, status: 'PAID_IN_ESCROW' },
            data: { status: 'REFUNDED' },
        });
        if (r.count !== 1)
            throw new OrderActionError('BAD_STATE', 'Buyurtma hozirgi holatida rad etilmaydi');
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
export async function courierPickup(actor, orderId) {
    if (actor.role !== 'COURIER') {
        throw new OrderActionError('FORBIDDEN', 'Faqat kuryer buyurtmani olishi mumkin');
    }
    if (actor.kyc_status !== 'APPROVED') {
        throw new OrderActionError('FORBIDDEN', 'Kuryer profili hali tasdiqlanmagan');
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
    const dataToUpdate = {
        status: 'IN_TRANSIT',
        courier_id: actor.id,
        picked_up_at: new Date(),
    };
    // PIN'i yo'q eski buyurtmalar uchun PIN courierPickup da yaratilsin
    if (!order.delivery_pin) {
        dataToUpdate.delivery_pin = generateDeliveryPin();
        dataToUpdate.delivery_pin_attempts = 0;
    }
    const result = await prisma.order.updateMany({
        where: { id: order.id, status: 'CONFIRMED_BY_FARMER', courier_id: null },
        data: dataToUpdate,
    });
    if (result.count !== 1) {
        throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas yoki boshqa kuryer allaqachon olgan");
    }
    return prisma.order.findUnique({ where: { id: order.id } });
}
// ——— Kuryer yetkazdi: IN_TRANSIT → DELIVERED (PIN kodi bilan) ———
export async function courierDeliver(actor, orderId, inputPin) {
    if (actor.role !== 'COURIER') {
        throw new OrderActionError('FORBIDDEN', 'Faqat biriktirilgan kuryer yetkazildi deb belgilay oladi');
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
    if (order.courier_id !== actor.id) {
        throw new OrderActionError('FORBIDDEN', 'Faqat biriktirilgan kuryer yetkazildi deb belgilay oladi');
    }
    if (order.status !== 'IN_TRANSIT') {
        throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas (faqat 'IN_TRANSIT' holatidagi buyurtmani yetkazish mumkin)");
    }
    // 1. Agar urinishlar soni 5 yoki undan ko'p bo'lsa, yetkazish bloklangan
    if (order.delivery_pin_attempts >= 5) {
        throw new OrderActionError('BAD_STATE', 'Yetkazish bloklangan (5 ta noto‘g‘ri urinish). Admin bilan bog‘laning');
    }
    // 2. PIN kodi mavjudligini tekshirish
    const cleanPin = String(inputPin || '').trim();
    if (!cleanPin || cleanPin.length !== 4) {
        throw new OrderActionError('VALIDATION', '4 xonali yetkazish PIN kodini kiriting');
    }
    // 3. timingSafeEqual bilan xavfsiz solishtirish
    const pinBuffer = Buffer.from(cleanPin, 'utf-8');
    const actualBuffer = Buffer.from(order.delivery_pin || '', 'utf-8');
    const isMatch = pinBuffer.length === actualBuffer.length && crypto.timingSafeEqual(pinBuffer, actualBuffer);
    if (!isMatch) {
        // Atomik ravishda urinishlar sonini 1 taga oshirish
        const updated = await prisma.order.update({
            where: { id: order.id },
            data: { delivery_pin_attempts: { increment: 1 } },
            select: { delivery_pin_attempts: true },
        });
        const attempts = updated.delivery_pin_attempts;
        if (attempts >= 5) {
            throw new OrderActionError('BAD_STATE', 'PIN kodi 5 marta noto‘g‘ri kiritildi va yetkazish bloklandi. Admin bilan bog‘laning');
        }
        const remaining = 5 - attempts;
        throw new OrderActionError('VALIDATION', `Noto‘g‘ri PIN kodi. Qolgan urinishlar: ${remaining} ta`);
    }
    // 4. PIN to'g'ri bo'lsa: atomik ravishda DELIVERED holatiga o'tkazish
    const result = await prisma.order.updateMany({
        where: {
            id: order.id,
            status: 'IN_TRANSIT',
            courier_id: actor.id,
            delivery_pin_attempts: { lt: 5 },
        },
        data: {
            status: 'DELIVERED',
            delivered_at: new Date(),
        },
    });
    if (result.count !== 1) {
        throw new OrderActionError('BAD_STATE', "Buyurtma holati mos emas yoki allaqachon o'zgargan");
    }
    return prisma.order.findUnique({ where: { id: order.id } });
}
// ——— Xaridor «Qabul qildim»: DELIVERED → COMPLETED ———
export async function buyerComplete(actor, orderId) {
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
    const completed = await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({
            where: { id: order.id, status: 'DELIVERED' },
            data: { status: 'COMPLETED' },
        });
        if (r.count !== 1)
            throw new OrderActionError('BAD_STATE', "Buyurtma allaqachon yakunlangan yoki holati o'zgargan");
        await settleOrder(tx, order, 0);
        return tx.order.findUnique({ where: { id: order.id } });
    });
    return { message: "Buyurtma yakunlandi! Mablag'lar fermer va kuryerga o'tkazildi.", order: completed };
}

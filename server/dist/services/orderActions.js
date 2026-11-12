import crypto from 'node:crypto';
import prisma from '../db.js';
export class OrderActionError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
export function generateDeliveryPin() { return crypto.randomInt(0, 10000).toString().padStart(4, '0'); }
export async function courierPickup(actor, id) {
    if (actor.role !== 'COURIER' || actor.kyc_status !== 'APPROVED')
        throw new OrderActionError('FORBIDDEN', 'Tasdiqlangan logist hisobi kerak');
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
    const changed = await prisma.order.updateMany({ where: { id, status: 'CONFIRMED_BY_FARMER', courier_id: null }, data: { status: 'IN_TRANSIT', courier_id: actor.id, picked_up_at: new Date(), ...(!order.delivery_pin ? { delivery_pin: generateDeliveryPin(), delivery_pin_attempts: 0 } : {}) } });
    if (changed.count !== 1)
        throw new OrderActionError('BAD_STATE', 'Buyurtmani boshqa logist olgan yoki holati o‘zgargan');
    return prisma.order.findUniqueOrThrow({ where: { id } });
}
export async function courierDeliver(actor, id, pin) {
    if (actor.role !== 'COURIER')
        throw new OrderActionError('FORBIDDEN', 'Faqat biriktirilgan logist yetkazishni tasdiqlaydi');
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order)
        throw new OrderActionError('NOT_FOUND', 'Buyurtma topilmadi');
    if (order.courier_id !== actor.id)
        throw new OrderActionError('FORBIDDEN', 'Bu buyurtma sizga biriktirilmagan');
    if (order.status !== 'IN_TRANSIT' || order.delivery_pin_attempts >= 5)
        throw new OrderActionError('BAD_STATE', 'Yetkazish bloklangan yoki buyurtma holati o‘zgargan. Administratorga murojaat qiling.');
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin))
        throw new OrderActionError('VALIDATION', 'Xaridordan olingan 4 xonali PIN kodni kiriting');
    const match = !!order.delivery_pin && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(order.delivery_pin.padEnd(4).slice(0, 4)));
    const where = { id, status: 'IN_TRANSIT', courier_id: actor.id, delivery_pin: order.delivery_pin, delivery_pin_attempts: { lt: 5 } };
    if (!match) {
        await prisma.order.updateMany({ where, data: { delivery_pin_attempts: { increment: 1 } } });
        const current = await prisma.order.findUniqueOrThrow({ where: { id }, select: { delivery_pin_attempts: true } });
        throw new OrderActionError(current.delivery_pin_attempts >= 5 ? 'BAD_STATE' : 'VALIDATION', `PIN noto‘g‘ri. Qolgan urinishlar: ${Math.max(0, 5 - current.delivery_pin_attempts)}.`);
    }
    const changed = await prisma.order.updateMany({ where, data: { status: 'DELIVERED', delivered_at: new Date() } });
    if (changed.count !== 1)
        throw new OrderActionError('BAD_STATE', 'PIN yangilangan, urinishlar tugagan yoki holat o‘zgargan');
    return prisma.order.findUniqueOrThrow({ where: { id } });
}

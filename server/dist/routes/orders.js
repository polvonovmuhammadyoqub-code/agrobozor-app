import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { DELIVERY_FEE, COURIER_PAYOUT, LOGISTICS_MARGIN, COMMISSION_RATE, PAYMENT_TIMEOUT_MIN, INVOICE_TIMEOUT_HOURS, DISPUTE_WINDOW_HOURS, } from '../config.js';
import { chargeOrder } from '../services/payment.js';
import { holdInEscrow, settleOrder } from '../services/settlement.js';
import { cleanText, maskId, positiveNumber } from '../utils/validate.js';
const router = Router();
const BUYER_ROLES = ['BUYER_B2C', 'BUYER_B2B'];
const METHODS = ['CLICK', 'PAYME', 'UZCARD', 'HUMO', 'INVOICE_B2B'];
// Parolsiz, xavfsiz foydalanuvchi maydonlari
const PARTY = { id: true, full_name: true, phone: true, region: true, farm_or_company_name: true };
const FULL_INCLUDE = {
    product: true,
    buyer: { select: PARTY },
    farmer: { select: { ...PARTY, rating: true, is_premium: true } },
    courier: { select: { id: true, full_name: true, phone: true, rating: true } },
    dispute: true,
    reviews: true,
    transactions: true,
};
function isParticipant(order, u) {
    return u.role === 'ADMIN' || order.buyer_id === u.id || order.farmer_id === u.id || order.courier_id === u.id;
}
// Kuryer buyurtmani olmaguncha xaridor telefonini ko'rmaydi; boshqalarga faqat o'zlariga tegishli ma'lumot
function sanitize(order, u) {
    const o = { ...order };
    if (u.role === 'COURIER' && o.courier_id !== u.id && o.buyer) {
        o.buyer = { ...o.buyer, phone: undefined };
        o.delivery_address = undefined;
        o.delivery_schedule = undefined;
        o.dispute = undefined;
        o.reviews = [];
    }
    // Faqat o'ziga tegishli tranzaksiyalarni ko'radi (admin — hammasini)
    if (u.role !== 'ADMIN' && o.transactions) {
        o.transactions = o.transactions.filter((t) => t.user_id === u.id);
    }
    return o;
}
/** Muddati o'tgan to'lanmagan buyurtmalarni bekor qilib, ombor qoldig'ini qaytaradi */
export async function releaseExpiredOrders() {
    try {
        const now = Date.now();
        const stale = await prisma.order.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                OR: [
                    { payment_method: { not: 'INVOICE_B2B' }, created_at: { lt: new Date(now - PAYMENT_TIMEOUT_MIN * 60000) } },
                    { payment_method: 'INVOICE_B2B', created_at: { lt: new Date(now - INVOICE_TIMEOUT_HOURS * 3600000) } },
                ],
            },
            take: 50,
        });
        for (const o of stale) {
            await prisma.$transaction(async (tx) => {
                const r = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
                if (r.count === 1) {
                    await tx.product.update({ where: { id: o.product_id }, data: { available_quantity_kg: { increment: o.quantity_kg } } });
                }
            });
        }
    }
    catch (e) {
        console.error('releaseExpiredOrders error:', e);
    }
}
/** Yetkazilganiga 24 soat o'tib, nizo ochilmagan buyurtmalarni avtomatik yakunlaydi. */
export async function autoCompleteDelivered() {
    try {
        const cutoff = new Date(Date.now() - DISPUTE_WINDOW_HOURS * 3600000);
        const due = await prisma.order.findMany({ where: { status: 'DELIVERED', delivered_at: { lt: cutoff } }, take: 50 });
        for (const o of due) {
            await prisma.$transaction(async (tx) => {
                const r = await tx.order.updateMany({ where: { id: o.id, status: 'DELIVERED' }, data: { status: 'COMPLETED' } });
                if (r.count === 1)
                    await settleOrder(tx, o, 0);
            });
        }
    }
    catch (e) {
        console.error('autoCompleteDelivered error:', e);
    }
}
// 1. Buyurtmalar ro'yxati
router.get('/', authenticateToken, async (req, res) => {
    try {
        await releaseExpiredOrders();
        await autoCompleteDelivered();
        const user = req.user;
        let where = {};
        if (BUYER_ROLES.includes(user.role))
            where.buyer_id = user.id;
        else if (user.role === 'FARMER')
            where.farmer_id = user.id;
        else if (user.role === 'COURIER') {
            where = { OR: [{ courier_id: user.id }, { status: 'CONFIRMED_BY_FARMER', courier_id: null }] };
        }
        else if (user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Ruxsat yo‘q' });
        }
        const orders = await prisma.order.findMany({ where, include: FULL_INCLUDE, orderBy: { created_at: 'desc' }, take: 200 });
        return res.json(orders.map((o) => sanitize(o, user)));
    }
    catch (err) {
        console.error('Get orders error:', err);
        return res.status(500).json({ error: 'Buyurtmalarni yuklashda xatolik' });
    }
});
// 2. Yagona buyurtma (faqat ishtirokchilar)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: FULL_INCLUDE });
        if (!order)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (!isParticipant(order, req.user))
            return res.status(403).json({ error: "Bu buyurtmani ko'rishga ruxsat yo'q" });
        return res.json(sanitize(order, req.user));
    }
    catch {
        return res.status(500).json({ error: "Buyurtma ma'lumotlarini yuklashda xatolik" });
    }
});
// 3. Buyurtma berish: ombor qoldig'i band qilinadi, status PENDING_PAYMENT (pul hali tushmagan!)
router.post('/', authenticateToken, requireRole(BUYER_ROLES), async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { product_id, delivery_schedule } = req.body || {};
        const qty = positiveNumber(req.body?.quantity_kg);
        const delivery_address = cleanText(req.body?.delivery_address, 300);
        const payment_method = METHODS.includes(req.body?.payment_method) ? req.body.payment_method : 'CLICK';
        if (!product_id || !qty || delivery_address.length < 5) {
            return res.status(400).json({ error: "Mahsulot, miqdor va to'liq manzilni kiriting" });
        }
        if (payment_method === 'INVOICE_B2B' && req.user.role !== 'BUYER_B2B') {
            return res.status(400).json({ error: 'Hisob-faktura orqali to‘lov faqat biznes hisoblar uchun' });
        }
        const product = await prisma.product.findUnique({ where: { id: String(product_id) }, include: { farmer: true } });
        if (!product || !product.is_active) {
            return res.status(404).json({ error: 'Mahsulot topilmadi yoki sotuvda mavjud emas' });
        }
        if (product.farmer_id === buyerId)
            return res.status(400).json({ error: "O'z mahsulotingizni sotib ola olmaysiz" });
        if (product.farmer.kyc_status !== 'APPROVED') {
            return res.status(400).json({ error: 'Sotuvchi hali tekshiruvdan o‘tmagan' });
        }
        if (qty < product.min_order_kg) {
            return res.status(400).json({ error: `Minimal buyurtma miqdori: ${product.min_order_kg} kg` });
        }
        const product_total_amount = Math.round(qty * product.price_per_kg);
        if (!Number.isSafeInteger(product_total_amount) || product_total_amount < 1 || product_total_amount > 2_147_483_647 - DELIVERY_FEE) {
            return res.status(400).json({ error: "Buyurtma summasi ruxsat etilgan chegaradan tashqarida" });
        }
        const platform_commission = Math.round(product_total_amount * COMMISSION_RATE);
        const farmer_payout = product_total_amount - platform_commission;
        const order = await prisma.$transaction(async (tx) => {
            // Atomik band qilish: poyga holatida (oversell) ikki kishiga bir xil qoldiq sotilmaydi
            const reserved = await tx.product.updateMany({
                where: { id: product.id, is_active: true, available_quantity_kg: { gte: qty } },
                data: { available_quantity_kg: { decrement: qty } },
            });
            if (reserved.count !== 1)
                throw new Error('STOCK');
            return tx.order.create({
                data: {
                    buyer_id: buyerId,
                    farmer_id: product.farmer_id,
                    product_id: product.id,
                    product_title: product.title,
                    unit_price_per_kg: product.price_per_kg,
                    quantity_kg: qty,
                    product_total_amount,
                    delivery_fee: DELIVERY_FEE,
                    total_paid: product_total_amount + DELIVERY_FEE,
                    platform_commission,
                    farmer_payout,
                    courier_payout: COURIER_PAYOUT,
                    platform_logistics_margin: LOGISTICS_MARGIN,
                    payment_method,
                    status: 'PENDING_PAYMENT',
                    delivery_address,
                    delivery_schedule: delivery_schedule ? cleanText(delivery_schedule, 200) : null,
                },
            });
        });
        return res.status(201).json(order);
    }
    catch (err) {
        if (err?.message === 'STOCK')
            return res.status(400).json({ error: 'Omborda yetarli mahsulot qolmagan' });
        console.error('Create order error:', err);
        return res.status(500).json({ error: 'Buyurtma rasmiylashtirishda xatolik yuz berdi' });
    }
});
// 3b. Savatdagi barcha mahsulotlarni rasmiylashtirish (Multi-item cart checkout)
router.post('/checkout', authenticateToken, requireRole(BUYER_ROLES), async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { items, delivery_address, delivery_schedule, payment_method } = req.body || {};
        if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
            return res.status(400).json({ error: 'Savatda mahsulotlar mavjud emas' });
        }
        const cleanAddress = cleanText(delivery_address, 300);
        if (cleanAddress.length < 5) {
            return res.status(400).json({ error: "Yetkazib berish manzilini to'liq kiriting" });
        }
        const payMethod = METHODS.includes(payment_method) ? payment_method : 'CLICK';
        if (payMethod === 'INVOICE_B2B' && req.user.role !== 'BUYER_B2B') {
            return res.status(400).json({ error: 'Hisob-faktura orqali to‘lov faqat biznes hisoblar uchun' });
        }
        // Har bir mahsulotni tekshirish
        const itemRequests = items.map((it) => ({
            product_id: typeof it?.product_id === 'string' ? it.product_id.trim() : '',
            quantity_kg: positiveNumber(it?.quantity_kg),
        }));
        if (itemRequests.some((it) => !it.product_id || !it.quantity_kg)) {
            return res.status(400).json({ error: "Mahsulotlar va ularning miqdorlari to'g'ri kiritilishi shart" });
        }
        const productIds = itemRequests.map((it) => it.product_id);
        if (new Set(productIds).size !== productIds.length) {
            return res.status(400).json({ error: 'Bir mahsulot savatda faqat bir marta kiritilishi kerak' });
        }
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { farmer: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        for (const item of itemRequests) {
            const prod = productMap.get(item.product_id);
            if (!prod || !prod.is_active) {
                return res.status(400).json({ error: `Mahsulot topilmadi yoki sotuvda faol emas: ${prod?.title || item.product_id}` });
            }
            if (prod.farmer_id === buyerId) {
                return res.status(400).json({ error: `O'zingizning mahsulotingizni sotib ola olmaysiz: ${prod.title}` });
            }
            if (prod.farmer.kyc_status !== 'APPROVED') {
                return res.status(400).json({ error: `Sotuvchi hali tekshiruvdan o'tmagan: ${prod.farmer.full_name}` });
            }
            const amount = Math.round(item.quantity_kg * prod.price_per_kg);
            if (amount < 1 || amount > 2_147_483_647 - DELIVERY_FEE) {
                return res.status(400).json({ error: "Buyurtma summasi ruxsat etilgan chegaradan tashqarida" });
            }
            if (item.quantity_kg < prod.min_order_kg) {
                return res.status(400).json({ error: `${prod.title} uchun minimal buyurtma: ${prod.min_order_kg} kg` });
            }
            if (item.quantity_kg > prod.available_quantity_kg) {
                return res.status(400).json({ error: `${prod.title} omborda yetarli emas. Qoldiq: ${prod.available_quantity_kg} kg` });
            }
        }
        // Fermerlar bo'yicha guruhlash (har bir alohida fermer yetkazib berish bo'yicha alohida hisoblanadi)
        const farmerOrdersMap = new Map();
        for (const item of itemRequests) {
            const prod = productMap.get(item.product_id);
            const list = farmerOrdersMap.get(prod.farmer_id) || [];
            list.push(item);
            farmerOrdersMap.set(prod.farmer_id, list);
        }
        const createdOrders = await prisma.$transaction(async (tx) => {
            const resultList = [];
            for (const [farmerId, farmerItems] of farmerOrdersMap.entries()) {
                for (const item of farmerItems) {
                    const prod = productMap.get(item.product_id);
                    // Ombor qoldig'ini atomik band qilish
                    const reserved = await tx.product.updateMany({
                        where: { id: prod.id, is_active: true, available_quantity_kg: { gte: item.quantity_kg } },
                        data: { available_quantity_kg: { decrement: item.quantity_kg } },
                    });
                    if (reserved.count !== 1) {
                        throw new Error(`STOCK_${prod.title}`);
                    }
                    const product_total_amount = Math.round(item.quantity_kg * prod.price_per_kg);
                    const platform_commission = Math.round(product_total_amount * COMMISSION_RATE);
                    const farmer_payout = product_total_amount - platform_commission;
                    // Each order is claimed, cancelled and delivered independently.
                    const delivery_fee = DELIVERY_FEE;
                    const courier_payout = COURIER_PAYOUT;
                    const platform_logistics_margin = LOGISTICS_MARGIN;
                    const order = await tx.order.create({
                        data: {
                            buyer_id: buyerId,
                            farmer_id: farmerId,
                            product_id: prod.id,
                            product_title: prod.title,
                            unit_price_per_kg: prod.price_per_kg,
                            quantity_kg: item.quantity_kg,
                            product_total_amount,
                            delivery_fee,
                            total_paid: product_total_amount + delivery_fee,
                            platform_commission,
                            farmer_payout,
                            courier_payout,
                            platform_logistics_margin,
                            payment_method: payMethod,
                            status: 'PENDING_PAYMENT',
                            delivery_address: cleanAddress,
                            delivery_schedule: delivery_schedule ? cleanText(delivery_schedule, 200) : null,
                        },
                    });
                    resultList.push(order);
                }
            }
            return resultList;
        });
        return res.status(201).json({
            orders: createdOrders,
            total_orders_count: createdOrders.length,
            grand_total: createdOrders.reduce((sum, o) => sum + o.total_paid, 0),
        });
    }
    catch (err) {
        if (err?.message?.startsWith('STOCK_')) {
            return res.status(400).json({ error: `Omborda mahsulot yetarli emas: ${err.message.replace('STOCK_', '')}` });
        }
        console.error('Checkout error:', err);
        return res.status(500).json({ error: 'Savat buyurtmalarini rasmiylashtirishda xatolik yuz berdi' });
    }
});
// 4. To'lov: muvaffaqiyatli bo'lsa pul ESCROW'ga tushadi (PAID_IN_ESCROW)
router.post('/:id/pay', authenticateToken, requireRole(BUYER_ROLES), async (req, res) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.buyer_id !== req.user.id)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (order.status !== 'PENDING_PAYMENT') {
            return res.status(400).json({ error: "Bu buyurtma to'lov kutmayapti" });
        }
        // Muddat tekshiruvi: 30 daqiqa (oddiy to'lov) yoki 72 soat (B2B hisob-faktura)
        const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
        const isExpired = order.payment_method === 'INVOICE_B2B'
            ? orderAgeMs > INVOICE_TIMEOUT_HOURS * 3600000
            : orderAgeMs > PAYMENT_TIMEOUT_MIN * 60000;
        if (isExpired) {
            await prisma.$transaction(async (tx) => {
                const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
                if (r.count === 1) {
                    await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
                }
            });
            return res.status(400).json({ error: "Buyurtmani to'lash muddati tugagan (rezerv bekor qilindi). Iltimos, qaytadan buyurtma bering." });
        }
        // B2B hisob-faktura: admin bank o'tkazmasini tasdiqlagach escrow'ga tushadi
        if (order.payment_method === 'INVOICE_B2B') {
            return res.json({ order, pending_invoice: true, message: "Hisob-faktura shakllandi. To'lov tasdiqlangach buyurtma faollashadi." });
        }
        const charge = await chargeOrder(order.id, order.total_paid, order.payment_method);
        if (!charge.ok)
            return res.status(402).json({ error: charge.error || "To'lov amalga oshmadi" });
        const updated = await prisma.$transaction(async (tx) => {
            const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID_IN_ESCROW' } });
            if (r.count !== 1)
                throw new Error('STATE');
            await holdInEscrow(tx, order);
            return tx.order.findUnique({ where: { id: order.id } });
        });
        return res.json({ order: updated, reference: charge.reference });
    }
    catch (err) {
        if (err?.message === 'STATE')
            return res.status(409).json({ error: "Buyurtma holati o'zgargan, sahifani yangilang" });
        console.error('Pay order error:', err);
        return res.status(500).json({ error: "To'lovda xatolik yuz berdi" });
    }
});
// 5. To'lanmagan buyurtmani bekor qilish (qoldiq qaytadi)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.buyer_id !== req.user.id)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        await prisma.$transaction(async (tx) => {
            const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
            if (r.count !== 1)
                throw new Error('STATE');
            await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
        });
        return res.json({ message: 'Buyurtma bekor qilindi' });
    }
    catch (err) {
        if (err?.message === 'STATE')
            return res.status(400).json({ error: "Faqat to'lanmagan buyurtmani bekor qilish mumkin" });
        return res.status(500).json({ error: 'Bekor qilishda xatolik' });
    }
});
// 6. Fermer buyurtmani rad etadi -> xaridorga to'liq qaytariladi
router.post('/:id/reject', authenticateToken, requireRole(['FARMER']), async (req, res) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.farmer_id !== req.user.id)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        await prisma.$transaction(async (tx) => {
            const r = await tx.order.updateMany({ where: { id: order.id, status: 'PAID_IN_ESCROW' }, data: { status: 'REFUNDED' } });
            if (r.count !== 1)
                throw new Error('STATE');
            await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
            await settleOrder(tx, order, order.product_total_amount);
        });
        return res.json({ message: 'Buyurtma rad etildi, mablag‘ xaridorga qaytarildi' });
    }
    catch (err) {
        if (err?.message === 'STATE')
            return res.status(400).json({ error: 'Buyurtma hozirgi holatida rad etilmaydi' });
        console.error('Reject order error:', err);
        return res.status(500).json({ error: 'Rad etishda xatolik' });
    }
});
// 7. Holat o'zgartirish: qat'iy ketma-ketlik va egalik tekshiruvi
//    PAID_IN_ESCROW -> CONFIRMED_BY_FARMER (fermer) -> IN_TRANSIT (kuryer oladi) -> DELIVERED (shu kuryer)
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const status = String(req.body?.status ?? '');
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        let result;
        if (status === 'CONFIRMED_BY_FARMER') {
            if (user.role !== 'FARMER' || order.farmer_id !== user.id)
                return res.status(403).json({ error: 'Faqat buyurtma egasi fermer tasdiqlay oladi' });
            result = await prisma.order.updateMany({ where: { id: order.id, status: 'PAID_IN_ESCROW' }, data: { status } });
        }
        else if (status === 'IN_TRANSIT') {
            if (user.role !== 'COURIER')
                return res.status(403).json({ error: 'Faqat kuryer buyurtmani olishi mumkin' });
            if (user.kyc_status !== 'APPROVED')
                return res.status(403).json({ error: 'Kuryer profili hali tasdiqlanmagan' });
            // Atomik "claim": bir buyurtmani ikki kuryer ola olmaydi
            result = await prisma.order.updateMany({
                where: { id: order.id, status: 'CONFIRMED_BY_FARMER', courier_id: null },
                data: { status, courier_id: user.id },
            });
        }
        else if (status === 'DELIVERED') {
            if (user.role !== 'COURIER' || order.courier_id !== user.id)
                return res.status(403).json({ error: 'Faqat biriktirilgan kuryer yetkazildi deb belgilay oladi' });
            result = await prisma.order.updateMany({
                where: { id: order.id, status: 'IN_TRANSIT', courier_id: user.id },
                data: { status, delivered_at: new Date() },
            });
        }
        else {
            return res.status(400).json({ error: "Bu holatga to'g'ridan-to'g'ri o'tib bo'lmaydi" });
        }
        if (result.count !== 1)
            return res.status(409).json({ error: "Buyurtma holati mos emas yoki allaqachon o'zgargan" });
        const updated = await prisma.order.findUnique({ where: { id: order.id }, include: FULL_INCLUDE });
        return res.json(sanitize(updated, user));
    }
    catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ error: 'Statusni yangilashda xatolik' });
    }
});
// 8. Xaridor "Qabul qildim" -> escrow'dan pul taqsimlanadi (faqat DELIVERED'dan, bir marta)
router.post('/:id/complete', authenticateToken, requireRole(BUYER_ROLES), async (req, res) => {
    try {
        const order = await prisma.order.findUnique({ where: { id: req.params.id } });
        if (!order || order.buyer_id !== req.user.id)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (order.status === 'DISPUTED')
            return res.status(400).json({ error: 'Bu buyurtma bo‘yicha nizo ochilgan' });
        if (order.status !== 'DELIVERED')
            return res.status(400).json({ error: 'Mahsulot yetkazilgandan keyingina qabul qilish mumkin' });
        const completed = await prisma.$transaction(async (tx) => {
            const r = await tx.order.updateMany({ where: { id: order.id, status: 'DELIVERED' }, data: { status: 'COMPLETED' } });
            if (r.count !== 1)
                throw new Error('STATE'); // ikki marta bosish / poyga
            await settleOrder(tx, order, 0);
            return tx.order.findUnique({ where: { id: order.id } });
        });
        return res.json({ message: "Buyurtma yakunlandi! Mablag'lar fermer va kuryerga o'tkazildi.", order: completed });
    }
    catch (err) {
        if (err?.message === 'STATE')
            return res.status(409).json({ error: 'Buyurtma allaqachon yakunlangan yoki holati o‘zgargan' });
        console.error('Complete order error:', err);
        return res.status(500).json({ error: 'Buyurtmani yakunlashda xatolik yuz berdi' });
    }
});
// 9. Hisob-faktura (faqat ishtirokchilar; pasport/STIR maskalanadi)
router.get('/:id/invoice', authenticateToken, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: { product: true, buyer: true, farmer: true },
        });
        if (!order)
            return res.status(404).json({ error: 'Hisob-faktura uchun buyurtma topilmadi' });
        if (!isParticipant(order, req.user))
            return res.status(403).json({ error: 'Ruxsat yo‘q' });
        return res.json({
            invoice_number: `AGRO-INV-${order.id.slice(0, 8).toUpperCase()}`,
            created_at: order.created_at,
            payment_method: order.payment_method,
            status: order.status,
            seller: {
                name: order.farmer.farm_or_company_name || order.farmer.full_name,
                tin: maskId(order.farmer.tin_or_passport),
                address: order.farmer.region,
                phone: order.farmer.phone,
            },
            buyer: {
                name: order.buyer.farm_or_company_name || order.buyer.full_name,
                tin: maskId(order.buyer.tin_or_passport),
                address: order.delivery_address || order.buyer.region,
                phone: order.buyer.phone,
            },
            items: [
                {
                    name: order.product_title || order.product.title,
                    category: order.product.category,
                    quantity_kg: order.quantity_kg,
                    price_per_kg: order.unit_price_per_kg ??
                        (order.quantity_kg > 0
                            ? Math.round(order.product_total_amount / order.quantity_kg)
                            : order.product.price_per_kg),
                    total_price: order.product_total_amount,
                },
            ],
            delivery_fee: order.delivery_fee,
            platform_service_fee: order.platform_commission,
            grand_total: order.total_paid,
            delivery_schedule: order.delivery_schedule || 'Bir martalik tezkor yetkazib berish',
            stamp: 'AGROBOZOR ELEKTRON HISOB-FAKTURASI',
        });
    }
    catch {
        return res.status(500).json({ error: 'Hisob-fakturani generatsiya qilishda xatolik' });
    }
});
export default router;

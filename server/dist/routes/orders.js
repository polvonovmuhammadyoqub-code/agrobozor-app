import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
// 1. Buyurtmalar ro'yxati (Foydalanuvchi roliga qarab)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let where = {};
        if (user.role === 'BUYER_B2C' || user.role === 'BUYER_B2B') {
            where.buyer_id = user.id;
        }
        else if (user.role === 'FARMER') {
            where.farmer_id = user.id;
        }
        else if (user.role === 'COURIER') {
            // Kuryer o'z buyurtmalarini yoki tasdiqlangan (ochiq) buyurtmalarni ko'ra oladi
            where = {
                OR: [
                    { courier_id: user.id },
                    { status: 'CONFIRMED_BY_FARMER', courier_id: null },
                ],
            };
        }
        // ADMIN barcha buyurtmalarni ko'radi
        const orders = await prisma.order.findMany({
            where,
            include: {
                product: true,
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                        phone: true,
                        region: true,
                        farm_or_company_name: true,
                        tin_or_passport: true,
                    },
                },
                farmer: {
                    select: {
                        id: true,
                        full_name: true,
                        phone: true,
                        region: true,
                        farm_or_company_name: true,
                        tin_or_passport: true,
                        rating: true,
                        is_premium: true,
                    },
                },
                courier: {
                    select: {
                        id: true,
                        full_name: true,
                        phone: true,
                        rating: true,
                    },
                },
                dispute: true,
                reviews: true,
                transactions: true,
            },
            orderBy: { created_at: 'desc' },
        });
        return res.json(orders);
    }
    catch (err) {
        console.error('Get orders error:', err);
        return res.status(500).json({ error: 'Buyurtmalarni yuklashda xatolik' });
    }
});
// 2. Yagona buyurtma detali
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                product: true,
                buyer: true,
                farmer: true,
                courier: true,
                dispute: true,
                reviews: true,
                transactions: true,
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        }
        return res.json(order);
    }
    catch (err) {
        return res.status(500).json({ error: 'Buyurtma ma\'lumotlarini yuklashda xatolik' });
    }
});
// 3. Buyurtma berish va Escrow mantiqi (POST /api/orders)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { product_id, quantity_kg, payment_method, // 'CLICK', 'PAYME', 'UZCARD', 'HUMO', 'INVOICE_B2B'
        delivery_address, delivery_schedule, // ixtiyoriy B2B uchun
         } = req.body;
        if (!product_id || !quantity_kg || !delivery_address) {
            return res.status(400).json({ error: 'Barcha ma\'lumotlarni to\'ldiring' });
        }
        const qty = parseFloat(quantity_kg);
        if (qty <= 0) {
            return res.status(400).json({ error: 'Miqdor 0 dan katta bo\'lishi kerak' });
        }
        // Mahsulotni tekshiramiz
        const product = await prisma.product.findUnique({
            where: { id: product_id },
            include: { farmer: true },
        });
        if (!product) {
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        }
        if (!product.is_active) {
            return res.status(400).json({ error: 'Ushbu mahsulot hozirda sotuvda mavjud emas' });
        }
        if (qty < product.min_order_kg) {
            return res.status(400).json({
                error: `Minimal buyurtma miqdori: ${product.min_order_kg} kg`,
            });
        }
        // a) Ombordagi qoldiq yetarliligini tekshirish
        if (product.available_quantity_kg < qty) {
            return res.status(400).json({
                error: `Omborda yetarli mahsulot qolmagan. Mavjud qoldiq: ${product.available_quantity_kg} kg`,
            });
        }
        // Moliya hisob-kitoblari:
        const product_total_amount = qty * product.price_per_kg;
        const delivery_fee = 15000;
        const total_paid = product_total_amount + delivery_fee;
        const platform_commission = Math.round(product_total_amount * 0.10);
        const farmer_payout = product_total_amount - platform_commission; // 90%
        const courier_payout = 12000;
        const platform_logistics_margin = 3000;
        // Database Tranzaksiyasi ichida bajarish:
        const result = await prisma.$transaction(async (tx) => {
            // 1. Ombordagi qoldiqni ayirish
            await tx.product.update({
                where: { id: product.id },
                data: {
                    available_quantity_kg: {
                        decrement: qty,
                    },
                },
            });
            // 2. Buyurtmani 'PAID_IN_ESCROW' sifatida yaratish
            const order = await tx.order.create({
                data: {
                    buyer_id: buyerId,
                    farmer_id: product.farmer_id,
                    product_id: product.id,
                    quantity_kg: qty,
                    product_total_amount,
                    delivery_fee,
                    total_paid,
                    platform_commission,
                    farmer_payout,
                    courier_payout,
                    platform_logistics_margin,
                    payment_method: payment_method || 'CLICK',
                    status: 'PAID_IN_ESCROW',
                    delivery_address,
                    delivery_schedule: delivery_schedule || null,
                },
            });
            // 3. Fermerning wallet_escrow balansiga qo'shish (90% qismi)
            await tx.user.update({
                where: { id: product.farmer_id },
                data: {
                    wallet_escrow: {
                        increment: farmer_payout,
                    },
                },
            });
            // 4. Tranzaksiyalar jadvaliga ESCROW_HOLD yozish
            await tx.transaction.create({
                data: {
                    order_id: order.id,
                    user_id: buyerId,
                    amount: total_paid,
                    type: 'ESCROW_HOLD',
                },
            });
            return order;
        });
        return res.status(201).json(result);
    }
    catch (err) {
        console.error('Create order error:', err);
        return res.status(500).json({ error: 'Buyurtma rasmiylashtirishda xatolik yuz berdi' });
    }
});
// 4. Buyurtma zanjiri statusini o'zgartirish (PATCH /api/orders/:id/status)
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user = req.user;
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        }
        const validStatuses = [
            'PAID_IN_ESCROW',
            'CONFIRMED_BY_FARMER',
            'IN_TRANSIT',
            'DELIVERED',
            'COMPLETED',
            'DISPUTED',
            'REFUNDED',
        ];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Noto\'g\'ri status' });
        }
        let updateData = { status };
        // Fermer tasdiqlashi
        if (status === 'CONFIRMED_BY_FARMER') {
            if (user.role !== 'FARMER' && user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Faqat fermer buyurtmani tasdiqlay oladi' });
            }
            if (order.status !== 'PAID_IN_ESCROW') {
                return res.status(400).json({ error: 'Buyurtma hozirgi holatida tasdiqlanmaydi' });
            }
        }
        // Kuryer yo'lga chiqishi
        if (status === 'IN_TRANSIT') {
            if (user.role !== 'COURIER' && user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Faqat kuryer ushbu buyurtmani yetkazishga ola oladi' });
            }
            updateData.courier_id = user.id;
        }
        // Kuryer yetkazib berishi
        if (status === 'DELIVERED') {
            if (user.role !== 'COURIER' && user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Faqat kuryer yetkazildi deb belgilashi mumkin' });
            }
        }
        const updated = await prisma.order.update({
            where: { id },
            data: updateData,
            include: {
                product: true,
                buyer: true,
                farmer: true,
                courier: true,
            },
        });
        return res.json(updated);
    }
    catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ error: 'Statusni yangilashda xatolik' });
    }
});
// 5. Escrow'dan pulni yechish — Buyurtmani yakunlash (POST /api/orders/:id/complete)
router.post('/:id/complete', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const order = await prisma.order.findUnique({
            where: { id },
            include: { product: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        }
        // Faqat xaridor yoki admin tasdiqlay oladi
        if (order.buyer_id !== user.id && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Faqat xaridor mahsulotni qabul qilib, pulni yechib bera oladi' });
        }
        if (order.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Buyurtma allaqachon yakunlangan' });
        }
        if (order.status === 'DISPUTED') {
            return res.status(400).json({ error: 'Ushbu buyurtma bo\'yicha nizo ochilgan, avval nizoni hal qiling' });
        }
        // Database Tranzaksiyasi
        const completedOrder = await prisma.$transaction(async (tx) => {
            // a) Buyurtma status = 'COMPLETED'
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { status: 'COMPLETED' },
            });
            // b) Fermerning wallet_escrow balansidan farmer_payout ayrilib, wallet_available ga o'tadi
            await tx.user.update({
                where: { id: order.farmer_id },
                data: {
                    wallet_escrow: { decrement: order.farmer_payout },
                    wallet_available: { increment: order.farmer_payout },
                },
            });
            // c) Kuryerning wallet_available balansiga 12 000 so'm qo'shiladi (agar kuryer biriktirilgan bo'lsa)
            if (order.courier_id) {
                await tx.user.update({
                    where: { id: order.courier_id },
                    data: {
                        wallet_available: { increment: order.courier_payout },
                    },
                });
                // Tranzaksiya: Kuryer to'lovi
                await tx.transaction.create({
                    data: {
                        order_id: order.id,
                        user_id: order.courier_id,
                        amount: order.courier_payout,
                        type: 'COURIER_FEE',
                    },
                });
            }
            // d) Fermerga yechilgan pul tranzaksiyasi
            await tx.transaction.create({
                data: {
                    order_id: order.id,
                    user_id: order.farmer_id,
                    amount: order.farmer_payout,
                    type: 'ESCROW_RELEASE_FARMER',
                },
            });
            // e) Platforma komissiyasi va logistika marjasi tranzaksiyasi
            // Admin foydalanuvchisini topamiz
            const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' } });
            if (adminUser) {
                const platformTotalRevenue = order.platform_commission + order.platform_logistics_margin;
                await tx.transaction.create({
                    data: {
                        order_id: order.id,
                        user_id: adminUser.id,
                        amount: platformTotalRevenue,
                        type: 'PLATFORM_COMMISSION',
                    },
                });
            }
            return updatedOrder;
        });
        return res.json({
            message: 'Buyurtma muvaffaqiyatli yakunlandi! Mablag\'lar fermer va kuryerga o\'tkazildi.',
            order: completedOrder,
        });
    }
    catch (err) {
        console.error('Complete order error:', err);
        return res.status(500).json({ error: 'Buyurtmani yakunlashda xatolik yuz berdi' });
    }
});
// 6. B2B Hisob-faktura (Invoice) ma'lumotlarini olish
router.get('/:id/invoice', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                product: true,
                buyer: true,
                farmer: true,
                courier: true,
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Hisob-faktura uchun buyurtma topilmadi' });
        }
        const invoiceData = {
            invoice_number: `AGRO-INV-${order.id.slice(0, 8).toUpperCase()}`,
            created_at: order.created_at,
            payment_method: order.payment_method,
            status: order.status,
            seller: {
                name: order.farmer.farm_or_company_name || order.farmer.full_name,
                tin: order.farmer.tin_or_passport,
                address: order.farmer.region,
                phone: order.farmer.phone,
            },
            buyer: {
                name: order.buyer.farm_or_company_name || order.buyer.full_name,
                tin: order.buyer.tin_or_passport,
                address: order.delivery_address || order.buyer.region,
                phone: order.buyer.phone,
            },
            items: [
                {
                    name: order.product.title,
                    category: order.product.category,
                    quantity_kg: order.quantity_kg,
                    price_per_kg: order.product.price_per_kg,
                    total_price: order.product_total_amount,
                },
            ],
            delivery_fee: order.delivery_fee,
            platform_service_fee: order.platform_commission,
            grand_total: order.total_paid,
            delivery_schedule: order.delivery_schedule || 'Bir martalik tezkor yetkazib berish',
            stamp: 'AGROBOZOR RASMIY ELEKTRON MUHRI BILAN TASDIQLANGAN',
        };
        return res.json(invoiceData);
    }
    catch (err) {
        return res.status(500).json({ error: 'Hisob-fakturani generatsiya qilishda xatolik' });
    }
});
export default router;

import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { settleOrder } from '../services/settlement.js';
import { DISPUTE_WINDOW_HOURS } from '../config.js';
import { cleanText, positiveInt } from '../utils/validate.js';
import { supabase } from '../services/supabase.js';
const router = Router();
const PARTY = { id: true, full_name: true, phone: true, region: true, farm_or_company_name: true };
const DISPUTABLE = ['CONFIRMED_BY_FARMER', 'IN_TRANSIT', 'DELIVERED'];
// 1. Nizolar ro'yxati (har bir nizo uchun xavfsiz 300 soniyalik signed URL generatsiya qilinadi)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let where = {};
        if (user.role === 'BUYER_B2C' || user.role === 'BUYER_B2B')
            where.buyer_id = user.id;
        else if (user.role === 'FARMER')
            where.order = { farmer_id: user.id };
        else if (user.role !== 'ADMIN')
            return res.status(403).json({ error: 'Ruxsat yo‘q' });
        const disputes = await prisma.dispute.findMany({
            where,
            include: {
                order: { include: { product: true, farmer: { select: PARTY }, buyer: { select: PARTY }, courier: { select: PARTY } } },
                buyer: { select: { id: true, full_name: true, phone: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 200,
        });
        // Har bir nizo uchun evidence_signed_url generatsiya qilish (faqat huquqi bo'lganlarga)
        const disputesWithSignedUrls = await Promise.all(disputes.map(async (d) => {
            let evidence_signed_url = null;
            if (d.evidence_image_url && d.evidence_image_url.startsWith('private-docs:')) {
                const filePath = d.evidence_image_url.replace(/^private-docs:/, '');
                const isAllowed = user.role === 'ADMIN' || d.buyer_id === user.id || d.order?.farmer_id === user.id;
                if (isAllowed && supabase) {
                    try {
                        const { data: signed } = await supabase.storage.from('private-docs').createSignedUrl(filePath, 300);
                        evidence_signed_url = signed?.signedUrl || null;
                    }
                    catch (e) {
                        console.error('Failed to create signed url for evidence:', e);
                    }
                }
            }
            if (d.order) {
                delete d.order.delivery_pin;
            }
            return {
                ...d,
                evidence_signed_url,
            };
        }));
        return res.json(disputesWithSignedUrls);
    }
    catch (err) {
        console.error('Get disputes error:', err);
        return res.status(500).json({ error: 'Nizolarni yuklashda xatolik' });
    }
});
// 2. Nizo ochish: faqat xaridor, faqat yetkazish jarayonida yoki yetkazilgach 24 soat ichida
router.post('/', authenticateToken, requireRole(['BUYER_B2C', 'BUYER_B2B']), async (req, res) => {
    try {
        const buyerId = req.user.id;
        const order_id = String(req.body?.order_id ?? '');
        const reason = cleanText(req.body?.reason, 1000);
        const evidence = req.body?.evidence_image_url ? String(req.body.evidence_image_url).trim() : null;
        if (!order_id || reason.length < 10) {
            return res.status(400).json({ error: "Sababni batafsil yozing (kamida 10 belgi)" });
        }
        // Dalil ixtiyoriy. Agar berilgan bo'lsa, aniq private-docs:<buyerId>/<uuid>.(jpg|png|webp) shabloniga mos kelishi shart
        if (evidence) {
            const pattern = new RegExp(`^private-docs:${buyerId}/[0-9a-fA-F-]{36}\\.(jpg|png|webp)$`);
            if (!pattern.test(evidence)) {
                return res.status(400).json({
                    error: "Dalil rasmi faqat o'zingiz yuklagan private-docs xavfsiz fayli bo'lishi kerak (private-docs:<buyerId>/<uuid>.<ext>)",
                });
            }
        }
        const order = await prisma.order.findUnique({ where: { id: order_id } });
        if (!order || order.buyer_id !== buyerId)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (!DISPUTABLE.includes(order.status)) {
            return res.status(400).json({ error: 'Bu holatdagi buyurtma bo‘yicha nizo ochib bo‘lmaydi' });
        }
        if (order.status === 'DELIVERED' && order.delivered_at &&
            Date.now() - order.delivered_at.getTime() > DISPUTE_WINDOW_HOURS * 3600000) {
            return res.status(400).json({ error: `Shikoyat muddati (${DISPUTE_WINDOW_HOURS} soat) o'tgan` });
        }
        const dispute = await prisma.$transaction(async (tx) => {
            const r = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: 'DISPUTED' } });
            if (r.count !== 1)
                throw new Error('STATE');
            return tx.dispute.create({
                data: { order_id, buyer_id: buyerId, reason, evidence_image_url: evidence || null, status: 'OPEN' },
            });
        });
        return res.status(201).json(dispute);
    }
    catch (err) {
        if (err?.code === 'P2002')
            return res.status(400).json({ error: 'Bu buyurtma bo‘yicha allaqachon nizo ochilgan' });
        if (err?.message === 'STATE')
            return res.status(409).json({ error: "Buyurtma holati o'zgargan, sahifani yangilang" });
        console.error('Create dispute error:', err);
        return res.status(500).json({ error: 'Nizo ochishda xatolik yuz berdi' });
    }
});
// 3. Admin arbitraji
//    RESOLVED_REFUND_FULL    — mahsulot summasi to'liq qaytadi
//    RESOLVED_REFUND_PARTIAL — refund_amount (so'm, mahsulot summasidan oshmaydi); bermasa 50%
//    RESOLVED_FARMER_WIN     — fermerga to'liq to'lanadi
router.post('/:id/resolve', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    try {
        const resolution = String(req.body?.resolution ?? '');
        const admin_comment = cleanText(req.body?.admin_comment, 1000);
        const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id }, include: { order: true } });
        if (!dispute)
            return res.status(404).json({ error: 'Nizo topilmadi' });
        if (dispute.status !== 'OPEN')
            return res.status(400).json({ error: 'Bu nizo allaqachon hal qilingan' });
        const order = dispute.order;
        let productRefund;
        let orderStatus;
        if (resolution === 'RESOLVED_REFUND_FULL') {
            productRefund = order.product_total_amount;
            orderStatus = 'REFUNDED';
        }
        else if (resolution === 'RESOLVED_REFUND_PARTIAL') {
            const asked = positiveInt(req.body?.refund_amount);
            productRefund = Math.min(asked ?? Math.round(order.product_total_amount / 2), order.product_total_amount);
            orderStatus = 'REFUNDED';
        }
        else if (resolution === 'RESOLVED_FARMER_WIN') {
            productRefund = 0;
            orderStatus = 'COMPLETED';
        }
        else {
            return res.status(400).json({ error: "Noto'g'ri qaror turi" });
        }
        const result = await prisma.$transaction(async (tx) => {
            const claimed = await tx.dispute.updateMany({
                where: { id: dispute.id, status: 'OPEN' },
                data: { status: resolution, refund_amount: productRefund, admin_comment: admin_comment || null },
            });
            if (claimed.count !== 1)
                throw new Error('STATE');
            await tx.order.update({ where: { id: order.id }, data: { status: orderStatus } });
            return settleOrder(tx, order, productRefund);
        });
        return res.json({ message: 'Qaror ijro etildi', ...result });
    }
    catch (err) {
        if (err?.message === 'STATE')
            return res.status(409).json({ error: 'Nizo allaqachon hal qilingan' });
        console.error('Resolve dispute error:', err);
        return res.status(500).json({ error: 'Nizoni hal qilishda xatolik yuz berdi' });
    }
});
export default router;

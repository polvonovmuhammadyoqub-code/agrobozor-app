import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { cleanText } from '../utils/validate.js';
const router = Router();
// Sharh: faqat yakunlangan buyurtma ishtirokchisi, faqat boshqa ishtirokchiga, bir marta
router.post('/', authenticateToken, async (req, res) => {
    try {
        const reviewerId = req.user.id;
        const order_id = String(req.body?.order_id ?? '');
        const target_user_id = String(req.body?.target_user_id ?? '');
        const rating = Number(req.body?.rating);
        const comment = cleanText(req.body?.comment, 500);
        if (!order_id || !target_user_id || !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
            return res.status(400).json({ error: "Buyurtma, baholanuvchi va 1-5 oralig'ida reyting kiritilishi shart" });
        }
        const order = await prisma.order.findUnique({ where: { id: order_id } });
        if (!order)
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (order.status !== 'COMPLETED')
            return res.status(400).json({ error: 'Faqat yakunlangan buyurtmani baholash mumkin' });
        const participants = [order.buyer_id, order.farmer_id, order.courier_id].filter(Boolean);
        if (!participants.includes(reviewerId))
            return res.status(403).json({ error: "Siz bu buyurtma ishtirokchisi emassiz" });
        if (!participants.includes(target_user_id) || target_user_id === reviewerId) {
            return res.status(400).json({ error: "Baholanuvchi noto'g'ri" });
        }
        const dup = await prisma.review.findFirst({ where: { order_id, reviewer_id: reviewerId, target_user_id } });
        if (dup)
            return res.status(400).json({ error: 'Siz allaqachon baholagansiz' });
        const review = await prisma.$transaction(async (tx) => {
            // Serialize updates to this user's aggregate rating.
            await tx.user.update({ where: { id: target_user_id }, data: { rating: { increment: 0 } } });
            const created = await tx.review.create({
                data: { order_id, reviewer_id: reviewerId, target_user_id, rating, comment },
            });
            const agg = await tx.review.aggregate({ where: { target_user_id }, _avg: { rating: true } });
            await tx.user.update({ where: { id: target_user_id }, data: { rating: Math.round(agg._avg.rating * 100) / 100 } });
            return created;
        });
        return res.status(201).json(review);
    }
    catch (err) {
        if (err?.code === 'P2002')
            return res.status(409).json({ error: 'Siz allaqachon baholagansiz' });
        console.error('Create review error:', err);
        return res.status(500).json({ error: "Sharh qo'shishda xatolik yuz berdi" });
    }
});
router.get('/user/:userId', async (req, res) => {
    try {
        const reviews = await prisma.review.findMany({
            where: { target_user_id: req.params.userId },
            include: { reviewer: { select: { id: true, full_name: true } } },
            orderBy: { created_at: 'desc' },
            take: 100,
        });
        return res.json(reviews);
    }
    catch {
        return res.status(500).json({ error: 'Sharhlarni olishda xatolik' });
    }
});
export default router;

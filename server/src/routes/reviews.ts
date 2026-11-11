import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { cleanText } from '../utils/validate.js';

const router = Router();

// Sharh: faqat yakunlangan buyurtma ishtirokchisi, faqat boshqa ishtirokchiga, bir marta
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user!.id;
    const order_id = String(req.body?.order_id ?? '');
    const target_user_id = String(req.body?.target_user_id ?? '');
    const rating = parseInt(String(req.body?.rating), 10);
    const comment = cleanText(req.body?.comment, 500);

    if (!order_id || !target_user_id || !(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: "Buyurtma, baholanuvchi va 1-5 oralig'ida reyting kiritilishi shart" });
    }

    const order = await prisma.order.findUnique({ where: { id: order_id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.status !== 'COMPLETED') return res.status(400).json({ error: 'Faqat yakunlangan buyurtmani baholash mumkin' });

    const participants = [order.buyer_id, order.farmer_id, order.courier_id].filter(Boolean) as string[];
    if (!participants.includes(reviewerId)) return res.status(403).json({ error: "Siz bu buyurtma ishtirokchisi emassiz" });
    if (!participants.includes(target_user_id) || target_user_id === reviewerId) {
      return res.status(400).json({ error: "Baholanuvchi noto'g'ri" });
    }

    const dup = await prisma.review.findFirst({ where: { order_id, reviewer_id: reviewerId, target_user_id } });
    if (dup) return res.status(400).json({ error: 'Siz allaqachon baholagansiz' });

    const review = await prisma.review.create({
      data: { order_id, reviewer_id: reviewerId, target_user_id, rating, comment },
    });

    const agg = await prisma.review.aggregate({ where: { target_user_id }, _avg: { rating: true } });
    if (agg._avg.rating != null) {
      await prisma.user.update({ where: { id: target_user_id }, data: { rating: Math.round(agg._avg.rating * 100) / 100 } });
    }
    return res.status(201).json(review);
  } catch (err) {
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
  } catch {
    return res.status(500).json({ error: 'Sharhlarni olishda xatolik' });
  }
});

export default router;

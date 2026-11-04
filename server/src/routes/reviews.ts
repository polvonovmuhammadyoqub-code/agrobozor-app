import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Sharh qoldirish va reytingni yangilash
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user!.id;
    const { order_id, target_user_id, rating, comment } = req.body;

    if (!order_id || !target_user_id || !rating) {
      return res.status(400).json({ error: 'Buyurtma, baholanuvchi va reyting kiritilishi shart' });
    }

    const numericRating = Math.min(5, Math.max(1, parseInt(rating, 10)));

    // Sharhni yaratamiz
    const review = await prisma.review.create({
      data: {
        order_id,
        reviewer_id: reviewerId,
        target_user_id,
        rating: numericRating,
        comment: comment || '',
      },
    });

    // Ushbu target_user_id ning yangi o'rtacha reytingini hisoblaymiz
    const allReviews = await prisma.review.findMany({
      where: { target_user_id },
      select: { rating: true },
    });

    if (allReviews.length > 0) {
      const avgRating =
        allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const rounded = parseFloat(avgRating.toFixed(2));

      await prisma.user.update({
        where: { id: target_user_id },
        data: { rating: rounded },
      });
    }

    return res.status(201).json(review);
  } catch (err: any) {
    console.error('Create review error:', err);
    return res.status(500).json({ error: 'Sharh qo\'shishda xatolik yuz berdi' });
  }
});

// Foydalanuvchiga tegishli sharhlar ro'yxati
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { target_user_id: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return res.json(reviews);
  } catch (err: any) {
    return res.status(500).json({ error: 'Sharhlarni olishda xatolik' });
  }
});

export default router;

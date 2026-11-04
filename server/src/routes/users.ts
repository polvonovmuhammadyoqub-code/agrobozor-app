import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Premium profil sotib olish (50 000 so'm)
router.post('/upgrade-premium', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const PREMIUM_FEE = 50000;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    if (user.is_premium) {
      return res.status(400).json({ error: 'Sizda allaqachon Premium status mavjud' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { is_premium: true },
      });

      await tx.transaction.create({
        data: {
          user_id: userId,
          amount: PREMIUM_FEE,
          type: 'PREMIUM_SUBSCRIPTION',
        },
      });

      return u;
    });

    const { password_hash: _, ...safeUser } = updated;
    return res.json({
      message: 'Tabriklaymiz! Sizga oltin Premium maqomi berildi. Mahsulotlaringiz qidiruvda birinchi o\'rinda ko\'rsatiladi!',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Upgrade premium error:', err);
    return res.status(500).json({ error: 'Premiumga ulanishda xatolik yuz berdi' });
  }
});

// Foydalanuvchining hamyon tarixi va barcha tranzaksiyalari
router.get('/wallet-history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        wallet_available: true,
        wallet_escrow: true,
        is_premium: true,
      },
    });

    const transactions = await prisma.transaction.findMany({
      where: { user_id: userId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            product: { select: { title: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      wallet_available: user?.wallet_available || 0,
      wallet_escrow: user?.wallet_escrow || 0,
      is_premium: user?.is_premium || false,
      transactions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Hamyon tarixini yuklashda xatolik' });
  }
});

// Pul yechib olish (Withdrawal)
router.post('/withdraw', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, card_or_account } = req.body;

    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Noto\'g\'ri summa kiritildi' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    if (user.wallet_available < withdrawAmount) {
      return res.status(400).json({
        error: `Yechib olish uchun hisobingizda mablag' yetarli emas. Mavjud: ${user.wallet_available.toLocaleString()} so'm`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          wallet_available: { decrement: withdrawAmount },
        },
      });

      await tx.transaction.create({
        data: {
          user_id: userId,
          amount: -withdrawAmount,
          type: 'ESCROW_RELEASE_FARMER', // Chiqim
        },
      });

      return u;
    });

    return res.json({
      message: `${withdrawAmount.toLocaleString()} so'm ${card_or_account || 'kartangizga'} yuborildi!`,
      wallet_available: updated.wallet_available,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Mablag\' yechishda xatolik' });
  }
});

export default router;

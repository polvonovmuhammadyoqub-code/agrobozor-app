import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

// Barcha admin amallari uchun ADMIN ruxsatini talab qilamiz
router.use(authenticateToken, requireRole(['ADMIN']));

// 1. Real vaqtda hisoblanadigan KPI va statistika
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    // 1. Barcha buyurtmalar
    const orders = await prisma.order.findMany();
    const paidOrders = orders.filter(
      (o) => o.status !== 'REFUNDED'
    );

    // GMV (Gross Merchandise Value)
    const totalGmv = paidOrders.reduce((sum, o) => sum + o.total_paid, 0);

    // Platforma sof daromadi = 10% komissiya + 3000 so'm marjalar
    // COMPLETED bo'lgan yoki PAID_IN_ESCROW / IN_TRANSIT / DELIVERED bo'lgan
    const platformNetRevenue = paidOrders.reduce(
      (sum, o) => sum + (o.platform_commission + o.platform_logistics_margin),
      0
    );

    // AOV (Average Order Value)
    const aov = paidOrders.length > 0 ? Math.round(totalGmv / paidOrders.length) : 0;

    // Foydalanuvchilar soni
    const farmersCount = await prisma.user.count({ where: { role: 'FARMER' } });
    const buyersCount = await prisma.user.count({
      where: { OR: [{ role: 'BUYER_B2C' }, { role: 'BUYER_B2B' }] },
    });
    const couriersCount = await prisma.user.count({ where: { role: 'COURIER' } });

    // KYC navbatidagi fermerlar soni
    const pendingKycCount = await prisma.user.count({
      where: { role: 'FARMER', kyc_status: 'PENDING' },
    });

    // Ochiq nizolar soni
    const openDisputesCount = await prisma.dispute.count({
      where: { status: 'OPEN' },
    });

    // Mahsulotlar soni
    const activeProductsCount = await prisma.product.count({
      where: { is_active: true },
    });

    // Statuslar bo'yicha taqsimot
    const statusCounts: Record<string, number> = {};
    for (const o of orders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    return res.json({
      totalGmv,
      platformNetRevenue,
      aov,
      farmersCount,
      buyersCount,
      couriersCount,
      pendingKycCount,
      openDisputesCount,
      activeProductsCount,
      totalOrdersCount: orders.length,
      statusCounts,
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Statistikani hisoblashda xatolik' });
  }
});

// 2. KYC navbatidagi va barcha fermerlar ro'yxati
router.get('/farmers', async (_req: AuthRequest, res: Response) => {
  try {
    const farmers = await prisma.user.findMany({
      where: { role: 'FARMER' },
      select: {
        id: true,
        full_name: true,
        phone: true,
        region: true,
        tin_or_passport: true,
        farm_or_company_name: true,
        kyc_status: true,
        is_premium: true,
        wallet_available: true,
        wallet_escrow: true,
        rating: true,
        created_at: true,
        _count: {
          select: { products: true, farmer_orders: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(farmers);
  } catch (err: any) {
    return res.status(500).json({ error: 'Fermerlarni yuklashda xatolik' });
  }
});

// 3. KYC holatini o'zgartirish (Tasdiqlash yoki Rad etish)
router.patch('/kyc/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'APPROVED' yoki 'REJECTED'

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Noto\'g\'ri KYC status' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { kyc_status: status },
      select: {
        id: true,
        full_name: true,
        phone: true,
        kyc_status: true,
        role: true,
      },
    });

    return res.json({
      message: `Fermer KYC statusi muvaffaqiyatli o'zgartirildi: ${status}`,
      user: updatedUser,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'KYC holatini yangilashda xatolik' });
  }
});

// 4. Barcha tranzaksiyalar audit jurnali
router.get('/transactions', async (_req: AuthRequest, res: Response) => {
  try {
    const txs = await prisma.transaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            role: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            product: { select: { title: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json(txs);
  } catch (err: any) {
    return res.status(500).json({ error: 'Tranzaksiyalarni olishda xatolik' });
  }
});

export default router;

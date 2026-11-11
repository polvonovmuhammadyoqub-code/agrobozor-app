import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { holdInEscrow } from '../services/settlement.js';
import { generateDeliveryPin } from '../services/orderActions.js';
import { cleanText } from '../utils/validate.js';

const router = Router();

// Barcha admin amallari uchun ADMIN ruxsatini talab qilamiz
router.use(authenticateToken, requireRole(['ADMIN']));

// 1. Statistika. GMV — haqiqatan to'langan buyurtmalar; daromad — bajarilgan hisob-kitoblar (tranzaksiyalar jurnali)
const PAID_STATUSES = ['PAID_IN_ESCROW', 'CONFIRMED_BY_FARMER', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'DISPUTED'];

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const paid = await prisma.order.aggregate({
      where: { status: { in: PAID_STATUSES } },
      _sum: { total_paid: true },
      _count: true,
    });
    const revenue = await prisma.transaction.aggregate({
      where: { type: 'PLATFORM_COMMISSION' },
      _sum: { amount: true },
    });

    const totalGmv = paid._sum.total_paid || 0;
    const aov = paid._count > 0 ? Math.round(totalGmv / paid._count) : 0;

    const [farmersCount, buyersCount, couriersCount, pendingKycCount, openDisputesCount, activeProductsCount, totalOrdersCount, grouped] =
      await Promise.all([
        prisma.user.count({ where: { role: 'FARMER' } }),
        prisma.user.count({ where: { role: { in: ['BUYER_B2C', 'BUYER_B2B'] } } }),
        prisma.user.count({ where: { role: 'COURIER' } }),
        prisma.user.count({ where: { role: { in: ['FARMER', 'COURIER'] }, kyc_status: 'PENDING' } }),
        prisma.dispute.count({ where: { status: 'OPEN' } }),
        prisma.product.count({ where: { is_active: true } }),
        prisma.order.count(),
        prisma.order.groupBy({ by: ['status'], _count: true }),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const g of grouped) statusCounts[g.status] = g._count;

    return res.json({
      totalGmv,
      platformNetRevenue: revenue._sum.amount || 0,
      aov,
      farmersCount,
      buyersCount,
      couriersCount,
      pendingKycCount,
      openDisputesCount,
      activeProductsCount,
      totalOrdersCount,
      statusCounts,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Statistikani hisoblashda xatolik' });
  }
});

// 1b. B2B hisob-faktura to'lovi bank orqali kelganini tasdiqlash -> pul escrow'ga tushadi
router.post('/orders/:id/confirm-payment', async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const deliveryPin = generateDeliveryPin();

    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING_PAYMENT' },
        data: {
          status: 'PAID_IN_ESCROW',
          paid_at: new Date(),
          delivery_pin: deliveryPin,
          delivery_pin_attempts: 0,
        },
      });
      if (r.count !== 1) throw new Error('STATE');
      await holdInEscrow(tx, order);
    });
    return res.json({ message: "To'lov tasdiqlandi, mablag' escrow'ga o'tkazildi" });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(400).json({ error: "Buyurtma to'lov kutmayapti" });
    return res.status(500).json({ error: 'Tasdiqlashda xatolik' });
  }
});

// 1c. Admin tomonidan yetkazishni qo'lda tasdiqlash (override) — majburiy reason bilan
router.post('/orders/:id/deliver-override', async (req: AuthRequest, res: Response) => {
  try {
    const admin = req.user!;
    const reason = cleanText(req.body?.reason, 500);
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: "Yetkazishni qo'lda tasdiqlash uchun sabab (kamida 5 belgi) kiritilishi shart" });
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.status !== 'IN_TRANSIT') {
      return res.status(400).json({ error: "Faqat 'IN_TRANSIT' (yo'lda) holatidagi buyurtmani yetkazildi deb tasdiqlash mumkin" });
    }

    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: { id: order.id, status: 'IN_TRANSIT' },
        data: { status: 'DELIVERED', delivered_at: new Date() },
      });
      if (r.count !== 1) throw new Error('STATE');

      await tx.auditLog.create({
        data: {
          actor_id: admin.id,
          action: 'ORDER_DELIVER_OVERRIDE',
          order_id: order.id,
          reason,
        },
      });
    });

    return res.json({ message: "Buyurtma admin tomonidan 'DELIVERED' holatiga o'tkazildi" });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(409).json({ error: "Buyurtma holati mos emas yoki o'zgargan" });
    console.error('Deliver override error:', err);
    return res.status(500).json({ error: 'Yetkazishni tasdiqlashda xatolik' });
  }
});

// 1d. Admin tomonidan PIN ni yangilash va urinishlarni nolga tushirish
router.post('/orders/:id/reset-pin', async (req: AuthRequest, res: Response) => {
  try {
    const admin = req.user!;
    const reason = cleanText(req.body?.reason, 500) || "Admin tomonidan PIN kodi yangilandi";

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (!['PAID_IN_ESCROW', 'CONFIRMED_BY_FARMER', 'IN_TRANSIT'].includes(order.status)) {
      return res.status(400).json({ error: "Bu holatdagi buyurtma uchun PIN ni yangilab bo'lmaydi" });
    }

    const newPin = generateDeliveryPin();

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          delivery_pin: newPin,
          delivery_pin_attempts: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          actor_id: admin.id,
          action: 'ORDER_RESET_PIN',
          order_id: order.id,
          reason,
        },
      });
    });

    // Yangi PIN faqat xaridorga ko'rinadi (javobda xavfsizlik uchun qaytarilmaydi)
    return res.json({ message: "PIN kodi muvaffaqiyatli yangilandi va urinishlar soni 0 ga tushirildi" });
  } catch (err) {
    console.error('Reset pin error:', err);
    return res.status(500).json({ error: 'PIN kodini yangilashda xatolik' });
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

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (target.role === 'ADMIN') return res.status(400).json({ error: 'Admin profilini o‘zgartirib bo‘lmaydi' });

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

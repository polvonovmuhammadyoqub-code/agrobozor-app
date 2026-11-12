import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { INVOICE_TIMEOUT_HOURS } from '../config.js';
import { paymentMode } from '../services/payment-options.js';
import { holdInEscrow } from '../services/settlement.js';

import {generateDeliveryPin} from '../services/orderActions.js';
import {cleanText} from '../utils/validate.js';
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

    const [
      farmersCount,
      buyersCount,
      couriersCount,
      pendingKycCount,
      openDisputesCount,
      activeProductsCount,
      totalOrdersCount,
      pendingWithdrawalsCount,
      pendingB2bPaymentsCount,
      grouped,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'FARMER' } }),
      prisma.user.count({ where: { role: { in: ['BUYER_B2C', 'BUYER_B2B'] } } }),
      prisma.user.count({ where: { role: 'COURIER' } }),
      prisma.user.count({ where: { role: { in: ['FARMER', 'COURIER'] }, kyc_status: 'PENDING' } }),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.product.count({ where: { is_active: true } }),
      prisma.order.count(),
      prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { payment_method: 'INVOICE_B2B', status: 'PENDING_PAYMENT' } }),
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
      pendingWithdrawalsCount,
      pendingB2bPaymentsCount,
      statusCounts,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Statistikani hisoblashda xatolik' });
  }
});

// 1b. B2B hisob-faktura to'lovi bank orqali kelganini tasdiqlash -> pul escrow'ga tushadi
router.post('/orders/:id/confirm-payment', async (req: AuthRequest, res: Response) => {
  if(paymentMode()==='direct') return res.status(400).json({error:'Bu rejimda to‘lovni fermer tasdiqlaydi; platforma pul qabul qilmaydi'});
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.payment_method !== 'INVOICE_B2B') return res.status(400).json({ error: 'Faqat B2B bank hisob-fakturasi tasdiqlanadi' });
    if (Date.now() - order.created_at.getTime() > INVOICE_TIMEOUT_HOURS * 3600000) {
      return res.status(400).json({ error: 'Hisob-faktura muddati tugagan' });
    }
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID_IN_ESCROW',paid_at:new Date(),delivery_pin:generateDeliveryPin(),delivery_pin_attempts:0 } });
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

    let newPin = generateDeliveryPin();
    while(newPin === order.delivery_pin)newPin=generateDeliveryPin();

    await prisma.$transaction(async (tx) => {
      const changed=await tx.order.updateMany({
        where: { id: order.id, status:order.status },
        data: {
          delivery_pin: newPin,
          delivery_pin_attempts: 0,
        },
      });

      if(changed.count !== 1) throw new Error('STATE');
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

// 2b. KYC navbatidagi va barcha kuryerlar ro'yxati (Kuryer KYC boshqaruvi)
router.get('/couriers', async (_req: AuthRequest, res: Response) => {
  try {
    const couriers = await prisma.user.findMany({
      where: { role: 'COURIER' },
      select: {
        id: true,
        full_name: true,
        phone: true,
        region: true,
        tin_or_passport: true,
        kyc_status: true,
        rating: true,
        wallet_available: true,
        created_at: true,
        _count: {
          select: { courier_orders: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(couriers);
  } catch (err: any) {
    return res.status(500).json({ error: 'Kuryerlarni yuklashda xatolik' });
  }
});

// 2c. B2B hisob-faktura to'lovini kutayotgan yoki barcha B2B buyurtmalar ro'yxati
router.get('/b2b-orders', async (_req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { payment_method: 'INVOICE_B2B' },
      include: {
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
            farm_or_company_name: true,
            phone: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            price_per_kg: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json(orders.map(({delivery_pin,...safe})=>safe));
  } catch (err: any) {
    return res.status(500).json({ error: 'B2B buyurtmalarni yuklashda xatolik' });
  }
});

// 2d. Pul yechish so'rovlari ro'yxati
router.get('/withdrawals', async (_req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.withdrawalRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            role: true,
            wallet_available: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json(requests);
  } catch (err: any) {
    return res.status(500).json({ error: "Pul yechish so'rovlarini yuklashda xatolik" });
  }
});

// 2e. Pul yechish so'rovini tasdiqlash (Admin kartaga o'tkazgach "PAID" qiladi)
router.post('/withdrawals/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ error: "So'rov topilmadi" });
    if (withdrawal.status !== 'PENDING') {
      return res.status(400).json({ error: `Bu so'rov allaqachon ${withdrawal.status} holatida` });
    }

    const claimed = await prisma.withdrawalRequest.updateMany({
      where: { id: withdrawal.id, status: 'PENDING' },
      data: {
        status: 'PAID',
        processed_at: new Date(),
        admin_comment: req.body?.comment || "Admin tomonidan to'lov muvaffaqiyatli o'tkazildi",
      },
    });

    if (claimed.count !== 1) return res.status(409).json({ error: "So'rov holati o'zgargan" });
    const updated = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawal.id } });
    return res.json({ message: "Pul o'tkazmasi tasdiqlandi", withdrawal: updated });
  } catch {
    return res.status(500).json({ error: 'Tasdiqlashda xatolik' });
  }
});

// 2f. Pul yechish so'rovini rad etish va balansni qaytarish
router.post('/withdrawals/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ error: "So'rov topilmadi" });
    if (withdrawal.status !== 'PENDING') {
      return res.status(400).json({ error: `Bu so'rov allaqachon ${withdrawal.status} holatida` });
    }

    const reason = req.body?.reason || 'Karta rekvizitlari noto‘g‘ri yoki bank tomonidan rad etildi';

    const result = await prisma.$transaction(async (tx) => {
      // 1. So'rovni REJECTED qilish
      const claimed = await tx.withdrawalRequest.updateMany({
        where: { id: withdrawal.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          processed_at: new Date(),
          admin_comment: reason,
        },
      });

      if (claimed.count !== 1) throw new Error('STATE');

      // 2. Balansni qaytarish
      await tx.user.update({
        where: { id: withdrawal.user_id },
        data: { wallet_available: { increment: withdrawal.amount } },
      });

      // 3. Qaytarilganlik tranzaksiyasini yozish
      await tx.transaction.create({
        data: {
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          type: 'WITHDRAWAL_REFUND',
        },
      });

      return tx.withdrawalRequest.findUnique({ where: { id: withdrawal.id } });
    });

    return res.json({ message: "So'rov rad etildi va mablag' foydalanuvchi balansiga qaytarildi", withdrawal: result });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(409).json({ error: "So'rov holati o'zgargan" });
    return res.status(500).json({ error: 'Rad etishda xatolik' });
  }
});

// 3. KYC holatini o'zgartirish (Fermer yoki Kuryerni Tasdiqlash yoki Rad etish)
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
      message: `${target.role} KYC statusi muvaffaqiyatli o'zgartirildi: ${status}`,
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

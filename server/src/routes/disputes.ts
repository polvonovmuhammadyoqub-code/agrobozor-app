import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

// 1. Nizolar ro'yxati
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let where: any = {};

    if (user.role === 'BUYER_B2C' || user.role === 'BUYER_B2B') {
      where.buyer_id = user.id;
    } else if (user.role === 'FARMER') {
      where.order = { farmer_id: user.id };
    }
    // Admin barchasini ko'radi

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        order: {
          include: {
            product: true,
            farmer: true,
            buyer: true,
            courier: true,
          },
        },
        buyer: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(disputes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Nizolarni yuklashda xatolik' });
  }
});

// 2. Yangi nizo ochish (POST /api/disputes)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const { order_id, reason, evidence_image_url } = req.body;

    if (!order_id || !reason) {
      return res.status(400).json({ error: 'Buyurtma va shikoyat sababi ko\'rsatilishi shart' });
    }

    const order = await prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }

    if (order.buyer_id !== buyerId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Faqat buyurtmachi shikoyat qila oladi' });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Yakunlangan buyurtma bo\'yicha shikoyat qilib bo\'lmaydi' });
    }

    const existingDispute = await prisma.dispute.findUnique({
      where: { order_id },
    });

    if (existingDispute) {
      return res.status(400).json({ error: 'Ushbu buyurtma bo\'yicha allaqachon nizo ochilgan' });
    }

    // Database transaction
    const dispute = await prisma.$transaction(async (tx) => {
      // 1. Buyurtma statusini 'DISPUTED' ga o'tkazish (pul escrowda muzlaydi)
      await tx.order.update({
        where: { id: order_id },
        data: { status: 'DISPUTED' },
      });

      // 2. Nizo yozuvi yaratish
      return await tx.dispute.create({
        data: {
          order_id,
          buyer_id: buyerId,
          reason,
          evidence_image_url: evidence_image_url || 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80',
          status: 'OPEN',
        },
      });
    });

    return res.status(201).json(dispute);
  } catch (err: any) {
    console.error('Create dispute error:', err);
    return res.status(500).json({ error: 'Nizo ochishda xatolik yuz berdi' });
  }
});

// 3. Admin arbitraji — Nizoni hal qilish (POST /api/disputes/:id/resolve)
router.post('/:id/resolve', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, admin_comment } = req.body;
    // resolution: 'RESOLVED_REFUND_FULL' | 'RESOLVED_REFUND_PARTIAL' | 'RESOLVED_FARMER_WIN'

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            farmer: true,
            buyer: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: 'Nizo topilmadi' });
    }

    if (dispute.status !== 'OPEN') {
      return res.status(400).json({ error: 'Ushbu nizo allaqachon hal qilingan' });
    }

    const order = dispute.order;
    const farmerPayout = order.farmer_payout;
    const totalPaid = order.total_paid;

    await prisma.$transaction(async (tx) => {
      if (resolution === 'RESOLVED_REFUND_FULL') {
        // 1) "To'liq qaytarish": Fermerning wallet_escrow balansidan pul olinib, xaridorning wallet_available balansiga qaytariladi
        await tx.user.update({
          where: { id: order.farmer_id },
          data: {
            wallet_escrow: { decrement: farmerPayout },
          },
        });

        await tx.user.update({
          where: { id: order.buyer_id },
          data: {
            wallet_available: { increment: totalPaid },
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });

        await tx.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED_REFUND_FULL',
            refund_amount: totalPaid,
            admin_comment: admin_comment || 'Xaridor foydasiga to\'liq qaytarildi',
          },
        });

        await tx.transaction.create({
          data: {
            order_id: order.id,
            user_id: order.buyer_id,
            amount: totalPaid,
            type: 'REFUND',
          },
        });
      } else if (resolution === 'RESOLVED_REFUND_PARTIAL') {
        // 2) "Qisman qaytarish (50/50)": Yarim pul xaridorga, yarmi fermerning wallet_available balansiga o'tadi
        const halfFarmer = Math.round(farmerPayout / 2);
        const halfRefund = Math.round(totalPaid / 2);

        await tx.user.update({
          where: { id: order.farmer_id },
          data: {
            wallet_escrow: { decrement: farmerPayout },
            wallet_available: { increment: halfFarmer },
          },
        });

        await tx.user.update({
          where: { id: order.buyer_id },
          data: {
            wallet_available: { increment: halfRefund },
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });

        await tx.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED_REFUND_PARTIAL',
            refund_amount: halfRefund,
            admin_comment: admin_comment || 'Kelishuv asosida 50/50 qisman qoplandi',
          },
        });

        await tx.transaction.create({
          data: {
            order_id: order.id,
            user_id: order.buyer_id,
            amount: halfRefund,
            type: 'REFUND',
          },
        });

        await tx.transaction.create({
          data: {
            order_id: order.id,
            user_id: order.farmer_id,
            amount: halfFarmer,
            type: 'ESCROW_RELEASE_FARMER',
          },
        });
      } else if (resolution === 'RESOLVED_FARMER_WIN') {
        // 3) "Fermer haq": Pul to'liq fermerning wallet_available balansiga o'tadi
        await tx.user.update({
          where: { id: order.farmer_id },
          data: {
            wallet_escrow: { decrement: farmerPayout },
            wallet_available: { increment: farmerPayout },
          },
        });

        if (order.courier_id) {
          await tx.user.update({
            where: { id: order.courier_id },
            data: {
              wallet_available: { increment: order.courier_payout },
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });

        await tx.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED_FARMER_WIN',
            refund_amount: 0,
            admin_comment: admin_comment || 'Fermer haqligi isbotlandi, mahsulot sifat talablariga javob beradi',
          },
        });

        await tx.transaction.create({
          data: {
            order_id: order.id,
            user_id: order.farmer_id,
            amount: farmerPayout,
            type: 'ESCROW_RELEASE_FARMER',
          },
        });
      } else {
        throw new Error('Noto\'g\'ri qaror turi tanlandi');
      }
    });

    return res.json({ message: 'Nizo bo\'yicha qaror muvaffaqiyatli qabul qilindi va ijro etildi' });
  } catch (err: any) {
    console.error('Resolve dispute error:', err);
    return res.status(500).json({ error: err.message || 'Nizoni hal qilishda xatolik yuz berdi' });
  }
});

export default router;

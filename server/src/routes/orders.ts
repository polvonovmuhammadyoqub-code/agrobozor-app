import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, requireRole, AuthRequest, AuthUser } from '../middleware/auth.js';
import {
  DELIVERY_FEE,
  COURIER_PAYOUT,
  LOGISTICS_MARGIN,
  COMMISSION_RATE,
  PAYMENT_TIMEOUT_MIN,
  INVOICE_TIMEOUT_HOURS,
  DISPUTE_WINDOW_HOURS,
} from '../config.js';
import { settleOrder } from '../services/settlement.js';
import { cleanText, maskId, positiveNumber, formatUnitName } from '../utils/validate.js';
import { isValidDistrict } from '../constants/districts.js';
import {
  payOrder,
  farmerConfirm,
  farmerReject,
  courierPickup,
  courierDeliver,
  buyerComplete,
  OrderActionError,
} from '../services/orderActions.js';
import { supabase } from '../services/supabase.js';

const router = Router();
const BUYER_ROLES = ['BUYER_B2C', 'BUYER_B2B'];
const METHODS = ['CLICK', 'PAYME', 'UZCARD', 'HUMO', 'INVOICE_B2B'];

// Parolsiz, xavfsiz foydalanuvchi maydonlari
const PARTY = { id: true, full_name: true, phone: true, region: true, farm_or_company_name: true } as const;
const FULL_INCLUDE = {
  product: true,
  buyer: { select: PARTY },
  farmer: { select: { ...PARTY, rating: true, is_premium: true } },
  courier: { select: { id: true, full_name: true, phone: true, rating: true } },
  dispute: true,
  reviews: true,
  transactions: true,
} as const;

function isParticipant(order: { buyer_id: string; farmer_id: string; courier_id: string | null }, u: AuthUser) {
  return u.role === 'ADMIN' || order.buyer_id === u.id || order.farmer_id === u.id || order.courier_id === u.id;
}

// Kuryer buyurtmani olmaguncha xaridor telefonini ko'rmaydi; boshqalarga faqat o'zlariga tegishli ma'lumot
function sanitize(order: any, u: AuthUser) {
  const o = { ...order };
  if (u.role === 'COURIER' && o.courier_id !== u.id && o.buyer) {
    o.buyer = { ...o.buyer, phone: undefined };
  }
  // Faqat o'ziga tegishli tranzaksiyalarni ko'radi (admin — hammasini)
  if (u.role !== 'ADMIN' && o.transactions) {
    o.transactions = o.transactions.filter((t: any) => t.user_id === u.id);
  }
  // PIN faqat o'sha buyurtmaning xaridoriga qaytadi. Fermer, kuryer va adminga delivery_pin HECH QACHON qaytmasin!
  if (o.buyer_id !== u.id) {
    delete o.delivery_pin;
  }
  return o;
}

// Nizo dalili uchun xavfsiz 300 soniyalik signed URL biriktirish
async function attachDisputeSignedUrl(order: any, u: AuthUser) {
  if (order.dispute && order.dispute.evidence_image_url && order.dispute.evidence_image_url.startsWith('private-docs:')) {
    const isAllowed = u.role === 'ADMIN' || order.buyer_id === u.id || order.farmer_id === u.id;
    if (isAllowed && supabase) {
      try {
        const path = order.dispute.evidence_image_url.replace(/^private-docs:/, '');
        const { data: signed } = await supabase.storage.from('private-docs').createSignedUrl(path, 300);
        order.dispute.evidence_signed_url = signed?.signedUrl || null;
      } catch {
        order.dispute.evidence_signed_url = null;
      }
    } else {
      order.dispute.evidence_signed_url = null;
    }
  }
  return order;
}

// OrderActionError ni HTTP javobga aylantiruvchi yordamchi
function handleActionError(err: unknown, res: Response) {
  if (err instanceof OrderActionError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404, FORBIDDEN: 403, BAD_STATE: 409,
      PAYMENT_FAILED: 402, STOCK: 400, VALIDATION: 400,
    };
    return res.status(statusMap[err.code] || 500).json({ error: err.message });
  }
  console.error('Order action error:', err);
  return res.status(500).json({ error: 'Ichki xatolik yuz berdi' });
}

/** Muddati o'tgan to'lanmagan buyurtmalarni bekor qilib, ombor qoldig'ini qaytaradi (cron o'rniga lazy). */
async function releaseExpiredOrders() {
  try {
    const now = Date.now();
    const stale = await prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        OR: [
          { payment_method: { not: 'INVOICE_B2B' }, created_at: { lt: new Date(now - PAYMENT_TIMEOUT_MIN * 60000) } },
          { payment_method: 'INVOICE_B2B', created_at: { lt: new Date(now - INVOICE_TIMEOUT_HOURS * 3600000) } },
        ],
      },
      take: 50,
    });
    for (const o of stale) {
      await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
        if (r.count === 1) {
          await tx.product.update({ where: { id: o.product_id }, data: { available_quantity_kg: { increment: o.quantity_kg } } });
        }
      });
    }
  } catch (e) {
    console.error('releaseExpiredOrders error:', e);
  }
}

/** Yetkazilganiga 24 soat o'tib, nizo ochilmagan buyurtmalarni avtomatik yakunlaydi. */
async function autoCompleteDelivered() {
  try {
    const cutoff = new Date(Date.now() - DISPUTE_WINDOW_HOURS * 3600000);
    const due = await prisma.order.findMany({ where: { status: 'DELIVERED', delivered_at: { lt: cutoff } }, take: 50 });
    for (const o of due) {
      await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({ where: { id: o.id, status: 'DELIVERED' }, data: { status: 'COMPLETED' } });
        if (r.count === 1) await settleOrder(tx, o, 0);
      });
    }
  } catch (e) {
    console.error('autoCompleteDelivered error:', e);
  }
}

// 1. Buyurtmalar ro'yxati
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await releaseExpiredOrders();
    await autoCompleteDelivered();

    const user = req.user!;
    let where: any = {};
    if (BUYER_ROLES.includes(user.role)) where.buyer_id = user.id;
    else if (user.role === 'FARMER') where.farmer_id = user.id;
    else if (user.role === 'COURIER') {
      where = { OR: [{ courier_id: user.id }, { status: 'CONFIRMED_BY_FARMER', courier_id: null }] };
    } else if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Ruxsat yo\u2018q' });
    }

    const orders = await prisma.order.findMany({ where, include: FULL_INCLUDE, orderBy: { created_at: 'desc' }, take: 200 });
    const result = await Promise.all(
      orders.map(async (o) => {
        const sanitized = sanitize(o, user);
        return attachDisputeSignedUrl(sanitized, user);
      })
    );
    return res.json(result);
  } catch (err) {
    console.error('Get orders error:', err);
    return res.status(500).json({ error: 'Buyurtmalarni yuklashda xatolik' });
  }
});

// 2. Yagona buyurtma (faqat ishtirokchilar)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: FULL_INCLUDE });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (!isParticipant(order, req.user!)) return res.status(403).json({ error: "Bu buyurtmani ko'rishga ruxsat yo'q" });
    const sanitized = sanitize(order, req.user!);
    await attachDisputeSignedUrl(sanitized, req.user!);
    return res.json(sanitized);
  } catch {
    return res.status(500).json({ error: "Buyurtma ma'lumotlarini yuklashda xatolik" });
  }
});

// 3. Buyurtma berish: ombor qoldig'i band qilinadi, status PENDING_PAYMENT (pul hali tushmagan!)
router.post('/', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const { product_id, delivery_schedule } = req.body || {};
    const qty = positiveNumber(req.body?.quantity_kg);
    const delivery_address = cleanText(req.body?.delivery_address, 300);
    const payment_method = METHODS.includes(req.body?.payment_method) ? req.body.payment_method : 'CLICK';

    if (!product_id || !qty || delivery_address.length < 5) {
      return res.status(400).json({ error: "Mahsulot, miqdor va to'liq manzilni kiriting" });
    }
    if (payment_method === 'INVOICE_B2B' && req.user!.role !== 'BUYER_B2B') {
      return res.status(400).json({ error: "Hisob-faktura orqali to'lov faqat biznes hisoblar uchun" });
    }

    const product = await prisma.product.findUnique({ where: { id: String(product_id) }, include: { farmer: true } });
    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Mahsulot topilmadi yoki sotuvda mavjud emas' });
    }
    if (product.farmer_id === buyerId) return res.status(400).json({ error: "O'z mahsulotingizni sotib ola olmaysiz" });
    if (product.farmer.kyc_status !== 'APPROVED') {
      return res.status(400).json({ error: "Sotuvchi hali tekshiruvdan o'tmagan" });
    }
    if (qty < product.min_order_kg) {
      return res.status(400).json({
        error: `Minimal buyurtma miqdori: ${product.min_order_kg} ${formatUnitName(product.unit)}`,
      });
    }

    const product_total_amount = Math.round(qty * product.price_per_kg);
    const platform_commission = Math.round(product_total_amount * COMMISSION_RATE);
    const farmer_payout = product_total_amount - platform_commission;

    let delivery_district: string | null = null;
    if (req.body?.delivery_district) {
      const dist = cleanText(req.body.delivery_district, 120);
      if (isValidDistrict(dist)) delivery_district = dist;
    }

    const order = await prisma.$transaction(async (tx) => {
      // Atomik band qilish: poyga holatida (oversell) ikki kishiga bir xil qoldiq sotilmaydi
      const reserved = await tx.product.updateMany({
        where: { id: product.id, is_active: true, available_quantity_kg: { gte: qty } },
        data: { available_quantity_kg: { decrement: qty } },
      });
      if (reserved.count !== 1) throw new Error('STOCK');

      return tx.order.create({
        data: {
          buyer_id: buyerId,
          farmer_id: product.farmer_id,
          product_id: product.id,
          quantity_kg: qty,
          product_total_amount,
          delivery_fee: DELIVERY_FEE,
          total_paid: product_total_amount + DELIVERY_FEE,
          platform_commission,
          farmer_payout,
          courier_payout: COURIER_PAYOUT,
          platform_logistics_margin: LOGISTICS_MARGIN,
          payment_method,
          status: 'PENDING_PAYMENT',
          delivery_address,
          delivery_district,
          delivery_schedule: delivery_schedule ? cleanText(delivery_schedule, 200) : null,
        },
      });
    });

    return res.status(201).json(order);
  } catch (err: any) {
    if (err?.message === 'STOCK') return res.status(400).json({ error: 'Omborda yetarli mahsulot qolmagan' });
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Buyurtma rasmiylashtirishda xatolik yuz berdi' });
  }
});

// 4. To'lov: muvaffaqiyatli bo'lsa pul ESCROW'ga tushadi (PAID_IN_ESCROW)
// Endi orderActions servisiga delegatsiya qilinadi
router.post('/:id/pay', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const result = await payOrder(req.user!, req.params.id);
    return res.json(result);
  } catch (err) {
    return handleActionError(err, res);
  }
});

// 5. To'lanmagan buyurtmani bekor qilish (qoldiq qaytadi)
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.buyer_id !== req.user!.id) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
      if (r.count !== 1) throw new Error('STATE');
      await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
    });
    return res.json({ message: 'Buyurtma bekor qilindi' });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(400).json({ error: "Faqat to'lanmagan buyurtmani bekor qilish mumkin" });
    return res.status(500).json({ error: 'Bekor qilishda xatolik' });
  }
});

// 6. Fermer buyurtmani rad etadi -> xaridorga to'liq qaytariladi
// Endi orderActions servisiga delegatsiya qilinadi
router.post('/:id/reject', authenticateToken, requireRole(['FARMER']), async (req: AuthRequest, res: Response) => {
  try {
    const result = await farmerReject(req.user!, req.params.id);
    return res.json(result);
  } catch (err) {
    return handleActionError(err, res);
  }
});

// 7. Holat o'zgartirish: qat'iy ketma-ketlik va egalik tekshiruvi
//    PAID_IN_ESCROW -> CONFIRMED_BY_FARMER (fermer) -> IN_TRANSIT (kuryer oladi) -> DELIVERED (shu kuryer)
// Endi orderActions servisiga delegatsiya qilinadi
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const status = String(req.body?.status ?? '');
    let updated;

    if (status === 'CONFIRMED_BY_FARMER') {
      updated = await farmerConfirm(user, req.params.id);
    } else if (status === 'IN_TRANSIT') {
      updated = await courierPickup(user, req.params.id);
    } else if (status === 'DELIVERED') {
      const pin = req.body?.pin;
      updated = await courierDeliver(user, req.params.id, pin);
    } else {
      return res.status(400).json({ error: "Bu holatga to'g'ridan-to'g'ri o'tib bo'lmaydi" });
    }

    const full = await prisma.order.findUnique({ where: { id: req.params.id }, include: FULL_INCLUDE });
    return res.json(sanitize(full, user));
  } catch (err) {
    return handleActionError(err, res);
  }
});

// 8. Xaridor "Qabul qildim" -> escrow'dan pul taqsimlanadi (faqat DELIVERED'dan, bir marta)
// Endi orderActions servisiga delegatsiya qilinadi
router.post('/:id/complete', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyerComplete(req.user!, req.params.id);
    return res.json(result);
  } catch (err) {
    return handleActionError(err, res);
  }
});

// 9. Hisob-faktura (faqat ishtirokchilar; pasport/STIR maskalanadi)
router.get('/:id/invoice', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { product: true, buyer: true, farmer: true },
    });
    if (!order) return res.status(404).json({ error: 'Hisob-faktura uchun buyurtma topilmadi' });
    if (!isParticipant(order, req.user!)) return res.status(403).json({ error: "Ruxsat yo'q" });

    return res.json({
      invoice_number: `AGRO-INV-${order.id.slice(0, 8).toUpperCase()}`,
      created_at: order.created_at,
      payment_method: order.payment_method,
      status: order.status,
      seller: {
        name: order.farmer.farm_or_company_name || order.farmer.full_name,
        tin: maskId(order.farmer.tin_or_passport),
        address: order.farmer.region,
        phone: order.farmer.phone,
      },
      buyer: {
        name: order.buyer.farm_or_company_name || order.buyer.full_name,
        tin: maskId(order.buyer.tin_or_passport),
        address: order.delivery_address || order.buyer.region,
        phone: order.buyer.phone,
      },
      items: [
        {
          name: order.product.title,
          category: order.product.category,
          quantity_kg: order.quantity_kg,
          unit: order.product.unit || 'KG',
          price_per_kg: order.product.price_per_kg,
          total_price: order.product_total_amount,
        },
      ],
      delivery_fee: order.delivery_fee,
      platform_service_fee: order.platform_commission,
      grand_total: order.total_paid,
      delivery_schedule: order.delivery_schedule || 'Bir martalik tezkor yetkazib berish',
      stamp: 'AGROBOZOR ELEKTRON HISOB-FAKTURASI',
    });
  } catch {
    return res.status(500).json({ error: 'Hisob-fakturani generatsiya qilishda xatolik' });
  }
});

export default router;

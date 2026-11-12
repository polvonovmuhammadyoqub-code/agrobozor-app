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
import { paymeCheckout, paymentMode, paymentOptions } from '../services/payment-options.js';
import { chargeOrder } from '../services/payment.js';
import { holdInEscrow, settleOrder } from '../services/settlement.js';
import { cleanText, maskId, positiveNumber } from '../utils/validate.js';

import { courierDeliver, courierPickup, generateDeliveryPin, OrderActionError } from '../services/orderActions.js';
import { fulfillmentFields, validQuantity, snapshotPickup } from '../utils/fulfillment.js';
const router = Router();
const BUYER_ROLES = ['BUYER_B2C', 'BUYER_B2B'];
const METHODS = ['CLICK', 'PAYME', 'UZCARD', 'HUMO', 'INVOICE_B2B', 'DIRECT_FARMER'];

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
export function sanitizeOrder(order: any, u: AuthUser) {
  const o = { ...order };
  if(u.id !== o.buyer_id) delete o.delivery_pin;
  if (u.role === 'COURIER' && o.courier_id !== u.id && o.buyer) {
    o.buyer = { ...o.buyer, phone: undefined };
    o.delivery_address = undefined;
    o.delivery_lat = undefined; o.delivery_lng=undefined;
    o.delivery_schedule = undefined;
    o.dispute = undefined;
    o.reviews = [];
  }
  if(u.role === 'COURIER' && o.courier_id !== u.id) { o.pickup_address=undefined;o.pickup_lat=undefined;o.pickup_lng=undefined; if(o.product) o.product={...o.product,pickup_address:undefined,pickup_lat:undefined,pickup_lng:undefined}; }
  // Faqat o'ziga tegishli tranzaksiyalarni ko'radi (admin — hammasini)
  if (u.role !== 'ADMIN' && o.transactions) {
    o.transactions = o.transactions.filter((t: any) => t.user_id === u.id);
  }
  return o;
}

/** Muddati o'tgan to'lanmagan buyurtmalarni bekor qilib, ombor qoldig'ini qaytaradi */
export async function releaseExpiredOrders() {
  try {
    const now = Date.now();
    const stale = await prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        NOT: { payme_transaction: { is: { state: 1, expires_at: { gt: new Date() } } } },
        OR: [
          { payment_method: { notIn: ['INVOICE_B2B', 'DIRECT_FARMER'] }, created_at: { lt: new Date(now - PAYMENT_TIMEOUT_MIN * 60000) } },
          { payment_method: { in: ['INVOICE_B2B', 'DIRECT_FARMER'] }, created_at: { lt: new Date(now - INVOICE_TIMEOUT_HOURS * 3600000) } },
        ],
      },
      take: 50,
    });
    for (const o of stale) {
      await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT', NOT: { payme_transaction: { is: { state: 1, expires_at: { gt: new Date() } } } } }, data: { status: 'CANCELLED' } });
        if (r.count === 1) {
          await tx.paymeTransaction.updateMany({ where: { order_id: o.id, state: 1 }, data: { state: -1, reason: 4, cancel_time: new Date() } });
          await tx.product.update({ where: { id: o.product_id }, data: { available_quantity_kg: { increment: o.quantity_kg } } });
        }
      });
    }
  } catch (e) {
    console.error('releaseExpiredOrders error:', e);
  }
}

/** Yetkazilganiga 24 soat o'tib, nizo ochilmagan buyurtmalarni avtomatik yakunlaydi. */
export async function autoCompleteDelivered() {
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
      return res.status(403).json({ error: 'Ruxsat yo‘q' });
    }

    const orders = await prisma.order.findMany({ where, include: FULL_INCLUDE, orderBy: { created_at: 'desc' }, take: 200 });
    for(const order of orders) if(!order.delivery_pin && ['PAID_IN_ESCROW','CONFIRMED_BY_FARMER','IN_TRANSIT'].includes(order.status)){
      await prisma.order.updateMany({where:{id:order.id,delivery_pin:null,status:order.status},data:{delivery_pin:generateDeliveryPin(),delivery_pin_attempts:0}});
      const fresh=await prisma.order.findUnique({where:{id:order.id},select:{delivery_pin:true}});order.delivery_pin=fresh?.delivery_pin||null;
    }
    return res.json(orders.map((o) => sanitizeOrder(o, user)));
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
    return res.json(sanitizeOrder(order, req.user!));
  } catch {
    return res.status(500).json({ error: "Buyurtma ma'lumotlarini yuklashda xatolik" });
  }
});

// 3. Buyurtma berish: ombor qoldig'i band qilinadi, status PENDING_PAYMENT (pul hali tushmagan!)
router.post('/', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const delivery = fulfillmentFields({delivery_district:req.body?.delivery_district,delivery_lat:req.body?.delivery_lat,delivery_lng:req.body?.delivery_lng});
    const { product_id, delivery_schedule } = req.body || {};
    const qty = positiveNumber(req.body?.quantity_kg);
    const delivery_address = cleanText(req.body?.delivery_address, 300);
    const payment_method = METHODS.includes(req.body?.payment_method) ? req.body.payment_method : (paymentOptions().methods[0] || 'CLICK');

    if (!product_id || !qty || delivery_address.length < 5) {
      return res.status(400).json({ error: "Mahsulot, miqdor va to'liq manzilni kiriting" });
    }
    if (paymentMode() === 'direct' && payment_method !== 'DIRECT_FARMER') return res.status(400).json({error:'Bu rejimda to‘lov faqat bevosita fermerga qilinadi'});
    if (payment_method === 'INVOICE_B2B' && req.user!.role !== 'BUYER_B2B') {
      return res.status(400).json({ error: 'Hisob-faktura orqali to‘lov faqat biznes hisoblar uchun' });
    }

    if (payment_method !== 'INVOICE_B2B' && !paymentOptions().methods.length) {
      return res.status(503).json({ error: 'Onlayn to‘lov hali ulanmagan. Buyurtma yaratilmadi.' });
    }
    if (payment_method !== 'INVOICE_B2B' && !paymentOptions().methods.includes(payment_method)) return res.status(400).json({ error: 'Bu to‘lov usuli hozir mavjud emas' });

    const product = await prisma.product.findUnique({ where: { id: String(product_id) }, include: { farmer: true } });
    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Mahsulot topilmadi yoki sotuvda mavjud emas' });
    }
    if (product.farmer_id === buyerId) return res.status(400).json({ error: "O'z mahsulotingizni sotib ola olmaysiz" });
    if (product.farmer.kyc_status !== 'APPROVED') {
      return res.status(400).json({ error: 'Sotuvchi hali tekshiruvdan o‘tmagan' });
    }
    if(!validQuantity(qty,product.unit)) return res.status(400).json({error:'Miqdor birlik uchun noto‘g‘ri (dona/banka/quti butun son bo‘lishi kerak)'});
    if (qty < product.min_order_kg) {
      return res.status(400).json({ error: `Minimal buyurtma miqdori: ${product.min_order_kg} ${product.unit}` });
    }

    const product_total_amount = Math.round(qty * product.price_per_kg);
    if (!Number.isSafeInteger(product_total_amount) || product_total_amount < 1 || product_total_amount > 2_147_483_647 - DELIVERY_FEE) {
      return res.status(400).json({ error: "Buyurtma summasi ruxsat etilgan chegaradan tashqarida" });
    }
    const platform_commission = payment_method === 'DIRECT_FARMER' ? 0 : Math.round(product_total_amount * COMMISSION_RATE);
    const farmer_payout = product_total_amount - platform_commission;

    const order = await prisma.$transaction(async (tx) => {
      // Atomik band qilish: poyga holatida (oversell) ikki kishiga bir xil qoldiq sotilmaydi
      const reserved = await tx.product.updateMany({
        where: { id: product.id, unit:product.unit,price_per_kg:product.price_per_kg,min_order_kg:product.min_order_kg, is_active: true, available_quantity_kg: { gte: qty - 1e-8 } },
        data: { available_quantity_kg: { decrement: qty } },
      });
      if (reserved.count !== 1) throw new Error('STOCK');

      await tx.product.updateMany({where:{id:product.id,available_quantity_kg:{lt:0,gt:-1e-8}},data:{available_quantity_kg:0}});
      return tx.order.create({
        data: {
          buyer_id: buyerId,
          farmer_id: product.farmer_id,
          product_id: product.id,
          ...snapshotPickup(product), ...delivery,
          product_title: product.title,
          unit_price_per_kg: product.price_per_kg,
          quantity_kg: qty,
          product_total_amount,
          delivery_fee: DELIVERY_FEE,
          total_paid: product_total_amount + DELIVERY_FEE,
          platform_commission,
          farmer_payout,
          courier_payout: payment_method === 'DIRECT_FARMER' ? DELIVERY_FEE : COURIER_PAYOUT,
          platform_logistics_margin: payment_method === 'DIRECT_FARMER' ? 0 : LOGISTICS_MARGIN,
          payment_method,
          status: 'PENDING_PAYMENT',
          delivery_address,
          delivery_schedule: delivery_schedule ? cleanText(delivery_schedule, 200) : null,
        },
      });
    });

    return res.status(201).json(order);
  } catch (err: any) {
    if (err?.message === 'STOCK') return res.status(400).json({ error: 'Omborda yetarli mahsulot qolmagan' });
    if(err instanceof Error && ['Tuman ro‘yxatda mavjud emas','Koordinatalar noto‘g‘ri'].includes(err.message)) return res.status(400).json({error:err.message});
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Buyurtma rasmiylashtirishda xatolik yuz berdi' });
  }
});

// 3b. Savatdagi barcha mahsulotlarni rasmiylashtirish (Multi-item cart checkout)
router.post('/checkout', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const delivery = fulfillmentFields({delivery_district:req.body?.delivery_district,delivery_lat:req.body?.delivery_lat,delivery_lng:req.body?.delivery_lng});
    const { items, delivery_address, delivery_schedule, payment_method } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: 'Savatda mahsulotlar mavjud emas' });
    }

    const cleanAddress = cleanText(delivery_address, 300);
    if (cleanAddress.length < 5) {
      return res.status(400).json({ error: "Yetkazib berish manzilini to'liq kiriting" });
    }

    const payMethod = METHODS.includes(payment_method) ? payment_method : (paymentOptions().methods[0] || 'CLICK');
    if (paymentMode() === 'direct' && payMethod !== 'DIRECT_FARMER') return res.status(400).json({error:'Bu rejimda to‘lov faqat bevosita fermerga qilinadi'});
    if (payMethod === 'INVOICE_B2B' && req.user!.role !== 'BUYER_B2B') {
      return res.status(400).json({ error: 'Hisob-faktura orqali to‘lov faqat biznes hisoblar uchun' });
    }

    if (payMethod !== 'INVOICE_B2B' && !paymentOptions().methods.length) {
      return res.status(503).json({ error: 'Onlayn to‘lov hali ulanmagan. Buyurtma yaratilmadi.' });
    }
    if (payMethod !== 'INVOICE_B2B' && !paymentOptions().methods.includes(payMethod)) return res.status(400).json({ error: 'Bu to‘lov usuli hozir mavjud emas' });

    // Har bir mahsulotni tekshirish
    const itemRequests = items.map((it: any) => ({
      product_id: typeof it?.product_id === 'string' ? it.product_id.trim() : '',
      quantity_kg: positiveNumber(it?.quantity_kg),
    }));

    if (itemRequests.some((it: any) => !it.product_id || !it.quantity_kg)) {
      return res.status(400).json({ error: "Mahsulotlar va ularning miqdorlari to'g'ri kiritilishi shart" });
    }

    const productIds = itemRequests.map((it: any) => it.product_id);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ error: 'Bir mahsulot savatda faqat bir marta kiritilishi kerak' });
    }
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { farmer: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of itemRequests) {
      const prod = productMap.get(item.product_id);
      if (!prod || !prod.is_active) {
        return res.status(400).json({ error: `Mahsulot topilmadi yoki sotuvda faol emas: ${prod?.title || item.product_id}` });
      }
      if (prod.farmer_id === buyerId) {
        return res.status(400).json({ error: `O'zingizning mahsulotingizni sotib ola olmaysiz: ${prod.title}` });
      }
      if (prod.farmer.kyc_status !== 'APPROVED') {
        return res.status(400).json({ error: `Sotuvchi hali tekshiruvdan o'tmagan: ${prod.farmer.full_name}` });
      }
      const amount = Math.round(item.quantity_kg! * prod.price_per_kg);
      if (amount < 1 || amount > 2_147_483_647 - DELIVERY_FEE) {
        return res.status(400).json({ error: "Buyurtma summasi ruxsat etilgan chegaradan tashqarida" });
      }
      if(!validQuantity(item.quantity_kg,prod.unit)) return res.status(400).json({error:`${prod.title}: miqdor birlikka mos emas`});
      if (item.quantity_kg < prod.min_order_kg) {
        return res.status(400).json({ error: `${prod.title} uchun minimal buyurtma: ${prod.min_order_kg} ${prod.unit}` });
      }
      if (item.quantity_kg > prod.available_quantity_kg + 1e-8) {
        return res.status(400).json({ error: `${prod.title} omborda yetarli emas. Qoldiq: ${prod.available_quantity_kg} ${prod.unit}` });
      }
    }

    // Fermerlar bo'yicha guruhlash (har bir alohida fermer yetkazib berish bo'yicha alohida hisoblanadi)
    const farmerOrdersMap = new Map<string, typeof itemRequests>();
    for (const item of itemRequests) {
      const prod = productMap.get(item.product_id)!;
      const list = farmerOrdersMap.get(prod.farmer_id) || [];
      list.push(item);
      farmerOrdersMap.set(prod.farmer_id, list);
    }

    const createdOrders = await prisma.$transaction(async (tx) => {
      const resultList = [];

      for (const [farmerId, farmerItems] of farmerOrdersMap.entries()) {

        for (const item of farmerItems) {
          const prod = productMap.get(item.product_id)!;

          // Ombor qoldig'ini atomik band qilish
          const reserved = await tx.product.updateMany({
            where: { id: prod.id,unit:prod.unit,price_per_kg:prod.price_per_kg,min_order_kg:prod.min_order_kg, is_active: true, available_quantity_kg: { gte: item.quantity_kg - 1e-8 } },
            data: { available_quantity_kg: { decrement: item.quantity_kg } },
          });
          if (reserved.count !== 1) {
            throw new Error(`STOCK_${prod.title}`);
          }

          const product_total_amount = Math.round(item.quantity_kg * prod.price_per_kg);
          const platform_commission = payMethod === 'DIRECT_FARMER' ? 0 : Math.round(product_total_amount * COMMISSION_RATE);
          const farmer_payout = product_total_amount - platform_commission;

          // Each order is claimed, cancelled and delivered independently.
          const delivery_fee = DELIVERY_FEE;
          const courier_payout = payMethod === 'DIRECT_FARMER' ? DELIVERY_FEE : COURIER_PAYOUT;
          const platform_logistics_margin = payMethod === 'DIRECT_FARMER' ? 0 : LOGISTICS_MARGIN;

          await tx.product.updateMany({where:{id:prod.id,available_quantity_kg:{lt:0,gt:-1e-8}},data:{available_quantity_kg:0}});
          const order = await tx.order.create({
            data: {
              buyer_id: buyerId,
              farmer_id: farmerId,
              product_id: prod.id,
              ...snapshotPickup(prod), ...delivery,
              product_title: prod.title,
              unit_price_per_kg: prod.price_per_kg,
              quantity_kg: item.quantity_kg,
              product_total_amount,
              delivery_fee,
              total_paid: product_total_amount + delivery_fee,
              platform_commission,
              farmer_payout,
              courier_payout,
              platform_logistics_margin,
              payment_method: payMethod,
              status: 'PENDING_PAYMENT',
              delivery_address: cleanAddress,
              delivery_schedule: delivery_schedule ? cleanText(delivery_schedule, 200) : null,
            },
          });
          resultList.push(order);
        }
      }

      return resultList;
    });

    return res.status(201).json({
      orders: createdOrders,
      total_orders_count: createdOrders.length,
      grand_total: createdOrders.reduce((sum, o) => sum + o.total_paid, 0),
    });
  } catch (err: any) {
    if (err?.message?.startsWith('STOCK_')) {
      return res.status(400).json({ error: `Omborda mahsulot yetarli emas: ${err.message.replace('STOCK_', '')}` });
    }
    if(err instanceof Error && ['Tuman ro‘yxatda mavjud emas','Koordinatalar noto‘g‘ri'].includes(err.message)) return res.status(400).json({error:err.message});
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Savat buyurtmalarini rasmiylashtirishda xatolik yuz berdi' });
  }
});

// 4. To'lov: muvaffaqiyatli bo'lsa pul ESCROW'ga tushadi (PAID_IN_ESCROW)
router.post('/:id/pay', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payme_transaction: true } });
    if (!order || order.buyer_id !== req.user!.id) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ error: "Bu buyurtma to'lov kutmayapti" });
    }

    // Muddat tekshiruvi: 30 daqiqa (oddiy to'lov) yoki 72 soat (B2B hisob-faktura)
    const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
    const isExpired =
      ['INVOICE_B2B','DIRECT_FARMER'].includes(order.payment_method)
        ? orderAgeMs > INVOICE_TIMEOUT_HOURS * 3600000
        : orderAgeMs > PAYMENT_TIMEOUT_MIN * 60000;

    const gatewayActive = order.payme_transaction?.state === 1 && order.payme_transaction.expires_at.getTime() > Date.now();
    if (isExpired && !gatewayActive) {
      await prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT', NOT: { payme_transaction: { is: { state: 1, expires_at: { gt: new Date() } } } } }, data: { status: 'CANCELLED' } });
        if (r.count === 1) {
          await tx.paymeTransaction.updateMany({ where: { order_id: order.id, state: 1 }, data: { state: -1, reason: 4, cancel_time: new Date() } });
          await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
        }
      });
      return res.status(400).json({ error: "Buyurtmani to'lash muddati tugagan (rezerv bekor qilindi). Iltimos, qaytadan buyurtma bering." });
    }

    if(order.payment_method === 'DIRECT_FARMER') {
      return res.json({ order: { ...order, payme_transaction: undefined }, pending_direct: true,
        message: 'Buyurtma yaratildi. To‘lovni fermer bilan kelishing; pul tushganini fermer tasdiqlaydi. Platforma pul qabul qilmaydi.' });
    }

    // B2B hisob-faktura: admin bank o'tkazmasini tasdiqlagach escrow'ga tushadi
    if (order.payment_method === 'INVOICE_B2B') {
      return res.json({ order, pending_invoice: true, message: "Hisob-faktura shakllandi. To'lov tasdiqlangach buyurtma faollashadi." });
    }

    if (paymentMode() === 'payme') {
      if(!paymentOptions().methods.includes('PAYME')) return res.status(503).json({ error: 'Payme merchant sozlamalari hali kiritilmagan' });
      const changed = await prisma.order.updateMany({ where: { id:order.id, status:'PENDING_PAYMENT' }, data: { payment_method:'PAYME' } });
      if(changed.count !== 1) return res.status(409).json({ error: 'Buyurtma holati o‘zgargan' });
      return res.json({ order: { ...order, payme_transaction: undefined, payment_method:'PAYME' }, pending_payment:true,
        checkout_url:paymeCheckout(order), message:'To‘lovni Payme sahifasida yakunlang. Holat provayder tasdig‘idan keyin yangilanadi.' });
    }

    const charge = await chargeOrder(order.id, order.total_paid, order.payment_method);
    if (!charge.ok) return res.status(402).json({ error: charge.error || "To'lov amalga oshmadi" });

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID_IN_ESCROW',paid_at:new Date(),delivery_pin:generateDeliveryPin(),delivery_pin_attempts:0 } });
      if (r.count !== 1) throw new Error('STATE');
      await holdInEscrow(tx, order);
      return tx.order.findUnique({ where: { id: order.id } });
    });

    return res.json({ order: updated, reference: charge.reference, is_demo: charge.is_demo });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(409).json({ error: "Buyurtma holati o'zgargan, sahifani yangilang" });
    console.error('Pay order error:', err);
    return res.status(500).json({ error: "To'lovda xatolik yuz berdi" });
  }
});

// A direct bank/card payment is confirmed only by the receiving farmer.
router.post('/:id/confirm-direct-payment', authenticateToken, requireRole(['FARMER']), async (req: AuthRequest, res: Response) => {
  try {
    if(req.user!.kyc_status !== 'APPROVED') return res.status(403).json({ error: 'Fermer profili tasdiqlanishi kerak' });
    const order = await prisma.order.findUnique({where:{id:req.params.id}});
    if(!order || order.farmer_id !== req.user!.id) return res.status(404).json({error:'Buyurtma topilmadi'});
    if(order.payment_method !== 'DIRECT_FARMER') return res.status(400).json({error:'Bu buyurtmada boshqa to‘lov usuli tanlangan'});
    if(req.body?.received !== true || req.body?.received_amount !== order.total_paid) return res.status(400).json({error:'To‘liq summa kelib tushganini tasdiqlang'});
    await prisma.$transaction(async tx => {
      const r = await tx.order.updateMany({where:{id:order.id,status:'PENDING_PAYMENT',created_at:{gte:new Date(Date.now()-INVOICE_TIMEOUT_HOURS*3600000)}},data:{status:'CONFIRMED_BY_FARMER',paid_at:new Date(),confirmed_at:new Date(),delivery_pin:generateDeliveryPin(),delivery_pin_attempts:0}});
      if(r.count !== 1) throw new Error('STATE');
      await tx.transaction.create({data:{order_id:order.id,user_id:order.farmer_id,type:'DIRECT_PAYMENT_RECEIVED',amount:order.total_paid}});
    });
    res.json({message:'Fermer to‘lovni olganini tasdiqladi. Buyurtma yetkazishga tayyor.'});
  }catch(err:any){
    if(err?.message === 'STATE') return res.status(409).json({error:'Buyurtma holati o‘zgargan yoki muddati tugagan'});
    res.status(500).json({error:'To‘lov tasdig‘ini saqlashda xatolik'});
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
      await tx.paymeTransaction.updateMany({ where: { order_id: order.id, state: 1 }, data: { state: -1, reason: 5, cancel_time: new Date() } });
      await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
    });
    return res.json({ message: 'Buyurtma bekor qilindi' });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(400).json({ error: "Faqat to'lanmagan buyurtmani bekor qilish mumkin" });
    return res.status(500).json({ error: 'Bekor qilishda xatolik' });
  }
});

// 6. Fermer buyurtmani rad etadi -> xaridorga to'liq qaytariladi
router.post('/:id/reject', authenticateToken, requireRole(['FARMER']), async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.farmer_id !== req.user!.id) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'PAID_IN_ESCROW' }, data: { status: 'REFUNDED' } });
      if (r.count !== 1) throw new Error('STATE');
      await tx.product.update({ where: { id: order.product_id }, data: { available_quantity_kg: { increment: order.quantity_kg } } });
      await settleOrder(tx, order, order.product_total_amount);
    });
    return res.json({ message: 'Buyurtma rad etildi, mablag‘ xaridorga qaytarildi' });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(400).json({ error: 'Buyurtma hozirgi holatida rad etilmaydi' });
    console.error('Reject order error:', err);
    return res.status(500).json({ error: 'Rad etishda xatolik' });
  }
});

// 7. Holat o'zgartirish: qat'iy ketma-ketlik va egalik tekshiruvi
//    PAID_IN_ESCROW -> CONFIRMED_BY_FARMER (fermer) -> IN_TRANSIT (kuryer oladi) -> DELIVERED (shu kuryer)
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const status = String(req.body?.status ?? '');
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    let result;
    if (status === 'CONFIRMED_BY_FARMER') {
      if (user.role !== 'FARMER' || order.farmer_id !== user.id) return res.status(403).json({ error: 'Faqat buyurtma egasi fermer tasdiqlay oladi' });
      result = await prisma.order.updateMany({ where: { id: order.id, status: 'PAID_IN_ESCROW' }, data: { status,confirmed_at:new Date() } });
    } else if (status === 'IN_TRANSIT' || status === 'DELIVERED') {
      if(status === 'IN_TRANSIT') await courierPickup(user,order.id);
      else await courierDeliver(user,order.id,req.body?.pin);
      const updated=await prisma.order.findUnique({where:{id:order.id},include:FULL_INCLUDE});
      return res.json(sanitizeOrder(updated,user));
    } else {
      return res.status(400).json({ error: "Bu holatga to'g'ridan-to'g'ri o'tib bo'lmaydi" });
    }

    if (result.count !== 1) return res.status(409).json({ error: "Buyurtma holati mos emas yoki allaqachon o'zgargan" });
    const updated = await prisma.order.findUnique({ where: { id: order.id }, include: FULL_INCLUDE });
    return res.json(sanitizeOrder(updated, user));
  } catch (err) {
    if(err instanceof OrderActionError) return res.status(err.code==='FORBIDDEN'?403:err.code==='NOT_FOUND'?404:err.code==='VALIDATION'?400:409).json({error:err.message});
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Statusni yangilashda xatolik' });
  }
});

// 8. Xaridor "Qabul qildim" -> escrow'dan pul taqsimlanadi (faqat DELIVERED'dan, bir marta)
router.post('/:id/complete', authenticateToken, requireRole(BUYER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.buyer_id !== req.user!.id) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.status === 'DISPUTED') return res.status(400).json({ error: 'Bu buyurtma bo‘yicha nizo ochilgan' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ error: 'Mahsulot yetkazilgandan keyingina qabul qilish mumkin' });

    const completed = await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'DELIVERED' }, data: { status: 'COMPLETED' } });
      if (r.count !== 1) throw new Error('STATE'); // ikki marta bosish / poyga
      await settleOrder(tx, order, 0);
      return tx.order.findUnique({ where: { id: order.id } });
    });

    return res.json({ message: order.payment_method === 'DIRECT_FARMER' ? 'Yetkazish yakunlandi. Hisob-kitob fermer bilan qo‘lda bajariladi.' : "Buyurtma yakunlandi! Mablag'lar fermer va kuryerga o'tkazildi.", order: completed });
  } catch (err: any) {
    if (err?.message === 'STATE') return res.status(409).json({ error: 'Buyurtma allaqachon yakunlangan yoki holati o‘zgargan' });
    console.error('Complete order error:', err);
    return res.status(500).json({ error: 'Buyurtmani yakunlashda xatolik yuz berdi' });
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
    if (!isParticipant(order, req.user!)) return res.status(403).json({ error: 'Ruxsat yo‘q' });

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
          name: (order as any).product_title || order.product.title,
          category: order.product.category,
          quantity_kg: order.quantity_kg,
          unit:order.unit,
          price_per_kg:
            (order as any).unit_price_per_kg ??
            (order.quantity_kg > 0
              ? Math.round(order.product_total_amount / order.quantity_kg)
              : order.product.price_per_kg),
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

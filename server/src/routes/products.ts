import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { CATEGORIES, cleanText, isHttpUrl, positiveInt, positiveNumber, toNumber } from '../utils/validate.js';
import { AUTO_APPROVE_KYC, JWT_SECRET } from '../config.js';

import { productKind, normalizeProductName } from '../utils/product-kind.js';

import { fulfillmentFields, validQuantity } from '../utils/fulfillment.js';
import { ALLOWED_UNITS } from '../utils/validate.js';
import { isAllowedDefaultImage, isSupabaseStorageUrl, DEFAULT_PRODUCT_IMAGES } from '../config.js';
const router = Router();
function images(b:any,farmerId:string,category:string){
  if(b.image_urls!==undefined&&(!Array.isArray(b.image_urls)||b.image_urls.length>5))throw new Error('Ko‘pi bilan 5 ta rasm bo‘lishi mumkin');
  const urls=b.image_urls!==undefined?b.image_urls:b.image_url?[b.image_url]:[];
  for(const u of urls)if(typeof u!=='string'||!isHttpUrl(u)||(!isSupabaseStorageUrl(u,farmerId)&&!isAllowedDefaultImage(u)))throw new Error('Rasm faqat o‘zingiz yuklagan AgroBozor xotirasidan bo‘lishi kerak');
  const image_urls=urls.length?urls:[DEFAULT_PRODUCT_IMAGES[category]];
  return {image_url:image_urls[0],image_urls};
}
function inputFields(b:any){try{return fulfillmentFields(b);}catch(e){throw Object.assign(e as Error,{validation:true});}}


// 1. Aqlli narx tavsiyasi API (/api/products/price-recommendation va /api/price-recommendation)
router.get('/price-recommendation', async (req: Request, res: Response) => {
  try {
    const unit=typeof req.query.unit==='string'?req.query.unit:'KG';
    if(!ALLOWED_UNITS.includes(unit as any))return res.status(400).json({error:'Birlik noto‘g‘ri'});
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    if(!CATEGORIES.includes(category)) return res.status(400).json({ error: 'To‘g‘ri kategoriyani tanlang' });
    const title = cleanText(req.query.title, 120);
    const region = cleanText(req.query.region, 120);
    const empty = { recommended_price: null, avg_price: null, min_price: null, max_price: null, sample_count: 0, source: 'insufficient_data' };
    if(normalizeProductName(title).length < 2) return res.json({ ...empty, context: 'Narx tavsiyasi uchun mahsulot nomini kiriting' });
    const kind = productKind(title);
    const candidates = await prisma.product.findMany({
      where: { category, unit, is_active: true, available_quantity_kg: { gt: 0 }, farmer: { kyc_status: 'APPROVED' } },
      select: { title: true, region: true, price_per_kg: true }, orderBy: { created_at: 'desc' }, take: 2000,
    });
    const sameKind = candidates.filter(p => productKind(p.title) === kind);
    const local = region ? sameKind.filter(p => normalizeProductName(p.region).includes(normalizeProductName(region))) : [];
    const products = local.length ? local : sameKind;
    if(!products.length) return res.json({ ...empty, context: 'Shu mahsulot turi bo‘yicha narx tavsiyasi uchun ma’lumot yetarli emas' });
    const prices = products.map(p => p.price_per_kg).sort((a,b) => a-b);
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid-1]+prices[mid])/2);
    res.json({ recommended_price: median, avg_price: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
      min_price: prices[0], max_price: prices[prices.length-1], sample_count: prices.length,
      source: 'matched_product', context: local.length ? 'Shu mahsulot turi, shu hudud' : 'Shu mahsulot turi, respublika bo‘yicha',
    });
  } catch (err) {
    console.error('Price recommendation error:', err);
    res.status(500).json({ error: 'Narx tavsiyasini hisoblashda xatolik' });
  }
});

// 2. Mahsulotlar ro'yxati (Filtrlar bilan)
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      region,
      min_price,
      max_price,
      min_rating,
      today_harvested,
      search,
      farmer_id,
    } = req.query;

    const where: any = {};

    // Barcha ko'radigan ro'yxat: faol mahsulot + tasdiqlangan fermer.
    // Fermer o'z mahsulotlarini (nofaol ham) faqat tizimga kirgan holda /products/mine orqali ko'radi.
    where.is_active = true;
    const farmerFilter: any = { kyc_status: 'APPROVED' };
    if (farmer_id) where.farmer_id = String(farmer_id);

    if (category && category !== 'ALL') {
      where.category = String(category);
    }

    if (region && region !== 'ALL') {
      where.region = { contains: String(region), mode: 'insensitive' };
    }

    if (search) {
      where.title = { contains: String(search), mode: 'insensitive' };
    }

    if (min_price || max_price) {
      where.price_per_kg = {};
      const lo = toNumber(min_price);
      const hi = toNumber(max_price);
      if (Number.isFinite(lo)) where.price_per_kg.gte = Math.round(lo);
      if (Number.isFinite(hi)) where.price_per_kg.lte = Math.round(hi);
    }

    if (today_harvested === 'true') {
      // 24 soat ichida uzilgan
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.harvest_date = { gte: yesterday };
    }

    if (min_rating) {
      const mr = toNumber(min_rating);
      if (Number.isFinite(mr)) farmerFilter.rating = { gte: mr };
    }
    where.farmer = farmerFilter;

    const products = await prisma.product.findMany({
      where,
      include: {
        farmer: {
          select: {
            id: true,
            full_name: true,
            farm_or_company_name: true,
            region: true,
            rating: true,
            kyc_status: true,
            is_premium: true,
          },
        },
      },
      orderBy: [
        { farmer: { is_premium: 'desc' } }, // Premium fermerlar yuqoriroqda chiqadi
        { created_at: 'desc' },
      ],
    });

    return res.json(products);
  } catch (err: any) {
    console.error('Get products error:', err);
    return res.status(500).json({ error: 'Mahsulotlarni yuklashda xatolik' });
  }
});

// 2b. Fermerning o'z mahsulotlari (nofaol ham)
router.get('/mine/list', authenticateToken, requireRole(['FARMER']), async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { farmer_id: req.user!.id },
      include: { _count: { select: { views: true, orders: true } } },
      orderBy: { created_at: 'desc' },
    });
    return res.json(products);
  } catch {
    return res.status(500).json({ error: 'Mahsulotlarni yuklashda xatolik' });
  }
});

// Only the owner can inspect named viewers; documents and contact details are never included.
router.get('/:id/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || (product.farmer_id !== req.user!.id && req.user!.role !== 'ADMIN')) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    const [unique_views, viewers, sales, order_count, earnings, directSales] = await Promise.all([
      prisma.productView.count({ where: { product_id: product.id } }),
      prisma.productView.findMany({ where: { product_id: product.id }, orderBy: { last_viewed_at: 'desc' }, take: 50,
        select: { id: true, last_viewed_at: true, viewer: { select: { id: true, full_name: true, region: true } } } }),
      prisma.order.aggregate({ where: { product_id: product.id, status: 'COMPLETED' }, _sum: { quantity_kg: true, farmer_payout: true } }),
      prisma.order.count({ where: { product_id: product.id } }),
      prisma.transaction.aggregate({ where: { user_id: product.farmer_id, type: 'ESCROW_RELEASE_FARMER', order: { product_id: product.id } }, _sum: { amount: true } }),
      prisma.order.aggregate({where:{product_id:product.id,payment_method:'DIRECT_FARMER',status:'COMPLETED'},_sum:{product_total_amount:true}}),
    ]);
    res.json({ unique_views, viewers, order_count, sold_kg: sales._sum.quantity_kg || 0, earned: (earnings._sum.amount || 0) + (directSales._sum.product_total_amount || 0) });
  } catch (err) {
    console.error('Product analytics error:', err);
    res.status(500).json({ error: 'Statistikani yuklashda xatolik' });
  }
});

router.post('/:id/view', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { farmer: { select: { kyc_status: true } } } });
    if (!product || !product.is_active || product.farmer.kyc_status !== 'APPROVED') return res.status(404).json({ error: 'Mahsulot topilmadi' });
    if (product.farmer_id !== req.user!.id) {
      await prisma.productView.upsert({
        where: { product_id_viewer_id: { product_id: product.id, viewer_id: req.user!.id } },
        create: { product_id: product.id, viewer_id: req.user!.id },
        update: { last_viewed_at: new Date() },
      });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Ko‘rishni saqlashda xatolik' });
  }
});

router.get('/farmer/last',authenticateToken,requireRole(['FARMER']),async(req:AuthRequest,res:Response)=>{
  try{res.json(await prisma.product.findFirst({where:{farmer_id:req.user!.id},orderBy:{created_at:'desc'}}));}
  catch{res.status(500).json({error:'Oxirgi e’lonni yuklab bo‘lmadi'});}
});

// 3. Yagona mahsulot detali (xaridor manzili va buyurtma tafsilotlari ochiq chiqib ketishi oldi olingan)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        farmer: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            farm_or_company_name: true,
            region: true,
            rating: true,
            kyc_status: true,
            is_premium: true,
            created_at: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    // Nofaol yoki tekshirilmagan fermer mahsulotini faqat egasi yoki admin ko'ra oladi
    if (!product.is_active || product.farmer.kyc_status !== 'APPROVED') {
      let isAllowed = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (typeof decoded?.id === 'string') {
            const viewer = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, role: true } });
            isAllowed = !!viewer && (viewer.id === product.farmer_id || viewer.role === 'ADMIN');
          }
        } catch {}
      }
      if (!isAllowed) {
        return res.status(404).json({ error: 'Mahsulot topilmadi yoki faol emas' });
      }
    }

    // Sharhlar: faqat ommaviy xavfsiz maydonlar (orders va xaridor manzillarisiz!)
    const reviews = await prisma.review.findMany({
      where: {
        order: {
          product_id: id,
          status: 'COMPLETED',
        },
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        created_at: true,
        reviewer: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return res.json({
      ...product,
      reviews,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Mahsulot ma'lumotlarini olishda xatolik" });
  }
});

// 4. Yangi mahsulot qo'shish (faqat fermer; tekshiruvdan o'tmagan fermer mahsuloti ko'rinmaydi)
router.post('/', authenticateToken, requireRole(['FARMER']), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (user.kyc_status === 'REJECTED') {
      return res.status(403).json({ error: 'Profilingiz tekshiruvdan o‘tmadi. Administratorga murojaat qiling.' });
    }

    const b = req.body || {};
    const title = cleanText(b.title, 120);
    const price = positiveInt(b.price_per_kg);
    const quantity = positiveNumber(b.available_quantity_kg);
    const minOrder = b.min_order_kg !== undefined ? positiveNumber(b.min_order_kg) : 1;
    const fulfillment=inputFields(b);const unit=fulfillment.unit||'KG';
    if(!validQuantity(quantity,unit)||!validQuantity(minOrder,unit))return res.status(400).json({error:'Miqdor va minimum birlikka mos bo‘lishi kerak (dona, banka, quti — butun son)'});

    if (title.length < 2) return res.status(400).json({ error: 'Mahsulot nomini kiriting' });
    if (!CATEGORIES.includes(String(b.category))) return res.status(400).json({ error: "Kategoriya noto'g'ri" });
    if (!price || price > 10_000_000) return res.status(400).json({ error: "Narx noto'g'ri (so'm/kg)" });
    if (!quantity || quantity > 1_000_000) return res.status(400).json({ error: "Miqdor noto'g'ri (kg)" });
    if (!minOrder || minOrder > quantity) return res.status(400).json({ error: "Minimal buyurtma miqdori noto'g'ri" });
    let gallery;try{gallery=images(b,user.id,String(b.category));}catch(e){return res.status(400).json({error:(e as Error).message});}

    let harvest = b.harvest_date ? new Date(b.harvest_date) : new Date();
    if (isNaN(harvest.getTime()) || harvest.getTime() > Date.now() + 86400000) harvest = new Date();

    const product = await prisma.product.create({
      data: {
        ...fulfillment, ...gallery,
        farmer_id: user.id,
        title,
        category: String(b.category),
        price_per_kg: price,
        available_quantity_kg: quantity,
        min_order_kg: minOrder,
        harvest_date: harvest,

        region: cleanText(b.region, 120) || user.region,
        is_active: true,
      },
    });

    return res.status(201).json({
      ...product,
      pending_review: user.kyc_status !== 'APPROVED' && !AUTO_APPROVE_KYC,
    });
  } catch (err) {
    if((err as any)?.validation)return res.status(400).json({error:(err as Error).message});
    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Mahsulot qo‘shishda xatolik yuz berdi' });
  }
});

// 5. Mahsulotni tahrirlash (faqat egasi)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    if (existing.farmer_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: "Ushbu mahsulotni faqat egasi o'zgartira oladi" });
    }

    const b = req.body || {};
    const data: any = inputFields(b);
    if(data.unit && data.unit!==existing.unit && await prisma.order.count({where:{product_id:existing.id}}))return res.status(409).json({error:'Buyurtmaga bog‘langan e’lon birligini o‘zgartirib bo‘lmaydi. Yangi e’lon yarating.'});
    if (b.expected_quantity_kg !== undefined && toNumber(b.expected_quantity_kg) !== existing.available_quantity_kg) {
      return res.status(409).json({ error: 'Mahsulot qoldig‘i o‘zgargan. Kabinetni yangilab, qayta urinib ko‘ring.' });
    }
    if (b.title !== undefined) {
      const t = cleanText(b.title, 120);
      if (t.length < 2) return res.status(400).json({ error: 'Nom juda qisqa' });
      data.title = t;
    }
    if (b.category !== undefined) {
      if (!CATEGORIES.includes(String(b.category))) return res.status(400).json({ error: "Kategoriya noto'g'ri" });
      data.category = String(b.category);
    }
    if (b.price_per_kg !== undefined) {
      const p = positiveInt(b.price_per_kg);
      if (!p || p > 10_000_000) return res.status(400).json({ error: "Narx noto'g'ri" });
      data.price_per_kg = p;
    }
    if (b.available_quantity_kg !== undefined) {
      const q = toNumber(b.available_quantity_kg);
      if (!(q >= 0 && q <= 1_000_000)) return res.status(400).json({ error: "Miqdor noto'g'ri" });
      data.available_quantity_kg = q;
    }
    if (b.min_order_kg !== undefined) {
      const m = positiveNumber(b.min_order_kg);
      if (!m) return res.status(400).json({ error: "Minimal miqdor noto'g'ri" });
      data.min_order_kg = m;
    }
    if(b.image_url!==undefined||b.image_urls!==undefined){try{Object.assign(data,images(b,existing.farmer_id,b.category||existing.category));}catch(e){return res.status(400).json({error:(e as Error).message});}}
    if (b.region !== undefined) data.region = cleanText(b.region, 120);
    if (b.is_active !== undefined) {
      if (typeof b.is_active !== 'boolean') return res.status(400).json({ error: "Faollik qiymati noto'g'ri" });
      data.is_active = b.is_active;
    }
    if (b.harvest_date !== undefined) {
      const h = new Date(b.harvest_date);
      if (!isNaN(h.getTime())) data.harvest_date = h;
    }

    const unit=data.unit||existing.unit;
    if(!validQuantity(data.available_quantity_kg??existing.available_quantity_kg,unit,true)||!validQuantity(data.min_order_kg??existing.min_order_kg,unit))return res.status(400).json({error:'Miqdor birlikka mos emas'});
    if (data.min_order_kg !== undefined && data.min_order_kg > (data.available_quantity_kg ?? existing.available_quantity_kg)) {
      return res.status(400).json({ error: "Minimal buyurtma qoldiqdan oshmasligi kerak" });
    }
    const changed = await prisma.product.updateMany({
      where: { id: existing.id, available_quantity_kg: existing.available_quantity_kg, price_per_kg: existing.price_per_kg }, data,
    });
    if(changed.count !== 1) return res.status(409).json({ error: 'Mahsulot o‘zgargan. Sahifani yangilab qayta urinib ko‘ring.' });
    const updated = await prisma.product.findUnique({ where: { id: existing.id } });
    return res.json(updated);
  } catch (err) {
    if((err as any)?.validation)return res.status(400).json({error:(err as Error).message});
    return res.status(500).json({ error: 'Mahsulotni tahrirlashda xatolik' });
  }
});

// 6. Mahsulotni o'chirish: buyurtmalari bo'lsa o'chirmaymiz, faqat sotuvdan olamiz
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    if (existing.farmer_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: "Ushbu mahsulotni o'chirishga ruxsat yo'q" });
    }
    const [hasOrders, hasConversations] = await Promise.all([
      prisma.order.count({ where: { product_id: existing.id } }),
      prisma.conversation.count({ where: { product_id: existing.id } }),
    ]);
    if (hasOrders > 0 || hasConversations > 0) {
      await prisma.product.update({ where: { id: existing.id }, data: { is_active: false } });
      return res.json({ message: "Mahsulot buyurtmalarga bog'liq, shuning uchun sotuvdan olindi" });
    }
    await prisma.product.delete({ where: { id: existing.id } });
    return res.json({ message: "Mahsulot muvaffaqiyatli o'chirildi" });
  } catch {
    return res.status(500).json({ error: "Mahsulotni o'chirishda xatolik" });
  }
});

export default router;

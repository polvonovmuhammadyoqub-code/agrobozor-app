import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { CATEGORIES, cleanText, isHttpUrl, positiveInt, positiveNumber, toNumber } from '../utils/validate.js';
import { AUTO_APPROVE_KYC, JWT_SECRET } from '../config.js';

const router = Router();

// 1. Aqlli narx tavsiyasi API (/api/products/price-recommendation va /api/price-recommendation)
router.get('/price-recommendation', async (req: Request, res: Response) => {
  try {
    const { category, region } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'Kategoriya parametri ko\'rsatilishi shart' });
    }

    const categoryStr = String(category);
    const regionStr = region ? String(region).trim() : null;

    // Birinchi navbatda shu viloyat va kategoriya bo'yicha qidiramiz
    let whereClause: any = {
      category: categoryStr,
      is_active: true,
    };

    if (regionStr) {
      whereClause.region = { contains: regionStr, mode: 'insensitive' };
    }

    let products = await prisma.product.findMany({
      where: whereClause,
      select: { price_per_kg: true },
    });

    let context = 'viloyat bo\'yicha';

    // Agar viloyat bo'yicha mahsulot topilmasa yoki kam bo'lsa, butun respublika bo'yicha hisoblaymiz
    if (products.length === 0 && regionStr) {
      products = await prisma.product.findMany({
        where: {
          category: categoryStr,
          is_active: true,
        },
        select: { price_per_kg: true },
      });
      context = 'respublika bo\'yicha o\'rtacha';
    }

    if (products.length === 0) {
      // Default bazaviy narxlar (agar hali mahsulot bo'lmasa)
      const defaultPrices: Record<string, number> = {
        MEVALAR: 20000,
        SABZAVOTLAR: 12000,
        POLIZ: 6000,
        SUT_GOSHT: 85000,
        DON: 25000,
      };
      const def = defaultPrices[categoryStr] || 15000;
      return res.json({
        recommended_price: def,
        avg_price: def,
        min_price: Math.round(def * 0.8),
        max_price: Math.round(def * 1.25),
        sample_count: 0,
        context: 'Standart bozor tavsiyasi',
      });
    }

    const prices = products.map((p) => p.price_per_kg);
    const sum = prices.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(sum / prices.length);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return res.json({
      recommended_price: avg,
      avg_price: avg,
      min_price: min,
      max_price: max,
      sample_count: prices.length,
      context,
    });
  } catch (err: any) {
    console.error('Price recommendation error:', err);
    return res.status(500).json({ error: 'Narx tavsiyasini hisoblashda xatolik' });
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
    const [unique_views, viewers, sales, order_count, earnings] = await Promise.all([
      prisma.productView.count({ where: { product_id: product.id } }),
      prisma.productView.findMany({ where: { product_id: product.id }, orderBy: { last_viewed_at: 'desc' }, take: 50,
        select: { id: true, last_viewed_at: true, viewer: { select: { id: true, full_name: true, region: true } } } }),
      prisma.order.aggregate({ where: { product_id: product.id, status: 'COMPLETED' }, _sum: { quantity_kg: true, farmer_payout: true } }),
      prisma.order.count({ where: { product_id: product.id } }),
      prisma.transaction.aggregate({ where: { user_id: product.farmer_id, type: 'ESCROW_RELEASE_FARMER', order: { product_id: product.id } }, _sum: { amount: true } }),
    ]);
    res.json({ unique_views, viewers, order_count, sold_kg: sales._sum.quantity_kg || 0, earned: earnings._sum.amount || 0 });
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
    const minOrder = b.min_order_kg ? positiveNumber(b.min_order_kg) : 1;

    if (title.length < 2) return res.status(400).json({ error: 'Mahsulot nomini kiriting' });
    if (!CATEGORIES.includes(String(b.category))) return res.status(400).json({ error: "Kategoriya noto'g'ri" });
    if (!price || price > 10_000_000) return res.status(400).json({ error: "Narx noto'g'ri (so'm/kg)" });
    if (!quantity || quantity > 1_000_000) return res.status(400).json({ error: "Miqdor noto'g'ri (kg)" });
    if (!minOrder || minOrder > quantity) return res.status(400).json({ error: "Minimal buyurtma miqdori noto'g'ri" });
    if (b.image_url && !isHttpUrl(b.image_url)) return res.status(400).json({ error: "Rasm havolasi noto'g'ri" });

    let harvest = b.harvest_date ? new Date(b.harvest_date) : new Date();
    if (isNaN(harvest.getTime()) || harvest.getTime() > Date.now() + 86400000) harvest = new Date();

    const defaultImages: Record<string, string> = {
      MEVALAR: 'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=800&q=80',
      SABZAVOTLAR: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
      POLIZ: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
      SUT_GOSHT: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80',
      DON: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    };

    const product = await prisma.product.create({
      data: {
        farmer_id: user.id,
        title,
        category: String(b.category),
        price_per_kg: price,
        available_quantity_kg: quantity,
        min_order_kg: minOrder,
        harvest_date: harvest,
        image_url: b.image_url || defaultImages[String(b.category)],
        region: cleanText(b.region, 120) || user.region,
        is_active: true,
      },
    });

    return res.status(201).json({
      ...product,
      pending_review: user.kyc_status !== 'APPROVED' && !AUTO_APPROVE_KYC,
    });
  } catch (err) {
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
    const data: any = {};
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
    if (b.image_url !== undefined) {
      if (!isHttpUrl(b.image_url)) return res.status(400).json({ error: "Rasm havolasi noto'g'ri" });
      data.image_url = b.image_url;
    }
    if (b.region !== undefined) data.region = cleanText(b.region, 120);
    if (b.is_active !== undefined) {
      if (typeof b.is_active !== 'boolean') return res.status(400).json({ error: "Faollik qiymati noto'g'ri" });
      data.is_active = b.is_active;
    }
    if (b.harvest_date !== undefined) {
      const h = new Date(b.harvest_date);
      if (!isNaN(h.getTime())) data.harvest_date = h;
    }

    if (data.min_order_kg !== undefined && data.min_order_kg > (data.available_quantity_kg ?? existing.available_quantity_kg)) {
      return res.status(400).json({ error: "Minimal buyurtma qoldiqdan oshmasligi kerak" });
    }
    const changed = await prisma.product.updateMany({
      where: { id: existing.id, available_quantity_kg: existing.available_quantity_kg, price_per_kg: existing.price_per_kg }, data,
    });
    if(changed.count !== 1) return res.status(409).json({ error: 'Mahsulot o‘zgargan. Sahifani yangilab qayta urinib ko‘ring.' });
    const updated = await prisma.product.findUnique({ where: { id: existing.id } });
    return res.json(updated);
  } catch {
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

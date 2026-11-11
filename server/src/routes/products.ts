import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { CATEGORIES, cleanText, isHttpUrl, positiveInt, positiveNumber, toNumber } from '../utils/validate.js';
import { AUTO_APPROVE_KYC, isSupabaseStorageUrl, isAllowedDefaultImage, DEFAULT_PRODUCT_IMAGES } from '../config.js';

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
      orderBy: { created_at: 'desc' },
    });
    return res.json(products);
  } catch {
    return res.status(500).json({ error: 'Mahsulotlarni yuklashda xatolik' });
  }
});

// 3. Yagona mahsulot detali
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
            farm_or_company_name: true,
            region: true,
            rating: true,
            kyc_status: true,
            is_premium: true,
            created_at: true,
          },
        },
        orders: {
          take: 5,
          where: { status: 'COMPLETED' },
          include: {
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    return res.json(product);
  } catch (err: any) {
    return res.status(500).json({ error: 'Mahsulot ma\'lumotlarini olishda xatolik' });
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

    // Rasm havolalari: faqat rasmiy Supabase storage domenidan va o'z papkasidan bo'lishi tekshiriladi
    const imageUrls: string[] = Array.isArray(b.image_urls)
      ? b.image_urls.map((u: any) => String(u).trim()).filter(Boolean)
      : [];

    for (const u of imageUrls) {
      if (!isHttpUrl(u) || !isSupabaseStorageUrl(u, user.id)) {
        return res.status(400).json({ error: "Yuklangan rasm faqat o'zingizning rasmiy AgroBozor Supabase xotirangizga tegishli bo'lishi kerak" });
      }
    }

    if (b.image_url) {
      if (!isHttpUrl(b.image_url)) return res.status(400).json({ error: "Rasm havolasi noto'g'ri" });
      if (!isSupabaseStorageUrl(b.image_url, user.id) && !isAllowedDefaultImage(b.image_url)) {
        return res.status(400).json({ error: "Rasm havolasi faqat Supabase xotirangizdan yoki standart kutubxonadan bo'lishi kerak" });
      }
    }

    let harvest = b.harvest_date ? new Date(b.harvest_date) : new Date();
    if (isNaN(harvest.getTime()) || harvest.getTime() > Date.now() + 86400000) harvest = new Date();

    const finalImageUrl = imageUrls[0] || b.image_url || DEFAULT_PRODUCT_IMAGES[String(b.category)] || '';

    const product = await prisma.product.create({
      data: {
        farmer_id: user.id,
        title,
        category: String(b.category),
        price_per_kg: price,
        available_quantity_kg: quantity,
        min_order_kg: minOrder,
        harvest_date: harvest,
        image_url: finalImageUrl,
        image_urls: imageUrls.length > 0 ? imageUrls : [finalImageUrl],
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
      if (!p) return res.status(400).json({ error: "Narx noto'g'ri" });
      data.price_per_kg = p;
    }
    if (b.available_quantity_kg !== undefined) {
      const q = toNumber(b.available_quantity_kg);
      if (!(q >= 0)) return res.status(400).json({ error: "Miqdor noto'g'ri" });
      data.available_quantity_kg = q;
    }
    if (b.min_order_kg !== undefined) {
      const m = positiveNumber(b.min_order_kg);
      if (!m) return res.status(400).json({ error: "Minimal miqdor noto'g'ri" });
      data.min_order_kg = m;
    }
    const farmerId = existing.farmer_id;
    if (b.image_urls !== undefined) {
      if (!Array.isArray(b.image_urls)) return res.status(400).json({ error: "image_urls massiv bo'lishi kerak" });
      const urls = b.image_urls.map((u: any) => String(u).trim()).filter(Boolean);
      for (const u of urls) {
        if (!isHttpUrl(u) || !isSupabaseStorageUrl(u, farmerId)) {
          return res.status(400).json({ error: "Yuklangan rasm faqat o'zingizning rasmiy AgroBozor Supabase xotirangizga tegishli bo'lishi kerak" });
        }
      }
      data.image_urls = urls;
      if (urls.length > 0) {
        data.image_url = urls[0];
      }
    }
    if (b.image_url !== undefined) {
      if (!isHttpUrl(b.image_url)) return res.status(400).json({ error: "Rasm havolasi noto'g'ri" });
      if (!isSupabaseStorageUrl(b.image_url, farmerId) && !isAllowedDefaultImage(b.image_url)) {
        return res.status(400).json({ error: "Rasm havolasi faqat Supabase xotirangizdan yoki standart kutubxonadan bo'lishi kerak" });
      }
      data.image_url = b.image_url;
    }
    if (b.region !== undefined) data.region = cleanText(b.region, 120);
    if (b.is_active !== undefined) data.is_active = !!b.is_active;
    if (b.harvest_date !== undefined) {
      const h = new Date(b.harvest_date);
      if (!isNaN(h.getTime())) data.harvest_date = h;
    }

    const updated = await prisma.product.update({ where: { id: existing.id }, data });
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
    const hasOrders = await prisma.order.count({ where: { product_id: existing.id } });
    if (hasOrders > 0) {
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

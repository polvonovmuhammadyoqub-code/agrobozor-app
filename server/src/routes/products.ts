import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';

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
      whereClause.region = { contains: regionStr };
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

    if (farmer_id) {
      where.farmer_id = String(farmer_id);
    } else {
      where.is_active = true;
    }

    if (category && category !== 'ALL') {
      where.category = String(category);
    }

    if (region && region !== 'ALL') {
      where.region = { contains: String(region) };
    }

    if (search) {
      where.title = { contains: String(search) };
    }

    if (min_price || max_price) {
      where.price_per_kg = {};
      if (min_price) where.price_per_kg.gte = parseFloat(String(min_price));
      if (max_price) where.price_per_kg.lte = parseFloat(String(max_price));
    }

    if (today_harvested === 'true') {
      // 24 soat ichida uzilgan
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.harvest_date = { gte: yesterday };
    }

    if (min_rating) {
      where.farmer = {
        rating: { gte: parseFloat(String(min_rating)) },
      };
    }

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
            phone: true,
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
            phone: true,
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

// 4. Yangi mahsulot qo'shish (Barcha ro'yxatdan o'tgan foydalanuvchilar va fermerlar uchun)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    // Foydalanuvchini sotuvchi sifatida faollashtiramiz va tasdiqlaymiz
    if (user.role !== 'FARMER' && user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'FARMER', kyc_status: 'APPROVED' },
      });
    } else if (user.kyc_status !== 'APPROVED') {
      await prisma.user.update({
        where: { id: user.id },
        data: { kyc_status: 'APPROVED' },
      });
    }

    const {
      title,
      category,
      price_per_kg,
      available_quantity_kg,
      min_order_kg,
      harvest_date,
      image_url,
      region,
    } = req.body;

    if (!title || !category || !price_per_kg || !available_quantity_kg) {
      return res.status(400).json({ error: 'Majburiy maydonlarni to\'ldiring' });
    }

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
        category,
        price_per_kg: parseFloat(price_per_kg),
        available_quantity_kg: parseFloat(available_quantity_kg),
        min_order_kg: min_order_kg ? parseFloat(min_order_kg) : 1,
        harvest_date: harvest_date ? new Date(harvest_date) : new Date(),
        image_url: image_url || defaultImages[category] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        region: region || user.region,
        is_active: true,
      },
    });

    return res.status(201).json(product);
  } catch (err: any) {
    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Mahsulot qo\'shishda xatolik yuz berdi' });
  }
});

// 5. Mahsulotni tahrirlash
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    if (existing.farmer_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Ushbu mahsulotni faqat egasi o\'zgartira oladi' });
    }

    const {
      title,
      category,
      price_per_kg,
      available_quantity_kg,
      min_order_kg,
      harvest_date,
      image_url,
      region,
      is_active,
    } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        category: category !== undefined ? category : existing.category,
        price_per_kg: price_per_kg !== undefined ? parseFloat(price_per_kg) : existing.price_per_kg,
        available_quantity_kg: available_quantity_kg !== undefined ? parseFloat(available_quantity_kg) : existing.available_quantity_kg,
        min_order_kg: min_order_kg !== undefined ? parseFloat(min_order_kg) : existing.min_order_kg,
        harvest_date: harvest_date !== undefined ? new Date(harvest_date) : existing.harvest_date,
        image_url: image_url !== undefined ? image_url : existing.image_url,
        region: region !== undefined ? region : existing.region,
        is_active: is_active !== undefined ? is_active : existing.is_active,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Mahsulotni tahrirlashda xatolik' });
  }
});

// 6. Mahsulotni o'chirish / faolsizlantirish
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    if (existing.farmer_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Ushbu mahsulotni o\'chirishga ruxsat yo\'q' });
    }

    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Mahsulot muvaffaqiyatli o\'chirildi' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Mahsulotni o\'chirishda xatolik' });
  }
});

export default router;

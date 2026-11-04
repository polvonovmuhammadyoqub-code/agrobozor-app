import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'agrobozor_secure_jwt_secret_token_key_2025';

// Ro'yxatdan o'tish
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      phone,
      password,
      full_name,
      role, // 'FARMER', 'BUYER_B2C', 'BUYER_B2B', 'COURIER'
      region,
      tin_or_passport,
      farm_or_company_name,
    } = req.body;

    if (!phone || !password || !full_name || !role || !region || !tin_or_passport) {
      return res.status(400).json({ error: 'Barcha majburiy maydonlarni to\'ldiring!' });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    // Real foydalanuvchilar darhol mahsulot sota olishi uchun kyc_status APPROVED
    const kyc_status = 'APPROVED';

    const user = await prisma.user.create({
      data: {
        phone,
        password_hash,
        full_name,
        role,
        region,
        tin_or_passport,
        farm_or_company_name: farm_or_company_name || null,
        kyc_status,
        wallet_available: 0,
        wallet_escrow: 0,
        rating: 5.0,
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
        full_name: user.full_name,
        kyc_status: user.kyc_status,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...safeUser } = user;
    return res.status(201).json({ user: safeUser, token });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Ro\'yxatdan o\'tishda xatolik yuz berdi' });
  }
});

// Kirish (Parol yoki OTP: 1111)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, otp } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefon raqamini kiriting' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ error: 'Bunday telefon raqamli foydalanuvchi topilmadi' });
    }

    // OTP simulyatsiyasi: agar otp kiritilgan bo'lsa va u 1111 bo'lsa, yoki parol to'g'ri bo'lsa
    let isValid = false;
    if (otp && (otp === '1111' || otp === 1111)) {
      isValid = true;
    } else if (password) {
      isValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Parol yoki SMS OTP (1111) noto\'g\'ri' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
        full_name: user.full_name,
        kyc_status: user.kyc_status,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...safeUser } = user;
    return res.json({ user: safeUser, token });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Tizimga kirishda xatolik yuz berdi' });
  }
});

// Joriy foydalanuvchi profili
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }
    const { password_hash: _, ...safeUser } = user;
    return res.json(safeUser);
  } catch (err: any) {
    return res.status(500).json({ error: 'Profilni yuklashda xatolik' });
  }
});

// Demo endpointlar real rejimda yopiq
router.get('/demo-users', async (_req: Request, res: Response) => {
  return res.json([]);
});

export default router;

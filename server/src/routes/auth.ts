import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import prisma from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sendVerificationEmail } from '../services/email.js';
import { JWT_SECRET, AUTO_APPROVE_KYC } from '../config.js';
import { cleanText, normalizePhone, PUBLIC_ROLES } from '../utils/validate.js';

import {fulfillmentFields} from '../utils/fulfillment.js';
const router = Router();
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId: string) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Kodni tekshiradi; noto'g'ri urinishlarni hisoblaydi (brute-force'dan himoya)
async function checkCode(email: string, code: string): Promise<boolean> {
  const record = await prisma.emailVerification.findFirst({
    where: { email, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });
  if (!record) return false;
  const attempt = await prisma.emailVerification.updateMany({
    where: { id: record.id, attempts: { lt: MAX_CODE_ATTEMPTS }, expires_at: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  return attempt.count === 1 && record.code === code;
}

// 1. Emailga tasdiqlash kodini yuborish
router.post('/send-verification-code', async (req: Request, res: Response) => {
  try {
    const cleanEmail = cleanText(req.body?.email, 200).toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: "Email manzili formati noto'g'ri" });
    }

    const existing = await prisma.user.findFirst({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Ushbu email bilan allaqachon hisob ochilgan. Tizimga kiring.' });
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailVerification.deleteMany({ where: { email: cleanEmail } });
    await prisma.emailVerification.create({ data: { email: cleanEmail, code, expires_at: expiresAt } });

    const result = await sendVerificationEmail(cleanEmail, code);
    if (!result.success) {
      await prisma.emailVerification.deleteMany({ where: { email: cleanEmail } });
      return res.status(503).json({ error: result.message });
    }

    return res.json({ success: true, message: result.message, dev_code: result.dev_code });
  } catch (err) {
    console.error('Send verification code error:', err);
    return res.status(500).json({ error: 'Tasdiqlash kodini yuborishda xatolik yuz berdi' });
  }
});

// 2. Kodni oldindan tekshirish (ro'yxatdan o'tish ekranida qadam sifatida)
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const email = cleanText(req.body?.email, 200).toLowerCase();
    const code = cleanText(req.body?.code, 10);
    if (!email || !code) return res.status(400).json({ error: 'Email va tasdiqlash kodini kiriting' });

    if (!(await checkCode(email, code))) {
      return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri yoki muddati tugagan" });
    }
    return res.json({ success: true, verified: true });
  } catch (err) {
    console.error('Verify code error:', err);
    return res.status(500).json({ error: 'Kodni tekshirishda xatolik yuz berdi' });
  }
});

// 3. Ro'yxatdan o'tish
router.post('/register', async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const phone = normalizePhone(b.phone);
    const email = cleanText(b.email, 200).toLowerCase();
    const password = String(b.password ?? '');
    const full_name = cleanText(b.full_name, 120);
    const role = String(b.role ?? '');
    const region = cleanText(b.region, 120);
    let district:string|null=null;try{district=fulfillmentFields({district:b.district}).district||null;}catch(e){return res.status(400).json({error:(e as Error).message});}

    if (!phone) return res.status(400).json({ error: "Telefon raqami noto'g'ri (+998 XX XXX XX XX)" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Email manzili noto'g'ri" });
    if (password.length < 8) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo'lishi kerak" });
    if (full_name.length < 2) return res.status(400).json({ error: 'Ism-familiyani kiriting' });
    if (!region) return res.status(400).json({ error: 'Hududni kiriting' });
    // MUHIM: ADMIN roli ommaviy ro'yxatdan o'tish orqali berilmaydi
    if (!PUBLIC_ROLES.includes(role)) return res.status(400).json({ error: "Noto'g'ri rol tanlandi" });

    const tin = cleanText(b.tin_or_passport, 30);
    if ((role === 'FARMER' || role === 'BUYER_B2B' || role === 'COURIER') && tin.length < 5) {
      return res.status(400).json({ error: 'STIR yoki pasport raqamini kiriting' });
    }

    if (!(await checkCode(email, cleanText(b.verification_code, 10)))) {
      return res.status(400).json({ error: "Email tasdiqlash kodi noto'g'ri yoki eskirgan. Kodni qayta so'rang." });
    }

    if (await prisma.user.findUnique({ where: { phone } })) {
      return res.status(400).json({ error: "Ushbu telefon raqami allaqachon ro'yxatdan o'tgan" });
    }
    if (await prisma.user.findFirst({ where: { email } })) {
      return res.status(400).json({ error: "Ushbu email manzil allaqachon ro'yxatdan o'tgan" });
    }

    // Xaridorlar darhol faol; fermer va kuryer admin tekshiruvidan o'tadi (AUTO_APPROVE_KYC=true bo'lsa — darhol)
    const needsKyc = role === 'FARMER' || role === 'COURIER';
    const kyc_status = !needsKyc || AUTO_APPROVE_KYC ? 'APPROVED' : 'PENDING';

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerification.deleteMany({
        where: { email, code: cleanText(b.verification_code, 10), expires_at: { gt: new Date() }, attempts: { lte: MAX_CODE_ATTEMPTS } },
      });
      if (consumed.count !== 1) throw new Error('CODE');
      return tx.user.create({
        data: {
          phone,
          email,
          password_hash,
          full_name,
          role,
          region,
          district,
          tin_or_passport: tin || `ID-${Date.now()}`,
          farm_or_company_name: cleanText(b.farm_or_company_name, 160) || null,
          kyc_status,
        },
      });
    });

    const { password_hash: _, ...safeUser } = user;
    return res.status(201).json({ user: safeUser, token: signToken(user.id) });
  } catch (err: any) {
    if (err?.message === 'CODE') return res.status(400).json({ error: "Tasdiqlash kodi eskirgan yoki ishlatilgan" });
    if (err?.code === 'P2002') return res.status(409).json({ error: "Telefon yoki email allaqachon ro'yxatdan o'tgan" });
    console.error('Register error:', err);
    return res.status(500).json({ error: "Ro'yxatdan o'tishda xatolik yuz berdi" });
  }
});

// 4. Kirish (telefon yoki email + parol). Test OTP/orqa eshik YO'Q.
router.post('/login', async (req: Request, res: Response) => {
  try {
    const identifier = cleanText(req.body?.phone || req.body?.email, 200);
    const password = String(req.body?.password ?? '');
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Telefon/email va parolni kiriting' });
    }

    const phone = normalizePhone(identifier);
    const user = await prisma.user.findFirst({
      where: { OR: [...(phone ? [{ phone }] : []), { email: identifier.toLowerCase() }] },
    });

    // Foydalanuvchi bor-yo'qligini oshkor qilmaymiz
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid) {
      return res.status(401).json({ error: "Telefon/email yoki parol noto'g'ri" });
    }

    const { password_hash: _, ...safeUser } = user;
    return res.json({ user: safeUser, token: signToken(user.id) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Tizimga kirishda xatolik yuz berdi' });
  }
});

// 5. Joriy foydalanuvchi profili
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const { password_hash: _, ...safeUser } = user;
    return res.json(safeUser);
  } catch {
    return res.status(500).json({ error: 'Profilni yuklashda xatolik' });
  }
});

export default router;

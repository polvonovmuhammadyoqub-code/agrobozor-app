import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { cleanText, positiveInt } from '../utils/validate.js';
const router = Router();
const PREMIUM_FEE = 50000;
// Premium: to'lov yechiladigan balansdan olinadi (bepul emas). Platforma hisobiga o'tadi.
router.post('/upgrade-premium', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const updated = await prisma.$transaction(async (tx) => {
            let admin = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
            if (!admin) {
                admin = await tx.user.create({
                    data: {
                        phone: '+998712000000',
                        email: 'system@agrobozor.uz',
                        password_hash: '$2a$10$Defau1tAgroBozorP1atformAdminHashKeyNotForLoginDirect1y',
                        full_name: 'AgroBozor Platforma',
                        role: 'ADMIN',
                        region: 'Toshkent',
                        tin_or_passport: 'SYSTEM',
                        kyc_status: 'APPROVED',
                    },
                    select: { id: true },
                });
            }
            const paid = await tx.user.updateMany({
                where: { id: userId, is_premium: false, wallet_available: { gte: PREMIUM_FEE } },
                data: { wallet_available: { decrement: PREMIUM_FEE }, is_premium: true },
            });
            if (paid.count !== 1)
                throw new Error('DENIED');
            await tx.user.update({ where: { id: admin.id }, data: { wallet_available: { increment: PREMIUM_FEE } } });
            await tx.transaction.create({ data: { user_id: userId, amount: -PREMIUM_FEE, type: 'PREMIUM_SUBSCRIPTION' } });
            await tx.transaction.create({ data: { user_id: admin.id, amount: PREMIUM_FEE, type: 'PREMIUM_SUBSCRIPTION' } });
            return tx.user.findUnique({ where: { id: userId } });
        });
        const { password_hash: _, ...safeUser } = updated;
        return res.json({ message: 'Premium maqomi faollashtirildi!', user: safeUser });
    }
    catch (err) {
        if (err?.message === 'DENIED') {
            return res.status(400).json({ error: `Premium ${PREMIUM_FEE.toLocaleString()} so'm turadi. Hamyoningizda mablag' yetarli emas yoki Premium allaqachon faol.` });
        }
        console.error('Upgrade premium error:', err);
        return res.status(500).json({ error: 'Premiumga ulanishda xatolik yuz berdi' });
    }
});
router.get('/wallet-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { wallet_available: true, wallet_escrow: true, is_premium: true },
        });
        const transactions = await prisma.transaction.findMany({
            where: { user_id: userId },
            include: { order: { select: { id: true, status: true, product: { select: { title: true } } } } },
            orderBy: { created_at: 'desc' },
            take: 200,
        });
        return res.json({
            wallet_available: user?.wallet_available || 0,
            wallet_escrow: user?.wallet_escrow || 0,
            is_premium: user?.is_premium || false,
            transactions,
        });
    }
    catch {
        return res.status(500).json({ error: 'Hamyon tarixini yuklashda xatolik' });
    }
});
// Pul yechish SO'ROVI: balansdan ayriladi, admin kartaga qo'lda o'tkazadi (haqiqiy payout API ulangunga qadar)
router.post('/withdraw', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const amount = positiveInt(req.body?.amount);
        const card = cleanText(req.body?.card_or_account, 40).replace(/\s/g, '');
        if (!amount)
            return res.status(400).json({ error: "Noto'g'ri summa kiritildi" });
        if (amount < 10000)
            return res.status(400).json({ error: "Minimal yechish summasi: 10 000 so'm" });
        if (!/^\d{16}$/.test(card))
            return res.status(400).json({ error: "Karta raqami 16 xonali bo'lishi kerak" });
        const updated = await prisma.$transaction(async (tx) => {
            // Atomik: balans yetarli bo'lsagina ayiriladi (ikki marta yechib bo'lmaydi)
            const r = await tx.user.updateMany({
                where: { id: userId, wallet_available: { gte: amount } },
                data: { wallet_available: { decrement: amount } },
            });
            if (r.count !== 1)
                throw new Error('FUNDS');
            await tx.transaction.create({ data: { user_id: userId, amount: -amount, type: 'WITHDRAWAL_REQUEST' } });
            return tx.user.findUnique({ where: { id: userId }, select: { wallet_available: true } });
        });
        return res.json({
            message: `${amount.toLocaleString()} so'm yechish so'rovi qabul qilindi. 1–2 ish kuni ichida ${card.slice(0, 4)} **** **** ${card.slice(-4)} kartaga o'tkaziladi.`,
            wallet_available: updated.wallet_available,
        });
    }
    catch (err) {
        if (err?.message === 'FUNDS')
            return res.status(400).json({ error: "Hisobingizda mablag' yetarli emas" });
        return res.status(500).json({ error: "Mablag' yechishda xatolik" });
    }
});
export default router;

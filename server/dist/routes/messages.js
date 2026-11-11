import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
const person = { id: true, full_name: true, region: true, role: true };
const summary = {
    product: {
        select: { id: true, title: true, image_url: true, is_active: true },
    },
    buyer: { select: person },
    seller: { select: person },
};
const participant = (id) => ({
    OR: [{ buyer_id: id }, { seller_id: id }],
});
const sendLimit = rateLimit({
    windowMs: 60000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Xabarlar juda tez yuborilmoqda. Bir oz kuting.' },
});
router.get('/unread-count', async (req, res) => {
    try {
        const count = await prisma.message.count({
            where: {
                sender_id: { not: req.user.id },
                read_at: null,
                conversation: participant(req.user.id),
            },
        });
        res.json({ count });
    }
    catch {
        res.status(500).json({ error: 'Yangi xabarlarni tekshirishda xatolik' });
    }
});
router.get('/conversations', async (req, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: participant(req.user.id),
            orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
            take: 100,
            include: {
                ...summary,
                messages: {
                    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                    take: 1,
                },
                _count: {
                    select: {
                        messages: {
                            where: { sender_id: { not: req.user.id }, read_at: null },
                        },
                    },
                },
            },
        });
        res.json(conversations);
    }
    catch (err) {
        console.error('Conversation list error:', err);
        res.status(500).json({ error: 'Suhbatlarni yuklashda xatolik' });
    }
});
router.post('/conversations', sendLimit, async (req, res) => {
    try {
        const id = typeof req.body?.product_id === 'string' ? req.body.product_id : '';
        if (!id)
            return res.status(400).json({ error: 'Mahsulotni tanlang' });
        const product = await prisma.product.findUnique({
            where: { id },
            include: { farmer: { select: { kyc_status: true } } },
        });
        if (!product)
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        if (product.farmer_id === req.user.id)
            return res
                .status(400)
                .json({ error: 'O‘zingizga xabar yoza olmaysiz' });
        const key = {
            product_id: id,
            buyer_id: req.user.id,
            seller_id: product.farmer_id,
        };
        const existing = await prisma.conversation.findUnique({
            where: { product_id_buyer_id_seller_id: key },
            include: summary,
        });
        if (existing)
            return res.json(existing);
        if (!product.is_active || product.farmer.kyc_status !== 'APPROVED')
            return res.status(404).json({ error: 'Mahsulot sotuvda mavjud emas' });
        const conversation = await prisma.conversation.upsert({
            where: { product_id_buyer_id_seller_id: key },
            create: key,
            update: {},
            include: summary,
        });
        res.status(201).json(conversation);
    }
    catch (err) {
        if (err?.code === 'P2002') {
            const existing = await prisma.conversation.findFirst({
                where: { product_id: req.body.product_id, buyer_id: req.user.id },
                include: summary,
            });
            if (existing)
                return res.json(existing);
        }
        console.error('Create conversation error:', err);
        res.status(500).json({ error: 'Suhbatni ochishda xatolik' });
    }
});
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const conversation = await prisma.conversation.findFirst({
            where: { id: req.params.id, ...participant(req.user.id) },
            include: summary,
        });
        if (!conversation)
            return res.status(404).json({ error: 'Suhbat topilmadi' });
        const before = typeof req.query.before === 'string' ? req.query.before : undefined;
        if (before &&
            !(await prisma.message.findFirst({
                where: { id: before, conversation_id: conversation.id },
                select: { id: true },
            }))) {
            return res.status(400).json({ error: 'Xabar sahifasi noto‘g‘ri' });
        }
        const messages = await prisma.message.findMany({
            where: { conversation_id: conversation.id },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: 50,
            ...(before ? { cursor: { id: before }, skip: 1 } : {}),
        });
        const now = new Date();
        const unread = messages
            .filter((m) => m.sender_id !== req.user.id && !m.read_at)
            .map((m) => m.id);
        if (unread.length)
            await prisma.message.updateMany({
                where: { id: { in: unread }, read_at: null },
                data: { read_at: now },
            });
        res.json({
            conversation,
            next_cursor: messages.length === 50 ? messages[messages.length - 1].id : null,
            messages: messages
                .reverse()
                .map((m) => (unread.includes(m.id) ? { ...m, read_at: now } : m)),
        });
    }
    catch (err) {
        console.error('Read messages error:', err);
        res.status(500).json({ error: 'Xabarlarni yuklashda xatolik' });
    }
});
router.post('/conversations/:id/messages', sendLimit, async (req, res) => {
    try {
        const conversation = await prisma.conversation.findFirst({
            where: { id: req.params.id, ...participant(req.user.id) },
            select: { id: true },
        });
        if (!conversation)
            return res.status(404).json({ error: 'Suhbat topilmadi' });
        const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
        const clientId = req.body?.client_id || randomUUID();
        if (!body || body.length > 2000)
            return res
                .status(400)
                .json({ error: 'Xabar 1–2000 belgidan iborat bo‘lishi kerak' });
        if (typeof clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientId))
            return res
                .status(400)
                .json({ error: 'Xabar identifikatori noto‘g‘ri' });
        const message = await prisma.$transaction(async (tx) => {
            const existing = await tx.message.findUnique({
                where: { client_id: clientId },
            });
            if (existing) {
                if (existing.conversation_id !== conversation.id ||
                    existing.sender_id !== req.user.id ||
                    existing.body !== body)
                    throw new Error('CONFLICT');
                return existing;
            }
            const sent = await tx.message.create({
                data: {
                    client_id: clientId,
                    conversation_id: conversation.id,
                    sender_id: req.user.id,
                    body,
                },
            });
            await tx.conversation.update({
                where: { id: conversation.id },
                data: { updated_at: sent.created_at },
            });
            return sent;
        });
        res.status(201).json(message);
    }
    catch (err) {
        if (err?.code === 'P2002' || err?.message === 'CONFLICT')
            return res
                .status(409)
                .json({
                error: 'Xabar yuborish holatini tekshiring va qayta urinib ko‘ring',
            });
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Xabarni yuborishda xatolik' });
    }
});
export default router;

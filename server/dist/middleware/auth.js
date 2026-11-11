import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { JWT_SECRET } from '../config.js';
// Token faqat foydalanuvchi ID'sini ishonchli deb hisoblaymiz; rol va KYC har safar bazadan olinadi.
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Avtorizatsiya talab qilinadi (Token yo'q)" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded?.id)
            throw new Error('bad token');
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, phone: true, role: true, full_name: true, kyc_status: true },
        });
        if (!user) {
            return res.status(401).json({ error: 'Foydalanuvchi topilmadi. Qaytadan kiring.' });
        }
        req.user = user;
        next();
    }
    catch {
        return res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan token" });
    }
};
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Ruxsat berilmagan amal (Role cheklovi)' });
        }
        next();
    };
};

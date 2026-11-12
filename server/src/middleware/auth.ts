import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { JWT_SECRET } from '../config.js';

export interface AuthUser {
  id: string;
  phone: string;
  role: string;
  full_name: string;
  kyc_status: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Token faqat foydalanuvchi ID'sini ishonchli deb hisoblaymiz; rol va KYC har safar bazadan olinadi.
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Avtorizatsiya talab qilinadi (Token yo'q)" });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id?: string };
    if (typeof decoded?.id !== 'string' || !decoded.id) throw new Error('bad token');
    userId = decoded.id;
  } catch {
    return res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan token" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, role: true, full_name: true, kyc_status: true },
    });
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi. Qaytadan kiring.' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication database error:', err);
    return res.status(503).json({ error: 'Server vaqtincha ishlamayapti. Qayta urinib ko‘ring.' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ruxsat berilmagan amal (Role cheklovi)' });
    }
    next();
  };
};

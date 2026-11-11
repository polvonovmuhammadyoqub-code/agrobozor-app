import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import disputeRoutes from './routes/disputes.js';
import reviewRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const app = express();
app.set('trust proxy', 1); // Vercel proxy ortida haqiqiy IP uchun
app.use(helmet({ contentSecurityPolicy: false }));
// Frontend va API bir domenda (Vercel) — CORS faqat aniq ko'rsatilgan manzillar uchun
const allowed = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : false }));
app.use(express.json({ limit: '100kb' }));
// Brute-force va spamdan himoya
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." } });
const codeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
    message: { error: "Kod so'rovlari limiti tugadi. Keyinroq urinib ko'ring." } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-code', authLimiter);
app.use('/api/auth/send-verification-code', codeLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
// Eski mijoz kodi uchun qisqa yo'l: /api/price-recommendation
app.use('/api/price-recommendation', (req, res, next) => {
    req.url = '/price-recommendation' + (req.url === '/' ? '' : req.url);
    productRoutes(req, res, next);
});
app.use('/api/orders', orderRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Productionda Vite build qilingan statik fayllarni xizmat ko'rsatish
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
        if (err) {
            res.status(200).send('AgroBozor API ishlamoqda.');
        }
    });
});

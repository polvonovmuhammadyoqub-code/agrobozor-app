import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import disputeRoutes from './routes/disputes.js';
import reviewRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import uploadRoutes from './routes/uploads.js';
import prisma from './db.js';
import { paymeHandler } from './services/payme.js';
import { paymentOptions } from './services/payment-options.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : Number(process.env.TRUST_PROXY || 0)); // Vercel proxy ortida haqiqiy IP uchun
app.use(helmet({ contentSecurityPolicy: false }));
// Frontend va API bir domenda (Vercel) — CORS faqat aniq ko'rsatilgan manzillar uchun
const allowed = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : false }));
app.use((req,_res,next)=>{if(req.body && typeof req.body === 'object')(req as any)._body=true;next();});

// Payme requires JSON-RPC errors with HTTP 200, including malformed JSON.
app.post('/api/payments/payme', express.json({ limit: '100kb' }), paymeHandler);
app.use('/api/payments/payme', ((err, _req, res, _next) => {
  res.status(200).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } });
}) as ErrorRequestHandler);
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

app.get('/api/payments/options', (_req, res) => res.json(paymentOptions()));
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
app.use('/api/messages', messageRoutes);
app.use('/api/uploads',uploadRoutes);
app.get('/api/ready',async(_req,res)=>{try{await prisma.$queryRaw`SELECT 1`;res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API manzili topilmadi' });
});

// Productionda Vite build qilingan statik fayllarni xizmat ko'rsatish
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  if(path.extname(req.path)) return void res.status(404).end();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(503).json({error:'Ilova vaqtincha mavjud emas'});
    }
  });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed') {
    return void res.status(400).json({ error: "JSON formati noto'g'ri" });
  }
  if (err?.type === 'entity.too.large') {
    return void res.status(413).json({ error: "So'rov hajmi juda katta" });
  }
  console.error('Unhandled request error:', err);
  res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
};
app.use(errorHandler);

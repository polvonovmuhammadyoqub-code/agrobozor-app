import express from 'express';
import cors from 'cors';
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

app.use(cors());
app.use(express.json());

// Marshrutlarni ro'yxatdan o'tkazish (/api va / uchun universal)
function registerRoutes(prefix: string) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/products`, productRoutes);

  // Maxsus talab qilingan: /price-recommendation to'g'ridan-to'g'ri chaqiruv
  app.use(`${prefix}/price-recommendation`, (req, res, next) => {
    req.url = '/price-recommendation' + (req.url === '/' ? '' : req.url);
    productRoutes(req, res, next);
  });

  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/disputes`, disputeRoutes);
  app.use(`${prefix}/reviews`, reviewRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/users`, userRoutes);

  app.get(`${prefix}/health`, (_req, res) => {
    res.json({
      status: 'ok',
      message: 'AgroBozor Backend API faol ishlamoqda',
      timestamp: new Date().toISOString(),
    });
  });
}

// 1. Standart /api marshrutlari
registerRoutes('/api');
// 2. Vercel Serverless Function /api ni qirqib yuborishi mumkin bo'lgan holatlar uchun fallback
registerRoutes('');

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

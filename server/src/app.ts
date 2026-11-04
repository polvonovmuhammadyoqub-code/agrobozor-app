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

// Marshrutlar
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Maxsus talab qilingan: /api/price-recommendation to'g'ridan-to'g'ri chaqiruv
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
  res.json({
    status: 'ok',
    message: 'AgroBozor Backend API faol ishlamoqda',
    timestamp: new Date().toISOString(),
  });
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

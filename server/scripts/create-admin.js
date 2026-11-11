// Platforma ADMIN hisobini yaratadi (escrow daromadi ham shu hisobga yig'iladi).
// Ishlatish:  ADMIN_PHONE=+998901234567 ADMIN_EMAIL=admin@agrobozor.uz ADMIN_PASSWORD='kuchli-parol' npm run create-admin
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const phone = (process.env.ADMIN_PHONE || '').replace(/\D/g, '');
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (phone.length !== 12 || !phone.startsWith('998') || !email || password.length < 12) {
  console.error('ADMIN_PHONE (+998XXXXXXXXX), ADMIN_EMAIL va ADMIN_PASSWORD (kamida 12 belgi) kerak.');
  process.exit(1);
}

try {
  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existing) {
    console.log('ADMIN allaqachon mavjud:', existing.phone);
  } else {
    const u = await prisma.user.create({
      data: {
        phone: '+' + phone,
        email,
        password_hash: await bcrypt.hash(password, 12),
        full_name: 'AgroBozor Admin',
        role: 'ADMIN',
        region: 'Toshkent',
        tin_or_passport: 'ADMIN',
        kyc_status: 'APPROVED',
      },
    });
    console.log('ADMIN yaratildi:', u.phone);
  }
} finally {
  await prisma.$disconnect();
}

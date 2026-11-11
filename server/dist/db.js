import { PrismaClient } from '@prisma/client';
// Serverless muhitda har chaqiruvda yangi ulanish ochilmasligi uchun global nusxa.
// DATABASE_URL — PostgreSQL (Neon / Supabase). SQLite Vercel'da ishlamaydi: ma'lumot yo'qoladi.
const g = globalThis;
const prisma = g.__prisma ?? new PrismaClient();
if (!g.__prisma)
    g.__prisma = prisma;
export default prisma;

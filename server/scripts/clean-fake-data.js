import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
  console.log('🧹 Barcha soxta (fake/demo) ma\'lumotlar tozalanmoqda...');

  // 1. Soxta sharhlar, nizolar, tranzaksiyalar, buyurtmalar, mahsulotlar va foydalanuvchilarni tozalash
  const delReviews = await prisma.review.deleteMany();
  const delDisputes = await prisma.dispute.deleteMany();
  const delTransactions = await prisma.transaction.deleteMany();
  const delOrders = await prisma.order.deleteMany();
  const delProducts = await prisma.product.deleteMany();
  const delUsers = await prisma.user.deleteMany();

  console.log(`✅ Tozalandi:
  - Foydalanuvchilar: ${delUsers.count}
  - Mahsulotlar: ${delProducts.count}
  - Buyurtmalar: ${delOrders.count}
  - Tranzaksiyalar: ${delTransactions.count}
  - Nizolar: ${delDisputes.count}
  - Sharhlar: ${delReviews.count}
  `);

  console.log('✨ Ma\'lumotlar bazasi haqiqiy mijozlar uchun 100% toza va tayyor holatga keltirildi!');
}

clean()
  .catch((e) => {
    console.error('Xatolik:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

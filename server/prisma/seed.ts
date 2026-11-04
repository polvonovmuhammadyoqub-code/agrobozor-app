import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Ma\'lumotlar bazasini tozalash va to\'ldirish (Seeding)... ---');

  // Tozalash
  await prisma.review.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // 1. Foydalanuvchilar
  const farmerApproved = await prisma.user.create({
    data: {
      phone: '+998901112233',
      password_hash: passwordHash,
      full_name: 'Anvar Qodirov (Bog\'bon Fermer)',
      role: 'FARMER',
      region: 'Toshkent viloyati, Parkent tumani',
      tin_or_passport: 'AA1234567',
      farm_or_company_name: 'Parkent Zamin Bog\'lari MCHJ',
      kyc_status: 'APPROVED',
      is_premium: true,
      wallet_available: 4500000,
      wallet_escrow: 950000,
      rating: 4.9,
    },
  });

  const farmerPending = await prisma.user.create({
    data: {
      phone: '+998902223344',
      password_hash: passwordHash,
      full_name: 'Rustam Karimov (Yangi Issiqxona)',
      role: 'FARMER',
      region: 'Surxondaryo viloyati, Denov tumani',
      tin_or_passport: 'AB7654321',
      farm_or_company_name: 'Surxon Pomidor Agro',
      kyc_status: 'PENDING',
      is_premium: false,
      wallet_available: 0,
      wallet_escrow: 0,
      rating: 5.0,
    },
  });

  const buyerB2C = await prisma.user.create({
    data: {
      phone: '+998903334455',
      password_hash: passwordHash,
      full_name: 'Dilshod Aliyev',
      role: 'BUYER_B2C',
      region: 'Toshkent shahri, Chilonzor tumani',
      tin_or_passport: 'AC9876543',
      kyc_status: 'APPROVED',
      wallet_available: 250000,
      wallet_escrow: 0,
      rating: 5.0,
    },
  });

  const buyerB2B = await prisma.user.create({
    data: {
      phone: '+998904445566',
      password_hash: passwordHash,
      full_name: 'Bekzod Rahimov',
      role: 'BUYER_B2B',
      region: 'Toshkent shahri, Mirobod tumani',
      tin_or_passport: 'STIR308945123',
      farm_or_company_name: 'Rayhon Milliy Taomlar Restorani',
      kyc_status: 'APPROVED',
      wallet_available: 1800000,
      wallet_escrow: 0,
      rating: 4.8,
    },
  });

  const courier = await prisma.user.create({
    data: {
      phone: '+998905556677',
      password_hash: passwordHash,
      full_name: 'Jasur Shodiyev (Tezkor Kuryer)',
      role: 'COURIER',
      region: 'Toshkent shahri',
      tin_or_passport: 'AD4455667',
      kyc_status: 'APPROVED',
      wallet_available: 360000,
      wallet_escrow: 0,
      rating: 4.95,
    },
  });

  const admin = await prisma.user.create({
    data: {
      phone: '+998909998877',
      password_hash: passwordHash,
      full_name: 'Bosh Administrator',
      role: 'ADMIN',
      region: 'Bosh Ofis, Toshkent',
      tin_or_passport: 'ADMIN001',
      kyc_status: 'APPROVED',
      wallet_available: 0,
      wallet_escrow: 0,
      rating: 5.0,
    },
  });

  console.log('✅ Foydalanuvchilar yaratildi');

  // 2. Mahsulotlar (Kategoriyalar: 'MEVALAR', 'SABZAVOTLAR', 'POLIZ', 'SUT_GOSHT', 'DON')
  const productsData = [
    {
      farmer_id: farmerApproved.id,
      title: 'Parkent Qora Kishmish Uzumi (Saralangan)',
      category: 'MEVALAR',
      price_per_kg: 24000,
      available_quantity_kg: 850,
      min_order_kg: 2,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 soat oldin
      image_url: 'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=800&q=80',
      region: 'Toshkent viloyati, Parkent',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Samarqand Qizil Olmasi (Besh yulduz)',
      category: 'MEVALAR',
      price_per_kg: 18000,
      available_quantity_kg: 1200,
      min_order_kg: 5,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 24),
      image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80',
      region: 'Samarqand viloyati, Toyloq',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Surxondaryo Shirin Qizil Tarvuzi (Dala uzilgan)',
      category: 'POLIZ',
      price_per_kg: 4500,
      available_quantity_kg: 3500,
      min_order_kg: 10,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 6),
      image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
      region: 'Surxondaryo viloyati, Termiz',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Mirzacho\'l Qovuni (Katta gulobi)',
      category: 'POLIZ',
      price_per_kg: 8000,
      available_quantity_kg: 1500,
      min_order_kg: 5,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 12),
      image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
      region: 'Jizzax viloyati, Do\'stlik',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Surxon Pushti Pomidori (Eksportbop)',
      category: 'SABZAVOTLAR',
      price_per_kg: 16000,
      available_quantity_kg: 900,
      min_order_kg: 3,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 2), // bugun uzilgan
      image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
      region: 'Surxondaryo viloyati, Denov',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Zarafshon Sariq Sabzisi (Oshbop shirali)',
      category: 'SABZAVOTLAR',
      price_per_kg: 5000,
      available_quantity_kg: 4000,
      min_order_kg: 10,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 48),
      image_url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80',
      region: 'Navoiy viloyati, Karmana',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Qashqadaryo Yangi Yosh Go\'shti (Qo\'y go\'shti)',
      category: 'SUT_GOSHT',
      price_per_kg: 95000,
      available_quantity_kg: 350,
      min_order_kg: 3,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 5),
      image_url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80',
      region: 'Qashqadaryo viloyati, Kitob',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Xorazm Laziz Guruchi (Devzira saralangan)',
      category: 'DON',
      price_per_kg: 28000,
      available_quantity_kg: 2200,
      min_order_kg: 5,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 72),
      image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
      region: 'Xorazm viloyati, Bog\'ot',
      is_active: true,
    },
    {
      farmer_id: farmerApproved.id,
      title: 'Farg\'ona Quva Anori (Shirin qizil donali)',
      category: 'MEVALAR',
      price_per_kg: 32000,
      available_quantity_kg: 600,
      min_order_kg: 2,
      harvest_date: new Date(Date.now() - 1000 * 60 * 60 * 18),
      image_url: 'https://images.unsplash.com/photo-1541344999736-83eca272f6fc?auto=format&fit=crop&w=800&q=80',
      region: 'Farg\'ona viloyati, Quva',
      is_active: true,
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({ data: p });
    createdProducts.push(prod);
  }

  console.log(`✅ ${createdProducts.length} ta mahsulot yaratildi`);

  // 3. Buyurtmalar (Har xil holatda: PAID_IN_ESCROW, CONFIRMED_BY_FARMER, IN_TRANSIT, DELIVERED, COMPLETED, DISPUTED)
  
  // Buyurtma 1: COMPLETED (B2C xaridor, to'liq yakunlangan)
  const order1Qty = 10;
  const order1ProductAmount = order1Qty * createdProducts[0].price_per_kg; // 240,000
  const order1Delivery = 15000;
  const order1Total = order1ProductAmount + order1Delivery; // 255,000
  const order1 = await prisma.order.create({
    data: {
      buyer_id: buyerB2C.id,
      farmer_id: farmerApproved.id,
      courier_id: courier.id,
      product_id: createdProducts[0].id,
      quantity_kg: order1Qty,
      product_total_amount: order1ProductAmount,
      delivery_fee: order1Delivery,
      total_paid: order1Total,
      platform_commission: order1ProductAmount * 0.10,
      farmer_payout: order1ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'CLICK',
      status: 'COMPLETED',
      delivery_address: 'Toshkent sh., Chilonzor 9-mavze, 14-uy, 22-xonadon',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
  });

  // Tranzaksiyalar - order1 uchun
  await prisma.transaction.create({
    data: {
      order_id: order1.id,
      user_id: buyerB2C.id,
      amount: order1Total,
      type: 'ESCROW_HOLD',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
  });
  await prisma.transaction.create({
    data: {
      order_id: order1.id,
      user_id: farmerApproved.id,
      amount: order1ProductAmount * 0.90,
      type: 'ESCROW_RELEASE_FARMER',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20),
    },
  });
  await prisma.transaction.create({
    data: {
      order_id: order1.id,
      user_id: courier.id,
      amount: 12000,
      type: 'COURIER_FEE',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20),
    },
  });
  await prisma.transaction.create({
    data: {
      order_id: order1.id,
      user_id: admin.id,
      amount: (order1ProductAmount * 0.10) + 3000,
      type: 'PLATFORM_COMMISSION',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20),
    },
  });

  // Sharh - order1
  await prisma.review.create({
    data: {
      order_id: order1.id,
      reviewer_id: buyerB2C.id,
      target_user_id: farmerApproved.id,
      rating: 5,
      comment: 'Uzumlari ajoyib, juda shirin va yangi uzilgan ekan! Rahmat sizga!',
    },
  });

  // Buyurtma 2: PAID_IN_ESCROW (Fermer tasdiqlashi kutilmoqda)
  const order2Qty = 25;
  const order2ProductAmount = order2Qty * createdProducts[4].price_per_kg; // 25 * 16,000 = 400,000
  const order2 = await prisma.order.create({
    data: {
      buyer_id: buyerB2C.id,
      farmer_id: farmerApproved.id,
      product_id: createdProducts[4].id,
      quantity_kg: order2Qty,
      product_total_amount: order2ProductAmount,
      delivery_fee: 15000,
      total_paid: order2ProductAmount + 15000,
      platform_commission: order2ProductAmount * 0.10,
      farmer_payout: order2ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'PAYME',
      status: 'PAID_IN_ESCROW',
      delivery_address: 'Toshkent sh., Yunusobod 4-mavze, 12-uy',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
  });

  await prisma.transaction.create({
    data: {
      order_id: order2.id,
      user_id: buyerB2C.id,
      amount: order2ProductAmount + 15000,
      type: 'ESCROW_HOLD',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
  });

  // Buyurtma 3: CONFIRMED_BY_FARMER (Kuryer olishi mumkin bo'lgan buyurtma)
  const order3Qty = 50;
  const order3ProductAmount = order3Qty * createdProducts[1].price_per_kg; // 50 * 18,000 = 900,000
  const order3 = await prisma.order.create({
    data: {
      buyer_id: buyerB2C.id,
      farmer_id: farmerApproved.id,
      product_id: createdProducts[1].id,
      quantity_kg: order3Qty,
      product_total_amount: order3ProductAmount,
      delivery_fee: 15000,
      total_paid: order3ProductAmount + 15000,
      platform_commission: order3ProductAmount * 0.10,
      farmer_payout: order3ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'UZCARD',
      status: 'CONFIRMED_BY_FARMER',
      delivery_address: 'Toshkent sh., Yashnobod tumani, Parkent ko\'chasi 45',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
  });

  // Buyurtma 4: IN_TRANSIT (Kuryer yo'lda)
  const order4Qty = 15;
  const order4ProductAmount = order4Qty * createdProducts[6].price_per_kg; // 15 * 95,000 = 1,425,000
  await prisma.order.create({
    data: {
      buyer_id: buyerB2B.id,
      farmer_id: farmerApproved.id,
      courier_id: courier.id,
      product_id: createdProducts[6].id,
      quantity_kg: order4Qty,
      product_total_amount: order4ProductAmount,
      delivery_fee: 15000,
      total_paid: order4ProductAmount + 15000,
      platform_commission: order4ProductAmount * 0.10,
      farmer_payout: order4ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'INVOICE_B2B',
      status: 'IN_TRANSIT',
      delivery_address: 'Toshkent sh., Mirobod tumani, Nukus ko\'chasi 18 (Rayhon restorani)',
      delivery_schedule: 'Har dushanba va payshanba soat 08:00 gacha',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
  });

  // Buyurtma 5: DELIVERED (Xaridor tasdiqlashi kutilmoqda - Escrowda pul muzlatilgan)
  const order5Qty = 8;
  const order5ProductAmount = order5Qty * createdProducts[8].price_per_kg; // 8 * 32,000 = 256,000
  await prisma.order.create({
    data: {
      buyer_id: buyerB2C.id,
      farmer_id: farmerApproved.id,
      courier_id: courier.id,
      product_id: createdProducts[8].id,
      quantity_kg: order5Qty,
      product_total_amount: order5ProductAmount,
      delivery_fee: 15000,
      total_paid: order5ProductAmount + 15000,
      platform_commission: order5ProductAmount * 0.10,
      farmer_payout: order5ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'HUMO',
      status: 'DELIVERED',
      delivery_address: 'Toshkent sh., Mirzo Ulug\'bek tumani, Qorasuv 1, 15-uy',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
  });

  // Buyurtma 6: DISPUTED (Nizo ochilgan - Admin arbitrajida ko'rish uchun!)
  const order6Qty = 30;
  const order6ProductAmount = order6Qty * createdProducts[5].price_per_kg; // 30 * 5,000 = 150,000
  const order6 = await prisma.order.create({
    data: {
      buyer_id: buyerB2C.id,
      farmer_id: farmerApproved.id,
      courier_id: courier.id,
      product_id: createdProducts[5].id,
      quantity_kg: order6Qty,
      product_total_amount: order6ProductAmount,
      delivery_fee: 15000,
      total_paid: order6ProductAmount + 15000,
      platform_commission: order6ProductAmount * 0.10,
      farmer_payout: order6ProductAmount * 0.90,
      courier_payout: 12000,
      platform_logistics_margin: 3000,
      payment_method: 'CLICK',
      status: 'DISPUTED',
      delivery_address: 'Toshkent sh., Sergeli tumani, Yangi Choshtepa 44-uy',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 16),
    },
  });

  await prisma.dispute.create({
    data: {
      order_id: order6.id,
      buyer_id: buyerB2C.id,
      reason: 'Sabzilarning bir qismi (taxminan 10 kg) namlikdan chirigan holatda yetib keldi. Iltimos tekshirib bering.',
      evidence_image_url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80',
      status: 'OPEN',
      refund_amount: 50000,
    },
  });

  console.log('✅ Namunaviy buyurtmalar va nizolar yaratildi');
  console.log('--- Database Seeding Muvaffaqiyatli Yakunlandi! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

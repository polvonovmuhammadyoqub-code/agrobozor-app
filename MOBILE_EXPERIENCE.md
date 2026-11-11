# Mobil foydalanish va yozishmalar

## Foydalanuvchi oqimlari

- Mehmon: ikkita katta tugma — Kirish / Ro‘yxatdan o‘tish; alohida bozorni ko‘rish havolasi.
- Fermer: hisobga kirishi bilan o‘z mahsulotlari, yangi buyurtmalar, ko‘rish statistikasi va balans.
  Mahsulot qo‘shish, narx/qoldiq/nomni tahrirlash, sotuvni to‘xtatish va statistikani ochish mumkin.
- Logist: hisobga kirishi bilan olishga tayyor buyurtmalar. Buyurtmani olgach faol yetkazuvlarga o‘tadi.
  Profil tasdiqlanmagan bo‘lsa olish tugmasi faol emas; mavjud buyurtmalar avtomatik yangilanadi.
- Xaridor: bozor, mobil qidiruv, kategoriyalar va hudud/narx filtrlari.
- Pastki menyu: rolga mos kabinet/buyurtmalar, bozor, xabarlar va hamyon.

## Mahsulot va muloqot

Mahsulot rasmi yoki nomi batafsil oynani ochadi. Sotuvchi ismi/xo‘jaligi,
hududi va bosiladigan telefon raqami ko‘rsatiladi. Pasport/STIR, email, parol
va balans mahsulotning ommaviy javobiga kirmaydi.

Pastda “Sotuvchiga yozish” orqali mahsulotga bog‘langan suhbat boshlanadi.
Ikki tomon yozishadi. Xabarlar bazada saqlanadi; qayta kirganda davom etadi.
O‘qilgan belgisi, yangi xabarlar hisoblagichi va eski xabarlar sahifalashi mavjud.
Yuborish xatosida matn saqlanadi; qayta yuborishda idempotency identifikatori ishlatiladi.
Qoralama shu brauzer sessiyasida saqlanadi. Faol suhbat 5 soniyada yangilanadi;
bu versiyada websocket va push bildirishnomalari qo‘shilmagan.

## Statistika va maxfiylik

Ko‘rishlar faqat hisobga kirgan odamning mahsulotni ochishi bilan yoziladi.
Bir odam bir mahsulot uchun bir marta sanaladi; fermerning o‘z ko‘rishi sanalmaydi.
Faqat egasi/admin ko‘ruvchilar ismi va hududini oladi; ko‘ruvchi telefoni yoki
hujjatlari yuborilmaydi. Eng ko‘p ko‘rilgan mahsulot kabinetda ajratiladi.
Sotilgan kg yakunlangan buyurtmalardan; daromad fermerning haqiqiy payout
tranzaksiyalaridan hisoblanadi, shu jumladan qisman qaytarishdan qolgan ulush.

## Tekshiruv

- Server va mijoz TypeScript/Vite buildi.
- Haqiqiy PostgreSQL bilan 20 ta server testi, 0 skip.
- Chromium bilan 8 ta brauzer testi, jumladan ikki alohida mobil sessiyada
  haqiqiy xaridor xabari, fermer javobi va ko‘ruvchilar statistikasi.
- 375px ekranda onboarding, bozor, kabinet, logist va chat tekshirilgan.
- Kutubxona auditida 0 zaiflik.

## Ishga tushirish

`ProductView`, `Conversation`, `Message` jadvallari qo‘shilgan. Mavjud bazada
`server/prisma/mobile-experience.sql` ni bir marta qo‘llash yoki tegishli baza
sozlamalari bilan `npm run db:push` bajarish kerak. Keyin `npm run build` va
deploy. SQL mavjud jadvallardagi yozuvlarni o‘zgartirmaydi va o‘chirmaydi.
Production baza va jonli hosting ushbu ishda yangilanmagan.

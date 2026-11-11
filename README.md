# 🌾 AgroBozor — fermerdan to‘g‘ridan-to‘g‘ri xaridorga (MVP)

React + Vite (client) · Express + Prisma (server) · PostgreSQL · Vercel.

## Pul oqimi (escrow)

```
Buyurtma  -> PENDING_PAYMENT   (ombor band qilinadi, pul YO‘Q)
To‘lov    -> PAID_IN_ESCROW    (pul platformada; fermerning "escrow" balansida ko‘rinadi)
Fermer    -> CONFIRMED_BY_FARMER  (yoki rad etadi -> xaridorga 100% qaytadi)
Kuryer    -> IN_TRANSIT -> DELIVERED
Xaridor "Qabul qildim" (yoki 24 soat jimlik) -> COMPLETED
          -> fermerga 90%, kuryerga 12 000, platformaga 10% + 3 000
Nizo (24 soat ichida) -> admin: to‘liq / qisman qaytarish / fermer foydasiga
```
Barcha hisob-kitob `server/src/services/settlement.ts` ichida; har holatda
`xaridorga + fermerga + kuryerga + platformaga = to‘langan summa` bo‘ladi.

## ⚠️ Hozirgi cheklov: haqiqiy to‘lov yo‘q
`PAYMENT_MODE=mock` — test to‘lov (haqiqiy pul harakatlanmaydi). Production'da standart `disabled`.
Click/Payme merchant API (redirect + webhook) `server/src/services/payment.ts` ga ulanadi.
B2B uchun `INVOICE_B2B`: admin bank o‘tkazmasini `/api/admin/orders/:id/confirm-payment` bilan tasdiqlaydi.

## Ishga tushirish

1. **PostgreSQL** oching (bepul: neon.tech yoki supabase.com).
2. `server/.env.example` → `server/.env` (lokal) yoki Vercel → Environment Variables:
   `DATABASE_URL`, `DIRECT_URL` (Supabase: ikkalasi ham Connect bo‘limida), `JWT_SECRET` (32+ belgi), `RESEND_API_KEY`, `EMAIL_FROM`, `PAYMENT_MODE`.
3. Lokal:
   ```bash
   npm install
   npm run db:push            # jadvallarni yaratadi
   ADMIN_PHONE=+998901234567 ADMIN_EMAIL=admin@agrobozor.uz ADMIN_PASSWORD='kamida-12-belgi' npm run create-admin
   npm run server             # terminal 1 (5000)
   npm run client             # terminal 2 (3000)
   ```
4. Vercel: repo'ni import qiling, o‘zgaruvchilarni kiriting. `npm run build` faqat kodni yig‘adi; bazani o‘zgartirmaydi. Jadvallarni alohida `npm run db:push` bilan tayyorlang.
   Admin yaratish uchun bir marta lokal kompyuterdan (Vercel `DATABASE_URL` bilan) `npm run create-admin` ni ishga tushiring.

## Rollar va tekshiruv
- Ommaviy ro‘yxatdan faqat: FARMER, BUYER_B2C, BUYER_B2B, COURIER. **ADMIN faqat `create-admin` orqali.**
- Fermer/kuryer admin tasdig‘idan (KYC) o‘tmaguncha mahsuloti ko‘rinmaydi / buyurtma ololmaydi.
  Demo uchun `AUTO_APPROVE_KYC=true`.

## Keyingi qadamlar (MVP'dan keyin)
Click/Payme integratsiyasi · rasm yuklash (Vercel Blob/Cloudinary) · SMS (Eskiz/Playmobile) · Sentry.

## Admin yaratish (kompyutersiz) — Supabase SQL Editor
```sql
insert into "User" (id, phone, email, password_hash, full_name, role, region, tin_or_passport, kyc_status)
values (gen_random_uuid()::text, '+998901234567', 'admin@agrobozor.uz',
        crypt('KAMIDA-12-BELGILI-PAROL', gen_salt('bf', 10)),
        'AgroBozor Admin', 'ADMIN', 'Toshkent', 'ADMIN', 'APPROVED');
```
(`create extension if not exists pgcrypto;` kerak bo‘lsa avval shuni ishga tushiring.)

## Tekshiruv va yangilash

Node.js 22 tavsiya etiladi. `npm ci` lockfile bo‘yicha kutubxonalarni o‘rnatadi.

```bash
npm run build
npm test
npm audit
```

`npm test` odatiy holatda son qiymatlari tekshiruvini bajaradi; baza testlari
`TEST_DATABASE_URL` bo‘lmasa **skip** qilinadi. To‘liq integratsiya testi uchun
alohida, faqat testga tegishli PostgreSQL bazasini tayyorlang:

```bash
export TEST_DATABASE_URL="postgresql://.../agrobozor_test"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm run db:push
npm test
```

Haqiqiy ulanish manzilini kiriting. Testlar ishlab turgan
production bazasida bajarilmasin: ular foydalanuvchi, mahsulot va pul oqimi
ma’lumotlarini yaratadi va o‘z yozuvlarini tozalaydi.

Brauzer testlari (oldin `npm run build`):

```bash
npm exec --workspace client -- playwright install chromium
npm run test:browser --workspace client
```

Tizimdagi Chromium uchun `CHROMIUM_PATH=/usr/bin/chromium` berish mumkin.
Brauzer testlari frontend API javoblarini mock qiladi; server integratsiya
testlari esa haqiqiy PostgreSQL bilan bajariladi. GitHub Actions ikkalasini,
build va kutubxonalar auditini avtomatik ishga tushiradi.

### Mavjud bazaga yangilash

Sharhlar uchun `(order_id, reviewer_id, target_user_id)` unikal indeksi qo‘shildi.
Mavjud bazada avval `server/prisma/review-uniqueness.sql` ni ko‘rib, qo‘llang.
Takroriy sharhlar bo‘lsa, indeks yaratish xato beradi; yozuvlarni qo‘lda ko‘rib
chiqing. Skript hech qanday sharhni o‘chirmaydi. Keyin `npm run db:push`.

### Yetkazib berish va to‘lov

Savatdagi har bir mahsulot alohida `Order`: fermer uni alohida rad etishi,
xaridor bekor qilishi va boshqa kuryer olib ketishi mumkin. Shuning uchun har
bir buyurtmaga **15 000 so‘m** logistika haqi hisoblanadi (bir fermerning ikki
mahsulotiga ham ikki haq). Frontend va backend hisoblari bir xil. Fermer
bo‘yicha bitta yetkazish haqiga qaytish uchun umumiy jo‘natma modeli va birga
bekor qilish/yetkazish jarayoni kerak.

Qisman to‘lov muvaffaqiyatsiz tugasa, savat qayta buyurtma yaratmasligi uchun
bo‘shatiladi; yaratilgan buyurtmalar `Buyurtmalar` bo‘limida to‘lov kutib turadi.
Muvaffaqiyat xabari bunday buyurtmalarni to‘langan deb ko‘rsatmaydi.

Lokal serverdagi scheduler har daqiqada ishlaydi. Vercel serverless muhitida
doimiy interval ishlamaydi; muddatli tozalash va avtomatik yakunlash hozir
`GET /api/orders` chaqirilganda bajariladi. Aniq vaqt talab qilinsa, alohida
himoyalangan rejalashtirilgan vazifa/cron qo‘shish kerak.

## Mobil kabinetlar, statistika va yozishmalar

Mehmon avval “Kirish” va “Ro‘yxatdan o‘tish” ekranini ko‘radi. Bozorni hisob
kiritmasdan ham ko‘rib chiqish mumkin. Kirgandan so‘ng fermerning mahsulotlari,
logistning tayyor buyurtmalari, xaridorning esa bozori ochiladi. Mobil pastki
menyudan kabinet, bozor, xabarlar va hamyonga o‘tish mumkin.

Fermer mahsulot nomi, narxi, qoldig‘i va sotuv holatini kabinetda tahrirlaydi.
Eskirgan qoldiq bilan saqlash urinishida server yangilashni talab qiladi.

Mahsulot rasmi yoki nomiga bosilganda mahsulot oynasi ochiladi. Sotuvchining
ismi, xo‘jaligi, hududi va telefon raqami ko‘rsatiladi; pasport/STIR, email,
parol va balans bu ommaviy javobga kiritilmaydi. “Sotuvchiga yozish” orqali
hisobga kirgan foydalanuvchi fermer bilan mahsulot bo‘yicha suhbat boshlaydi.

Yozishmalar bazada saqlanadi, faqat ikki ishtirokchi uchun ochiq. Xabar yuborish
limiti, o‘qilgan belgilari, eski xabarlarni sahifalash va takroriy yuborishdan
himoya mavjud. Faol suhbat har 5 soniyada, ro‘yxat 10 soniyada va menyudagi yangi
xabarlar belgisi 15 soniyada yangilanadi. Bu versiyada push bildirishnomalari yo‘q.

Statistika mahsulot oynasini ochgan **hisobga kirgan noyob odamlar**ni sanaydi;
o‘z mahsulotini ko‘rgan fermer sanalmaydi. Faqat mahsulot egasi yoki admin
ko‘ruvchilar ismi/hududi, buyurtmalar, sotilgan kg va yakunlangan savdodan
fermer daromadini ko‘radi. Mehmonlar sanalmaydi; avvalgi ko‘rishlar tiklanmaydi.

**Mavjud serverni yangilash:** yangi `ProductView`, `Conversation`, `Message`
jadvallari kerak. `server/prisma/mobile-experience.sql` ni bir marta qo‘llang
(yoki moslashtirilgan muhitda `npm run db:push`), so‘ng build/deploy qiling.
SQL yangi jadvallar va indekslarni qo‘shadi, mavjud yozuvlarni o‘chirmaydi.
Eski sharhlar unikal indeksi uchun yuqoridagi alohida ko‘rsatma ham amal qiladi.

To‘liq testlar uchun `TEST_DATABASE_URL` bilan server va brauzer testlarini
ishga tushiring. Haqiqiy chat testi ikki mobil sessiyada xaridor xabari, fermer
javobi, o‘qish huquqlari va fermerning ko‘ruvchilar statistikasi oqimini tekshiradi.

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
   `DATABASE_URL`, `JWT_SECRET` (32+ belgi), `RESEND_API_KEY`, `EMAIL_FROM`, `PAYMENT_MODE`.
3. Lokal:
   ```bash
   npm install
   npm run db:push            # jadvallarni yaratadi
   ADMIN_PHONE=+998901234567 ADMIN_EMAIL=admin@agrobozor.uz ADMIN_PASSWORD='kamida-12-belgi' npm run create-admin
   npm run server             # terminal 1 (5000)
   npm run client             # terminal 2 (3000)
   ```
4. Vercel: repo'ni import qiling, o‘zgaruvchilarni kiriting. `npm run build` jadvallarni avtomatik yangilaydi.
   Admin yaratish uchun bir marta lokal kompyuterdan (Vercel `DATABASE_URL` bilan) `npm run create-admin` ni ishga tushiring.

## Rollar va tekshiruv
- Ommaviy ro‘yxatdan faqat: FARMER, BUYER_B2C, BUYER_B2B, COURIER. **ADMIN faqat `create-admin` orqali.**
- Fermer/kuryer admin tasdig‘idan (KYC) o‘tmaguncha mahsuloti ko‘rinmaydi / buyurtma ololmaydi.
  Demo uchun `AUTO_APPROVE_KYC=true`.

## Keyingi qadamlar (MVP'dan keyin)
Click/Payme integratsiyasi · rasm yuklash (Vercel Blob/Cloudinary) · SMS (Eskiz/Playmobile) · avtomatik testlar · Sentry.

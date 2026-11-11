# AgroBozor

Fermer, xaridor va logist uchun mobilga mos bozor. React/Vite frontend va
Express/Prisma API bitta Node.js 22+ serverda ishlaydi; baza PostgreSQL.

Standart `PAYMENT_MODE=direct`: xaridor pulni fermerga bevosita beradi, aynan
buyurtma egasi fermer tushgan to'liq summani tasdiqlaydi. Platforma pul qabul
qilmaydi, escrow yoki avtomatik refund va'da qilmaydi. Yetkazish haqini fermer
logistga qo'lda beradi. Click/Payme sozlanmagan holatda faol usul emas.
Eski B2B platforma bank-to'lovi direct rejimda yopilgan.

## Hosting

To'liq sozlash, xavfsiz migratsiya va chiqarish tartibi:
[docs/HOSTING.md](docs/HOSTING.md).
Branchlarni solishtirish va tekshiruv dalillari:
[docs/RELEASE_CHECK.md](docs/RELEASE_CHECK.md).

```sh
npm ci --include=dev
# .env.example asosida server maxfiy sozlamalarini kiriting.
# Bo'sh baza uchun db:migrate; mavjud baza uchun avval HOSTING.md ni o'qing.
npm run db:migrate
npm run build
npm start
```

Hosting build: `npm ci --include=dev && npm run build`. Start: `npm start`.
Server hosting bergan PORTni ishlatadi. Build/start migratsiyani avtomatik bajarmaydi.
Production bazasida `db:push` yoki reset ishlatmang. Maxfiy .env fayllarini commit qilmang.

## Funksiyalar

- Mobil kirish/ro'yxat, rolga mos kabinet va bozor navigatsiyasi.
- Fermer mahsulotlari, ko'rish/sotuv statistikasi, shaxsiy sotuvchi-xaridor chati.
- Supabase rasm yuklash, beshta birlik, tuman/manzil va ixtiyoriy GPS.
- Atomik ombor rezervi; buyurtma narxi, birligi va olib ketish manzili saqlanadi.
- Logist buyurtmani oladi; xaridorning maxfiy 4 xonali PIN'i bilan yetkazadi.
- Admin KYC va sabab qayd etilgan PIN tiklash/yetkazishni tiklash amallari.

## Lokal ishlab chiqish va test

Development uchun `NODE_ENV=development` va alohida lokal baza ishlating.
`npm run server` va `npm run client` ikki terminalda ishlaydi.
Avtomatik testlar faqat alohida `TEST_DATABASE_URL` bilan bajarilsin; production
ulanishini testga bermang. Baza bo'lmasa DB testlari skipped deb hisoblanadi.

```sh
npm test
npm exec --workspace client -- playwright install chromium
npm run test:browser --workspace client
npm audit --audit-level=moderate
```

Admin faqat `npm run create-admin` orqali yaratiladi; fermer/logist KYC sini admin
tasdiqlaydi. `AUTO_APPROVE_KYC` va `ALLOW_DEV_CODES` productionda false qoladi.
Payme merchant shartnomasi va haqiqiy sandbox tekshiruvi alohida bosqich:
[PAYMENTS.md](PAYMENTS.md). Oldingi audit hujjatlari tarixiy kontekst;
hosting uchun yuqoridagi yangi qo'llanma asosiy manba.

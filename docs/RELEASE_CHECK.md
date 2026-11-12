# Hosting release tekshiruvi

## Solishtirilgan holat

| Branch | Tekshirilgan commit | main bilan farq (main/branch commitlari) |
|---|---|---|
| main | 2f1cd27 | — |
| fix/repository-audit | cc52cc0 | 0 / 4 |
| phase-1 | d998a31 | 1 / 14 |

Audit va phase-1 bir-biridan 5 / 14 commit farq qiladi; 109 faylda farq bor.
`release/hosting-ready` audit asosida yaratilgan, phase-1 tarixi merge qilinib
konfliktlar qo'lda hal qilingan. Main'ga merge va hostingga deploy qilinmagan.
Bu branch uchun Vercel avtomatik deploymenti vercel.json da o'chirilgan.

## Yakuniy tuzatishlar

- Auditdagi truthful checkout, ombor rezervi, chat, ko'rish statistikasi, mobil
  kabinetlar va public seller privacy saqlandi. Phase-1 rasm yuklash, gallery,
  birliklar, tuman/manzil/GPS va yetkazish PIN'i birlashtirildi.
- Birlikka mos tekshiruv: dona/banka/quti butun son; kg/litr uchta kasr xonasigacha.
  0.1 + 0.2 qoldiq xatosi, noto'g'ri birlik yorliqlari va birliklar aralashgan
  narx tavsiyasi tuzatildi. Narx tavsiyasi mahsulot turi va birligini hisobga oladi.
- Buyurtmada narx, nom, birlik va olib ketish manzili snapshot saqlanadi. E'lon
  tahriri eski buyurtma shartlarini almashtirmaydi. Buyurtmali e'lon birligi
  almashtirilmaydi; yangi birlik uchun yangi e'lon kerak.
- Savatdagi har buyurtma mustaqil logistika haqi oladi; umumiy summa yig'indiga teng.
  Atomik rezerv narx/birlik/minimal miqdor o'zgarganda eski narxda sotishni rad etadi.
- Direct to'lov faqat buyurtma fermeri tomonidan aniq summa bilan bir marta
  tasdiqlanadi. Escrow/hamyon krediti yo'q; eski B2B platforma bank endpointi
  direct rejimda yopiq. Sozlanmagan Click/Payme faol variant emas.
- PIN faqat xaridorga beriladi; biriktirilgan logist tekshiradi, parallel xato
  urinishlar ham 5 dan oshmaydi. Admin PIN reset/override amali audit jurnaliga
  yoziladi. Boshqa logist olgan buyurtma takror olinmaydi.
- Upload fermerga tegishli path, exact storage origin, MIME va size bilan
  tekshiriladi. Product-images public; nizo hujjatlari private va vaqtli signed URL.
  Rasm siqilib yuborilayotganda e'lonni saqlash bloklanadi.
- Server HOST/PORT, graceful shutdown, liveness/readiness va static frontend bilan
  bitta Node hostingga tayyorlandi. Build DBni o'zgartirmaydi. Additive Prisma
  migration va mavjud DB uchun alohida baseline qadami qo'shildi.

## Bajarilgan tekshiruvlar

Lokal Node v24.22.1; CI Node 22 qilib sozlangan. Productionga ulanilmadi.
Alohida lokal PostgreSQL `agrobozor_release_test` ishlatildi.

| Tekshiruv | Natija |
|---|---|
| npm ci --include=dev (yoziladigan lokal npm cache bilan) | O'tdi |
| npm run build (server TypeScript + client TypeScript/Vite) | O'tdi |
| npm test | 35 o'tdi, 0 failed, 0 skipped |
| Playwright/Chromium | 14 o'tdi, 0 skipped |
| Main/audit/phase-1/bo'sh DB migratsiyasi | 4 alohida schema; balans, order, qoldiq, chat va mavjud PIN saqlandi; qayta deploy ham o'tdi |
| Prisma migrate diff, test DB -> final schema | Farq yo'q |
| npm start, NODE_ENV=production, PORT=5187 | Frontend + build JS asset + /api/health + /api/ready 200; yo'q asset 404; faqat DIRECT_FARMER |
| npm audit --audit-level=moderate | 0 vulnerabilities |

Backend testlari direct orderni yaratishdan fermer tasdig'i, logist olish,
PIN bilan yetkazish va yakunlashgacha haqiqiy test DBda tekshiradi; hamyonlar
oshmasligi tekshiriladi. Brauzer sinovida ikki haqiqiy mobil sessiya test DB orqali
chat yozadi va statistika tekshiradi. UI upload testi signed PUTni mock qiladi;
haqiqiy Supabase bucketiga yozilmagan. Qolgan UI holatlarining bir qismi API
fixturelari bilan tekshirilgan; ularni haqiqiy provayder sinovi deb hisoblamang.

## Operator bajarishi kerak

- Hosting tanlash, maxfiy envlar, doimiy PostgreSQL va backup.
- Haqiqiy Supabase bucket/limitlar va service-role bilan upload smoke sinovi.
- Resend tasdiqlangan domen va email yetib kelishini haqiqiy manzil bilan tekshirish.
- Production nusxasida migratsiyani sinash, keyin operator boshqaruvida baseline/migrate.
- Admin yaratish, fermer/logist KYC tasdig'i, HTTPSda staging/pilot sinovi.
- Payme/Click jonli merchant shartnomasi yo'q; bu direct rejimni to'smaydi,
  lekin haqiqiy onlayn to'lov tayyor deb hisoblanmaydi.

Aniq buyruqlar va tartib: [HOSTING.md](HOSTING.md).

# AgroBozor tekshiruv hisoboti

Tekshirilgan repository: https://github.com/polvonovmuhammadyoqub-code/agrobozor-app
Boshlang‘ich commit: `2f1cd2775f1c43a2ff29fe8ead160d28ac369605`
Sana: 2026-11-11

## Tuzatilgan holatlar

- Pul yechishni rad etish/tasdiqlash: parallel so‘rovlar bir yozuvni takroran qayta ishlamaydi. Qaytarish tranzaksiyasi va balans bir atomik operatsiyada.
- Savat to‘lovi: muvaffaqiyatsiz yoki qisman bajarilgan to‘lov endi escrow muvaffaqiyati deb ko‘rsatilmaydi. Buyurtmalar to‘lov kutgan holda saqlanadi.
- Logistika: mustaqil bekor qilinadigan va turli kuryerlar oladigan har bir Order o‘z yetkazish haqiga ega. Bir fermerning ikki mahsulotiga ham 2 × 15 000 so‘m hisoblanadi. UI va server hisobi bir xil.
- Savat miqdori: mavjud qoldiqdan oshirilmaydi; noto‘g‘ri/cheksiz qiymatlar rad etiladi. Mahsulot summalari server kabi yaxlitlanadi.
- Checkout: null elementlar, yo‘q ID, takroriy mahsulotlar, 50 tadan ko‘p element va PostgreSQL Int chegarasidan katta summalar tekshiriladi.
- Narx/miqdor tekshiruvi: `12kg` kabi noto‘g‘ri qiymatlar endi `12` sifatida qabul qilinmaydi. Pul uchun kasr va integer overflow rad etiladi.
- Email kodi: parallel so‘rovlarda urinish limiti atomik; ro‘yxatdan o‘tishda kod foydalanuvchi yaratish bilan bitta tranzaksiyada sarflanadi.
- Sharhlar: buyurtma/yozuvchi/qabul qiluvchi bo‘yicha unikal indeks, qat’iy 1–5 butun reyting, sharh yaratish va o‘rtacha reytingni yangilash bitta tranzaksiyada.
- Kuryer maxfiyligi: buyurtmani olmaguncha xaridorning aniq manzili va telefoni berilmaydi.
- Yashirin mahsulot: admin ruxsati JWT ichidagi eskirgan role maydonidan emas, joriy baza rolidan olinadi.
- B2B bank tasdig‘i: faqat INVOICE_B2B va muddati tugamagan buyurtmalarga qo‘llanadi.
- Mock to‘lovdagi xotira keshi olib tashlandi: DB tranzaksiyasi muvaffaqiyatsiz tugaganda qayta urinish bloklanmaydi. Takroriy escrow bazadagi holat orqali cheklanadi.
- Lokal `.env`: server, config, Prisma va admin skripti sozlamalarni o‘z vaqtida oladi. Root `db:push` server workspace ichida ishlaydi.
- HTTP: noto‘g‘ri JSON uchun 400, katta body uchun 413, noma’lum API uchun 404 JSON; ichki xato tafsilotlari mijozga berilmaydi.
- Autentifikatsiya: baza vaqtinchalik ishlamasa 401 emas, 503; frontend vaqtinchalik xatoda tokenni o‘chirmaydi. Eski profil so‘rovi logout/login holatini qayta yozmaydi.
- Vercel catch-all query parametrlari va `req.query` sinxronlashtiriladi; mahsulot filtrlari saqlanadi.
- Marketplace: yuklash xatosi bo‘sh bozor sifatida ko‘rsatilmaydi; qayta urinish mavjud; kechikkan eski javob yangi filtr natijasini almashtirmaydi.
- UI: mobil navbar kenglikdan chiqmaydi; yangilangan mahsulot/buyurtma/sharh/nizo ro‘yxatlari qayta yuklanadi; hisob almashganda savat va ichki sahifa holati tozalanadi.
- Build: baza sxemasini avtomatik o‘zgartirmaydi. Eskirgan tracked `server/dist` qayta yig‘ildi, yetishmagan scheduler buildi qo‘shildi.
- Vite 5 → 6.4.6 yangilandi; kutubxonalar auditi 2 zaiflikdan 0 ga tushdi.
- GitHub Actions: PostgreSQL bilan integratsiya testi, build, Chromium brauzer testi va npm audit qo‘shildi.

## Tekshiruv dalillari

- `npm ci`: toza o‘rnatish.
- `npm run build`: server TypeScript va client TypeScript/Vite buildi.
- `TEST_DATABASE_URL=... npm test`: 15 ta test, 0 xato, 0 skip; alohida haqiqiy PostgreSQL bazasida.
- `npm run test:browser --workspace client`: Chromium’da 4 ta test, 0 xato. Frontend testlarida API javoblari mock qilingan.
- `npm audit`: 0 zaiflik.
- `git diff --check`: whitespace xatosi yo‘q.

Server testlari parallel pul yechish, tasdiqlash/rad etish poygasi, oversell,
takroriy to‘lov/bekor qilish/yakunlash, escrow summasi saqlanishi, sharhlar,
email kodi limiti, login/registratsiya, B2B muddati, rezervni qaytarish,
avtomatik yakunlash, nizoni hal qilish, maxfiylik va Vercel filtrlarini qamraydi.

## Qo‘llash va qolgan cheklovlar

Mavjud bazada avval `server/prisma/review-uniqueness.sql` ni ko‘rib qo‘llang:
takroriy sharhlar bo‘lsa indeks yaratish xavfsiz ravishda xato beradi; skript
ma’lumot o‘chirmaydi. Keyin README ko‘rsatmasi bilan `npm run db:push`.
Production bazasi bu tekshiruvda o‘zgartirilmadi.

Click/Payme haqiqiy integratsiyasi hali mavjud emas. Testlar mock to‘lov bilan
bajarildi. Email provayderi va real bank o‘tkazmalari jonli tekshirilmadi.
Vercel’da doimiy scheduler ishlamaydi: muddatli vazifalar hozir buyurtmalar
ro‘yxati ochilganda ham bajariladi; qat’iy jadval uchun alohida cron kerak.
Vercel deployi bajarilmadi. Barcha ehtimoliy xatolar yo‘qligi kafolatlanmaydi.

Kod `fix/repository-audit` branchida saqlanadi. Mobil kabinetlar, mahsulot
statistikasi va shaxsiy yozishmalar bo‘yicha ko‘rsatmalar README’da.

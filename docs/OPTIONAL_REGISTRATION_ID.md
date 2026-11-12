# Ixtiyoriy pasport/STIR — Render yangilash tartibi

Asos: `release/hosting-ready` / `c26bd9c`. Yangi branch:
`fix/optional-registration-id`. Production baza va Render sozlamalariga tegilmadi.

Barcha to'rtta ommaviy rolda formadagi maydon saqlangan:
**Pasport yoki STIR (ixtiyoriy)**. Bo'sh/whitespace/berilmagan qiymat NULL;
AUTO-/ID- yaratilmaydi. Kiritilgan qiymat uchun avvalgi server normalizatsiyasi
va fermer/biznes/logist uchun kamida 5 belgi tekshiruvi saqlanadi.
Xaridor uchun ilgari bo'lmagan format cheklovi qo'shilmagan.
Email kodi, parol, rollar, KYC/admin tasdig'i va ruxsatlar o'zgartirilmagan.
Admin yaratish skripti ham soxta hujjat o'rniga NULL yozadi.

Profil javobi va TypeScript user turlari nullni qabul qiladi; mavjud profil
interfeysi pasportni ko'rsatmaydi. Admin ro'yxati va hisob-fakturada qiymat yo'q
bo'lsa “Ko‘rsatilmagan” chiqadi; mavjud hujjat maskasi saqlanadi.

## Migratsiya → Render deploy

1. PRni ko'rib chiqing. Production backup/snapshot oling va imkon qadar uning
   nusxasida migratsiyani sinang. Render Auto-Deploy yoqilgan bo'lsa, merge paytida
   muddatidan oldin deploy boshlanmasligi uchun vaqtincha o'chiring.
2. Tasdiqlangandan keyingina PRni `release/hosting-ready` ga merge qiling.
   Hozirgi ishda merge/deploy bajarilmagan.
3. Yangi commitni checkout qilgan himoyalangan release muhitida kerakli
   DATABASE_URL/DIRECT_URL bilan quyidagini bajaring. Kalitlarni chat/log/Gitga yozmang:

   ```sh
   npm ci --include=dev
   npm run db:status
   npm run db:migrate
   npm run db:status
   ```

   Oldingi 0001/0002 migratsiyalari bajarilgan bo'lsa faqat
   `0003_optional_registration_id` qo'llanadi. U faqat
   `ALTER TABLE "User" ALTER COLUMN "tin_or_passport" DROP NOT NULL` bajaradi.
   Eski qiymatlar, jumladan eski AUTO-/ID- qiymatlari o'zgarmaydi yoki o'chirilmaydi.
   Eski baza migrate tarixi bo'lmasa avval [HOSTING.md](HOSTING.md) baseline tartibini
   operator tekshirishi kerak; ko'r-ko'rona baseline yoki reset qilmang.
4. Migratsiya muvaffaqiyatli tugagach Renderda aynan yangi release commit uchun
   **Manual Deploy → Deploy latest commit** qiling.
   Build: `npm ci --include=dev && npm run build`; start: `npm start`.
5. `/api/health`, `/api/ready`, eski akkauntga kirish, har bir rolda hujjat bilan/usiz
   ro'yxatdan o'tish va haqiqiy email kodini tekshiring. Fermer/logist uchun KYC
   avvalgidek admin tasdig'ini kutishi kerak.

Migration eski kod bilan ham mos: u faqat majburiylikni yumshatadi. Rollback uchun
NOT NULLni qayta qo'yishga urinmang: yangi NULL yozuvlar mavjud bo'lishi mumkin.
Productionda db:push/reset yoki ma'lumotlarni o'chirish talab qilinmaydi.

## Test dalillari

- Server va client TypeScript/Vite build o'tdi.
- Alohida lokal PostgreSQL bazasida 39 test o'tdi, 0 failed, 0 skipped.
  To'rtta rol x hujjat bilan/usiz, omitted/null/empty/whitespace, qiymat validatsiyasi,
  KYC, profil, admin, invoice, login va email kodi himoyasi tekshirildi.
- Main/audit/phase-1/bo'sh bazadan migratsiyalar sinovida eski qiymatlar, balans,
  buyurtma/chat saqlandi; nullable ustunga NULL yozildi, takror migrate o'tdi.
- 22 ta brauzer testi o‘tdi (0 skipped). Mobil ro'yxatdan o'tishning to'rtta rol x ikki holati tekshirildi.
  Bu UI submission sinovlari API fixture bilan; backend ro'yxatdan o'tish esa
  haqiqiy alohida test DBda bajarildi.
- Production/Renderdagi jonli signup/deploy va haqiqiy email yetib kelishi
  tekshirilmadi. Testda email kodi maxsus test bazasiga yozilgan, providerga
  haqiqiy xat yuborilmagan. Production bazasi o'zgartirilmagan.

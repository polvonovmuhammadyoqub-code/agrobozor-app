# 🌾 AgroBozor — O'zbekistonning Ishonchli va Xavfsiz Agro-Savdo Platformasi

**AgroBozor** — O'zbekistondagi fermerlar, bog'bonlar, xaridorlar (B2C & B2B) hamda tezkor logistika kuryerlarini yagona xavfsiz **Escrow to'lov tizimi** ostida birlashtiruvchi zamonaviy real agro-savdo platformasi.

Haqiqiy foydalanuvchilar platformaga kirib, o'z telefon raqamlari orqali ro'yxatdan o'tib, darhol o'z hosillarini sotuvga chiqarishlari (olma, uzum, go'sht, pomidor va h.k.) yoki yangi qishloq xo'jaligi mahsulotlarini sotib olishlari mumkin.

---

## 🚀 Texnik Stek
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend:** Node.js, Express, TypeScript (TSX)
- **Ma'lumotlar bazasi:** Prisma ORM (SQLite / PostgreSQL moslashuvchan qo'llab-quvvatlash bilan)
- **Autentifikatsiya:** JWT Token + bcrypt parollash
- **Deploy:** Vercel (Frontend + Serverless API), Render, Railway yoki VPS

---

## 🌟 Asosiy Imkoniyatlar

1. **Haqiqiy Foydalanuvchilar va Oson E'lon Berish**:
   - Har qanday yangi ro'yxatdan o'tgan foydalanuvchi bir bosishda **"+ Mahsulot qo'shish"** tugmasi orqali o'z mahsulotini sotuvga chiqara oladi.
   - Hech qanday sun'iy to'siq yoki kutishlarsiz, mahsulot darhol Bozorda (Marketplace) paydo bo'ladi.
   - Fermer kabinetida tushgan buyurtmalar va o'z mahsulotlarini boshqarish.

2. **100% Xavfsiz Escrow Tizimi**:
   - Xaridor to'lov qilganda mablag' platformaning xavfsiz Escrow hisobida muzlatiladi.
   - Kuryer mahsulotni yetkazib bergach, xaridor "Qabul qildim" deb tasdiqlaganidan so'nggina pul sotuvchi fermer va kuryer hisobiga o'tkaziladi.

3. **Nizolar Arbitraji (Dispute Resolution)**:
   - Sifatsiz yoki shikastlangan mahsulot yetib kelganda, xaridor fotosurat ilova qilib nizo ochishi mumkin.
   - Bosh admin arbitraj orqali to'liq qaytarish, 50/50 taqsimlash yoki fermer foydasiga qaror qabul qiladi.

4. **B2B Ulgurji Savdo va Rasmiy Hisob-faktura (Invoice)**:
   - Restoran, do'kon va korxonalar uchun rasmiy elektron muhrli B2B Invoice generatsiya qilish va PDF/chop etish.

5. **Aqlli Bozor Narxi Tavsiyasi**:
   - Kategoriya va viloyat bo'yicha bozorning o'rtacha narxini tahlil qilib, sotuvchiga eng maqbul narxni tavsiya qilish.

---

## ☁️ Vercel ga Deploy Qilish

Loyiha Vercel ga 1-bosishda deploy qilish uchun to'liq sozlangan:

### 1-usul: GitHub orqali Vercel ga ulash (Tavsiya etiladi)
1. Ushbu GitHub repozitoriyangizni [Vercel](https://vercel.com) ga import qiling.
2. Vercel loyiha sozlamalarida standart sozlamalar avtomatik aniqlanadi:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `client/dist`
3. **Environment Variables** (Ixtiyoriy, agar PostgreSQL ishlatmoqchi bo'lsangiz):
   - `DATABASE_URL` — Masalan, Neon yoki Supabase PostgreSQL ulanish havolasi: `postgresql://user:password@host/dbname?sslmode=require`
   - `JWT_SECRET` — Maxfiy JWT kalitingiz
4. **Deploy** tugmasini bosing!

> **Eslatma:** Agar `DATABASE_URL` kiritilmasa, loyiha Vercel serverless muhitida xavfsiz SQLite bazasi bilan ishlaydi. Real ishlab chiqarish (production) ma'lumotlarini saqlab qolish uchun bepul [Neon.tech](https://neon.tech) yoki [Supabase](https://supabase.com) PostgreSQL ma'lumotlar bazasini `DATABASE_URL` ga kiritish tavsiya etiladi.

---

## 💻 Mahalliy Kompyuterda Ishga Tushirish

```bash
# 1. Qaramliklarni o'rnatish
npm install

# 2. Ma'lumotlar bazasini yaratish
npm run build:server

# 3. Loyihani to'liq ishga tushirish (Frontend + Backend)
npm run build
npm start
# http://localhost:5000 da ishlaydi

# Yoki development rejimida alohida ishga tushirish:
npm run server  # Terminal 1 da (port 5000)
npm run client  # Terminal 2 da (port 3000)
```

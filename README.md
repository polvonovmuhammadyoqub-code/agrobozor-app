# 🌾 AgroBozor — To'liq Ishlaydigan Full-Stack Agro-Savdo Platformasi

**AgroBozor** — O'zbekistondagi fermerlar, bog'bonlar, xaridorlar (B2C & B2B) hamda tezkor logistika kuryerlarini yagona xavfsiz **Escrow to'lov tizimi** ostida birlashtiruvchi zamonaviy agro-savdo platformasi.

Ilova hech qanday statik/soxta (mock) ma'lumotlarsiz, to'liq **Node.js/Express + Prisma ORM + SQLite** ma'lumotlar bazasi va **React (TypeScript) + Tailwind CSS** frontend bilan to'liq ishlaydigan holda yaratilgan.

---

## 🚀 Texnik Stek
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend:** Node.js, Express, TypeScript (TSX)
- **Ma'lumotlar bazasi:** SQLite + Prisma ORM (to'liq tranzaksiyalar va ACID xususiyatlari bilan)
- **Autentifikatsiya:** JWT Token + bcrypt parollash + SMS OTP simulyatsiyasi (1111)
- **Dizayn uslubi:** To'q yashil (`#1B4D3E`), to'q sariq/amber (`#F59E0B`) va oq ranglar, mobile-first, to'liq o'zbek tilidagi interfeys.

---

## 👥 Tayyor Test Foydalanuvchilari (Demo Rejim)

Platformaning yuqori qismidagi **"Rolni almashtirish"** tugmasi orqali istalgan rolga 1-bosishda o'tish mumkin (Barcha parollar: `123456` yoki OTP `1111`):

| Rol | Ism-familiya | Telefon | Holat / Xususiyat |
| :--- | :--- | :--- | :--- |
| 👨‍🌾 **Fermer (Tasdiqlangan)** | Anvar Qodirov | `+998901112233` | KYC: `APPROVED`, Oltin Premium fermer, Parkent uzumlari |
| 🚜 **Fermer (Kutilmoqda)** | Rustam Karimov | `+998902223344` | KYC: `PENDING`, admin tasdiqlamaguncha sotuv cheklangan |
| 🛒 **Xaridor (B2C)** | Dilshod Aliyev | `+998903334455` | Chakana xarid, Escrow kafolati, sharh qoldirish |
| 🏢 **Xaridor (B2B)** | Bekzod Rahimov | `+998904445566` | "Rayhon" restorani, B2B Invoice, rejalashtirilgan yetkazish |
| 🚚 **Kuryer** | Jasur Shodiyev | `+998905556677` | 12 000 so'm/yetkazuv daromadi, faol yetkazishlar boshqaruvi |
| 🛡️ **Bosh Admin** | Bosh Administrator | `+998909998877` | Real vaqt KPI (GMV, AOV, Komissiya), KYC tasdiqlash, Nizolar arbitraji |

---

## 🔒 Biznes Mantiqi va Escrow Tizimi

1. **Xavfsiz Escrow Buyurtma (`POST /api/orders`)**:
   - Xaridor to'lov qilganda ombordagi qoldiq (`available_quantity_kg`) avtomatik kamaytiriladi.
   - Buyurtma `PAID_IN_ESCROW` statusida yaratiladi.
   - Mahsulot narxining 90% qismi fermerning muzlatilgan `wallet_escrow` hisobiga tushadi.
2. **Buyurtma Zanjiri**:
   - Fermer: "Tasdiqlash" (`CONFIRMED_BY_FARMER`).
   - Kuryer: "Yetkazib berishga olish" (`IN_TRANSIT`), kuryer ID biriktiriladi.
   - Kuryer: "Mijozga yetkazdim" (`DELIVERED`).
3. **Escrowdan Pulni Yechish (`POST /api/orders/:id/complete`)**:
   - Xaridor mahsulotni ko'zdan kechirib, "Qabul qildim, e'tirozim yo'q" tugmasini bosganda:
     - Fermerning `wallet_escrow` balansidan 90% pul yechilib, `wallet_available` (yechib olish mumkin bo'lgan) balansiga o'tkaziladi.
     - Kuryerning `wallet_available` balansiga 12 000 so'm o'tkaziladi.
     - Platforma hisobiga 10% komissiya + 3 000 so'm logistika marjasi yoziladi.
     - Xaridorga 1-5 yulduzli baholash oynasi ochiladi va fermer reytingi qayta hisoblanadi.
4. **Nizolar Arbitraji (`POST /api/disputes`)**:
   - Sifatsiz mahsulot kelsa, xaridor "Shikoyat qilish" tugmasini bosadi va dalil rasmini kiritadi.
   - Buyurtma `DISPUTED` holatiga o'tadi, pul Escrowda to'xtatiladi.
   - Admin arbitrajda 3 ta qarordan birini qabul qiladi:
     1. *To'liq qaytarish* (Xaridorga 100% pul qaytariladi)
     2. *50/50 qisman qoplash* (Yarim pul xaridorga, yarmi fermerga)
     3. *Fermer haq* (Pul to'liq fermerga o'tadi)
5. **Aqlli Narx Tavsiyasi (`GET /api/price-recommendation`)**:
   - Yangi mahsulot qo'shilayotganda tanlangan kategoriya va viloyat bo'yicha mavjud barcha partiyalarning o'rtacha narxi (`AVG`) hisoblanib, fermerga tavsiya etiladi.
6. **B2B Hisob-faktura (Invoice)**:
   - Restoran va korxonalar uchun rasmiy STIR, manzil, yetkazib berish jadvali, QR-kod va elektron raqamli muhrli Invoice generatsiya qilinadi va chop etish/PDF yuklash imkoniyati mavjud.

---

## 🛠️ Loyihani Ishga Tushirish

### 1. Qaramliklarni o'rnatish:
```bash
# Server qaramliklari
cd server && npm install

# Frontend qaramliklari
cd ../client && npm install
```

### 2. Ma'lumotlar bazasini yaratish va to'ldirish:
```bash
cd server
npx prisma db push
npm run seed
```

### 3. Server va Frontendni ishga tushirish:
```bash
# Variant A: Serverdan to'liq ishga tushirish (Frontend build qilingan holda)
cd server
npm start
# http://localhost:5000 da ishlaydi

# Variant B: Development rejimida
# Terminal 1:
cd server && npm run dev
# Terminal 2:
cd client && npm run dev
```

# Bitta Node.js hostingda AgroBozor

Node.js 22+ va doimiy PostgreSQL kerak. Frontend buildini shu Express server beradi;
client uchun alohida hosting kerak emas. Bu branch avtomatik deploy qilinmaydi.

## Sozlamalar

Hostingda repository rootni ishchi katalog qiling. `.env.example` dagi qiymatlarni
hostingning maxfiy Environment Variables qismiga kiriting. Lokal sinovda `.env`
yoki `server/.env` dan bittasini ishlating; qarama-qarshi qiymatli ikkita fayl saqlamang.
DATABASE_URL va DIRECT_URL bir xil bazaga qarasin. JWT_SECRET kamida 32 tasodifiy belgi.
PAYMENT_MODE=direct, AUTO_APPROVE_KYC=false, ALLOW_DEV_CODES=false bo'lsin.
NODE_ENV=production va APP_URL haqiqiy HTTPS domen bo'lsin. Hosting taqdim qilgan PORTni
server o'zi oladi. Bitta ishonchli reverse proxy bo'lsa TRUST_PROXY=1; aks holda 0.
Email tasdiqlash uchun Resend kaliti va tasdiqlangan jo'natuvchi domenini sozlang.

Rasm yuklash uchun Supabase URL/service-role ni faqat serverga kiriting. Dashboardda
`product-images` public, `private-docs` private bucket yarating yoki
[storage-buckets.sql](storage-buckets.sql) ni tekshirib bajaring. Har ikkisi JPEG/PNG/WebP,
5 MiB bilan cheklansin; mavjud bucketlarda limit/public holatini alohida tekshiring.
Kalitsiz standart rasm bilan e'lon berish mumkin, foydalanuvchi rasmi yuklanmaydi.
Xaridor hujjatlari uchun public policy ochmang. Telefon GPS'i HTTPS talab qiladi.
Tuman tanlovining dastlabki ro'yxati Toshkent shahri/viloyati; boshqa viloyatlarda
viloyat va matnli manzil ishlaydi, tuman ixtiyoriy.

## Ma'lumotlarni saqlovchi migratsiya

Avval baza backup/snapshot oling va nusxada sinang. Bu ish davomida productionga
ulanilmadi. `db:push`, reset va force-reset production uchun ishlatilmaydi.

Bo'sh baza uchun:

```sh
npm ci --include=dev
npm run db:migrate
```

Eski main/audit/phase-1 jadvali bor, lekin Prisma migration tarixi yo'q bazada:

```sh
npm ci --include=dev
npm run db:baseline
npm run db:migrate
npm run db:status
```

Baseline faqat mavjud eski schema tekshirilgandan keyin ishlatiladi, bo'sh bazada emas.
Migration tarixi allaqachon bo'lsa qayta baseline qilmang: avval `db:status` bilan
holatni tekshiring. 0001 eski main schemani belgilaydi; 0002 yangi ustun/jadvallarni
qo'shadi, eski balans/order/chatlarni saqlaydi. Takror Review yozuvlari aniqlansa
migratsiya to'xtaydi va hech birini avtomatik o'chirmaydi; ularni biznes qoidasi bilan
operator tekshirishi kerak. Schema nomlari o'zgartirilgan bazaga ko'r-ko'rona baseline qilmang.

## Build va start

Build command: `npm ci --include=dev && npm run build`

Start command: `npm start`

Migratsiyani build/start ichiga qo'shmang: tasdiqlangan release qadami sifatida bir marta
bajaring. Prisma CLI build/migratsiyada kerak, shuning uchun install --include=dev.
Build bazaga yozmaydi. Server SIGTERM/SIGINT da ulanishlarni yopadi.
Liveness: `/api/health`. Bazani ham tekshiradigan readiness: `/api/ready`.
Bir doimiy Node instansiya bilan boshlang; server ichidagi scheduler davriy ishlaydi.

Vaqtinchalik ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD (kamida 12 belgi) bilan
`npm run create-admin` bajaring va bu uch qiymatni olib tashlang. Admin fermer va
logist KYC holatini tasdiqlaydi. Admin panelidagi Yetkazish nazorati PINni yangilash
va sabab yozib yetkazishni tiklash imkonini beradi; har amal AuditLogda qoladi.

## Direct to'lovning chegaralari

Xaridor fermer bilan telefon/chat orqali kelishib bevosita to'laydi. Faqat buyurtma
fermeri haqiqiy tushgan to'liq summani tasdiqlaydi; shundan keyin logist buyurtmani
olishi mumkin. Yetkazish PIN'ini faqat xaridor ko'radi va mahsulotni olgach beradi.
5 noto'g'ri urinishdan keyin admin orqali tiklash kerak. Yetkazish haqi xaridorning
fermerga to'loviga kiradi; fermer uni logistga bevosita beradi. Platforma balansi,
escrow, avtomatik pul qaytarish yoki pul yechish bu rejimdagi hisob-kitob emas.
To'lov 72 soatda tasdiqlanmasa rezerv bekor bo'lishi mumkin: faqat faol buyurtma
uchun fermer bilan kelishib to'lang. Click faol emas; Payme faqat merchant sozlanganda
va rejim payme bo'lganda chiqadi. Haqiqiy merchant/sandbox tekshiruvi bu releasega kirmaydi.

## Release oldidan

PRni ko'rib chiqing; ushbu topshiriqda main merge yoki deploy qilinmagan. Hostingda
release branchni qo'lda tanlang yoki tasdiqlangan main merge'dan so'ng ishga tushiring.
Stagingda ikki alohida akkaunt bilan ro'yxatdan o'tish/email, KYC, rasm yuklash,
e'lon, chat, buyurtma, fermer tasdig'i, logist va PIN oqimini tekshiring. Real Supabase
signed upload va Resend real kalit bilan tekshirilishi kerak. HTTPS, backup va DB
ulanish limitlarini tekshiring, so'ng pilot foydalanuvchilarni kiriting.

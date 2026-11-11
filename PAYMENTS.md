# Payme to‘lovini sozlash

## Hozirgi holat

Merchant shartnomasi va provayder kalitlari ushbu ishda berilmagan. Adapter
rasmiy Merchant API hujjati bo‘yicha yozildi va haqiqiy PostgreSQL bilan,
imzolangan Basic auth callback’larini lokal yuborish orqali tekshirildi.
Payme’ning rasmiy sandboxi va haqiqiy karta bilan sinov **bajarilmagan**.
Jonli pul qabul qilish uchun avval Payme bilan shartnoma va uning tekshiruvlari
zarur. Click’da jonli adapter mavjud emas; uning nomi faqat mock rejimida chiqadi.

## Bazani tayyorlash

Mavjud bazaga `server/prisma/payme-transactions.sql` ni bir marta qo‘llang yoki
mos bazaga `npm run db:push` bajaring. `PaymeTransaction` identifikator, summa,
holat va vaqtlarni saqlaydi. Build o‘zi bazani o‘zgartirmaydi.

## Merchant mavjud bo‘lganda

Hostingning server Environment Variables bo‘limida:

```dotenv
PAYMENT_MODE=payme
PAYME_MERCHANT_ID=<web-kassa-id>
PAYME_KEY=<TEST_KEY>
PAYME_SANDBOX=true
APP_URL=https://sizning-domeningiz
```

Kalitni chatga, repositoryga yoki `VITE_` o‘zgaruvchilariga yozmang.
Payme web-kassasida Endpoint URL: `https://sizning-domeningiz/api/payments/payme`.
Account: `order_id`, String, bir martalik buyurtma hisobi.
Basic avtorizatsiya: `Paycom:<kalit>`. HTTPS shart.

Rasmiy sandboxdagi Create/Perform/Cancel/Check/GetStatement sinovlaridan keyin,
merchant bilan fiskalizatsiya va to‘lov qabul qilish talablari tasdiqlangach:
`PAYME_KEY` ni jonli kalitga, `PAYME_SANDBOX=false` ga o‘zgartiring. Bu ishda
bunday sozlamalar kiritilmadi. Fiskal mahsulot kodlari va soliq stavkalari
merchant bilan aniqlanadi; adapter `SetFiscalData` ixtiyoriy metodini qo‘shmagan.

## Oqim

1. Checkout omborni band qiladi; har mahsulot mustaqil buyurtma, alohida 15 000 so‘m logistika.
2. `POST /api/orders/:id/pay` Payme URL qaytaradi. Bu javob pul tushganini anglatmaydi.
3. `CheckPerformTransaction` buyurtma va summani tiyingacha tekshiradi.
4. `CreateTransaction` doimiy yozuv yaratadi va rezervni Payme’ning 12 soatlik oynasida saqlaydi.
5. Faqat autentifikatsiyalangan `PerformTransaction` buyurtmani `PAID_IN_ESCROW` qiladi.
   Takroriy/parallel callback escrow’ni ikki marta oshirmaydi.
6. Qaytish URL faqat Buyurtmalar ekranini ochadi; query parametri to‘lovni tasdiqlamaydi.
7. To‘lanmagan rezervni bekor qilish qoldiqni bir marta qaytaradi. Kechikkan perform rad etiladi.
8. Payme to‘lovni qaytarsa, fermer escrow’i kamayadi, qoldiq qaytadi va karta refundi
   `REFUND_EXTERNAL` sifatida yoziladi. Xaridorning ichki hamyoniga ham kredit yozilmaydi.
9. Kuryer olgan, yakunlangan yoki platforma hisob-kitobi bajarilgan buyurtmaga provayder
   orqali ikkinchi refund berilmaydi (`-31007`). Mavjud fermer rad etishi/nizo jarayoni
   xaridorning ichki hamyoniga qaytaradi; keyin Payme karta refundi takroran ruxsat etilmaydi.

Savatdagi har buyurtma alohida Payme chekiga ega. Qisman xato bo‘lsa qolgan
buyurtmalar yo‘qolmaydi: savat nusxasi tozalanadi, yaratilgan buyurtmalar va
ularning to‘lov holati saqlanadi. Buyurtmalar bo‘limida qayta to‘lash tugmasi bor.
Holat 10 soniyada yangilanadi. To‘lov tasdiqlanmaguncha muvaffaqiyat deyilmaydi.

`GET /api/payments/options` faqat sozlangan usullarni beradi. `disabled` yoki
noto‘liq Payme konfiguratsiyasida B2C checkout tugmasi yopiq; server ham yangi
rezerv yaratishni rad etadi. B2B bank hisob-fakturasi alohida ishlaydi.

## Rasmiy manbalar

- https://developer.help.paycom.uz/metody-merchant-api/
- https://developer.help.paycom.uz/metody-merchant-api/createtransaction
- https://developer.help.paycom.uz/metody-merchant-api/performtransaction
- https://developer.help.paycom.uz/metody-merchant-api/canceltransaction
- https://developer.help.paycom.uz/metody-merchant-api/getstatement
- https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get
- https://developer.help.paycom.uz/pesochnitsa

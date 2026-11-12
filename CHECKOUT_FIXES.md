# Checkout va narx tavsiyasidagi tuzatishlar

| Kamchilik | Yakuniy holat |
| --- | --- |
| To‘lov xatosidan keyin muvaffaqiyat | Har buyurtmaning haqiqiy holati tekshiriladi; xato/pending holati alohida ko‘rsatiladi. Yaratilgan buyurtmalar saqlanadi va qayta to‘lash tugmasi bor. |
| Haqiqiy Click/Payme yo‘q | Payme Merchant API callback va checkout adapteri qo‘shildi. Merchant shartnomasi/kalitlar/ruxsatlar berilmagan; rasmiy sandbox va haqiqiy pul sinovi bajarilmagan. Click’da jonli adapter yo‘q. |
| Bir fermerga bitta yetkazish haqi | Mustaqil buyurtmalarning har birida alohida 15 000 so‘m yetkazish haqi; bittasi bekor qilinsa qolganining kuryer haqi saqlanadi. |
| Yuklash xatosi yashirilgan | Marketplace xato va qayta urinishni ko‘rsatadi; server xatosi bo‘sh bozor sifatida chiqarilmaydi. |
| Kategoriya bo‘yicha narx | Bir xil mahsulot turi solishtiriladi; yangi/quritilgan/sharbat aralashtirilmaydi. Mos ma’lumot bo‘lmasa narx o‘ylab topilmaydi. |
| Yangi mahsulot ko‘rinmasligi | Callback ro‘yxatni qayta yuklaydi; AddProductModal’dagi shartli hook xatosi ham tuzatildi. Brauzer testi ochish/yopish/qayta ochish/yaratish oqimini tekshiradi. |

Sinov rejimi faqat aniq `PAYMENT_MODE=mock` bilan yoqiladi. O‘zgaruvchi
berilmaganda `direct` rejimi — fermerga bevosita to‘lov ishlaydi. Noto‘liq merchant konfiguratsiyasida
B2C checkout omborni band qilmaydi. B2B bank hisob-fakturasi alohida ishlaydi.

Tekshiruv: 25 ta server testi va 11 ta Chromium brauzer testi, build muvaffaqiyatli.
Payme callback testlari lokal so‘rovlar bilan bajarildi; ular provayderning
sertifikatsiyasi yoki haqiqiy karta to‘lovi o‘rnini bosmaydi.

Bazaga yangi `PaymeTransaction` jadvali kerak. `server/prisma/payme-transactions.sql`
yoki `npm run db:push`; undan keyin build va deploy. Hostingga bog‘lanmagan
sozlash va Payme hujjatlari: [PAYMENTS.md](PAYMENTS.md).

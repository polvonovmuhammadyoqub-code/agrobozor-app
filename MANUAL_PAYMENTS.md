# Fermerga bevosita to‘lov

Standart rejim `PAYMENT_MODE=direct`. Merchant shartnomasi yoki kalit kerak emas.
Xaridor pulni fermerga naqd yoki ular kelishgan karta/bank orqali beradi.
Platforma pul qabul qilmaydi va escrow kafolati bermaydi.

1. Xaridor buyurtma beradi; ombor qoldig‘i 72 soatga band qilinadi.
2. “Buyurtmalar” bo‘limida fermer telefonini ko‘radi va to‘lov rekvizitlarini kelishadi.
3. Fermer o‘z kabinetidagi Buyurtmalar bo‘limida to‘liq pul tushganini tekshiradi.
4. “To‘lovni oldim — tasdiqlash” tugmasini bosadi. Faqat buyurtmaning tasdiqlangan
   fermer-egasi buni qila oladi; xaridor, boshqa fermer va admin tasdiqlay olmaydi.
5. Buyurtma yetkazishga tayyor holatga o‘tadi va logistga ko‘rinadi.
6. Yetkazish va xaridorning qabul qilishi odatdagi tartibda davom etadi.

Jami narx mahsulot summasi va har bir mustaqil buyurtmaga 15 000 so‘m yetkazish
haqidan iborat. Fermer yetkazish haqini kuryer bilan qo‘lda hisoblashadi.
Platforma komissiyasi va logistika marjasi bu rejimda 0; fermer, kuryer yoki
platforma hamyoniga avtomatik mablag‘ yozilmaydi. Tasdiq tashqarida olingan pul
sifatida auditga yoziladi. Mahsulot statistikasi yakunlangan bevosita savdolarni
ham hisoblaydi, lekin bu yechib olinadigan platforma balansi emas.

Qaytarish fermer bilan qo‘lda kelishiladi. Platforma qabul qilmagan pulni
avtomatik qaytarmaydi va direct buyurtma uchun escrow nizosi ochilmaydi.
72 soatdan keyin to‘lanmagan rezerv bekor qilinadi; kechikkan to‘lov bo‘lsa,
xaridor va fermer uni alohida hal qilishlari kerak.

Qo‘shimcha baza ustuni kerak emas: mavjud `payment_method` String maydoniga
`DIRECT_FARMER` yoziladi. Oldingi versiyalarning baza jadvallari allaqachon
qo‘llangan bo‘lishi kerak. Hostingda eski `PAYMENT_MODE=disabled` yoki `mock`
bo‘lsa, uni `direct` ga almashtirib, yangi kodni build/deploy qiling.

`mock`, `disabled` va Payme usullari alohida qoladi; ularning to‘lovlarini fermer
qo‘lda tasdiqlay olmaydi. Bu rejim online provayderni avtomatik faollashtirmaydi.

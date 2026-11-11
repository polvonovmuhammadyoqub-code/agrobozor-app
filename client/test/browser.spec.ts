import { test, expect } from '@playwright/test';

const user = { id: 'buyer', role: 'BUYER_B2C', full_name: 'Test Buyer', region: 'Toshkent', wallet_available: 0, wallet_escrow: 0 };
const product = {
  id: 'apple', farmer_id: 'farmer', title: 'Test olma', category: 'MEVALAR', price_per_kg: 10000,
  available_quantity_kg: 2, min_order_kg: 1, harvest_date: '2026-11-11T00:00:00Z', region: 'Toshkent', is_active: true,
  image_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/%3E',
  farmer: { id: 'farmer', full_name: 'Test Farmer', rating: 5, kyc_status: 'APPROVED' },
};

test('marketplace displays API failure and can retry', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let failed = true;
  await page.route('**/api/products?*', route => route.fulfill({ status: failed ? 503 : 200, json: failed ? { error: 'Vaqtinchalik server xatosi' } : [product] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Avval bozorni ko‘rib chiqish →' }).click();
  await expect(page.getByRole('alert')).toContainText('Vaqtinchalik server xatosi');
  failed = false;
  await page.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(page.getByRole('heading', { name: 'Test olma' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('cart clamps stock and does not claim a failed payment succeeded', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('agro_token', 'test-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: user }));
  await page.route('**/api/products?*', route => route.fulfill({ json: [product] }));
  await page.route('**/api/orders/checkout', route => route.fulfill({ status: 201, json: { orders: [{ id: 'order-1' }], total_orders_count: 1, grand_total: 35000 } }));
  await page.route('**/api/orders/order-1/pay', route => route.fulfill({ status: 402, json: { error: 'Payment disabled' } }));
  await page.route('**/api/orders', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByText('Test Buyer', { exact: true })).toBeVisible();
  const add = page.getByTitle("Savatga qo'shish");
  for (let i = 0; i < 4; i++) await add.click();
  await page.getByTitle('Savat', { exact: true }).click();
  // The 2kg stock cap gives a subtotal of 20,000 plus 15,000 delivery.
  await expect(page.getByText(/35[\s,.]?000 so'm/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Buyurtmani Rasmiylashtirish' }).click();
  await page.getByRole('button', { name: 'Buyurtmani Tasdiqlash' }).click();
  await expect(page.getByText(/1 ta buyurtma to'lovi tasdiqlanmadi/)).toBeVisible();
  await expect(page.getByText(/to'lov Escrow himoyasiga o'tkazildi/)).toHaveCount(0);
});

test('temporary profile failure preserves token while an invalid token is removed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('agro_token', 'test-token'));
  let status = 503;
  await page.route('**/api/auth/me', route => route.fulfill({ status, json: { error: 'Unavailable' } }));
  await page.route('**/api/products?*', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Kirish', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('agro_token'))).toBe('test-token');
  status = 401;
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('agro_token'))).toBeNull();
});

test('mobile marketplace renders without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/products?*', route => route.fulfill({ json: [product] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Avval bozorni ko‘rib chiqish →' }).click();
  await expect(page.getByRole('heading', { name: 'Test olma' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile welcome puts both authentication actions first', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Kirish', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ro‘yxatdan o‘tish', exact: true })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Ro‘yxatdan o‘tish', exact: true }).evaluate(el => el.getBoundingClientRect().bottom < innerHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('farmer login opens own products and statistics with market in bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const farmer = { ...user, id: 'farmer', role: 'FARMER', full_name: 'Test Farmer', kyc_status: 'APPROVED' };
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: farmer, token: 'farmer-token' } }));
  await page.route('**/api/orders', route => route.fulfill({ json: [] }));
  await page.route('**/api/products/mine/list', route => route.fulfill({ json: [{ ...product, _count: { views: 4, orders: 0 } }] }));
  await page.route('**/api/products/apple/analytics', route => route.fulfill({ json: { unique_views: 4, order_count: 0, sold_kg: 0, earned: 0, viewers: [{ id:'v1', last_viewed_at: new Date().toISOString(), viewer: { id:'v1', full_name:'Ali Xaridor', region:'Toshkent' } }] } }));
  await page.route('**/api/products?*', route => route.fulfill({ json: [product] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await page.getByLabel('Telefon raqami yoki Email').fill('farmer@example.com');
  await page.getByLabel('Parol', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).last().click();
  await expect(page.getByText('Fermer kabineti', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mening mahsulotlarim' })).toBeVisible();
  await page.getByRole('button', { name: 'Statistika', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ali Xaridor');
  expect(await page.getByRole('dialog').locator('..').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
  await page.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.getByRole('navigation', { name: 'Pastki menyu' }).getByRole('button', { name: 'Bozor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bozor', exact: true })).toBeVisible();
});

test('courier signs in directly to available deliveries', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => localStorage.setItem('agro_token', 'courier-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...user, id: 'courier', role: 'COURIER', kyc_status: 'APPROVED' } }));
  await page.route('**/api/orders', route => route.fulfill({ json: [{ id:'delivery', status:'CONFIRMED_BY_FARMER', product, quantity_kg:5, courier_payout:12000, farmer:{full_name:'Ali',region:'Toshkent'}, buyer:{region:'Chilonzor'} }] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name:'Logist kabineti' })).toBeVisible();
  await expect(page.getByRole('button', { name:"Qabul qilish va Yo'lga chiqish" })).toBeVisible();
  await expect(page.getByText('Chilonzor', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Payme cart checkout remains unpaid and offers a provider link', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('agro_token', 'test-token'));
  await page.route('**/api/auth/me', route => route.fulfill({json:user}));
  await page.route('**/api/products?*', route => route.fulfill({json:[product]}));
  await page.route('**/api/payments/options', route => route.fulfill({json:{mode:'payme',methods:['PAYME'],message:'To‘lov Payme sahifasida tasdiqlanadi.'}}));
  const pending={id:'pending-payme',status:'PENDING_PAYMENT',product_title:'Test olma',total_paid:25000};
  await page.route('**/api/orders/checkout', async route => {expect(route.request().postDataJSON().payment_method).toBe('PAYME');await route.fulfill({status:201,json:{orders:[pending],grand_total:25000,total_orders_count:1}});});
  await page.route('**/api/orders/pending-payme/pay', route => route.fulfill({json:{order:pending,pending_payment:true,checkout_url:'https://test.paycom.uz/fixture'}}));
  await page.goto('/');
  await page.getByTitle("Savatga qo'shish").click();
  await page.getByTitle('Savat',{exact:true}).click();
  await page.getByRole('button',{name:'Buyurtmani Rasmiylashtirish'}).click();
  await expect(page.getByRole('radio',{name:'PAYME',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Buyurtmani Tasdiqlash'}).click();
  await expect(page.getByRole('status')).toContainText('to‘lov kutmoqda');
  await expect(page.getByRole('link',{name:/Payme orqali to‘lash/})).toHaveAttribute('href','https://test.paycom.uz/fixture');
  await expect(page.getByText('Barcha buyurtmalar to‘lovi tasdiqlandi.')).toHaveCount(0);
});

test('unconfigured payment is clearly unavailable and does not create an order', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('agro_token', 'test-token'));
  await page.route('**/api/auth/me', route => route.fulfill({json:user}));
  await page.route('**/api/products?*', route => route.fulfill({json:[product]}));
  await page.route('**/api/payments/options', route => route.fulfill({json:{mode:'disabled',methods:[],message:'Onlayn to‘lov hali ulanmagan.'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Sotib olish',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Onlayn to‘lov hali ulanmagan.');
  await expect(page.getByRole('button',{name:'Buyurtmani rasmiylashtirish',exact:true})).toBeDisabled();
});

test('add product opens repeatedly, preserves manual price and immediately refreshes farmer inventory', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const farmer={...user,id:'farmer',role:'FARMER',full_name:'Test Farmer',kyc_status:'APPROVED'};
  let inventory:unknown[]=[];
  await page.addInitScript(()=>localStorage.setItem('agro_token','farmer-token'));
  await page.route('**/api/auth/me',route=>route.fulfill({json:farmer}));
  await page.route('**/api/orders',route=>route.fulfill({json:[]}));
  await page.route('**/api/products/mine/list',route=>route.fulfill({json:inventory}));
  await page.route('**/api/price-recommendation?*',route=>route.fulfill({json:{recommended_price:24000,avg_price:24000,min_price:24000,max_price:24000,sample_count:1,source:'matched_product',context:'Shu mahsulot turi'}}));
  await page.route('**/api/products',async route=>{const body=route.request().postDataJSON();const p={...product,...body,id:'new-product',_count:{views:0,orders:0}};inventory=[p];await route.fulfill({status:201,json:p});});
  await page.goto('/');
  await page.getByRole('button',{name:'Mahsulot qo‘shish',exact:true}).first().click();
  await page.getByPlaceholder('so\'m',{exact:true}).fill('17000');
  await page.getByPlaceholder(/Masalan: Parkent/).fill('Qizil olma');
  await expect(page.getByText(/Tavsiya narxini qo.yish/)).toBeVisible();
  await expect(page.getByPlaceholder('so\'m',{exact:true})).toHaveValue('17000');
  await page.getByRole('button',{name:'Bekor qilish',exact:true}).click();
  await page.getByRole('button',{name:'Mahsulot qo‘shish',exact:true}).first().click();
  await page.getByRole('button',{name:'Sotuvga chiqarish',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Qizil olma',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('buyer manual checkout waits for farmer confirmation and never claims escrow', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('agro_token','test-token'));
  await page.route('**/api/auth/me',route=>route.fulfill({json:user}));
  await page.route('**/api/products?*',route=>route.fulfill({json:[product]}));
  await page.route('**/api/payments/options',route=>route.fulfill({json:{mode:'direct',methods:['DIRECT_FARMER'],message:'To‘lov bevosita fermerga. Platforma pul qabul qilmaydi.'}}));
  await page.route('**/api/orders/checkout',async route=>{expect(route.request().postDataJSON().payment_method).toBe('DIRECT_FARMER');await route.fulfill({status:201,json:{orders:[{id:'direct-order',status:'PENDING_PAYMENT',total_paid:25000}],grand_total:25000}});});
  await page.goto('/');await page.getByTitle("Savatga qo'shish").click();await page.getByTitle('Savat',{exact:true}).click();
  await page.getByRole('button',{name:'Buyurtmani Rasmiylashtirish'}).click();
  await expect(page.getByRole('radio',{name:'Bevosita fermerga'})).toBeChecked();
  await page.getByRole('button',{name:'Buyurtmani Tasdiqlash'}).click();
  await expect(page.getByRole('status')).toContainText('fermer tasdiqlaydi');
  await expect(page.getByRole('status')).toContainText('platforma pul qabul qilmaydi');
  await expect(page.getByRole('dialog')).not.toContainText('Escrow');
});

test('farmer sees a receive-payment action and direct orders have no escrow badge',async({page})=>{
  const farmer={...user,id:'farmer',role:'FARMER',full_name:'Test Farmer',kyc_status:'APPROVED'};
  const order={id:'direct-order',buyer_id:'buyer',farmer_id:'farmer',payment_method:'DIRECT_FARMER',status:'PENDING_PAYMENT',quantity_kg:1,total_paid:25000,delivery_fee:15000,product_total_amount:10000,platform_commission:0,courier_payout:15000,created_at:new Date().toISOString(),delivery_address:'Toshkent Test 10',product,farmer:{id:'farmer',full_name:'Test Farmer',region:'Toshkent',phone:'+998901234567'},buyer:{id:'buyer',full_name:'Test Buyer',phone:'+998901111111',region:'Toshkent'}};
  await page.addInitScript(()=>localStorage.setItem('agro_token','test-token'));
  await page.route('**/api/auth/me',route=>route.fulfill({json:farmer}));await page.route('**/api/products/mine/list',route=>route.fulfill({json:[]}));
  await page.route('**/api/orders',route=>route.fulfill({json:[order]}));
  await page.route('**/api/orders/direct-order/confirm-direct-payment',async route=>{expect(route.request().postDataJSON()).toEqual({received:true,received_amount:25000});order.status='CONFIRMED_BY_FARMER';await route.fulfill({json:{message:'Tasdiqlandi'}});});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');await page.getByRole('button',{name:/^Buyurtmalar/}).first().click();
  await expect(page.getByText('Escrowda himoyalangan')).toHaveCount(0);
  await page.getByRole('button',{name:'To‘lovni oldim — tasdiqlash'}).click();
  await expect(page.getByText('Fermer to‘lovni oldi',{exact:true})).toBeVisible();
  await expect(page.getByText('Escrowda himoyalangan')).toHaveCount(0);
});

test('farmer combines uploaded photo, units and pickup district in a new listing',async({page})=>{
  const farmer={...user,id:'farmer',role:'FARMER',kyc_status:'APPROVED'};
  let inventory:unknown[]=[];
  await page.addInitScript(()=>localStorage.setItem('agro_token','fixture-token'));
  await page.route('**/api/auth/me',r=>r.fulfill({json:farmer}));
  await page.route('**/api/orders',r=>r.fulfill({json:[]}));
  await page.route('**/api/products/mine/list',r=>r.fulfill({json:inventory}));
  await page.route('**/api/price-recommendation?*',r=>r.fulfill({json:{recommended_price:null}}));
  await page.route('**/api/uploads/sign',async r=>{
    const b=r.request().postDataJSON();expect(b.bucket).toBe('product-images');expect(b.content_type).toBe('image/jpeg');expect(b.size_bytes).toBeGreaterThan(0);
    await r.fulfill({json:{signed_url:'http://127.0.0.1:5000/test-upload',public_url:'https://storage.test.invalid/photo.jpg',path:'farmer/photo.jpg'}});
  });
  await page.route('**/test-upload',async r=>{expect(r.request().method()).toBe('PUT');await r.fulfill({status:200,body:''});});
  await page.route('**/api/products',async r=>{
    const b=r.request().postDataJSON();expect(b.unit).toBe('DONA');expect(b.pickup_district).toBe('Chilonzor');expect(b.region).toBe('Toshkent');expect(b.image_urls).toEqual(['https://storage.test.invalid/photo.jpg']);
    inventory=[{...product,...b,id:'photo-product',_count:{views:0,orders:0}}];await r.fulfill({status:201,json:inventory[0]});
  });
  await page.goto('/');await page.getByRole('button',{name:'Mahsulot qo‘shish',exact:true}).first().click();
  await page.getByPlaceholder(/Masalan: Parkent/).fill('Dona qovoq');
  await page.getByLabel('O‘lchov birligi').selectOption('DONA');
  await page.getByLabel('Olib ketish tumani').selectOption({label:'Chilonzor'});
  await page.getByPlaceholder("so'm",{exact:true}).fill('15000');
  await page.locator('input[type=file]').setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64')});
  await expect(page.locator('input[type=file]')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Sotuvga chiqarish',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Sotuvga chiqarish',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Dona qovoq',exact:true})).toBeVisible();
});

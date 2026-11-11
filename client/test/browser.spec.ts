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

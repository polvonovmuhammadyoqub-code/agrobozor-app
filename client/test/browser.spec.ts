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
  await expect(page.getByRole('heading', { name: 'Test olma' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

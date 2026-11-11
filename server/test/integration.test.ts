import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

// Use only a dedicated test database. Never fall back to DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL;
let prisma: any;
let server: Server;
let base: string;
let jwt: any;
let secret: string;
const ids: string[] = [];
const emails: string[] = [];
const users: Record<string, any> = {};
let product: any;

before(async () => {
  if (!testUrl) return;
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.PAYMENT_MODE = 'mock';
  process.env.JWT_SECRET = 'integration-test-secret-01234567890123456789';
  ({ default: prisma } = await import('../src/db.js'));
  ({ default: jwt } = await import('jsonwebtoken'));
  ({ JWT_SECRET: secret } = await import('../src/config.js'));
  const { app } = await import('../src/app.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  for (const role of ['ADMIN', 'FARMER', 'BUYER_B2C', 'BUYER_B2B', 'COURIER']) {
    const id = randomUUID(); ids.push(id);
    users[role] = await prisma.user.create({ data: {
      id, phone: `test-${id}`, password_hash: 'unused', full_name: role,
      role, region: 'Toshkent', tin_or_passport: 'TEST', kyc_status: 'APPROVED',
    } });
  }
  product = await makeProduct();
});

after(async () => {
  if (!testUrl || !prisma) return;
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const orders = { buyer_id: { in: ids } };
  await prisma.review.deleteMany({ where: { reviewer_id: { in: ids } } });
  await prisma.dispute.deleteMany({ where: { buyer_id: { in: ids } } });
  await prisma.transaction.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { order: orders }] } });
  await prisma.withdrawalRequest.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.order.deleteMany({ where: orders });
  await prisma.product.deleteMany({ where: { farmer_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.emailVerification.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

function token(role: string) { return jwt.sign({ id: users[role].id }, secret); }
async function request(path: string, role?: string, body?: unknown, method = 'POST') {
  const res = await fetch(base + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${token(role)}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}
async function makeProduct(stock = 100) {
  return prisma.product.create({ data: {
    farmer_id: users.FARMER.id, title: 'Test olma', category: 'MEVALAR', price_per_kg: 10000,
    available_quantity_kg: stock, min_order_kg: 1, harvest_date: new Date(),
    image_url: 'https://example.com/apple.jpg', region: 'Toshkent',
  } });
}
async function createOrder(p = product, qty = 1, role = 'BUYER_B2C', method = 'CLICK') {
  return request('/orders', role, { product_id: p.id, quantity_kg: qty,
    delivery_address: 'Toshkent, Test kocha 10', payment_method: method });
}
const options = { skip: !testUrl };

test('health, API 404, malformed JSON and auth errors return JSON', options, async () => {
  assert.equal((await request('/health', undefined, undefined, 'GET')).status, 200);
  assert.equal((await request('/missing', undefined, undefined, 'GET')).status, 404);
  assert.equal((await request('/orders', undefined, undefined, 'GET')).status, 401);
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(res.status, 400); assert.ok((await res.json()).error);
});

test('concurrent withdrawal rejection refunds exactly once', options, async () => {
  await prisma.user.update({ where: { id: users.BUYER_B2C.id }, data: { wallet_available: 50000 } });
  const withdrawal = await request('/users/withdraw', 'BUYER_B2C', { amount: 20000, card_or_account: '8600123412341234' });
  assert.equal(withdrawal.status, 200);
  const url = `/admin/withdrawals/${withdrawal.data.withdrawal.id}/reject`;
  const results = await Promise.all([request(url, 'ADMIN', {}), request(url, 'ADMIN', {})]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const user = await prisma.user.findUnique({ where: { id: users.BUYER_B2C.id } });
  assert.equal(user.wallet_available, 50000);
  assert.equal(await prisma.transaction.count({ where: { user_id: user.id, type: 'WITHDRAWAL_REFUND' } }), 1);
});

test('approval and rejection cannot both process the same withdrawal', options, async () => {
  const withdrawal = await request('/users/withdraw', 'BUYER_B2C', { amount: 10000, card_or_account: '8600123412341234' });
  const prefix = `/admin/withdrawals/${withdrawal.data.withdrawal.id}`;
  const results = await Promise.all([request(prefix + '/approve', 'ADMIN', {}), request(prefix + '/reject', 'ADMIN', {})]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const w = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawal.data.withdrawal.id } });
  const u = await prisma.user.findUnique({ where: { id: users.BUYER_B2C.id } });
  assert.equal(u.wallet_available, w.status === 'PAID' ? 40000 : 50000);
});

test('checkout rejects invalid items, duplicates, malformed quantity and overflowing money', options, async () => {
  const body = { delivery_address: 'Toshkent test address', payment_method: 'CLICK' };
  for (const items of [[null], [{ quantity_kg: 2 }], [{ product_id: product.id, quantity_kg: '2kg' }],
    [{ product_id: product.id, quantity_kg: 1 }, { product_id: product.id, quantity_kg: 1 }],
    [{ product_id: product.id, quantity_kg: 99999999 }]]) {
    assert.equal((await request('/orders/checkout', 'BUYER_B2C', { ...body, items })).status, 400);
  }
  assert.equal((await createOrder(product, 99999999)).status, 400);
});

test('independent cart orders each retain delivery funding after one is cancelled', options, async () => {
  const second = await makeProduct();
  const result = await request('/orders/checkout', 'BUYER_B2C', {
    delivery_address: 'Toshkent test address', payment_method: 'CLICK',
    items: [{ product_id: product.id, quantity_kg: 1 }, { product_id: second.id, quantity_kg: 1 }],
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.grand_total, 50000);
  for (const order of result.data.orders) {
    assert.equal(order.delivery_fee, 15000); assert.equal(order.courier_payout, 12000);
  }
  assert.equal((await request(`/orders/${result.data.orders[0].id}/cancel`, 'BUYER_B2C', {})).status, 200);
  assert.equal((await request(`/orders/${result.data.orders[1].id}/pay`, 'BUYER_B2C', {})).status, 200);
});

test('atomic stock reservation prevents overselling and double cancellation', options, async () => {
  const scarce = await makeProduct(1);
  const results = await Promise.all([createOrder(scarce), createOrder(scarce)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
  const order = results.find(r => r.status === 201)!.data;
  const cancelled = await Promise.all([request(`/orders/${order.id}/cancel`, 'BUYER_B2C', {}), request(`/orders/${order.id}/cancel`, 'BUYER_B2C', {})]);
  assert.equal(cancelled.filter(r => r.status === 200).length, 1);
  assert.equal((await prisma.product.findUnique({ where: { id: scarce.id } })).available_quantity_kg, 1);
});

test('delivery lifecycle, courier privacy, escrow conservation and duplicate reviews', options, async () => {
  const created = await createOrder(); const id = created.data.id;
  assert.equal(created.status, 201);
  const payments = await Promise.all([request(`/orders/${id}/pay`, 'BUYER_B2C', {}), request(`/orders/${id}/pay`, 'BUYER_B2C', {})]);
  assert.equal(payments.filter(r => r.status === 200).length, 1);
  assert.equal(await prisma.transaction.count({ where: { order_id: id, type: 'ESCROW_HOLD' } }), 1);
  assert.equal((await request(`/orders/${id}/status`, 'FARMER', { status: 'CONFIRMED_BY_FARMER' }, 'PATCH')).status, 200);
  const available = await request('/orders', 'COURIER', undefined, 'GET');
  const publicOrder = available.data.find((o: any) => o.id === id);
  assert.equal(publicOrder.delivery_address, undefined); assert.equal(publicOrder.buyer.phone, undefined);
  assert.equal((await request(`/orders/${id}/status`, 'COURIER', { status: 'IN_TRANSIT' }, 'PATCH')).status, 200);
  assert.equal((await request(`/orders/${id}`, 'COURIER', undefined, 'GET')).data.delivery_address, 'Toshkent, Test kocha 10');
  assert.equal((await request(`/orders/${id}/status`, 'COURIER', { status: 'DELIVERED' }, 'PATCH')).status, 200);
  const results = await Promise.all([request(`/orders/${id}/complete`, 'BUYER_B2C', {}), request(`/orders/${id}/complete`, 'BUYER_B2C', {})]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const credits = await prisma.transaction.aggregate({ where: { order_id: id, type: { not: 'ESCROW_HOLD' } }, _sum: { amount: true } });
  assert.equal(credits._sum.amount, created.data.total_paid);
  const review = { order_id: id, target_user_id: users.FARMER.id, rating: 4, comment: 'Good' };
  assert.equal((await request('/reviews', 'BUYER_B2C', { ...review, rating: '4abc' })).status, 400);
  const reviews = await Promise.all([request('/reviews', 'BUYER_B2C', review), request('/reviews', 'BUYER_B2C', review)]);
  assert.equal(reviews.filter(r => r.status === 201).length, 1);
  assert.equal(await prisma.review.count({ where: { order_id: id } }), 1);
});

test('verification attempt limit is atomic under concurrent guesses', options, async () => {
  const email = `${randomUUID()}@example.com`; emails.push(email);
  await prisma.emailVerification.create({ data: { email, code: '123456', expires_at: new Date(Date.now() + 600000) } });
  await Promise.all(Array.from({ length: 8 }, () => request('/auth/verify-code', undefined, { email, code: '000000' })));
  const record = await prisma.emailVerification.findFirst({ where: { email } });
  assert.equal(record.attempts, 5);
  assert.equal((await request('/auth/verify-code', undefined, { email, code: '123456' })).status, 400);
});

test('email code consumption, login normalization and admin registration restriction', options, async () => {
  const email = `${randomUUID()}@example.com`; emails.push(email);
  const code = '123456';
  await prisma.emailVerification.create({ data: { email, code, expires_at: new Date(Date.now() + 600000) } });
  const phone = '998' + String(Math.floor(Math.random() * 900000000) + 100000000);
  const body = { email, verification_code: code, phone, password: 'test-password-123', full_name: 'Test Buyer', region: 'Toshkent', role: 'ADMIN' };
  assert.equal((await request('/auth/register', undefined, body)).status, 400);
  const registered = await request('/auth/register', undefined, { ...body, role: 'BUYER_B2C' });
  assert.equal(registered.status, 201); ids.push(registered.data.user.id);
  assert.equal(registered.data.user.password_hash, undefined);
  assert.equal(await prisma.emailVerification.count({ where: { email } }), 0);
  assert.equal((await request('/auth/login', undefined, { email: email.toUpperCase(), password: body.password })).status, 200);
});

test('B2B payment confirmation rejects online orders and expired invoices', options, async () => {
  const online = await createOrder();
  assert.equal((await request(`/admin/orders/${online.data.id}/confirm-payment`, 'ADMIN', {})).status, 400);
  const invoice = await createOrder(product, 1, 'BUYER_B2B', 'INVOICE_B2B');
  assert.equal((await request(`/admin/orders/${invoice.data.id}/confirm-payment`, 'ADMIN', {})).status, 200);
  const expired = await createOrder(product, 1, 'BUYER_B2B', 'INVOICE_B2B');
  await prisma.order.update({ where: { id: expired.data.id }, data: { created_at: new Date(Date.now() - 73 * 3600000) } });
  assert.equal((await request(`/admin/orders/${expired.data.id}/confirm-payment`, 'ADMIN', {})).status, 400);
});

test('expired reservations release once and delivered orders settle automatically', options, async () => {
  const { releaseExpiredOrders, autoCompleteDelivered } = await import('../src/routes/orders.js');
  const reserved = await makeProduct(2);
  const order = (await createOrder(reserved)).data;
  await prisma.order.update({ where: { id: order.id }, data: { created_at: new Date(Date.now() - 31 * 60000) } });
  await Promise.all([releaseExpiredOrders(), releaseExpiredOrders()]);
  assert.equal((await prisma.product.findUnique({ where: { id: reserved.id } })).available_quantity_kg, 2);
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, 'CANCELLED');
  const delivered = (await createOrder()).data;
  assert.equal((await request(`/orders/${delivered.id}/pay`, 'BUYER_B2C', {})).status, 200);
  await prisma.order.update({ where: { id: delivered.id }, data: { status: 'DELIVERED', courier_id: users.COURIER.id, delivered_at: new Date(Date.now() - 25 * 3600000) } });
  await Promise.all([autoCompleteDelivered(), autoCompleteDelivered()]);
  assert.equal((await prisma.order.findUnique({ where: { id: delivered.id } })).status, 'COMPLETED');
  assert.equal(await prisma.transaction.count({ where: { order_id: delivered.id, type: 'ESCROW_RELEASE_FARMER' } }), 1);
});

test('farmer rejection and dispute settlement conserve the entire paid amount', options, async () => {
  const rejected = (await createOrder()).data;
  await request(`/orders/${rejected.id}/pay`, 'BUYER_B2C', {});
  assert.equal((await request(`/orders/${rejected.id}/reject`, 'FARMER', {})).status, 200);
  const refund = await prisma.transaction.findFirst({ where: { order_id: rejected.id, type: 'REFUND' } });
  assert.equal(refund.amount, rejected.total_paid);

  const disputed = (await createOrder()).data;
  await request(`/orders/${disputed.id}/pay`, 'BUYER_B2C', {});
  await request(`/orders/${disputed.id}/status`, 'FARMER', { status: 'CONFIRMED_BY_FARMER' }, 'PATCH');
  const opened = await request('/disputes', 'BUYER_B2C', { order_id: disputed.id, reason: 'Mahsulot sifati kelishuvga mos emas' });
  assert.equal(opened.status, 201);
  const results = await Promise.all(Array.from({ length: 2 }, () => request(`/disputes/${opened.data.id}/resolve`, 'ADMIN', { resolution: 'RESOLVED_REFUND_PARTIAL', refund_amount: 3000 })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const credits = await prisma.transaction.aggregate({ where: { order_id: disputed.id, type: { not: 'ESCROW_HOLD' } }, _sum: { amount: true } });
  assert.equal(credits._sum.amount, disputed.total_paid);
});

test('inactive products honor current database roles and reject invalid update values', options, async () => {
  const hidden = await makeProduct();
  await prisma.product.update({ where: { id: hidden.id }, data: { is_active: false } });
  assert.equal((await request(`/products/${hidden.id}`, undefined, undefined, 'GET')).status, 404);
  assert.equal((await request(`/products/${hidden.id}`, 'ADMIN', undefined, 'GET')).status, 200);
  assert.equal((await request(`/products/${hidden.id}`, 'BUYER_B2C', undefined, 'GET')).status, 404);
  for (const body of [{ is_active: 'false' }, { price_per_kg: '5kg' }, { min_order_kg: 101 }]) {
    assert.equal((await request(`/products/${hidden.id}`, 'FARMER', body, 'PUT')).status, 400);
  }
});

test('Vercel catch-all preserves product filter query parameters', options, async () => {
  const { createServer } = await import('node:http');
  const { default: handler } = await import('../../api/[...slug].js');
  const other = await makeProduct();
  await prisma.product.update({ where: { id: other.id }, data: { category: 'DON' } });
  const bridge = createServer((req, res) => {
    (req as any).query = { slug: ['products'] };
    handler(req, res);
  });
  await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(bridge.address() as any).port}/api/products?category=DON&slug=products`);
    assert.equal(response.status, 200);
    const products = await response.json();
    assert.ok(products.some((p: any) => p.id === other.id));
    assert.ok(products.every((p: any) => p.category === 'DON'));
  } finally {
    await new Promise<void>(resolve => bridge.close(() => resolve()));
  }
});

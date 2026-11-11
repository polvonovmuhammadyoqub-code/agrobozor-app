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
  await prisma.conversation.deleteMany({ where: { OR: [{ buyer_id: { in: ids } }, { seller_id: { in: ids } }] } });
  await prisma.paymeTransaction.deleteMany({ where: { order: orders } });
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

test('product detail includes seller phone but excludes identity documents and private fields', options, async () => {
  const result = await request(`/products/${product.id}`, undefined, undefined, 'GET');
  assert.equal(result.status, 200);
  assert.equal(result.data.farmer.phone, users.FARMER.phone);
  for (const key of ['tin_or_passport', 'password_hash', 'email', 'wallet_available']) assert.equal(result.data.farmer[key], undefined);
});

test('views are unique per signed-in viewer, exclude owner and protect viewer analytics', options, async () => {
  const p = await makeProduct();
  assert.equal((await request(`/products/${p.id}/view`, undefined, {})).status, 401);
  const results = await Promise.all(Array.from({ length: 3 }, () => request(`/products/${p.id}/view`, 'BUYER_B2C', {})));
  for (const result of results) assert.equal(result.status, 200);
  await request(`/products/${p.id}/view`, 'FARMER', {});
  const stats = await request(`/products/${p.id}/analytics`, 'FARMER', undefined, 'GET');
  assert.equal(stats.status, 200); assert.equal(stats.data.unique_views, 1);
  assert.equal(stats.data.viewers[0].viewer.full_name, users.BUYER_B2C.full_name);
  for (const key of ['tin_or_passport', 'phone', 'email', 'password_hash']) assert.equal(stats.data.viewers[0].viewer[key], undefined);
  assert.equal((await request(`/products/${p.id}/analytics`, 'BUYER_B2C', undefined, 'GET')).status, 404);
  const mine = await request('/products/mine/list', 'FARMER', undefined, 'GET');
  assert.equal(mine.data.find((item: any) => item.id === p.id)._count.views, 1);
});

test('seller conversations are private, persistent, replyable and mark messages read', options, async () => {
  const p = await makeProduct();
  assert.equal((await request('/messages/conversations', undefined, { product_id: p.id })).status, 401);
  assert.equal((await request('/messages/conversations', 'FARMER', { product_id: p.id })).status, 400);
  const opened = await Promise.all([request('/messages/conversations', 'BUYER_B2C', { product_id: p.id }), request('/messages/conversations', 'BUYER_B2C', { product_id: p.id })]);
  assert.ok(opened.every(r => [200,201].includes(r.status)));
  assert.equal(opened[0].data.id, opened[1].data.id);
  const id = opened[0].data.id; const path = `/messages/conversations/${id}/messages`;
  assert.equal((await request(path, 'COURIER', undefined, 'GET')).status, 404);
  assert.equal((await request(path, 'COURIER', { body: 'Unauthorized' })).status, 404);
  assert.equal((await request('/messages/conversations', 'COURIER', undefined, 'GET')).data.length, 0);
  assert.equal((await request(path, 'BUYER_B2C', { body: '   ' })).status, 400);
  assert.equal((await request(path, 'BUYER_B2C', { body: 'a'.repeat(2001) })).status, 400);
  const client_id = randomUUID();
  const sent = await request(path, 'BUYER_B2C', { body: 'Assalomu alaykum, olma bormi?', client_id });
  assert.equal(sent.status, 201);
  const resent = await request(path, 'BUYER_B2C', { body: 'Assalomu alaykum, olma bormi?', client_id });
  assert.equal(resent.data.id, sent.data.id);
  const list = await request('/messages/conversations', 'FARMER', undefined, 'GET');
  const chat = list.data.find((c: any) => c.id === id);
  assert.equal(chat._count.messages, 1);
  assert.equal((await request('/messages/unread-count', 'FARMER', undefined, 'GET')).data.count, 1);
  assert.equal((await request('/messages/unread-count', 'COURIER', undefined, 'GET')).data.count, 0);
  assert.equal(chat.buyer.tin_or_passport, undefined); assert.equal(chat.seller.password_hash, undefined);
  const history = await request(path, 'FARMER', undefined, 'GET');
  assert.equal(history.data.messages[0].body, 'Assalomu alaykum, olma bormi?');
  assert.ok(history.data.messages[0].read_at);
  assert.equal((await request('/messages/unread-count', 'FARMER', undefined, 'GET')).data.count, 0);
  assert.equal((await request(path, 'FARMER', { body: 'Va alaykum assalom, albatta bor.' })).status, 201);
  assert.equal((await request(path, 'BUYER_B2C', undefined, 'GET')).data.messages.length, 2);
  await request(`/products/${p.id}`, 'FARMER', undefined, 'DELETE');
  assert.equal((await prisma.product.findUnique({ where: { id: p.id } })).is_active, false);
  assert.equal((await request(path, 'BUYER_B2C', undefined, 'GET')).data.messages.length, 2);
});

test('message history paginates without loss and rejects foreign cursors', options, async () => {
  const p = await makeProduct();
  const opened = await request('/messages/conversations', 'BUYER_B2B', { product_id: p.id });
  const id = opened.data.id; const path = `/messages/conversations/${id}/messages`;
  await prisma.message.createMany({ data: Array.from({ length: 65 }, (_,i) => ({ client_id: randomUUID(), conversation_id: id, sender_id: users.BUYER_B2B.id, body: `Xabar ${i}`, created_at: new Date(Date.now() + i) })) });
  const latest = await request(path, 'FARMER', undefined, 'GET');
  assert.equal(latest.data.messages.length, 50); assert.ok(latest.data.next_cursor);
  const older = await request(`${path}?before=${latest.data.next_cursor}`, 'FARMER', undefined, 'GET');
  assert.equal(older.data.messages.length, 15); assert.equal(older.data.next_cursor, null);
  assert.equal(new Set([...older.data.messages, ...latest.data.messages].map((m:any) => m.id)).size, 65);
  assert.equal((await request(`${path}?before=${randomUUID()}`, 'FARMER', undefined, 'GET')).status, 400);
});

test('farmer stock edits detect stale quantities and analytics uses actual payout ledger', options, async () => {
  const p = await makeProduct(10);
  const order = (await createOrder(p, 1)).data;
  const stale = await request(`/products/${p.id}`, 'FARMER', { available_quantity_kg: 20, expected_quantity_kg: 10 }, 'PUT');
  assert.equal(stale.status, 409);
  assert.equal((await prisma.product.findUnique({ where: { id:p.id } })).available_quantity_kg, 9);
  assert.equal((await request(`/products/${p.id}`, 'FARMER', { available_quantity_kg: 20, expected_quantity_kg: 9 }, 'PUT')).status, 200);
  await prisma.transaction.create({ data: { order_id:order.id, user_id:users.FARMER.id, type:'ESCROW_RELEASE_FARMER', amount:4500 } });
  const stats = await request(`/products/${p.id}/analytics`, 'FARMER', undefined, 'GET');
  assert.equal(stats.data.earned, 4500);
});

test('price recommendations separate commodities, regions, processing and unapproved stock', options, async () => {
  const apple = await makeProduct();
  const grapes = await makeProduct();
  const dried = await makeProduct();
  await prisma.product.update({where:{id:apple.id},data:{title:'Qizil olma',price_per_kg:12345,region:'Narx test hududi'}});
  await prisma.product.update({where:{id:grapes.id},data:{title:'Shirin uzum',price_per_kg:50000,region:'Narx test hududi'}});
  await prisma.product.update({where:{id:dried.id},data:{title:'Quritilgan olma',price_per_kg:80000,region:'Narx test hududi'}});
  const emptyStock = await makeProduct(0);
  await prisma.product.update({where:{id:emptyStock.id},data:{title:'Olma',price_per_kg:1,region:'Narx test hududi'}});
  const pendingFarmerId=randomUUID();ids.push(pendingFarmerId);
  await prisma.user.create({data:{id:pendingFarmerId,phone:`test-${pendingFarmerId}`,password_hash:'unused',full_name:'Pending farmer',role:'FARMER',region:'Narx test hududi',tin_or_passport:'TEST',kyc_status:'PENDING'}});
  const hidden=await makeProduct();
  await prisma.product.update({where:{id:hidden.id},data:{farmer_id:pendingFarmerId,title:'Olma',price_per_kg:999999,region:'Narx test hududi'}});
  const rec = await request('/products/price-recommendation?category=MEVALAR&title=Olma&region=Narx%20test',undefined,undefined,'GET');
  assert.equal(rec.status,200);assert.equal(rec.data.recommended_price,12345);assert.equal(rec.data.sample_count,1);
  const none = await request('/products/price-recommendation?category=MEVALAR&title=Dragonfruit',undefined,undefined,'GET');
  assert.equal(none.data.recommended_price,null);assert.equal(none.data.sample_count,0);
  const noTitle = await request('/products/price-recommendation?category=MEVALAR',undefined,undefined,'GET');
  assert.equal(noTitle.data.recommended_price,null);
  const invalid = await request('/products/price-recommendation?category=INVALID&title=olma',undefined,undefined,'GET');
  assert.equal(invalid.status,400);
});

test('unconfigured online payment rejects checkout before reserving stock', options, async () => {
  const mode = process.env.PAYMENT_MODE;delete process.env.PAYMENT_MODE;
  const p = await makeProduct(5);
  try {
    const options = await request('/payments/options',undefined,undefined,'GET');
    assert.deepEqual(options.data.methods,[]);
    assert.equal((await createOrder(p)).status,503);
    assert.equal((await request('/orders/checkout','BUYER_B2C',{items:[{product_id:p.id,quantity_kg:1}],delivery_address:'Toshkent test address',payment_method:'CLICK'})).status,503);
    assert.equal((await prisma.product.findUnique({where:{id:p.id}})).available_quantity_kg,5);
  } finally { process.env.PAYMENT_MODE=mode; }
});

test('Payme redirects without payment, authenticates callbacks, holds escrow exactly once and refunds externally once', options, async () => {
  const saved = Object.fromEntries(['PAYMENT_MODE','PAYME_MERCHANT_ID','PAYME_KEY','PAYME_SANDBOX','APP_URL'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{PAYMENT_MODE:'payme',PAYME_MERCHANT_ID:'0123456789abcdef01234567',PAYME_KEY:'test-merchant-key',PAYME_SANDBOX:'true',APP_URL:'https://agrobozor.example'});
  const rpc = async(method:string,params:any,valid=true)=>{
    const res = await fetch(base+'/api/payments/payme',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from('Paycom:'+(valid?'test-merchant-key':'wrong-key')).toString('base64')},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
    assert.equal(res.status,200);return res.json();
  };
  try {
    const p = await makeProduct(10); const created = await createOrder(p,1,'BUYER_B2C','PAYME');assert.equal(created.status,201);
    const o = created.data;
    const checkout = await request(`/orders/${o.id}/pay`,'BUYER_B2C',{});
    assert.equal(checkout.data.pending_payment,true);assert.ok(checkout.data.checkout_url.startsWith('https://test.paycom.uz/'));
    assert.equal((await prisma.order.findUnique({where:{id:o.id}})).status,'PENDING_PAYMENT');
    const info = {account:{order_id:o.id},amount:o.total_paid*100};
    assert.equal((await rpc('CheckPerformTransaction',info,false)).error.code,-32504);
    assert.equal((await rpc('CheckPerformTransaction',{...info,amount:1})).error.code,-31001);
    assert.equal((await rpc('CheckPerformTransaction',info)).result.allow,true);
    const id = randomUUID().replaceAll('-','').slice(0,24);const time=Date.now();
    const transaction = await rpc('CreateTransaction',{...info,id,time});assert.equal(transaction.result.state,1);
    assert.equal((await rpc('CreateTransaction',{...info,id,time})).result.transaction,transaction.result.transaction);
    assert.equal((await rpc('CreateTransaction',{...info,id:'abcdefabcdefabcdefabcdef',time})).error.code,-31099);
    const { releaseExpiredOrders } = await import('../src/routes/orders.js');
    await prisma.order.update({where:{id:o.id},data:{created_at:new Date(Date.now()-40*60000)}});
    await releaseExpiredOrders();assert.equal((await prisma.order.findUnique({where:{id:o.id}})).status,'PENDING_PAYMENT');
    const paid = await Promise.all([rpc('PerformTransaction',{id}),rpc('PerformTransaction',{id})]);
    for(const r of paid)assert.equal(r.result.state,2);
    assert.equal(await prisma.transaction.count({where:{order_id:o.id,type:'ESCROW_HOLD'}}),1);
    const before = (await prisma.user.findUnique({where:{id:users.BUYER_B2C.id}})).wallet_available;
    const refunds = await Promise.all([rpc('CancelTransaction',{id,reason:1}),rpc('CancelTransaction',{id,reason:1})]);
    for(const r of refunds)assert.equal(r.result.state,-2);
    assert.equal((await prisma.user.findUnique({where:{id:users.BUYER_B2C.id}})).wallet_available,before);
    assert.equal(await prisma.transaction.count({where:{order_id:o.id,type:'REFUND_EXTERNAL'}}),1);
    assert.equal((await prisma.product.findUnique({where:{id:p.id}})).available_quantity_kg,10);
    const statement = await rpc('GetStatement',{from:time-1,to:time+1});assert.equal(statement.result.transactions.length,1);assert.equal(statement.result.transactions[0].state,-2);
    const malformed = await fetch(base+'/api/payments/payme',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,200);assert.equal((await malformed.json()).error.code,-32700);
  } finally { for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v; }
});

test('Payme expiry and buyer cancellation release a reservation once and block late confirmation', options, async () => {
  const saved = Object.fromEntries(['PAYMENT_MODE','PAYME_MERCHANT_ID','PAYME_KEY','PAYME_SANDBOX','APP_URL'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{PAYMENT_MODE:'payme',PAYME_MERCHANT_ID:'0123456789abcdef01234567',PAYME_KEY:'test-merchant-key',PAYME_SANDBOX:'true',APP_URL:'https://agrobozor.example'});
  const rpc=async(method:string,params:any)=>(await fetch(base+'/api/payments/payme',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from('Paycom:test-merchant-key').toString('base64')},body:JSON.stringify({id:1,method,params})})).json();
  try {
    for(const expired of [true,false]) {
      const p=await makeProduct(2);const order=(await createOrder(p,1,'BUYER_B2C','PAYME')).data;
      const id=randomUUID().replaceAll('-','').slice(0,24);
      assert.equal((await rpc('CreateTransaction',{id,time:Date.now(),amount:order.total_paid*100,account:{order_id:order.id}})).result.state,1);
      if(expired){await prisma.paymeTransaction.update({where:{provider_id:id},data:{expires_at:new Date(Date.now()-1000)}});assert.equal((await rpc('PerformTransaction',{id})).error.code,-31008);}
      else assert.equal((await request(`/orders/${order.id}/cancel`,'BUYER_B2C',{})).status,200);
      assert.equal((await rpc('PerformTransaction',{id})).error.code,-31008);
      assert.equal((await prisma.product.findUnique({where:{id:p.id}})).available_quantity_kg,2);
      assert.equal((await rpc('CheckTransaction',{id})).result.state,-1);
    }
  }finally{for(const [k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

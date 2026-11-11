import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

test('two real mobile sessions exchange messages and farmer sees the viewer', async ({
  browser,
  request,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    'Requires a dedicated PostgreSQL test database',
  );
  const db = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL! } },
  });
  const sellerId = randomUUID(),
    buyerId = randomUUID(),
    productId = randomUUID();
  const password = 'e2e-password-123';
  const sellerEmail = `${sellerId}@example.com`,
    buyerEmail = `${buyerId}@example.com`;
  const seller = await browser.newContext({
    baseURL: 'http://127.0.0.1:5000',
    viewport: { width: 375, height: 812 },
  });
  const buyer = await browser.newContext({
    baseURL: 'http://127.0.0.1:5000',
    viewport: { width: 375, height: 812 },
  });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    await db.user.createMany({
      data: [
        {
          id: sellerId,
          phone: '+998901234561',
          email: sellerEmail,
          role: 'FARMER',
          full_name: 'E2E Fermer',
        },
        {
          id: buyerId,
          phone: '+998901234562',
          email: buyerEmail,
          role: 'BUYER_B2C',
          full_name: 'E2E Xaridor',
        },
      ].map((u) => ({
        ...u,
        password_hash,
        region: 'Toshkent',
        tin_or_passport: 'PRIVATE-PASSPORT-TEST',
        kyc_status: 'APPROVED',
      })),
    });
    await db.product.create({
      data: {
        id: productId,
        farmer_id: sellerId,
        title: 'E2E Shirin olma',
        category: 'MEVALAR',
        price_per_kg: 12000,
        available_quantity_kg: 50,
        min_order_kg: 1,
        harvest_date: new Date(),
        image_url:
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
        region: 'Toshkent',
      },
    });
    const sellerLogin = await request.post('/api/auth/login', {
      data: { email: sellerEmail, password },
    });
    const buyerLogin = await request.post('/api/auth/login', {
      data: { email: buyerEmail, password },
    });
    expect(sellerLogin.ok()).toBe(true);
    expect(buyerLogin.ok()).toBe(true);
    await seller.addInitScript(
      (token) => localStorage.setItem('agro_token', token),
      (await sellerLogin.json()).token,
    );
    await buyer.addInitScript(
      (token) => localStorage.setItem('agro_token', token),
      (await buyerLogin.json()).token,
    );
    const sellerPage = await seller.newPage(),
      buyerPage = await buyer.newPage();
    await sellerPage.goto('/');
    await buyerPage.goto('/');
    await expect(
      sellerPage.getByRole('button', { name: 'Mening mahsulotlarim' }),
    ).toBeVisible();
    await buyerPage
      .getByRole('button', { name: 'E2E Shirin olma', exact: true })
      .click();
    await expect(buyerPage.getByRole('dialog')).not.toContainText(
      'PRIVATE-PASSPORT-TEST',
    );
    await expect(
      buyerPage.getByRole('link', { name: '+998901234561' }),
    ).toHaveAttribute('href', 'tel:+998901234561');
    await buyerPage
      .getByRole('button', { name: 'Sotuvchiga yozish', exact: true })
      .click();
    await buyerPage
      .getByLabel('Xabaringiz')
      .fill('Assalomu alaykum! 10 kg olma olmoqchiman.');
    await buyerPage
      .getByRole('button', { name: 'Xabar yuborish', exact: true })
      .click();
    await expect(buyerPage.getByRole('log')).toContainText(
      '10 kg olma olmoqchiman.',
    );
    await sellerPage
      .getByRole('navigation', { name: 'Pastki menyu' })
      .getByRole('button', { name: 'Xabarlar', exact: true })
      .click();
    await sellerPage
      .getByRole('complementary', { name: 'Suhbatlar' })
      .getByRole('button')
      .filter({ hasText: 'E2E Xaridor' })
      .click();
    await expect(sellerPage.getByRole('log')).toContainText(
      '10 kg olma olmoqchiman.',
    );
    await sellerPage
      .getByLabel('Xabaringiz')
      .fill('Va alaykum assalom! Albatta, mavjud.');
    await sellerPage
      .getByRole('button', { name: 'Xabar yuborish', exact: true })
      .click();
    await expect(buyerPage.getByRole('log')).toContainText('Albatta, mavjud.', {
      timeout: 12000,
    });
    await sellerPage
      .getByRole('navigation', { name: 'Pastki menyu' })
      .getByRole('button', { name: 'Kabinet', exact: true })
      .click();
    await sellerPage
      .getByRole('button', { name: 'Statistika', exact: true })
      .click();
    await expect(sellerPage.getByRole('dialog')).toContainText('E2E Xaridor');
    await expect(sellerPage.getByRole('dialog')).not.toContainText(
      'PRIVATE-PASSPORT-TEST',
    );
    expect(
      await buyerPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await buyerPage.screenshot({ path: 'test-results/mobile-messages.png' });
    await sellerPage.screenshot({ path: 'test-results/farmer-analytics.png' });
  } finally {
    await seller.close();
    await buyer.close();
    await db.conversation.deleteMany({ where: { product_id: productId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.user.deleteMany({ where: { id: { in: [sellerId, buyerId] } } });
    await db.$disconnect();
  }
});

import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import prisma from '../db.js';
import { paymeConfig, paymentMode } from './payment-options.js';
import { holdInEscrow } from './settlement.js';
import { PAYMENT_TIMEOUT_MIN } from '../config.js';

const TTL = 43_200_000; // Payme Merchant API: twelve hours from provider creation time.
class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: string,
  ) {
    super(message);
  }
}
function fail(code: number, message: string, data?: string): never {
  throw new RpcError(code, message, data);
}
function fields(t: any) {
  return {
    transaction: t.id,
    create_time: t.create_time.getTime(),
    perform_time: t.perform_time?.getTime() || 0,
    cancel_time: t.cancel_time?.getTime() || 0,
    state: t.state,
    reason: t.reason,
  };
}
async function atomic<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e: any) {
      if (attempt < 3 && (e.code === 'P2034' || e.code === 'P2002')) continue;
      throw e;
    }
  }
}
function authenticated(req: Request) {
  const c = paymeConfig();
  if (paymentMode() !== 'payme' || !c.ready) return false;
  const supplied = req.headers.authorization || '';
  if (supplied.length > 1024 || !supplied.startsWith('Basic ')) return false;
  const actual = Buffer.from(supplied.slice(6), 'base64').toString('utf8');
  return timingSafeEqual(
    createHash('sha256').update(actual).digest(),
    createHash('sha256').update(`Paycom:${c.key}`).digest(),
  );
}
async function pendingOrder(tx: Prisma.TransactionClient, p: any) {
  const id = p?.account?.order_id;
  if (typeof id !== 'string' || !id)
    fail(-31050, 'Buyurtma topilmadi', 'order_id');
  const order = await tx.order.findUnique({
    where: { id },
    include: { payme_transaction: true },
  });
  if (!order || order.payment_method !== 'PAYME')
    fail(-31050, 'Buyurtma topilmadi', 'order_id');
  if (!Number.isSafeInteger(p.amount) || p.amount !== order.total_paid * 100)
    fail(-31001, 'To‘lov summasi noto‘g‘ri');
  if (order.status !== 'PENDING_PAYMENT')
    fail(-31008, 'Buyurtma to‘lov kutmayapti');
  const active =
    order.payme_transaction?.state === 1 &&
    order.payme_transaction.expires_at.getTime() > Date.now();
  if (
    !active &&
    Date.now() - order.created_at.getTime() > PAYMENT_TIMEOUT_MIN * 60000
  )
    fail(-31008, 'Buyurtma muddati tugagan');
  return order;
}
async function cancelPending(
  tx: Prisma.TransactionClient,
  t: any,
  reason: number,
) {
  const now = new Date();
  const changed = await tx.order.updateMany({
    where: { id: t.order_id, status: 'PENDING_PAYMENT' },
    data: { status: 'CANCELLED' },
  });
  if (changed.count) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: t.order_id },
    });
    await tx.product.update({
      where: { id: order.product_id },
      data: { available_quantity_kg: { increment: order.quantity_kg } },
    });
  }
  return tx.paymeTransaction.update({
    where: { id: t.id },
    data: { state: -1, reason, cancel_time: now },
  });
}
async function dispatch(method: string, p: any): Promise<any> {
  if (method === 'CheckPerformTransaction')
    return atomic(async (tx) => {
      const order = await pendingOrder(tx, p);
      if (order.payme_transaction)
        fail(
          -31099,
          'Bu buyurtma uchun tranzaksiya allaqachon yaratilgan',
          'order_id',
        );
      return { allow: true };
    });
  if (method === 'CreateTransaction') {
    if (
      typeof p.id !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(p.id) ||
      !Number.isSafeInteger(p.time) ||
      p.time <= 0 ||
      p.time > Date.now() + 300000
    )
      fail(-32602, 'Tranzaksiya parametrlari noto‘g‘ri');
    const result = await atomic(async (tx) => {
      const existing = await tx.paymeTransaction.findUnique({
        where: { provider_id: p.id },
      });
      if (existing) {
        if (
          existing.order_id !== p.account?.order_id ||
          Number(existing.amount_tiyin) !== p.amount
        )
          fail(-31001, 'Tranzaksiya ma’lumotlari mos emas');
        if (existing.state === 1 && existing.expires_at.getTime() <= Date.now())
          return { expired: true, t: await cancelPending(tx, existing, 4) };
        if (existing.state !== 1)
          fail(-31008, 'Tranzaksiya bu holatda yaratilmaydi');
        return { t: existing, expired: false };
      }
      const order = await pendingOrder(tx, p);
      if (order.payme_transaction)
        fail(-31099, 'Buyurtma boshqa tranzaksiyada band', 'order_id');
      if (p.time + TTL <= Date.now())
        fail(-31008, 'Tranzaksiya muddati tugagan');
      const t = await tx.paymeTransaction.create({
        data: {
          provider_id: p.id,
          provider_time: BigInt(p.time),
          amount_tiyin: BigInt(p.amount),
          order_id: order.id,
          expires_at: new Date(p.time + TTL),
        },
      });
      return { t, expired: false };
    });
    if (result.expired) fail(-31008, 'Tranzaksiya muddati tugagan');
    return {
      transaction: result.t.id,
      create_time: result.t.create_time.getTime(),
      state: result.t.state,
    };
  }
  if (method === 'GetStatement') {
    if (
      !Number.isSafeInteger(p.from) ||
      !Number.isSafeInteger(p.to) ||
      p.from < 0 ||
      p.from > p.to
    )
      fail(-32602, 'Davr noto‘g‘ri');
    const rows = await prisma.paymeTransaction.findMany({
      where: { provider_time: { gte: BigInt(p.from), lte: BigInt(p.to) } },
      orderBy: [{ provider_time: 'asc' }, { id: 'asc' }],
    });
    return {
      transactions: rows.map((t) => ({
        id: t.provider_id,
        time: Number(t.provider_time),
        amount: Number(t.amount_tiyin),
        account: { order_id: t.order_id },
        ...fields(t),
      })),
    };
  }
  if (
    !['PerformTransaction', 'CancelTransaction', 'CheckTransaction'].includes(
      method,
    )
  )
    fail(-32601, 'Metod topilmadi', method);
  if (typeof p.id !== 'string') fail(-32602, 'Tranzaksiya ID kerak');
  const result = await atomic(async (tx) => {
    const t = await tx.paymeTransaction.findUnique({
      where: { provider_id: p.id },
      include: { order: true },
    });
    if (!t) fail(-31003, 'Tranzaksiya topilmadi');
    if (method === 'CheckTransaction') return { t, expired: false };
    if (method === 'PerformTransaction') {
      if (t.state === 2) return { t, expired: false };
      if (t.state !== 1) fail(-31008, 'Tranzaksiya bajarilmaydi');
      if (t.expires_at.getTime() <= Date.now())
        return { t: await cancelPending(tx, t, 4), expired: true };
      const changed = await tx.order.updateMany({
        where: { id: t.order_id, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID_IN_ESCROW' },
      });
      if (changed.count !== 1) fail(-31008, 'Buyurtma holati o‘zgargan');
      await holdInEscrow(tx, t.order);
      return {
        t: await tx.paymeTransaction.update({
          where: { id: t.id },
          data: { state: 2, perform_time: new Date() },
        }),
        expired: false,
      };
    }
    if (!Number.isInteger(p.reason) || p.reason < 1 || p.reason > 10)
      fail(-32602, 'Bekor qilish sababi noto‘g‘ri');
    if (t.state < 0) return { t, expired: false };
    if (t.state === 1)
      return { t: await cancelPending(tx, t, p.reason), expired: false };
    // Payme returns money to the card: never also credit the buyer's internal wallet.
    const changed = await tx.order.updateMany({
      where: {
        id: t.order_id,
        status: { in: ['PAID_IN_ESCROW', 'CONFIRMED_BY_FARMER'] },
        courier_id: null,
      },
      data: { status: 'REFUNDED' },
    });
    if (changed.count !== 1)
      fail(-31007, 'Buyurtma bajarilgan yoki mablag‘ allaqachon taqsimlangan');
    await tx.product.update({
      where: { id: t.order.product_id },
      data: { available_quantity_kg: { increment: t.order.quantity_kg } },
    });
    await tx.user.update({
      where: { id: t.order.farmer_id },
      data: { wallet_escrow: { decrement: t.order.farmer_payout } },
    });
    await tx.transaction.create({
      data: {
        order_id: t.order_id,
        user_id: t.order.buyer_id,
        amount: t.order.total_paid,
        type: 'REFUND_EXTERNAL',
      },
    });
    return {
      t: await tx.paymeTransaction.update({
        where: { id: t.id },
        data: { state: -2, reason: p.reason, cancel_time: new Date() },
      }),
      expired: false,
    };
  });
  if (result.expired) fail(-31008, 'Tranzaksiya muddati tugagan');
  const f = fields(result.t);
  if (method === 'PerformTransaction')
    return {
      transaction: f.transaction,
      perform_time: f.perform_time,
      state: f.state,
    };
  if (method === 'CancelTransaction')
    return {
      transaction: f.transaction,
      cancel_time: f.cancel_time,
      state: f.state,
    };
  return f;
}
export async function paymeHandler(req: Request, res: Response) {
  const id =
    typeof req.body?.id === 'number' || typeof req.body?.id === 'string'
      ? req.body.id
      : null;
  try {
    if (!authenticated(req)) fail(-32504, 'Avtorizatsiya xatosi');
    const { method, params } = req.body || {};
    if (
      typeof method !== 'string' ||
      !params ||
      typeof params !== 'object' ||
      Array.isArray(params)
    )
      fail(-32600, 'So‘rov noto‘g‘ri');
    const result = await dispatch(method, params);
    res.json({ jsonrpc: '2.0', id, result });
  } catch (e) {
    const error =
      e instanceof RpcError
        ? e
        : new RpcError(-32400, 'To‘lov serverida vaqtinchalik xatolik');
    if (!(e instanceof RpcError)) console.error('Payme transaction error:', e);
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code,
        message: { uz: error.message, ru: error.message, en: error.message },
        ...(error.data ? { data: error.data } : {}),
      },
    });
  }
}

import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PaymentMethod } from '../types';
import { ModalFrame } from './ModalFrame';
import { PaymentSelector, usePaymentOptions } from './PaymentSelector';
export function CartCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { items, subtotal, deliveryFee, grandTotal, clearCart } = useCart();
  const { user } = useAuth();
  const options = usePaymentOptions(isOpen, user?.role === 'BUYER_B2B');
  const [address, setAddress] = useState(user?.region || '');
  const [schedule, setSchedule] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(
    user?.role === 'BUYER_B2B' ? 'INVOICE_B2B' : 'CLICK',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    message: string;
    total: number;
    paid: boolean;
    links: Array<{ id: string; title: string; amount: number; url: string }>;
  } | null>(null);
  useEffect(() => {
    if (isOpen) {
      setReceipt(null);
      setError('');
    }
  }, [isOpen]);
  useEffect(() => {
    if (!options.loading)
      setMethod((old) =>
        options.methods.includes(old) ? old : options.methods[0] || 'CLICK',
      );
  }, [options.loading, options.mode, options.methods.join(',')]);
  if (!isOpen) return null;
  const finish = () => {
    onSuccess();
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || receipt) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.orders.checkout({
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity_kg: i.quantity_kg,
        })),
        delivery_address: address,
        delivery_schedule: schedule || undefined,
        payment_method: method,
      });
      let failures = 0,
        pending = 0,
        demo = false;
      const links: Array<{
        id: string;
        title: string;
        amount: number;
        url: string;
      }> = [];
      if (method !== 'INVOICE_B2B')
        for (const order of created.orders) {
          try {
            const result = await api.orders.pay(order.id);
            if (result.pending_payment) {
              pending++;
              if (result.checkout_url)
                links.push({
                  id: order.id,
                  title: order.product_title || 'Buyurtma',
                  amount: order.total_paid,
                  url: result.checkout_url,
                });
            } else if (result.order.status !== 'PAID_IN_ESCROW') {
              failures++;
            } else {
              demo ||= !!result.is_demo;
            }
          } catch {
            failures++;
          }
        }
      clearCart();
      const message =
        method === 'INVOICE_B2B'
          ? `${created.orders.length} ta buyurtma yaratildi. Bank to‘lovi tasdiqlanishi kutilmoqda.`
          : failures
            ? `${created.orders.length} ta buyurtma yaratildi. ${failures} ta buyurtma to'lovi tasdiqlanmadi. Buyurtmalar sahifasida holatni tekshirib, qayta to‘lang.`
            : pending
              ? `${pending} ta buyurtma to‘lov kutmoqda. Har bir buyurtmani Payme orqali to‘lang.`
              : demo
                ? 'Sinov to‘lovlari bajarildi. Haqiqiy pul yechilmadi.'
                : 'Barcha buyurtmalar to‘lovi tasdiqlandi.';
      setReceipt({
        message,
        total: created.grand_total,
        paid: !failures && !pending && method !== 'INVOICE_B2B',
        links,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Buyurtmalar yaratishda xatolik',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalFrame title="Savatni rasmiylashtirish" onClose={onClose}>
      {error && (
        <p
          role="alert"
          className="text-sm text-rose-700 bg-rose-50 p-3 rounded-xl"
        >
          {error}
        </p>
      )}
      {receipt ? (
        <div className="space-y-4">
          <p
            role="status"
            className={`p-4 rounded-xl text-sm ${receipt.paid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
          >
            {receipt.message}
          </p>
          <p className="font-bold">
            Buyurtmalar jami: {receipt.total.toLocaleString()} so‘m
          </p>
          {receipt.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              className="block border border-emerald-700 rounded-xl p-4 text-emerald-800 font-bold"
            >
              {link.title}: {link.amount.toLocaleString()} so‘m — Payme orqali
              to‘lash
            </a>
          ))}
          <button
            onClick={finish}
            className="w-full p-4 bg-agro-green text-white rounded-xl font-bold"
          >
            Buyurtmalarni ko‘rish
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ul className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            {items.map((i) => (
              <li key={i.product.id} className="flex justify-between gap-2">
                <span>
                  {i.product.title} · {i.quantity_kg} kg
                </span>
                <strong>
                  {Math.round(
                    i.quantity_kg * i.product.price_per_kg,
                  ).toLocaleString()}{' '}
                  so‘m
                </strong>
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            Yetkazib berish manzili
            <input
              required
              minLength={5}
              maxLength={300}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tuman, ko‘cha, uy raqami"
              className="block mt-2 w-full p-3 border rounded-xl"
            />
          </label>
          {user?.role === 'BUYER_B2B' && (
            <label className="block text-sm">
              Yetkazib berish jadvali
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="block mt-2 w-full p-3 border rounded-xl"
              />
            </label>
          )}
          <PaymentSelector
            options={options}
            value={method}
            onChange={setMethod}
          />
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <p className="flex justify-between">
              <span>Mahsulotlar</span>
              <strong>{subtotal.toLocaleString()} so‘m</strong>
            </p>
            <p className="flex justify-between">
              <span>Yetkazish ({items.length} buyurtma)</span>
              <strong>{deliveryFee.toLocaleString()} so‘m</strong>
            </p>
            <p className="flex justify-between border-t pt-2">
              <span>Jami</span>
              <strong>{grandTotal.toLocaleString()} so‘m</strong>
            </p>
          </div>
          <button
            disabled={
              busy ||
              !items.length ||
              options.loading ||
              !options.methods.includes(method)
            }
            className="w-full p-4 rounded-xl bg-agro-green text-white font-bold disabled:opacity-40"
          >
            {busy ? 'Rasmiylashtirilmoqda…' : 'Buyurtmani Tasdiqlash'}
          </button>
        </form>
      )}
    </ModalFrame>
  );
}

import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PaymentMethod } from '../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  Calendar,
  Package,
} from 'lucide-react';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { items, subtotal, deliveryFee, grandTotal, clearCart } = useCart();
  const { user } = useAuth();

  const [address, setAddress] = useState<string>(
    user?.region ? `${user.region}, Markaziy ko'cha 1` : ''
  );
  const [schedule, setSchedule] = useState<string>(
    user?.role === 'BUYER_B2B' ? 'Har dushanba va payshanba soat 09:00 gacha' : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    user?.role === 'BUYER_B2B' ? 'INVOICE_B2B' : 'CLICK'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setLoading(false);
      setPaymentMethod(user?.role === 'BUYER_B2B' ? 'INVOICE_B2B' : 'CLICK');
      if (user?.region && !address) {
        setAddress(`${user.region}, Markaziy ko'cha 1`);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Guruhlangan fermerlar soni
  const distinctFarmersCount = new Set(items.map((i) => i.product.farmer_id)).size;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Savatingiz bo'sh");
      return;
    }

    if (!address.trim()) {
      setError('Iltimos, yetkazib berish manzilini kiriting');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity_kg: i.quantity_kg,
        })),
        delivery_address: address.trim(),
        delivery_schedule: schedule.trim() || undefined,
        payment_method: paymentMethod,
      };

      const res = await api.orders.checkout(payload);

      // Agar onlayn to'lov (demo) bo'lsa, har bir buyurtmani avtomatik to'lash
      if (paymentMethod !== 'INVOICE_B2B') {
        for (const order of res.orders) {
          try {
            await api.orders.pay(order.id, paymentMethod);
          } catch (payErr) {
            console.error('Auto pay error:', payErr);
          }
        }
      }

      clearCart();
      setSuccessMessage(
        paymentMethod === 'INVOICE_B2B'
          ? `Muvaffaqiyatli! ${res.orders.length} ta buyurtma uchun B2B hisob-faktura shakllantirildi. Admin to'lovni tasdiqlagach buyurtmalar yuboriladi.`
          : `Muvaffaqiyatli! ${res.orders.length} ta mahsulot uchun buyurtma qabul qilindi va to'lov Escrow himoyasiga o'tkazildi.`
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err?.message || 'Buyurtmalarni rasmiylashtirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 px-6 bg-agro-green text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-agro-amber" />
            <h3 className="font-extrabold text-base">Savatdagi Barcha Mahsulotlarni Rasmiylashtirish</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Mahsulotlar ro'yxati qisqacha */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto p-3 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Buyurtma qilinayotgan mahsulotlar ({items.length} ta)
            </div>
            {items.map((i) => (
              <div key={i.product.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-200/60 last:border-0">
                <span className="font-medium text-gray-800">
                  {i.product.title} <span className="text-gray-500 font-normal">({i.quantity_kg} kg)</span>
                </span>
                <span className="font-bold text-gray-900">
                  {(i.quantity_kg * i.product.price_per_kg).toLocaleString()} so'm
                </span>
              </div>
            ))}
          </div>

          {/* Manzil */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Yetkazib berish manzili:
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Viloyat/tuman, ko'cha, uy raqami..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none focus:ring-1 focus:ring-agro-green"
            />
          </div>

          {/* B2B Yetkazib berish jadvali */}
          {(user?.role === 'BUYER_B2B' || schedule) && (
            <div>
              <label className="flex items-center space-x-1.5 text-xs font-bold text-purple-900 mb-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>B2B Yetkazib berish jadvali (ixtiyoriy):</span>
              </label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="Masalan: Har dushanba va payshanba soat 08:00 gacha"
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50/50 focus:border-purple-600 focus:outline-none"
              />
            </div>
          )}

          {/* To'lov usuli */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700">
                To'lov usuli:
              </label>
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                Online to'lov test/demo rejimida
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'CLICK', name: 'Click Up', badge: 'Demo' },
                { id: 'PAYME', name: 'Payme', badge: 'Demo' },
                { id: 'UZCARD', name: 'Uzcard', badge: 'Demo' },
                { id: 'HUMO', name: 'Humo', badge: 'Demo' },
                { id: 'INVOICE_B2B', name: 'B2B Invoice', badge: 'Bank' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                    paymentMethod === m.id
                      ? 'border-agro-green bg-agro-paleGreen text-agro-dark shadow-sm ring-1 ring-agro-green'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-agro-green" />
                    <span>{m.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-normal">{m.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Xulosa hisob-kitob */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Mahsulotlar jami:</span>
              <strong className="text-gray-900">{subtotal.toLocaleString()} so'm</strong>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5 text-gray-500" />
                <span>Logistika ({distinctFarmersCount} ta fermer partiyasi):</span>
              </span>
              <strong className="text-gray-900">{deliveryFee.toLocaleString()} so'm</strong>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
              <span className="font-extrabold text-gray-900">Jami to'lov:</span>
              <span className="text-lg font-black text-agro-green">
                {grandTotal.toLocaleString()} so'm
              </span>
            </div>

            <div className="pt-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/60 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <span>
                <strong>100% Escrow Kafolati:</strong> Barcha mahsulotlar yetkazib berilib, siz qabul qilmaguningizcha mablag' xavfsiz saqlanadi.
              </span>
            </div>
          </div>

          {/* Tasdiqlash tugmasi */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-6 py-2.5 rounded-xl bg-agro-green hover:bg-agro-lightGreen text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/15 disabled:opacity-50"
            >
              {loading ? "Rasmiylashtirilmoqda..." : "Buyurtmani Tasdiqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

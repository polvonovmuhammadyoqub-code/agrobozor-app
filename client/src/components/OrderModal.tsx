import React, { useState } from 'react';
import { Product, PaymentMethod } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatQty, formatUnitName } from '../lib/units';
import { TASHKENT_CITY_DISTRICTS, TASHKENT_REGION_DISTRICTS } from '../lib/districts';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';

interface OrderModalProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const [quantity, setQuantity] = useState<number>(product?.min_order_kg || 1);
  const [deliveryDistrict, setDeliveryDistrict] = useState<string>('');
  const [address, setAddress] = useState<string>(user?.region ? `${user.region}, Markaziy ko'cha 1` : '');
  const [schedule, setSchedule] = useState<string>(
    user?.role === 'BUYER_B2B' ? 'Har dushanba va payshanba soat 09:00 gacha' : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    user?.role === 'BUYER_B2B' ? 'INVOICE_B2B' : 'CLICK'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!product) return null; // hook'lardan KEYIN (React qoidasi)

  const productTotal = Math.round(quantity * product.price_per_kg);
  const deliveryFee = 15000;
  const grandTotal = productTotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity < product.min_order_kg) {
      setError(`Minimal buyurtma miqdori: ${formatQty(product.min_order_kg, product.unit)}`);
      return;
    }

    if (quantity > product.available_quantity_kg) {
      setError(`Omborda yetarli mahsulot yo'q. Mavjud: ${formatQty(product.available_quantity_kg, product.unit)}`);
      return;
    }

    if (!address.trim()) {
      setError('Iltimos, yetkazib berish manzilini kiriting');
      return;
    }

    setLoading(true);
    try {
      const created = await api.orders.create({
        product_id: product.id,
        quantity_kg: quantity,
        payment_method: paymentMethod,
        delivery_address: address,
        delivery_schedule: schedule || undefined,
        delivery_district: deliveryDistrict || undefined,
      });

      // 2-qadam: to'lov. Muvaffaqiyatsiz bo'lsa buyurtma bekor qilinadi va ombor qoldig'i qaytadi.
      let paid;
      try {
        paid = await api.orders.pay(created.id, paymentMethod);
      } catch (payErr) {
        await api.orders.cancel(created.id).catch(() => {});
        throw payErr;
      }

      setSuccessMessage(
        paid.pending_invoice
          ? "Hisob-faktura shakllandi. Bank o'tkazmasi tasdiqlangach buyurtma faollashadi."
          : "To'lov qabul qilindi! Mablag' Escrow hisobida xavfsiz saqlanmoqda."
      );
      await refreshUser();
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Buyurtma berishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Tepasi */}
        <div className="bg-agro-green text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-agro-amber" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Xavfsiz Escrow Buyurtma</h2>
              <p className="text-xs text-emerald-100">Kafolatlangan yetkazib berish xizmati</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tanasi */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Mahsulot ma'lumoti qisqacha */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <img
              src={product.image_url}
              alt={product.title}
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-sm">{product.title}</h4>
              <div className="text-xs text-gray-500">
                Fermer: {product.farmer?.farm_or_company_name || product.farmer?.full_name} ({product.region})
              </div>
              <div className="text-xs font-bold text-agro-green mt-0.5">
                {product.price_per_kg.toLocaleString()} so'm / {formatUnitName(product.unit)}
              </div>
            </div>
          </div>

          {/* Miqdor tanlash */}
          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <label className="font-bold text-gray-700">Miqdor ({formatUnitName(product.unit)}):</label>
              <span className="text-gray-500">
                Mavjud qoldiq: <strong>{formatQty(product.available_quantity_kg, product.unit)}</strong> (Min: {formatQty(product.min_order_kg, product.unit)})
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(product.min_order_kg, q - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-lg flex items-center justify-center text-gray-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min={product.min_order_kg}
                max={product.available_quantity_kg}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="flex-1 text-center font-extrabold text-base py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(product.available_quantity_kg, q + 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-lg flex items-center justify-center text-gray-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Yetkazib berish tumani va manzili */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Yetkazish tumani (ixtiyoriy):
              </label>
              <select
                value={deliveryDistrict}
                onChange={(e) => setDeliveryDistrict(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-agro-green focus:outline-none"
              >
                <option value="">Tumanni tanlang...</option>
                <optgroup label="Toshkent shahri">
                  {TASHKENT_CITY_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
                <optgroup label="Toshkent viloyati">
                  {TASHKENT_REGION_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Yetkazib berish manzili:
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ko'cha, uy raqami, xonadon..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none focus:ring-1 focus:ring-agro-green"
              />
            </div>
          </div>

          {/* B2B Yetkazib berish jadvali (Doimiy jadval) */}
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

          {/* To'lov usuli tanlash */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              To'lov tizimi (Escrow himoyasida):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'CLICK', name: 'Click Up', badge: 'Online' },
                { id: 'PAYME', name: 'Payme', badge: 'Online' },
                { id: 'UZCARD', name: 'Uzcard', badge: 'Karta' },
                { id: 'HUMO', name: 'Humo', badge: 'Karta' },
                { id: 'INVOICE_B2B', name: 'B2B Invoice', badge: 'Hisob-faktura' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
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

          {/* Moliya hisob-kitobi va Escrow kafolati */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Mahsulot ({quantity} kg × {product.price_per_kg.toLocaleString()} so'm):</span>
              <strong className="text-gray-900">{productTotal.toLocaleString()} so'm</strong>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5 text-gray-500" />
                <span>Standart logistika yetkazish:</span>
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
                <strong>100% Escrow Kafolati:</strong> To'lovingiz platformamizda muzlatiladi. Kuryer mahsulotni yetkazib berib, siz "Qabul qildim" deb tasdiqlaganingizdagina fermerga o'tkaziladi.
              </span>
            </div>
          </div>

          {/* Tasdiqlash tugmasi */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-agro-green hover:bg-agro-lightGreen text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-emerald-900/15 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Rasmiylashtirilmoqda...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-agro-amber" />
                  <span>To'lash va Escrowga qo'yish ({grandTotal.toLocaleString()} so'm)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

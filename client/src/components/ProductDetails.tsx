import { useEffect, useState } from 'react';
import {
  MapPin,
  Phone,
  MessageCircle,
  ShoppingBasket,
  Star,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ModalFrame } from './ModalFrame';
export function ProductDetails({
  id,
  onClose,
  onBuy,
  onMessage,
  onLogin,
}: {
  id: string;
  onClose: () => void;
  onBuy: (p: Product) => void;
  onMessage: (id: string) => Promise<void>;
  onLogin: () => void;
}) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.products
      .getById(id)
      .then((p) => {
        if (!active) return;
        setProduct(p);
        if (user && user.id !== p.farmer_id)
          void api.products.trackView(id).catch(() => {});
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id, retry]);
  const contact = async () => {
    if (!user) {
      sessionStorage.setItem('agro_pending_product', id);
      onLogin();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onMessage(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suhbatni ochib bo‘lmadi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalFrame title="Mahsulot haqida" onClose={onClose}>
      {loading ? (
        <p className="py-12 text-center text-gray-500" role="status">
          Mahsulot yuklanmoqda…
        </p>
      ) : !product ? (
        <div role="alert">
          <p>{error}</p>
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="text-agro-green underline mt-2"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <>
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full aspect-[4/3] object-cover rounded-2xl bg-gray-100"
          />
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-black text-2xl text-agro-dark">
                {product.title}
              </h3>
              <span className="text-emerald-800 bg-emerald-50 p-2 rounded-xl text-sm font-bold flex gap-1">
                <Star size={16} />
                {product.farmer?.rating?.toFixed(1) || '—'}
              </span>
            </div>
            <p className="text-2xl text-agro-green font-black mt-3">
              {product.price_per_kg.toLocaleString()}{' '}
              <span className="text-sm font-normal text-gray-500">
                so‘m / kg
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4 text-sm">
              <p className="text-gray-500 mb-1">Mavjud</p>
              <strong>{product.available_quantity_kg} kg</strong>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-sm">
              <p className="text-gray-500 mb-1">Eng kam buyurtma</p>
              <strong>{product.min_order_kg} kg</strong>
            </div>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <MapPin size={17} />
            {product.region} · Hosil:{' '}
            {new Date(product.harvest_date).toLocaleDateString('uz-UZ')}
          </p>
          {product.reviews && product.reviews.length > 0 && (
            <section>
              <h4 className="font-bold mb-3">Xaridorlar fikri</h4>
              {product.reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="border-b py-3 text-sm">
                  <div className="flex justify-between">
                    <strong>{review.reviewer?.full_name}</strong>
                    <span>★ {review.rating}</span>
                  </div>
                  <p className="text-gray-500 mt-1 break-words">
                    {review.comment}
                  </p>
                </div>
              ))}
            </section>
          )}
          <section className="bg-emerald-50/60 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Sotuvchi
            </p>
            <h4 className="font-bold">
              {product.farmer?.farm_or_company_name ||
                product.farmer?.full_name ||
                'Fermer'}
            </h4>
            <p className="text-sm text-gray-500">
              {product.farmer?.full_name} ·{' '}
              {product.farmer?.region || product.region}
            </p>
            {product.farmer?.phone && (
              <a
                href={`tel:${product.farmer.phone}`}
                className="flex items-center gap-2 text-emerald-800 font-bold"
              >
                <Phone size={18} />
                {product.farmer.phone}
              </a>
            )}
          </section>
          {error && (
            <p
              role="alert"
              className="text-sm text-rose-700 bg-rose-50 p-3 rounded-xl"
            >
              {error}
            </p>
          )}
          <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
            {user?.id === product.farmer_id ? (
              <p className="text-sm text-center text-gray-500">
                Bu sizning mahsulotingiz. Statistikani kabinetingizdan ko‘ring.
              </p>
            ) : (
              <>
                <button
                  onClick={contact}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl bg-agro-green text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <MessageCircle size={20} />
                  {busy ? 'Suhbat ochilmoqda…' : 'Sotuvchiga yozish'}
                </button>
                {(!user || ['BUYER_B2C', 'BUYER_B2B'].includes(user.role)) && (
                  <button
                    disabled={
                      product.available_quantity_kg < product.min_order_kg
                    }
                    onClick={() => (user ? onBuy(product) : onLogin())}
                    className="w-full py-3 rounded-2xl border border-emerald-700 text-emerald-800 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <ShoppingBasket size={18} />
                    {product.available_quantity_kg < product.min_order_kg
                      ? 'Hozircha qolmagan'
                      : 'Buyurtma berish'}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </ModalFrame>
  );
}

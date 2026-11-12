import {formatUnitName, formatQty} from '../lib/units';
import { useEffect, useState } from 'react';
import {
  Plus,
  Eye,
  Package,
  Wallet,
  BarChart3,
  ShoppingBasket,
  Trash2,
  Pencil,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Product, Order } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { OrderCard } from '../components/OrderCard';
import { EditProductModal } from '../components/EditProductModal';
import { ProductAnalyticsModal } from '../components/ProductAnalyticsModal';
interface Props {
  onOpenAddProduct: () => void;
  onOpenWallet: () => void;
  onOpenDispute: (o: Order) => void;
  onOpenInvoice: (id: string) => void;
  onOpenReview: (o: Order) => void;
  onMarket: () => void;
}
export function FarmerDashboard(p: Props) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fetchData = async () => {
    setError('');
    setLoading(true);
    try {
      const [ps, os] = await Promise.all([
        api.products.getMine(),
        api.orders.getAll(),
      ]);
      setProducts(ps);
      setOrders(os);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchData();
  }, [user?.id]);
  const remove = async (id: string) => {
    if (!confirm('Mahsulotni sotuvdan olib tashlaysizmi?')) return;
    setDeleting(id);
    try {
      await api.products.delete(id);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'O‘chirishda xatolik');
    } finally {
      setDeleting(null);
    }
  };
  const totalViews = products.reduce(
    (sum, p) => sum + (p._count?.views || 0),
    0,
  );
  const mostViewed = [...products].sort(
    (a, b) => (b._count?.views || 0) - (a._count?.views || 0),
  )[0];
  const pending = orders.filter((o) => o.status === 'PAID_IN_ESCROW' || (o.payment_method === 'DIRECT_FARMER' && o.status === 'PENDING_PAYMENT')).length;
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-3 items-start">
        <div>
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
            Fermer kabineti
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-agro-dark mt-1">
            Salom, {user?.full_name.split(' ')[0]}!
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Hosilingiz, xaridorlaringiz va savdolaringiz.
          </p>
        </div>
        <button
          onClick={fetchData}
          aria-label="Kabinetni yangilash"
          className="p-3 bg-white border rounded-xl"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {user?.kyc_status !== 'APPROVED' && (
        <p className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl text-sm">
          {user?.kyc_status === 'REJECTED'
            ? 'Profilingiz tasdiqlanmadi. Administratorga murojaat qiling.'
            : 'Profilingiz tekshirilmoqda. Mahsulot qo‘shishingiz mumkin; tasdiqlangandan so‘ng bozorda ko‘rinadi.'}
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [Package, 'Mahsulotlar', products.length],
          [Eye, 'Ko‘rishlar', totalViews],
          [ShoppingBasket, 'Yangi buyurtma', pending],
          [
            Wallet,
            'Mavjud balans',
            `${(user?.wallet_available || 0).toLocaleString()} so‘m`,
          ],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Eye;
          return (
            <div
              key={String(label)}
              className="bg-white rounded-2xl p-4 border border-gray-100"
            >
              <I size={20} className="text-emerald-700 mb-3" />
              <p className="font-black text-xl text-agro-dark break-words">
                {String(value)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{String(label)}</p>
            </div>
          );
        })}
      </div>
      <button
        onClick={p.onOpenAddProduct}
        className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-agro-green text-white font-bold flex items-center justify-center gap-2"
      >
        <Plus size={20} />
        Mahsulot qo‘shish
      </button>
      {mostViewed && (mostViewed._count?.views || 0) > 0 && (
        <button
          onClick={() => setAnalytics(mostViewed)}
          className="w-full text-left bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-center gap-3"
        >
          <BarChart3 className="text-emerald-800 shrink-0" />
          <div>
            <p className="text-xs text-emerald-700">
              Eng ko‘p qiziqish bildirilgan
            </p>
            <p className="font-bold text-agro-dark">
              {mostViewed.title} · {mostViewed._count?.views} odam
            </p>
          </div>
          <ArrowRight size={19} className="ml-auto shrink-0 text-emerald-800" />
        </button>
      )}
      <div className="flex gap-2 bg-white rounded-2xl p-1.5 border w-fit">
        <button
          onClick={() => setTab('products')}
          className={`px-4 py-3 rounded-xl text-sm font-bold ${tab === 'products' ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500'}`}
        >
          Mening mahsulotlarim
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`px-4 py-3 rounded-xl text-sm font-bold ${tab === 'orders' ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500'}`}
        >
          Buyurtmalar {pending > 0 && `(${pending})`}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 text-rose-700 text-sm"
        >
          {error}
          <button onClick={fetchData} className="underline ml-2">
            Qayta urinish
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="py-12 text-center text-gray-500">
          Kabinet yuklanmoqda…
        </p>
      ) : tab === 'products' ? (
        <>
          {!products.length ? (
            <div className="bg-white rounded-3xl p-8 text-center border">
              <Package className="mx-auto text-emerald-700 mb-4" size={36} />
              <h2 className="font-bold">Birinchi mahsulotingizni joylang</h2>
              <p className="text-sm text-gray-500 mt-2">
                Rasm, narx va qoldiqni kiriting. Xaridorlar sizga shu ilovada
                yozadi.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="bg-white rounded-2xl border overflow-hidden"
                >
                  <div className="relative">
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full aspect-[16/10] object-cover bg-gray-100"
                    />
                    <span
                      className={`absolute top-3 left-3 text-xs rounded-full px-3 py-1 font-bold ${product.is_active ? 'bg-white text-emerald-800' : 'bg-gray-800 text-white'}`}
                    >
                      {!product.is_active
                        ? 'Sotuvdan olingan'
                        : user?.kyc_status !== 'APPROVED'
                          ? 'Tekshiruvda'
                          : 'Sotuvda'}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <h2 className="font-bold text-lg">{product.title}</h2>
                    <p className="text-emerald-800 font-bold">
                      {product.price_per_kg.toLocaleString()} so‘m / {formatUnitName(product.unit)}{' '}
                      <span className="text-gray-400 font-normal text-xs">
                        · {formatQty(product.available_quantity_kg,product.unit)} qoldi
                      </span>
                    </p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span className="flex gap-1 items-center">
                        <Eye size={15} />
                        {product._count?.views || 0} ko‘rgan
                      </span>
                      <span>{product._count?.orders || 0} buyurtma</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAnalytics(product)}
                        className="flex-1 bg-emerald-50 text-emerald-800 rounded-xl py-3 text-sm font-bold flex justify-center items-center gap-2"
                      >
                        <BarChart3 size={17} />
                        Statistika
                      </button>
                      <button
                        aria-label={`${product.title}ni tahrirlash`}
                        onClick={() => setEditing(product)}
                        className="p-3 rounded-xl border text-emerald-800"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        aria-label={`${product.title}ni o‘chirish`}
                        disabled={deleting === product.id}
                        onClick={() => remove(product.id)}
                        className="p-3 rounded-xl border text-gray-400 disabled:opacity-40"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : !orders.length ? (
        <p className="bg-white p-8 rounded-2xl text-gray-500 text-sm text-center">
          Buyurtmalar shu yerda paydo bo‘ladi.
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onRefresh={fetchData}
              onOpenDispute={p.onOpenDispute}
              onOpenInvoice={p.onOpenInvoice}
              onOpenReview={p.onOpenReview}
            />
          ))}
        </div>
      )}
      <button
        onClick={p.onMarket}
        className="w-full rounded-2xl border border-emerald-200 bg-white p-5 text-left flex items-center gap-3"
      >
        <ShoppingBasket className="text-emerald-700" />
        <span>
          <strong className="block text-agro-dark">Bozorga o‘tish</strong>
          <span className="text-xs text-gray-500">
            Mavjud meva va sabzavotlarni ko‘ring
          </span>
        </span>
        <ArrowRight size={19} className="ml-auto" />
      </button>
      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchData}
        />
      )}
      {analytics && (
        <ProductAnalyticsModal
          product={analytics}
          onClose={() => setAnalytics(null)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Product, Category } from '../types';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import {
  ShieldCheck,
  Truck,
  Sparkles,
  Filter,
  Layers,
  MapPin,
  Calendar,
  CheckCircle,
  PlusCircle,
} from 'lucide-react';

interface MarketplaceProps {
  onOrderClick: (product: Product) => void;
  onViewProduct: (product: Product) => void;
  onOpenAddProduct?: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export const Marketplace: React.FC<MarketplaceProps> = ({
  onOrderClick,
  onViewProduct,
  onOpenAddProduct,
  searchQuery,
  onSearchChange,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('ALL');
  const [region, setRegion] = useState<string>('ALL');
  const [todayOnly, setTodayOnly] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {};
        if (category !== 'ALL') params.category = category;
        if (region !== 'ALL') params.region = region;
        if (todayOnly) params.today_harvested = 'true';
        if (minPrice) params.min_price = minPrice;
        if (maxPrice) params.max_price = maxPrice;
        if (searchQuery) params.search = searchQuery;

        const data = await api.products.getAll(params);
        if (active) setProducts(data);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Mahsulotlarni yuklashda xatolik',
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProducts();
    return () => {
      active = false;
    };
  }, [category, region, todayOnly, minPrice, maxPrice, searchQuery, retry]);

  const categories = [
    { id: 'ALL', label: 'Barchasi' },
    { id: 'MEVALAR', label: '🍎 Mevalar' },
    { id: 'SABZAVOTLAR', label: '🥦 Sabzavotlar' },
    { id: 'POLIZ', label: '🍉 Poliz' },
    { id: 'SUT_GOSHT', label: "🥩 Sut va Go'sht" },
    { id: 'DON', label: '🌾 Don' },
  ];

  const regions = [
    'ALL',
    'Toshkent',
    'Samarqand',
    'Surxondaryo',
    'Qashqadaryo',
    "Farg'ona",
    'Xorazm',
    'Jizzax',
    'Buxoro',
    'Andijon',
    'Namangan',
    'Navoiy',
    'Sirdaryo',
    'Qoraqalpog‘iston',
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
            Daladan to‘g‘ridan-to‘g‘ri
          </p>
          <h1 className="text-3xl font-black text-agro-dark mt-1">Bozor</h1>
          <p className="text-sm text-gray-500 mt-2">
            Yangi meva va sabzavotlarni toping, sotuvchi bilan kelishing.
          </p>
        </div>
        <input
          aria-label="Mahsulot qidirish"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Olma, pomidor, uzum…"
          className="w-full bg-white rounded-2xl border border-gray-200 p-4 text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
        />
      </section>

      {/* Filtrlar paneli */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-4">
        {/* Kategoriyalar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                category === c.id
                  ? 'bg-agro-green text-white shadow-md shadow-emerald-900/20'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Hudud, Narx va "Bugun uzilgan" hosil filtri */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Viloyat */}
            <div className="flex items-center space-x-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="bg-transparent font-semibold text-gray-800 focus:outline-none"
              >
                <option value="ALL">Barcha viloyatlar</option>
                {regions
                  .filter((r) => r !== 'ALL')
                  .map((r) => (
                    <option key={r} value={r}>
                      {r} viloyati
                    </option>
                  ))}
              </select>
            </div>

            {/* "Bugun uzilgan" hosil toggle */}
            <label className="flex items-center space-x-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors select-none">
              <input
                type="checkbox"
                checked={todayOnly}
                onChange={(e) => setTodayOnly(e.target.checked)}
                className="rounded text-agro-green focus:ring-agro-green w-4 h-4"
              />
              <span className="font-bold text-emerald-900 flex items-center space-x-1">
                <span>🌿 Bugun uzilgan hosil</span>
              </span>
            </label>
          </div>

          {/* Narx chegarasi */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 font-medium">Narx (so'm):</span>
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* Mahsulotlar Ro'yxati */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-extrabold text-gray-900">
            Mavjud Agro Mahsulotlar ({products.length})
          </h2>
          <span className="text-xs text-gray-500">
            Sotuvchiga to‘g‘ridan-to‘g‘ri yozing
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-agro-green border-t-transparent" />
            <p className="mt-2 text-xs text-gray-500 font-medium">
              Mahsulotlar yuklanmoqda...
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="p-6 text-center bg-rose-50 text-rose-700 rounded-2xl"
          >
            <p>{error}</p>
            <button
              onClick={() => setRetry((n) => n + 1)}
              className="mt-3 font-bold underline"
            >
              Qayta urinish
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <Layers className="w-12 h-12 text-agro-green/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">
              Bozorda hozircha yangi mahsulotlar kutilmoqda
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto mb-5">
              Siz birinchi bo'lib o'z hosilingiz yoki mahsulotingizni AgroBozor
              platformasiga joylashtirishingiz mumkin!
            </p>
            {onOpenAddProduct && (
              <button
                onClick={onOpenAddProduct}
                className="inline-flex items-center space-x-2 bg-agro-green hover:bg-agro-lightGreen text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-900/15 transition-all"
              >
                <PlusCircle className="w-4 h-4 text-agro-amber" />
                <span>+ Birinchi bo'lib mahsulot joylang</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOrderClick={onOrderClick}
                onViewProduct={onViewProduct}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

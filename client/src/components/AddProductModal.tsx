import React, { useState, useEffect } from 'react';
import { Category, PriceRecommendation } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Calendar,
} from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('MEVALAR');
  const [region, setRegion] = useState(
    user?.region || 'Toshkent viloyati, Parkent',
  );
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('500');
  const [minOrder, setMinOrder] = useState<string>('2');
  const [imageUrl, setImageUrl] = useState<string>(
    'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=800&q=80',
  );
  const [harvestDate, setHarvestDate] = useState<string>(
    new Date().toISOString().slice(0, 16),
  );

  const [recommendation, setRecommendation] =
    useState<PriceRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recError, setRecError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setRecommendation(null);
    setRecError('');
    setRecLoading(false);
    if (title.trim().length < 2) return;
    setRecLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.products.getPriceRecommendation(
          category,
          region,
          title,
        );
        if (active) setRecommendation(res);
      } catch (e) {
        if (active)
          setRecError(
            e instanceof Error ? e.message : 'Narx tavsiyasini yuklab bo‘lmadi',
          );
      } finally {
        if (active) setRecLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, category, region, title]);

  const handleApplyRecommendedPrice = () => {
    if (recommendation?.recommended_price != null)
      setPrice(String(recommendation.recommended_price));
  };

  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    // Avtomatik mos rasm taklifi
    const defaults: Record<Category, string> = {
      MEVALAR:
        'https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=800&q=80',
      SABZAVOTLAR:
        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
      POLIZ:
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
      SUT_GOSHT:
        'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80',
      DON: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    };
    setImageUrl(defaults[newCat]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || !price || !quantity) {
      setError("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    setSubmitting(true);
    try {
      await api.products.create({
        title,
        category,
        region,
        price_per_kg: parseFloat(price),
        available_quantity_kg: parseFloat(quantity),
        min_order_kg: parseFloat(minOrder) || 1,
        image_url: imageUrl,
        harvest_date: new Date(harvestDate).toISOString(),
      });
      await refreshUser();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Mahsulot qo'shishda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-agro-green text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-agro-amber" />
            <h2 className="text-base font-bold">
              Yangi Agro Mahsulot Qo'shish
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Mahsulot nomi */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Mahsulot nomi va navi:
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Parkent qora kishmish uzumi (Saralangan)"
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
            />
          </div>

          {/* Kategoriya va Viloyat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Kategoriya:
              </label>
              <select
                value={category}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as Category)
                }
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none bg-white font-medium"
              >
                <option value="MEVALAR">Mevalar</option>
                <option value="SABZAVOTLAR">Sabzavotlar</option>
                <option value="POLIZ">Poliz mahsulotlari</option>
                <option value="SUT_GOSHT">Sut va Go'sht</option>
                <option value="DON">Don va dukkaklilar</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Hudud (Viloyat/Tuman):
              </label>
              <input
                type="text"
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Viloyat va tuman"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
              />
            </div>
          </div>

          {/* Aqlli Narx Tavsiyasi Bloki (AI / Real bozor tahlili) */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-agro-green font-extrabold">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Aqlli Bozor Narxi Tavsiyasi</span>
              </div>
              {recLoading ? (
                <span className="text-[10px] text-gray-500 animate-pulse">
                  Hisoblanmoqda...
                </span>
              ) : recommendation?.recommended_price != null ? (
                <button
                  type="button"
                  disabled={recommendation?.recommended_price == null}
                  onClick={handleApplyRecommendedPrice}
                  className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                >
                  Tavsiya narxini qo'yish (
                  {recommendation?.recommended_price?.toLocaleString()} so'm)
                </button>
              ) : null}
            </div>

            {recError && (
              <p role="alert" className="text-xs text-rose-700">
                {recError}
              </p>
            )}
            {!recLoading &&
              !recError &&
              recommendation?.recommended_price == null && (
                <p className="text-xs text-gray-500">
                  {recommendation?.context ||
                    'Mahsulot nomini kiriting. Tavsiya faqat shu mahsulot turiga qarab hisoblanadi.'}
                </p>
              )}
            {recommendation?.recommended_price != null && (
              <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  O'rtacha:{' '}
                  <strong className="text-gray-900">
                    {recommendation.avg_price?.toLocaleString()} so'm/kg
                  </strong>
                </span>
                <span>
                  Oraliq:{' '}
                  <strong>
                    {recommendation.min_price?.toLocaleString()} -{' '}
                    {recommendation.max_price?.toLocaleString()} so'm
                  </strong>
                </span>
                <span>
                  Tahlil qamrovi:{' '}
                  <strong>
                    {recommendation.sample_count} ta faol lot (
                    {recommendation.context})
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Narx va Miqdorlar */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Narxi (1 kg uchun):
              </label>
              <input
                type="number"
                required
                min={100}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="so'm"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Ombordagi qoldiq (kg):
              </label>
              <input
                type="number"
                required
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="kg"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Min. buyurtma (kg):
              </label>
              <input
                type="number"
                required
                min={1}
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="kg"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
              />
            </div>
          </div>

          {/* Hosil uzilgan sana va Rasm */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Hosil uzilgan vaqt:
              </label>
              <input
                type="datetime-local"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Rasm havolasi (URL):
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none truncate"
              />
            </div>
          </div>

          {/* Tugmalar */}
          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-agro-green hover:bg-agro-lightGreen text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-agro-amber" />
              <span>{submitting ? 'Joylanmoqda...' : 'Sotuvga chiqarish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Category, PriceRecommendation } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ImageUploader } from './ImageUploader';
import { ProductUnit, UNIT_OPTIONS, formatUnitName } from '../lib/units';
import { TASHKENT_CITY_DISTRICTS, TASHKENT_REGION_DISTRICTS } from '../lib/districts';
import {
  X,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
  RotateCcw,
  MapPin,
  Clock,
  Compass,
} from 'lucide-react';

// Yangi UI matnlari komponent tepasida konstantalarda
const UI_TEXTS = {
  MODAL_TITLE: "Yangi Agro Mahsulot Qo'shish",
  REPEAT_LAST_BUTTON: "Oxirgi e'lonni takrorlash",
  PRESETS_TITLE: "Tezkor toifalar (bir bosishda to'ldirish):",
  PRODUCT_NAME_LABEL: "Mahsulot nomi va navi:",
  CATEGORY_LABEL: "Kategoriya:",
  UNIT_LABEL: "O'lchov birligi:",
  REGION_DISTRICT_LABEL: "Hudud (Tuman):",
  PRICE_LABEL: (unitName: string) => `Narxi (1 ${unitName} uchun):`,
  QUANTITY_LABEL: (unitName: string) => `Ombordagi qoldiq (${unitName}):`,
  MIN_ORDER_LABEL: (unitName: string) => `Min. buyurtma (${unitName}):`,
  HARVEST_DATE_LABEL: "Hosil uzilgan vaqt:",
  AI_REC_TITLE: "Aqlli Bozor Narxi Tavsiyasi",
  AI_REC_AVG: (price: number, unitName: string) => `Hududda o'rtacha: ${price.toLocaleString()} so'm / ${unitName}`,
  PICKUP_SECTION_TITLE: "Kuryer olib ketish ma'lumotlari (Logistika)",
  PICKUP_DISTRICT_LABEL: "Olib ketish tumani:",
  PICKUP_ADDRESS_LABEL: "Aniq manzil yoki ferma mo'ljali:",
  PICKUP_WINDOW_LABEL: "Olib ketish vaqt oralig'i:",
  PICKUP_GPS_BUTTON: "Joylashuvni yuborish (GPS)",
  PICKUP_GPS_ACTIVE: "GPS koordinatalari biriktirildi",
  CANCEL_BUTTON: "Bekor qilish",
  SUBMIT_BUTTON: "Sotuvga chiqarish",
  SUBMITTING_BUTTON: "Joylanmoqda...",
} as const;

interface QuickPreset {
  name: string;
  category: Category;
  unit: ProductUnit;
  icon: string;
}

// Tayyor katta tugmalar: bosilsa nom, kategoriya va birlik avtomatik to'ladi
const QUICK_PRESETS: QuickPreset[] = [
  { name: 'Olma', category: 'MEVALAR', unit: 'KG', icon: '🍎' },
  { name: 'Uzum', category: 'MEVALAR', unit: 'KG', icon: '🍇' },
  { name: 'Pomidor', category: 'SABZAVOTLAR', unit: 'KG', icon: '🍅' },
  { name: 'Bodring', category: 'SABZAVOTLAR', unit: 'KG', icon: '🥒' },
  { name: 'Kartoshka', category: 'SABZAVOTLAR', unit: 'KG', icon: '🥔' },
  { name: 'Piyoz', category: 'SABZAVOTLAR', unit: 'KG', icon: '🧅' },
  { name: 'Sabzi', category: 'SABZAVOTLAR', unit: 'KG', icon: '🥕' },
  { name: 'Tarvuz', category: 'POLIZ', unit: 'KG', icon: '🍉' },
  { name: 'Qovun', category: 'POLIZ', unit: 'KG', icon: '🍈' },
  { name: 'Asal', category: 'SUT_GOSHT', unit: 'BANKA', icon: '🍯' },
  { name: 'Tuxum', category: 'SUT_GOSHT', unit: 'DONA', icon: '🥚' },
  { name: 'Sut', category: 'SUT_GOSHT', unit: 'LITR', icon: '🥛' },
];

const TIME_SLOTS = [
  '06:00–09:00',
  '09:00–12:00',
  '12:00–16:00',
  '16:00–20:00',
] as const;

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
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('MEVALAR');
  const [unit, setUnit] = useState<ProductUnit>('KG');
  const [region, setRegion] = useState(user?.district || user?.region || 'Parkent');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('500');
  const [minOrder, setMinOrder] = useState<string>('2');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [harvestDate, setHarvestDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // Olib ketish ma'lumotlari
  const [pickupDistrict, setPickupDistrict] = useState<string>(user?.district || 'Parkent');
  const [pickupAddress, setPickupAddress] = useState<string>(user?.region ? `${user.region}, Ferma maydoni` : '');
  const [pickupWindow, setPickupWindow] = useState<string>('09:00–12:00');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  const [repeating, setRepeating] = useState(false);
  const [recommendation, setRecommendation] = useState<PriceRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kategoriya yoki viloyat o'zgarganda real vaqtda narx tavsiyasini hisoblash
  useEffect(() => {
    let active = true;
    const fetchRec = async () => {
      setRecLoading(true);
      try {
        const res = await api.products.getPriceRecommendation(category, region);
        if (active) {
          setRecommendation(res);
          if (!price) {
            setPrice(String(res.recommended_price));
          }
        }
      } catch (e) {
        console.error('Failed to get price recommendation:', e);
      } finally {
        if (active) setRecLoading(false);
      }
    };
    fetchRec();
    return () => {
      active = false;
    };
  }, [category, region]);

  const handleApplyRecommendedPrice = () => {
    if (recommendation) {
      setPrice(String(recommendation.recommended_price));
    }
  };

  const handlePresetSelect = (preset: QuickPreset) => {
    setTitle(preset.name);
    setCategory(preset.category);
    setUnit(preset.unit);
  };

  // Oxirgi e'lonni takrorlash (rasmdan tashqari barcha maydonlar to'ldiriladi)
  const handleRepeatLast = async () => {
    setRepeating(true);
    setError(null);
    try {
      const last = await api.products.getLast();
      if (!last) {
        setError("Sizda avval e'lon qilingan mahsulot topilmadi");
        return;
      }
      setTitle(last.title);
      setCategory(last.category);
      if (last.unit) setUnit(last.unit as ProductUnit);
      setPrice(String(last.price_per_kg));
      setQuantity(String(last.available_quantity_kg));
      setMinOrder(String(last.min_order_kg));
      if (last.region) setRegion(last.region);
      if (last.pickup_district) setPickupDistrict(last.pickup_district);
      if (last.pickup_address) setPickupAddress(last.pickup_address);
      if (last.pickup_window) setPickupWindow(last.pickup_window);
      if (last.pickup_lat !== undefined && last.pickup_lat !== null) setPickupLat(last.pickup_lat);
      if (last.pickup_lng !== undefined && last.pickup_lng !== null) setPickupLng(last.pickup_lng);
    } catch (err: any) {
      setError(err.message || "Oxirgi e'lonni yuklashda xatolik");
    } finally {
      setRepeating(false);
    }
  };

  // GPS joylashuvni aniqlash
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(pos.coords.latitude);
        setPickupLng(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        alert("Joylashuvni aniqlash imkoni bo'lmadi: " + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
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
        unit,
        region,
        price_per_kg: parseFloat(price),
        available_quantity_kg: parseFloat(quantity),
        min_order_kg: parseFloat(minOrder) || 1,
        pickup_district: pickupDistrict || undefined,
        pickup_address: pickupAddress || undefined,
        pickup_window: pickupWindow || undefined,
        pickup_lat: pickupLat ?? undefined,
        pickup_lng: pickupLng ?? undefined,
        image_url: imageUrls.length > 0 ? imageUrls[0] : undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
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

  const currentUnitName = formatUnitName(unit);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Modal Sarlavhasi */}
        <div className="bg-agro-green text-white p-4 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-agro-amber" />
            <h2 className="text-base font-bold">{UI_TEXTS.MODAL_TITLE}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRepeatLast}
              disabled={repeating}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-agro-green bg-white hover:bg-emerald-50 rounded-xl transition shadow-sm disabled:opacity-50"
              title="Avvalgi mahsulotingiz ma'lumotlarini yuklaydi (rasmsiz)"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${repeating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{UI_TEXTS.REPEAT_LAST_BUTTON}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tanasi */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Tezkor toifalar (Mobil uchun min-h-[48px] tugmalar) */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5 flex items-center justify-between">
              <span>{UI_TEXTS.PRESETS_TITLE}</span>
              <span className="text-[11px] font-normal text-gray-400">1 bosishda to'ldiradi</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {QUICK_PRESETS.map((p) => {
                const isSelected = title === p.name && category === p.category;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`min-h-[48px] p-2 flex flex-col items-center justify-center rounded-xl border text-center transition-all active:scale-95 ${
                      isSelected
                        ? 'border-agro-green bg-emerald-50 text-agro-green font-black shadow-sm ring-1 ring-agro-green'
                        : 'border-gray-200 bg-gray-50/70 hover:bg-emerald-50/50 hover:border-emerald-300 text-gray-800'
                    }`}
                  >
                    <span className="text-base leading-none mb-0.5">{p.icon}</span>
                    <span className="font-bold text-[11px] truncate w-full">{p.name}</span>
                    <span className="text-[9px] text-gray-400 uppercase font-mono">{p.unit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mahsulot nomi va Birlik */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.PRODUCT_NAME_LABEL}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Parkent qora kishmish uzumi"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.UNIT_LABEL}
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as ProductUnit)}
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none bg-white font-bold text-gray-800"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kategoriya va Hudud */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.CATEGORY_LABEL}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
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
                {UI_TEXTS.REGION_DISTRICT_LABEL}
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none bg-white font-medium"
              >
                <optgroup label="Toshkent viloyati">
                  {TASHKENT_REGION_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
                <optgroup label="Toshkent shahri">
                  {TASHKENT_CITY_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Aqlli Narx Tavsiyasi Bloki */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-agro-green font-extrabold">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>{UI_TEXTS.AI_REC_TITLE}</span>
              </div>
              {recLoading ? (
                <span className="text-[10px] text-gray-500 animate-pulse">Hisoblanmoqda...</span>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyRecommendedPrice}
                  className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                >
                  Tavsiya narxini qo'yish ({recommendation?.recommended_price?.toLocaleString()} so'm)
                </button>
              )}
            </div>

            {recommendation && (
              <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <strong className="text-emerald-900 font-bold">
                    {UI_TEXTS.AI_REC_AVG(recommendation.avg_price, currentUnitName)}
                  </strong>
                </span>
                <span>
                  Oraliq: <strong>{recommendation.min_price.toLocaleString()} - {recommendation.max_price.toLocaleString()} so'm</strong>
                </span>
                <span>
                  Tahlil qamrovi: <strong>{recommendation.sample_count} ta lot ({recommendation.context})</strong>
                </span>
              </div>
            )}
          </div>

          {/* Narx va Miqdorlar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.PRICE_LABEL(currentUnitName)}
              </label>
              <input
                type="number"
                required
                min={100}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="so'm"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none font-bold text-gray-900"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.QUANTITY_LABEL(currentUnitName)}
              </label>
              <input
                type="number"
                required
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={currentUnitName}
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {UI_TEXTS.MIN_ORDER_LABEL(currentUnitName)}
              </label>
              <input
                type="number"
                required
                min={1}
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder={currentUnitName}
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Olib ketish ma'lumotlari (Logistika / Kuryer uchun) */}
          <div className="p-4 bg-gray-50/90 border border-gray-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-gray-800 text-xs">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>{UI_TEXTS.PICKUP_SECTION_TITLE}</span>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locating}
                className="flex items-center space-x-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
              >
                <Compass className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                <span>{locating ? 'Aniqlanmoqda...' : UI_TEXTS.PICKUP_GPS_BUTTON}</span>
              </button>
            </div>

            {pickupLat !== null && pickupLng !== null && (
              <div className="text-[11px] text-emerald-700 bg-emerald-100/60 p-2 rounded-xl flex items-center space-x-1.5 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                <span>
                  {UI_TEXTS.PICKUP_GPS_ACTIVE}: ({pickupLat.toFixed(5)}, {pickupLng.toFixed(5)})
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {UI_TEXTS.PICKUP_DISTRICT_LABEL}
                </label>
                <select
                  value={pickupDistrict}
                  onChange={(e) => setPickupDistrict(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-white focus:border-agro-green focus:outline-none text-xs"
                >
                  <optgroup label="Toshkent viloyati">
                    {TASHKENT_REGION_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Toshkent shahri">
                    {TASHKENT_CITY_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {UI_TEXTS.PICKUP_WINDOW_LABEL}
                </label>
                <select
                  value={pickupWindow}
                  onChange={(e) => setPickupWindow(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-white focus:border-agro-green focus:outline-none text-xs"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {UI_TEXTS.PICKUP_ADDRESS_LABEL}
                </label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Ko'cha, ferma nomi..."
                  className="w-full p-2 rounded-xl border border-gray-200 bg-white focus:border-agro-green focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Hosil uzilgan sana */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              {UI_TEXTS.HARVEST_DATE_LABEL}
            </label>
            <input
              type="datetime-local"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
            />
          </div>

          {/* Rasm yuklash (Supabase Storage orqali kamera / galereya) */}
          <div className="pt-1">
            <ImageUploader
              bucket="product-images"
              urls={imageUrls}
              onChange={setImageUrls}
              maxImages={5}
              label="Mahsulot fotosuratlari (ixtiyoriy)"
              helperText="Kamera orqali suratga oling yoki galereyadan 5 tagacha rasm yuklang (agar yuklanmasa, standart rasm qo'yiladi)"
            />
          </div>

          {/* Tugmalar */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50"
            >
              {UI_TEXTS.CANCEL_BUTTON}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-agro-green hover:bg-agro-lightGreen text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-agro-amber" />
              <span>{submitting ? UI_TEXTS.SUBMITTING_BUTTON : UI_TEXTS.SUBMIT_BUTTON}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

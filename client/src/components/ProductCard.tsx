import React from 'react';
import { Product } from '../types';
import {
  MapPin,
  Star,
  CheckCircle2,
  Sparkles,
  Clock,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOrderClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOrderClick }) => {
  const isTodayHarvest = () => {
    try {
      const harvest = new Date(product.harvest_date);
      const diffHours = (Date.now() - harvest.getTime()) / (1000 * 60 * 60);
      return diffHours <= 24;
    } catch {
      return false;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'MEVALAR':
        return { label: 'Mevalar', color: 'bg-rose-100 text-rose-800' };
      case 'SABZAVOTLAR':
        return { label: 'Sabzavotlar', color: 'bg-emerald-100 text-emerald-800' };
      case 'POLIZ':
        return { label: 'Poliz', color: 'bg-amber-100 text-amber-800' };
      case 'SUT_GOSHT':
        return { label: 'Sut va Go\'sht', color: 'bg-red-100 text-red-800' };
      case 'DON':
        return { label: 'Don Mahsulotlari', color: 'bg-yellow-100 text-yellow-800' };
      default:
        return { label: category, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const catBadge = getCategoryBadge(product.category);
  const isFreshToday = isTodayHarvest();
  const farmer = product.farmer;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 hover:border-agro-green/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
      {/* Rasm qismi */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Kategoriya nishoni */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm ${catBadge.color}`}
          >
            {catBadge.label}
          </span>
          {isFreshToday && (
            <span className="flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/90 text-white shadow-sm backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>Bugun uzilgan</span>
            </span>
          )}
        </div>

        {/* Premium Fermer nishoni */}
        {farmer?.is_premium && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-[11px] px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>PREMIUM FERMER</span>
          </div>
        )}
      </div>

      {/* Kontent qismi */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Fermer va viloyat ma'lumotlari */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <div className="flex items-center space-x-1 truncate max-w-[170px]" title={farmer?.full_name}>
              <span className="font-semibold text-gray-700 truncate">
                {farmer?.farm_or_company_name || farmer?.full_name || 'Fermer xo\'jaligi'}
              </span>
              {farmer?.kyc_status === 'APPROVED' && (
                <span title="KYC Tasdiqlangan Fermer">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1 text-gray-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-bold text-xs">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              <span>{farmer?.rating?.toFixed(1) || '5.0'}</span>
            </div>
          </div>

          {/* Sarlavha */}
          <h3 className="font-bold text-gray-900 text-base leading-snug mb-2 group-hover:text-agro-green transition-colors line-clamp-2">
            {product.title}
          </h3>

          {/* Manzil va Terim vaqti */}
          <div className="space-y-1 mb-3 text-xs text-gray-500">
            <div className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{product.region}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>
                {new Date(product.harvest_date).toLocaleDateString('uz-UZ', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Qoldiq va Minimal buyurtma */}
        <div className="pt-3 border-t border-gray-100 mt-2">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Omborda qoldiq: <strong className="text-gray-900 font-bold">{product.available_quantity_kg} kg</strong></span>
            <span>Min: <strong className="text-gray-900">{product.min_order_kg} kg</strong></span>
          </div>

          {/* Narx va Xarid qilish tugmasi */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-[11px] text-gray-400 font-medium">1 kg uchun narx:</div>
              <div className="text-lg font-extrabold text-agro-green">
                {product.price_per_kg.toLocaleString()} <span className="text-xs font-semibold text-gray-600">so'm</span>
              </div>
            </div>

            <button
              onClick={() => onOrderClick(product)}
              className="flex items-center space-x-1.5 bg-agro-green hover:bg-agro-lightGreen text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/10 hover:shadow-emerald-900/25 active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Sotib olish</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

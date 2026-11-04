import React, { useState } from 'react';
import { Order } from '../types';
import { api } from '../lib/api';
import { X, Star, HeartHandshake } from 'lucide-react';

interface ReviewModalProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  if (!order) return null;

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.reviews.create({
        order_id: order.id,
        target_user_id: order.farmer_id,
        rating,
        comment,
      });
      alert('Rahmat! Sizning bahoyingiz qabul qilindi va fermer reytingi qayta hisoblandi.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Baholashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-agro-green text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-5 h-5 text-agro-amber" />
            <h2 className="text-base font-bold">Fermer va Xizmatni Baholash</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="text-center space-y-2">
            <p className="text-gray-600 font-medium">
              <strong>{order.farmer?.farm_or_company_name || order.farmer?.full_name}</strong> yetkazib bergan mahsulot sifatini baholang:
            </p>

            {/* Yulduzlar */}
            <div className="flex justify-center space-x-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-125 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || rating) >= star
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-agro-dark">
              {rating === 5 && '🌟 A\'lo sifat! (5/5)'}
              {rating === 4 && '👍 Yaxshi (4/5)'}
              {rating === 3 && '😐 Qoniqarli (3/5)'}
              {rating === 2 && '👎 Past sifat (2/5)'}
              {rating === 1 && '⚠️ Juda yomon (1/5)'}
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Fikr va mulohazalaringiz:
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Mahsulotning yangiligi, ta'mi va yetkazib berish tezligi haqida yozing..."
              className="w-full p-3 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50"
            >
              O'tkazib yuborish
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-agro-green hover:bg-agro-lightGreen text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Saqlanmoqda...' : 'Bahoni yuborish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

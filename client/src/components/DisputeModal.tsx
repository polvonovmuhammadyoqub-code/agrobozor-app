import React, { useState } from 'react';
import { Order } from '../types';
import { api } from '../lib/api';
import { X, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface DisputeModalProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  if (!order) return null;

  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState(
    'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=800&q=80'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Iltimos, shikoyat sababini batafsil yozing');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.disputes.create({
        order_id: order.id,
        reason,
        evidence_image_url: evidenceUrl,
      });
      alert('Shikoyat qabul qilindi. Buyurtma "Nizo" holatiga o\'tkazildi va pul Escrowda to\'xtatildi. Admin tekshirib qaror qabul qiladi.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Nizo ochishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-rose-600 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-bold">Mahsulot bo'yicha shikoyat (Nizo)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">{error}</div>}

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="font-bold text-gray-900">{order.product?.title || 'Agro mahsulot'}</div>
            <div className="text-gray-500">
              Buyurtma: #{order.id.slice(0, 8)} • Summa: {order.total_paid.toLocaleString()} so'm
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Shikoyat sababi (Mahsulot sifatsizligi, buzilganligi yoki kamligi):
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: Mahsulot sifatsiz holatda yetib keldi, mevalar ezilgan..."
              className="w-full p-3 rounded-xl border border-gray-200 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Dalil fotosurati havolasi (Evidence Image URL):
            </label>
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
            <strong>Diqqat:</strong> Shikoyat yuborilgach, buyurtma statusi avtomatik ravishda <strong>DISPUTED</strong> holatiga o'tadi va fermerga to'lanadigan pul Escrow tizimida muzlatiladi. Admin tekshirib qaror qabul qiladi.
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Yuborilmoqda...' : 'Nizo ochish va Pulni muzlatish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Wallet,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  CreditCard,
  History,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  if (!isOpen) return null;

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('8600 1234 5678 9012');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      const data = await api.users.getWalletHistory();
      setTransactions(data.transactions);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [isOpen]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    setErrorMessage(null);
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      setErrorMessage('Iltimos to\'g\'ri summa kiriting');
      return;
    }

    setLoading(true);
    try {
      const res = await api.users.withdraw(amt, cardNumber);
      setActionMessage(res.message);
      setWithdrawAmount('');
      await refreshUser();
      await fetchWallet();
    } catch (err: any) {
      setErrorMessage(err.message || 'Mablag\' yechishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePremium = async () => {
    if (!confirm('50 000 so\'m evaziga Oltin Premium maqomiga o\'tishni tasdiqlaysizmi? Mahsulotlaringiz qidiruvda eng yuqorida ko\'rsatiladi!')) {
      return;
    }
    setLoading(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.users.upgradePremium();
      setActionMessage(res.message);
      await refreshUser();
      await fetchWallet();
    } catch (err: any) {
      setErrorMessage(err.message || 'Premiumga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'ESCROW_HOLD':
        return { label: 'Escrow Muzlatish', color: 'bg-amber-100 text-amber-800' };
      case 'ESCROW_RELEASE_FARMER':
        return { label: 'Fermerga To\'lov', color: 'bg-emerald-100 text-emerald-800' };
      case 'COURIER_FEE':
        return { label: 'Kuryer Daromadi', color: 'bg-blue-100 text-blue-800' };
      case 'PLATFORM_COMMISSION':
        return { label: 'Platforma Komissiyasi', color: 'bg-purple-100 text-purple-800' };
      case 'REFUND_EXTERNAL':
        return { label: 'Payme orqali kartaga qaytarish', color: 'bg-blue-100 text-blue-800' };
      case 'REFUND':
        return { label: 'Qaytarilgan Mablag\'', color: 'bg-rose-100 text-rose-800' };
      case 'WITHDRAWAL_REQUEST':
        return { label: 'Yechish so\'rovi', color: 'bg-orange-100 text-orange-800' };
      case 'WITHDRAWAL_REFUND':
        return { label: 'Yechish rad etildi (Qaytarildi)', color: 'bg-teal-100 text-teal-800' };
      case 'PREMIUM_SUBSCRIPTION':
        return { label: 'Premium Obuna', color: 'bg-yellow-100 text-yellow-800' };
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-agro-green text-white p-5 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-agro-amber" />
            </div>
            <div>
              <h2 className="text-base font-bold">Moliya va Escrow Hamyon</h2>
              <p className="text-xs text-emerald-100">Barcha moliyaviy hisob-kitoblar va audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs text-gray-800">
          {actionMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Balans Kartalari */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Asosiy Hamyon */}
            <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl shadow-md space-y-1">
              <div className="flex justify-between items-center text-emerald-200 text-xs font-semibold">
                <span>Yechib olish mumkin bo'lgan balans</span>
                <Wallet className="w-4 h-4 text-agro-amber" />
              </div>
              <div className="text-2xl font-black tracking-tight">
                {(user?.wallet_available || 0).toLocaleString()} <span className="text-sm font-normal">so'm</span>
              </div>
              <div className="text-[11px] text-emerald-200/80 pt-1">
                Karta yoki bank hisobiga to'g'ridan-to'g'ri chiqariladi
              </div>
            </div>

            {/* Escrow Balans */}
            <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl shadow-md space-y-1">
              <div className="flex justify-between items-center text-amber-100 text-xs font-semibold">
                <span>Escrow Muzlatilgan Balans</span>
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-black tracking-tight">
                {(user?.wallet_escrow || 0).toLocaleString()} <span className="text-sm font-normal">so'm</span>
              </div>
              <div className="text-[11px] text-amber-100/90 pt-1">
                Mijozlar buyurtmani qabul qilishi bilan asosiy hamyonga o'tadi
              </div>
            </div>
          </div>

          {/* Premium Maqom Banneri */}
          <div className="p-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 border border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-amber-950 text-sm flex items-center space-x-1.5">
                  <span>Oltin Premium Maqomi</span>
                  {user?.is_premium ? (
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                      FAOL
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-amber-800">
                  {user?.is_premium
                    ? 'Sizning mahsulotlaringiz katalogda eng birinchi bo\'lib ko\'rsatilmoqda'
                    : 'Mahsulotlaringizni katalog tepasiga olib chiqish (50 000 so\'m / bir martalik)'}
                </div>
              </div>
            </div>

            {!user?.is_premium && (
              <button
                type="button"
                onClick={handleUpgradePremium}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                Ulanish (50 000 so'm)
              </button>
            )}
          </div>

          {/* Pul yechish formasi */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
            <div className="font-bold text-gray-900 text-xs flex items-center space-x-1.5">
              <CreditCard className="w-4 h-4 text-agro-green" />
              <span>Mablag'ni kartaga yechib olish</span>
            </div>

            <form onSubmit={handleWithdraw} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="Summa (so'm)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="p-2 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none text-xs"
              />
              <input
                type="text"
                placeholder="Karta raqami"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="p-2 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none text-xs"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-agro-green hover:bg-agro-lightGreen text-white font-bold p-2 rounded-xl transition-colors disabled:opacity-50 text-xs"
              >
                {loading ? 'Yuborilmoqda...' : 'Yechib olish'}
              </button>
            </form>
          </div>

          {/* Tranzaksiyalar tarixi */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 font-bold text-gray-900 text-xs">
              <History className="w-4 h-4 text-gray-500" />
              <span>Hamyon va Tranzaksiyalar Auditi</span>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-2xl bg-gray-50/50">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  Hozircha tranzaksiyalar mavjud emas
                </div>
              ) : (
                transactions.map((tx) => {
                  const badge = getTxTypeBadge(tx.type);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex items-center justify-between text-xs hover:bg-white transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          {tx.order && (
                            <span className="text-[11px] text-gray-500 font-medium">
                              #{tx.order.id.slice(0, 8)}: {tx.order.product?.title}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('uz-UZ', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      <div className="font-extrabold text-gray-900">
                        {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} so'm
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

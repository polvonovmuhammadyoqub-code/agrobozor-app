import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Sprout,
  ShieldCheck,
  UserCheck,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSwitchToRegister,
}) => {
  const { login, demoUsers, switchDemoUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Telefon raqamini kiriting");
      return;
    }
    if (!password.trim()) {
      setError("Parol yoki SMS kodini kiriting");
      return;
    }

    setLoading(true);
    try {
      // OTP 1111 bo'lsa yoki parol bo'lsa ikkalasini urinib ko'ramiz
      const isOtp = password === '1111';
      await login(phone.trim(), isOtp ? undefined : password, isOtp ? password : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || "Telefon yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userId: string) => {
    setDemoLoading(userId);
    try {
      await switchDemoUser(userId);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setDemoLoading(null);
    }
  };

  const getRoleLabel = (role: string) => {
    const map: Record<string, { label: string; color: string; emoji: string }> = {
      FARMER: { label: 'Fermer', color: 'text-emerald-800 bg-emerald-100', emoji: '👨‍🌾' },
      BUYER_B2C: { label: 'Xaridor (B2C)', color: 'text-blue-800 bg-blue-100', emoji: '🛒' },
      BUYER_B2B: { label: 'Biznes (B2B)', color: 'text-purple-800 bg-purple-100', emoji: '🏢' },
      COURIER: { label: 'Kuryer', color: 'text-amber-800 bg-amber-100', emoji: '🚚' },
      ADMIN: { label: 'Admin', color: 'text-rose-800 bg-rose-100', emoji: '🛡️' },
    };
    return map[role] || { label: role, color: 'text-gray-800 bg-gray-100', emoji: '👤' };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Yopish */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tepa qism */}
        <div className="bg-gradient-to-br from-agro-dark to-agro-green text-white px-7 pt-8 pb-6">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Sprout className="w-7 h-7 text-agro-amber" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Agro<span className="text-agro-amber">Bozor</span>
              </div>
              <div className="text-[11px] text-emerald-200">Xavfsiz Escrow Agro-Savdo</div>
            </div>
          </div>
          <h2 className="text-lg font-bold mt-2">Tizimga kirish</h2>
          <p className="text-xs text-emerald-100/80 mt-0.5">
            Telefon raqami va parol bilan kiring
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Xatolik xabari */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Kirish Formasi */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Telefon */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Telefon raqami
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901112233"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none focus:ring-2 focus:ring-agro-green/20 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Parol / SMS */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Parol yoki SMS kod
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parol yoki SMS kodi"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none focus:ring-2 focus:ring-agro-green/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Demo uchun SMS kodi: <strong className="text-gray-600 font-mono">1111</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-agro-green hover:bg-agro-lightGreen text-white font-extrabold py-3 rounded-2xl flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/15 transition-all disabled:opacity-60 mt-1"
            >
              {loading ? (
                <span className="animate-pulse">Tekshirilmoqda...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Kirish</span>
                </>
              )}
            </button>
          </form>

          {/* Ajratuvchi chiziq */}
          <div className="flex items-center space-x-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 font-medium">yoki</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Demo Tezkor Kirish */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Tezkor Demo Kirish (1-bosishda)</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {demoUsers.map((u) => {
                const info = getRoleLabel(u.role);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleDemoLogin(u.id)}
                    disabled={!!demoLoading}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-gray-200 hover:border-agro-green hover:bg-agro-paleGreen/40 text-xs transition-all group disabled:opacity-60"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-base">{info.emoji}</span>
                      <div className="text-left">
                        <div className="font-bold text-gray-900">{u.full_name}</div>
                        <div className="text-[10px] text-gray-500">{u.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {u.is_premium && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-black">PREMIUM</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${info.color}`}>
                        {info.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-agro-green transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ro'yxatdan o'tish havolasi */}
          <div className="text-center pt-1">
            <span className="text-xs text-gray-500">Akkauntingiz yo'qmi? </span>
            <button
              onClick={onSwitchToRegister}
              className="text-xs font-bold text-agro-green hover:underline"
            >
              Ro'yxatdan o'ting →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

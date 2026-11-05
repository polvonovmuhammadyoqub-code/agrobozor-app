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
  CheckCircle2,
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
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = phone.trim();
    if (!cleanIdentifier) {
      setError("Telefon raqami yoki email manzilini kiriting");
      return;
    }
    if (!password.trim()) {
      setError("Parolni kiriting");
      return;
    }

    setLoading(true);
    try {
      await login(cleanIdentifier, password);
      onClose();
    } catch (err: any) {
      setError(err.message || "Telefon raqami/email yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Yopish tugmasi */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Yuqori qism banner */}
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
            Shaxsiy kabinetingizga kirish uchun telefon raqamingiz va parolingizni kiriting
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Telefon raqami yoki Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Telefon raqami yoki Email
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567 yoki email@gmail.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none focus:ring-2 focus:ring-agro-green/20 transition-all font-medium"
                  autoFocus
                />
              </div>
            </div>

            {/* Parol */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Parol
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolingizni kiriting"
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
            </div>

            {/* Kirish tugmasi */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-agro-green hover:bg-agro-lightGreen text-white font-extrabold py-3 rounded-2xl flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/15 transition-all disabled:opacity-60 pt-3"
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

          {/* Xavfsizlik eslatmasi */}
          <div className="flex items-center space-x-2 p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Mablag'lar va shaxsiy ma'lumotlar 100% himoyalangan</span>
          </div>

          {/* Ro'yxatdan o'tish havolasi */}
          <div className="text-center pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">AgroBozorda yangimisiz? </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-xs font-bold text-agro-green hover:underline"
            >
              Yangi hisob yaratish →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

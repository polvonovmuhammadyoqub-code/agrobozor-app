import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import {
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  MapPin,
  Sprout,
  CheckCircle2,
  Building2,
  Truck,
  ShoppingBag,
  Tractor,
  FileText,
} from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onSuccess?: (role: Role) => void;
}

type FormStep = 'role' | 'details';

const ROLES = [
  {
    id: 'BUYER_B2C' as Role,
    emoji: '🛒',
    title: "Xaridor (Shaxsiy - B2C)",
    desc: "Uyingiz uchun yangi uzilgan meva-sabzavotlarni bevosita fermerlardان xarid qiling",
    color: 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900',
    activeColor: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400',
    icon: ShoppingBag,
    iconColor: 'text-blue-600',
  },
  {
    id: 'BUYER_B2B' as Role,
    emoji: '🏢',
    title: "Biznes Xaridor (Restoran / Do'kon - B2B)",
    desc: "Ulgurji xaridlar, rasmiy hisob-faktura (Invoice) va doimiy yetkazib berish jadvali",
    color: 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900',
    activeColor: 'border-purple-500 bg-purple-50 ring-2 ring-purple-400',
    icon: Building2,
    iconColor: 'text-purple-600',
  },
  {
    id: 'FARMER' as Role,
    emoji: '👨‍🌾',
    title: "Fermer (Sotuvchi)",
    desc: "O'z hosilingizni bevosita xaridorlarga soting. KYC tasdiqlanganidan so'ng sotuvga chiqarishingiz mumkin",
    color: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900',
    activeColor: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400',
    icon: Tractor,
    iconColor: 'text-emerald-600',
  },
  {
    id: 'COURIER' as Role,
    emoji: '🚚',
    title: "Kuryer (Logistika)",
    desc: "Buyurtmalarni yetkazib bering va har bir muvaffaqiyatli yetkazuvdan 12 000 so'm ishlang",
    color: 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900',
    activeColor: 'border-amber-500 bg-amber-50 ring-2 ring-amber-400',
    icon: Truck,
    iconColor: 'text-amber-600',
  },
];

const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand viloyati",
  "Farg'ona viloyati",
  "Andijon viloyati",
  "Namangan viloyati",
  "Buxoro viloyati",
  "Xorazm viloyati",
  "Qashqadaryo viloyati",
  "Surxondaryo viloyati",
  "Sirdaryo viloyati",
  "Jizzax viloyati",
  "Navoiy viloyati",
  "Qoraqalpog'iston Respublikasi",
];

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin,
  onSuccess,
}) => {
  const { register } = useAuth();
  const [step, setStep] = useState<FormStep>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Form maydonlari
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [region, setRegion] = useState('');
  // Fermer uchun qo'shimcha
  const [farmName, setFarmName] = useState('');
  const [tinOrPassport, setTinOrPassport] = useState('');
  // B2B uchun qo'shimcha
  const [companyName, setCompanyName] = useState('');
  const [companyTin, setCompanyTin] = useState('');

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('details');
    setError(null);
  };

  const handleBack = () => {
    setStep('role');
    setError(null);
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "To'liq ism-sharifni kiriting";
    if (!phone.match(/^\+998\d{9}$/)) return "Telefon raqami noto'g'ri (+998XXXXXXXXX formatida)";
    if (password.length < 6) return "Parol kamida 6 ta belgidan iborat bo'lishi kerak";
    if (password !== confirmPassword) return "Parollar mos kelmaydi";
    if (!region) return "Viloyat / Shaharni tanlang";

    if (selectedRole === 'FARMER') {
      if (!farmName.trim()) return "Fermer xo'jaligi nomini kiriting";
      if (!tinOrPassport.trim()) return "STIR (INN) yoki Pasport seriyasini kiriting";
    }
    if (selectedRole === 'BUYER_B2B') {
      if (!companyName.trim()) return "Kompaniya / Restoran nomini kiriting";
      if (!companyTin.trim()) return "STIR (INN) raqamini kiriting";
    }
    if (selectedRole === 'COURIER') {
      if (!tinOrPassport.trim()) return "Pasport seriyangizni kiriting";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        phone: phone.trim(),
        password,
        full_name: fullName.trim(),
        role: selectedRole,
        region,
        tin_or_passport:
          selectedRole === 'BUYER_B2B'
            ? companyTin.trim()
            : tinOrPassport.trim() || `AUTO-${Date.now()}`,
      };

      if (selectedRole === 'FARMER') {
        payload.farm_or_company_name = farmName.trim();
      }
      if (selectedRole === 'BUYER_B2B') {
        payload.farm_or_company_name = companyName.trim();
      }

      await register(payload);
      onSuccess?.(selectedRole!);
      onClose();
    } catch (err: any) {
      setError(err.message || "Ro'yxatdan o'tishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleInfo = ROLES.find((r) => r.id === selectedRole);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Yopish */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tepa */}
        <div className="bg-gradient-to-br from-agro-dark to-agro-green text-white px-7 pt-7 pb-5">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Sprout className="w-6 h-6 text-agro-amber" />
            </div>
            <div className="text-lg font-extrabold tracking-tight">
              Agro<span className="text-agro-amber">Bozor</span>
            </div>
          </div>
          <h2 className="text-base font-bold">
            {step === 'role' ? "Ro'yxatdan o'tish — Rolni tanlang" : `Hisob yaratish: ${selectedRoleInfo?.title}`}
          </h2>
          {step === 'details' && (
            <button
              onClick={handleBack}
              className="text-[11px] text-emerald-200 hover:text-white mt-0.5 transition-colors"
            >
              ← Orqaga (Rolni o'zgartirish)
            </button>
          )}
        </div>

        <div className="p-6">
          {/* 1-QADAM: Rol tanlash */}
          {step === 'role' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 text-center mb-4">
                Platformada qanday faoliyat yuritmoqchisiz?
              </p>
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelect(r.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${r.color}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`text-2xl flex-shrink-0`}>{r.emoji}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{r.title}</div>
                        <div className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{r.desc}</div>
                      </div>
                      <ChevronIcon />
                    </div>
                  </button>
                );
              })}

              <div className="text-center pt-2">
                <span className="text-xs text-gray-500">Akkauntingiz bormi? </span>
                <button
                  onClick={onSwitchToLogin}
                  className="text-xs font-bold text-agro-green hover:underline"
                >
                  Kirish →
                </button>
              </div>
            </div>
          )}

          {/* 2-QADAM: Ma'lumotlarni to'ldirish */}
          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {error}
                </div>
              )}

              {/* To'liq ism */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  To'liq ism-sharif *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masalan: Alisher Nazarov"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Telefon */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Telefon raqami *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998901234567"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                  />
                </div>
              </div>

              {/* Viloyat */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Viloyat / Shahar *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    required
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none appearance-none"
                  >
                    <option value="">Viloyatni tanlang...</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fermer qo'shimcha maydonlari */}
              {selectedRole === 'FARMER' && (
                <>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Fermer xo'jaligi nomi *
                    </label>
                    <div className="relative">
                      <Tractor className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={farmName}
                        onChange={(e) => setFarmName(e.target.value)}
                        placeholder="Masalan: Parkent Bog' Xo'jaligi"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      STIR (INN) yoki Pasport seriyasi *
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={tinOrPassport}
                        onChange={(e) => setTinOrPassport(e.target.value)}
                        placeholder="Masalan: AA1234567 yoki 308xxxxxx"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-1.5 border border-amber-200">
                      ⚠️ Ro'yxatdan o'tgach hisobingiz <strong>PENDING</strong> holatida bo'ladi. Admin tasdiqlanganidan so'ng mahsulot sotishingiz mumkin.
                    </p>
                  </div>
                </>
              )}

              {/* B2B qo'shimcha maydonlari */}
              {selectedRole === 'BUYER_B2B' && (
                <>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Kompaniya / Restoran nomi *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Masalan: Rayhon Restorani"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      STIR (INN) raqami *
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={companyTin}
                        onChange={(e) => setCompanyTin(e.target.value)}
                        placeholder="Masalan: 308xxxxxxx"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Kuryer pasporti */}
              {selectedRole === 'COURIER' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Pasport seriyasi *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={tinOrPassport}
                      onChange={(e) => setTinOrPassport(e.target.value)}
                      placeholder="Masalan: AA1234567"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Parol */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Parol *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 ta belgi"
                      className="w-full pl-9 pr-8 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Parolni tasdiqlash *</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Takrorlang"
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-agro-green focus:outline-none"
                  />
                </div>
              </div>

              {/* Yuborish tugmasi */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-agro-green hover:bg-agro-lightGreen text-white font-extrabold py-3 rounded-2xl flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/15 transition-all disabled:opacity-60 mt-2"
              >
                {loading ? (
                  <span className="animate-pulse">Ro'yxatdan o'tilmoqda...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-agro-amber" />
                    <span>Hisob yaratish</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <span className="text-xs text-gray-500">Akkauntingiz bormi? </span>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-xs font-bold text-agro-green hover:underline"
                >
                  Kirish →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Kichik o'q komponenti (Lucide ChevronRight o'rniga)
const ChevronIcon = () => (
  <svg className="w-4 h-4 text-current opacity-50 group-hover:opacity-100 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

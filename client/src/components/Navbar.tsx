import React, { useState } from 'react';
import {
  Sprout,
  ShoppingBag,
  Package,
  Tractor,
  Truck,
  ShieldCheck,
  Wallet,
  UserCheck,
  LogOut,
  ChevronDown,
  Search,
  LogIn,
  UserPlus,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openWalletModal: () => void;
  openCartDrawer: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  searchQuery,
  setSearchQuery,
  openWalletModal,
  openCartDrawer,
  onOpenLogin,
  onOpenRegister,
}) => {
  const { user, demoUsers, switchDemoUser, logout } = useAuth();
  const { totalQuantity } = useCart();
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'FARMER':
        return { label: 'Fermer', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'BUYER_B2C':
        return { label: 'Xaridor (B2C)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'BUYER_B2B':
        return { label: 'Restoran / B2B', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'COURIER':
        return { label: 'Kuryer', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'ADMIN':
        return { label: 'Admin', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: 'Mehmon', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
      {/* Top Banner */}
      <div className="bg-agro-dark text-white px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-agro-amber text-black uppercase tracking-wider">
              Real Rejim
            </span>
            <span className="hidden sm:inline text-gray-300">
              O'zbekistonning birinchi xavfsiz Escrow agro-savdo maydonchasi
            </span>
          </div>

          {/* Faqat tizimga kirgan foydalanuvchilar uchun: Tezkor Demo almashtirish */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                className="flex items-center space-x-2 bg-agro-green hover:bg-agro-lightGreen text-white px-2.5 py-1 rounded-md text-xs font-medium transition-colors border border-emerald-600/50"
              >
                <UserCheck className="w-3.5 h-3.5 text-agro-amber" />
                <span>Rolni almashtirish: <strong>{user?.full_name || 'Tanlang'}</strong></span>
                <ChevronDown className="w-3 h-3 text-gray-300" />
              </button>

              {demoMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDemoMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <div className="px-3 py-1.5 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Test Rejimi: 1-bosishda kirish
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {demoUsers.map((u) => {
                        const badge = getRoleBadge(u.role);
                        const isCurrent = user?.id === u.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => {
                              switchDemoUser(u.id);
                              setDemoMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between transition-colors ${
                              isCurrent ? 'bg-emerald-50/70' : ''
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                                <span>{u.full_name}</span>
                                {u.is_premium && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
                                    PREMIUM
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {u.phone} • {u.region}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap ml-2 ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Mehmon holati: Kirish va Ro'yxatdan o'tish tugmalari (kichik, top bar uchun) */
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-[11px]">Tizimga kiring yoki ro'yxatdan o'ting</span>
            </div>
          )}
        </div>
      </div>

      {/* Asosiy Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <div
            onClick={() => setCurrentTab('marketplace')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-agro-green flex items-center justify-center text-white shadow-md shadow-emerald-900/20 group-hover:bg-agro-lightGreen transition-colors">
              <Sprout className="w-6 h-6 text-agro-amber" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-agro-dark flex items-center">
                <span>Agro</span>
                <span className="text-agro-amber">Bozor</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium -mt-1 hidden sm:block">
                Hosil to'g'ridan-to'g'ri daladan
              </p>
            </div>
          </div>

          {/* Qidiruv qutisi */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mahsulotlarni qidiring (masalan: Parkent uzumi, olma)..."
                className="w-full bg-gray-50 hover:bg-gray-100/80 focus:bg-white text-sm pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:border-agro-green focus:outline-none focus:ring-2 focus:ring-agro-green/20 transition-all"
              />
            </div>
          </div>

          {/* Navigatsiya Tugmalari */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentTab('marketplace')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'marketplace'
                  ? 'bg-agro-paleGreen text-agro-green'
                  : 'text-gray-600 hover:text-agro-dark hover:bg-gray-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Bozor</span>
            </button>

            {/* Faqat tizimga kirgan foydalanuvchilar uchun tablar */}
            {user && (
              <>
                <button
                  onClick={() => setCurrentTab('orders')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    currentTab === 'orders'
                      ? 'bg-agro-paleGreen text-agro-green'
                      : 'text-gray-600 hover:text-agro-dark hover:bg-gray-100'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">Buyurtmalar</span>
                </button>

                {(user?.role === 'FARMER' || user?.role === 'ADMIN') && (
                  <button
                    onClick={() => setCurrentTab('farmer')}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      currentTab === 'farmer'
                        ? 'bg-agro-paleGreen text-agro-green'
                        : 'text-gray-600 hover:text-agro-dark hover:bg-gray-100'
                    }`}
                  >
                    <Tractor className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">Fermer Kabineti</span>
                  </button>
                )}

                {(user?.role === 'COURIER' || user?.role === 'ADMIN') && (
                  <button
                    onClick={() => setCurrentTab('courier')}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      currentTab === 'courier'
                        ? 'bg-agro-paleGreen text-agro-green'
                        : 'text-gray-600 hover:text-agro-dark hover:bg-gray-100'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span className="hidden sm:inline">Kuryer</span>
                  </button>
                )}

                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => setCurrentTab('admin')}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      currentTab === 'admin'
                        ? 'bg-agro-paleGreen text-agro-green'
                        : 'text-gray-600 hover:text-agro-dark hover:bg-gray-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span className="hidden sm:inline">Admin Panel</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* O'ng tomon */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user ? (
              /* ===== TIZIMGA KIRGAN: Ism, Rol, Hamyon, Chiqish ===== */
              <>
                {/* Foydalanuvchi info */}
                <div className="hidden lg:flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                  <User className="w-4 h-4 text-agro-green shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-agro-dark leading-tight truncate max-w-[100px]">
                      {user.full_name}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0 rounded-full border font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>

                {/* Hamyon Tugmasi */}
                <button
                  onClick={openWalletModal}
                  className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-800 transition-colors"
                  title="Hamyon va Escrow balansi"
                >
                  <Wallet className="w-4 h-4 text-agro-green" />
                  <div className="text-left hidden lg:block">
                    <div className="text-[10px] text-gray-500 leading-none">Hamyon</div>
                    <div className="font-bold text-agro-dark">
                      {(user?.wallet_available || 0).toLocaleString()} so'm
                    </div>
                  </div>
                  {user?.wallet_escrow ? (
                    <span className="hidden xl:inline text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-medium">
                      Escrow: {user.wallet_escrow.toLocaleString()}
                    </span>
                  ) : null}
                </button>

                {/* Savat Tugmasi */}
                <button
                  onClick={openCartDrawer}
                  className="relative p-2.5 rounded-xl bg-agro-paleGreen text-agro-green hover:bg-emerald-100 transition-colors"
                  title="Savat"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {totalQuantity > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-agro-amber text-black font-bold text-xs rounded-full flex items-center justify-center shadow">
                      {totalQuantity}
                    </span>
                  )}
                </button>

                {/* Chiqish Tugmasi */}
                <button
                  onClick={logout}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all"
                  title="Tizimdan chiqish"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Chiqish</span>
                </button>
              </>
            ) : (
              /* ===== MEHMON: Kirish va Ro'yxatdan o'tish tugmalari ===== */
              <>
                {/* Savat (mehmon ham ko'ra oladi) */}
                <button
                  onClick={openCartDrawer}
                  className="relative p-2.5 rounded-xl bg-agro-paleGreen text-agro-green hover:bg-emerald-100 transition-colors"
                  title="Savat"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {totalQuantity > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-agro-amber text-black font-bold text-xs rounded-full flex items-center justify-center shadow">
                      {totalQuantity}
                    </span>
                  )}
                </button>

                <button
                  onClick={onOpenLogin}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-agro-dark border border-gray-300 hover:border-agro-green hover:text-agro-green hover:bg-agro-paleGreen transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Kirish</span>
                </button>

                <button
                  onClick={onOpenRegister}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white bg-agro-green hover:bg-agro-lightGreen shadow-sm shadow-emerald-900/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Ro'yxatdan o'tish</span>
                  <span className="sm:hidden">Kirish</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

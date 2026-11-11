import React, { useState } from 'react';
import {
  Sprout,
  ShoppingBag,
  Package,
  Tractor,
  Truck,
  ShieldCheck,
  Wallet,
  LogOut,
  Search,
  LogIn,
  UserPlus,
  User,
  PlusCircle,
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
  onOpenAddProduct: () => void;
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
  onOpenAddProduct,
}) => {
  const { user, logout } = useAuth();
  const { totalQuantity } = useCart();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'FARMER':
        return { label: 'Fermer (Sotuvchi)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'BUYER_B2C':
        return { label: 'Xaridor', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'BUYER_B2B':
        return { label: 'Biznes / B2B', color: 'bg-purple-100 text-purple-800 border-purple-300' };
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-agro-amber text-black uppercase tracking-wider">
              100% Escrow
            </span>
            <span className="text-gray-300 text-[11px]">
              O'zbekistonning Ishonchli va Xavfsiz Agro-Savdo Platformasi
            </span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-gray-300">
            <span className="hidden md:inline">📞 Qo'llab-quvvatlash: +998 (71) 200-00-00</span>
            <span className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kafolatlangan To'lovlar</span>
            </span>
          </div>
        </div>
      </div>

      {/* Asosiy Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-16 gap-3 py-3">
          {/* Logo */}
          <div
            onClick={() => setCurrentTab('marketplace')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-agro-green flex items-center justify-center text-white shadow-md shadow-emerald-900/20 group-hover:bg-agro-lightGreen transition-colors">
              <Sprout className="w-6 h-6 text-agro-amber" />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-agro-dark flex items-center">
                <span>Agro</span>
                <span className="text-agro-amber">Bozor</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium -mt-1 hidden sm:block">
                Hosil bevosita daladan
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
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* O'ng tomon */}
          <div className="flex items-center space-x-2">
            {/* Mahsulot qo'shish / Hosilni sotish TUGMASI (Har kim uchun ochiq) */}
            <button
              onClick={onOpenAddProduct}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-900/10 active:scale-95"
              title="O'z hosilingizni sotuvga chiqaring"
            >
              <PlusCircle className="w-4 h-4 text-agro-amber" />
              <span className="hidden md:inline">Mahsulot qo'shish</span>
              <span className="md:hidden">Sotish</span>
            </button>

            {user ? (
              /* ===== TIZIMGA KIRGAN: Profil, Hamyon, Savat, Chiqish ===== */
              <>
                {/* Foydalanuvchi info */}
                <div className="hidden lg:flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                  <User className="w-4 h-4 text-agro-green shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-agro-dark leading-tight truncate max-w-[110px]">
                      {user.full_name}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0 rounded-full border font-bold ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>

                {/* Hamyon Tugmasi */}
                <button
                  onClick={openWalletModal}
                  className="flex items-center space-x-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-800 transition-colors"
                  title="Hamyon va hisob balansi"
                >
                  <Wallet className="w-4 h-4 text-agro-green" />
                  <div className="text-left hidden xl:block">
                    <div className="font-bold text-agro-dark text-xs">
                      {(user?.wallet_available || 0).toLocaleString()} so'm
                    </div>
                  </div>
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
                  className="flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all"
                  title="Tizimdan chiqish"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Chiqish</span>
                </button>
              </>
            ) : (
              /* ===== MEHMON: Savat, Kirish va Ro'yxatdan o'tish ===== */
              <>
                <button
                  onClick={openCartDrawer}
                  className="relative p-2 rounded-xl bg-agro-paleGreen text-agro-green hover:bg-emerald-100 transition-colors"
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
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-agro-dark border border-gray-300 hover:border-agro-green hover:text-agro-green hover:bg-agro-paleGreen transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Kirish</span>
                </button>

                <button
                  onClick={onOpenRegister}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-agro-green hover:bg-agro-lightGreen shadow-sm shadow-emerald-900/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Ro'yxatdan o'tish</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

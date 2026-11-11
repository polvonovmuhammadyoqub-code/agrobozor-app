import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Sprout,
  ShoppingBasket,
  Package,
  Tractor,
  Truck,
  ShieldCheck,
  Wallet,
  LogOut,
  MessageCircle,
  Plus,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openWalletModal: () => void;
  openCartDrawer: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAddProduct: () => void;
}
export function Navbar(p: NavbarProps) {
  const [unread, setUnread] = useState(0);
  const { user, logout } = useAuth();
  const { items } = useCart();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = async () => {
      try {
        const data = await api.messages.unread();
        if (active) setUnread(data.count);
      } catch {
        /* A missed badge update should not interrupt navigation. */
      }
    };
    void check();
    const timer = setInterval(() => {
      if (!document.hidden) void check();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, p.currentTab]);
  const roleTab =
    user?.role === 'FARMER'
      ? 'farmer'
      : user?.role === 'COURIER'
        ? 'courier'
        : user?.role === 'ADMIN'
          ? 'admin'
          : 'orders';
  const RoleIcon =
    user?.role === 'FARMER'
      ? Tractor
      : user?.role === 'COURIER'
        ? Truck
        : user?.role === 'ADMIN'
          ? ShieldCheck
          : Package;
  const roleLabel =
    user?.role === 'FARMER'
      ? 'Kabinet'
      : user?.role === 'COURIER'
        ? 'Yetkazuvlar'
        : user?.role === 'ADMIN'
          ? 'Boshqaruv'
          : 'Buyurtmalar';
  const nav = [
    ...(user && ['FARMER', 'COURIER', 'ADMIN'].includes(user.role)
      ? [{ id: roleTab, label: roleLabel, Icon: RoleIcon }]
      : []),
    { id: 'marketplace', label: 'Bozor', Icon: ShoppingBasket },
    ...(user && ['BUYER_B2C', 'BUYER_B2B'].includes(user.role)
      ? [{ id: 'orders', label: 'Buyurtmalar', Icon: Package }]
      : []),
    ...(user
      ? [{ id: 'messages', label: 'Xabarlar', Icon: MessageCircle }]
      : []),
  ];
  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() =>
              p.setCurrentTab(
                user
                  ? roleTab === 'orders'
                    ? 'marketplace'
                    : roleTab
                  : 'welcome',
              )
            }
            className="flex items-center gap-2 font-black text-xl text-agro-dark"
          >
            <Sprout className="text-emerald-700" size={26} />
            <span>
              Agro<span className="text-amber-600">Bozor</span>
            </span>
          </button>
          <nav aria-label="Asosiy menyu" className="hidden md:flex gap-1">
            {nav.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-label={label}
                aria-current={p.currentTab === id ? 'page' : undefined}
                onClick={() => p.setCurrentTab(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${p.currentTab === id ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500'}`}
              >
                <span className="relative">
                  <Icon size={18} />
                  {id === 'messages' && unread > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-2 -right-2 bg-amber-400 text-black text-[9px] px-1 rounded-full"
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </span>
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <span className="hidden xl:block text-xs text-gray-500 max-w-28 truncate">
                  {user.full_name}
                </span>
                {user.role === 'FARMER' && (
                  <button
                    aria-label="Mahsulot qo‘shish"
                    title="Mahsulot qo‘shish"
                    onClick={p.onOpenAddProduct}
                    className="p-2 rounded-xl bg-agro-green text-white"
                  >
                    <Plus size={20} />
                  </button>
                )}
                <button
                  title="Savat"
                  onClick={p.openCartDrawer}
                  className="p-2 rounded-xl bg-emerald-50 text-emerald-800 relative"
                >
                  <ShoppingBasket size={20} />
                  {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[10px] rounded-full px-1.5">
                      {items.length}
                    </span>
                  )}
                </button>
                <button
                  title="Tizimdan chiqish"
                  aria-label="Tizimdan chiqish"
                  onClick={logout}
                  className="p-2 text-gray-500"
                >
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={p.onOpenLogin}
                  className="text-sm font-semibold text-emerald-800 p-2"
                >
                  <LogIn className="inline mr-1" size={16} />
                  Kirish
                </button>
                <button
                  onClick={p.onOpenRegister}
                  aria-label="Ro‘yxatdan o‘tish"
                  className="bg-agro-green text-white p-2 rounded-xl"
                >
                  <UserPlus size={19} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {user && (
        <nav
          aria-label="Pastki menyu"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 flex justify-around pb-[env(safe-area-inset-bottom)]"
        >
          {nav.map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-label={label}
              aria-current={p.currentTab === id ? 'page' : undefined}
              onClick={() => p.setCurrentTab(id)}
              className={`flex-1 min-w-0 py-3 flex flex-col items-center gap-1 text-[11px] font-semibold ${p.currentTab === id ? 'text-emerald-800 bg-emerald-50/60' : 'text-gray-400'}`}
            >
              <span className="relative">
                <Icon size={21} />
                {id === 'messages' && unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-3 bg-amber-400 text-black text-[9px] px-1 rounded-full"
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
          <button
            onClick={p.openWalletModal}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-[11px] text-gray-400 font-semibold"
          >
            <Wallet size={21} />
            Hamyon
          </button>
        </nav>
      )}
      {user && (
        <button
          onClick={p.openWalletModal}
          className="hidden md:block fixed bottom-6 right-6 z-40 bg-agro-green text-white p-4 rounded-2xl shadow-lg"
          title="Hamyon"
        >
          <Wallet size={22} />
        </button>
      )}
    </>
  );
}

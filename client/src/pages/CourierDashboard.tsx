import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Wallet,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface CourierDashboardProps {
  onOpenInvoice: (orderId: string) => void;
}

export const CourierDashboard: React.FC<CourierDashboardProps> = ({ onOpenInvoice }) => {
  const { user, refreshUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleTakeOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await api.orders.updateStatus(orderId, 'IN_TRANSIT');
      await refreshUser();
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliverOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await api.orders.updateStatus(orderId, 'DELIVERED');
      await refreshUser();
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  // 1. Kuryer olishi mumkin bo'lgan buyurtmalar (Fermer tasdiqlagan)
  const availableOrders = orders.filter(
    (o) => o.status === 'CONFIRMED_BY_FARMER' && (!o.courier_id || o.courier_id === user?.id)
  );

  // 2. Kuryerning yo'ldagi faol yetkazuvlari
  const activeOrders = orders.filter(
    (o) => o.status === 'IN_TRANSIT' && o.courier_id === user?.id
  );

  // 3. Yetkazilgan va yakunlanganlar
  const historyOrders = orders.filter(
    (o) =>
      (o.status === 'DELIVERED' || o.status === 'COMPLETED') &&
      o.courier_id === user?.id
  );

  const completedCount = historyOrders.length;
  const totalEarned = completedCount * 12000;

  return (
    <div className="space-y-6">
      {/* Sarlavha va Kuryer statistikasi */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center space-x-2">
          <Truck className="w-7 h-7 text-amber-500" />
          <span>Kuryer Logistika Xizmati</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          AgroBozor tezkor kuryerlik tarmog'i — har bir muvaffaqiyatli yetkazish uchun 12 000 so'm kafolatlangan to'lov
        </p>
      </div>

      {/* KPI Kartalari */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Kuryer Balansi (Hamyon)</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-agro-green">
            {(user?.wallet_available || 0).toLocaleString()} <span className="text-xs font-normal">so'm</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Har bir yetkazib berishdan to'g'ridan-to'g'ri tushgan
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Faol Yo'ldagi Buyurtmalar</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {activeOrders.length} <span className="text-xs font-normal">ta</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Mijoz manziliga yetkazilmoqda
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Ochiq Tasdiqlangan Buyurtmalar</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {availableOrders.length} <span className="text-xs font-normal">ta</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Fermerlar tayyorlab kutmoqda
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'available'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mavjud Ochiq Buyurtmalar ({availableOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'active'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mening Faol Yetkazuvlarim ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Yetkazilganlar Tarixi ({historyOrders.length})
          </button>
        </div>

        {/* Tab Kontenti */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Yuklanmoqda...</div>
        ) : activeTab === 'available' ? (
          availableOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Hozirda yangi ochiq buyurtmalar yo'q. Fermerlar buyurtmalarni tasdiqlashi bilan bu yerda paydo bo'ladi.
            </div>
          ) : (
            <div className="space-y-4">
              {availableOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-5 rounded-2xl border border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-gray-900">
                        {o.product.title} ({o.quantity_kg} kg)
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        +12 000 so'm kuryer haqi
                      </span>
                    </div>
                    <div className="text-gray-600 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        Fermerdan olish: <strong>{o.farmer.region}</strong> ({o.farmer.full_name})
                      </span>
                    </div>
                    <div className="text-gray-600 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Mijozga eltish: <strong>{o.delivery_address}</strong> ({o.buyer.full_name})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTakeOrder(o.id)}
                    disabled={actionLoading === o.id}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-amber-900/10 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <span>Qabul qilish va Yo'lga chiqish</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'active' ? (
          activeOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Sizda hozircha yo'ldagi buyurtmalar yo'q. "Mavjud Ochiq Buyurtmalar" bo'limidan birini qabul qiling.
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-5 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-gray-900">
                        {o.product.title} ({o.quantity_kg} kg)
                      </span>
                      <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        Yo'lda
                      </span>
                    </div>
                    <div className="text-gray-700">
                      Yetkazish manzili: <strong>{o.delivery_address}</strong>
                    </div>
                    <div className="text-gray-600">
                      Mijoz: {o.buyer.full_name} ({o.buyer.phone})
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeliverOrder(o.id)}
                    disabled={actionLoading === o.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-900/15 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mijozga Yetkazdim</span>
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Tarix */
          historyOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Hali yakunlangan yetkazuvlar yo'q
            </div>
          ) : (
            <div className="space-y-3">
              {historyOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-4 rounded-xl border border-gray-100 bg-white flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-900">{o.product.title}</div>
                    <div className="text-gray-500">Manzil: {o.delivery_address}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-emerald-700">+12 000 so'm</div>
                    <div className="text-[10px] text-gray-400">{o.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

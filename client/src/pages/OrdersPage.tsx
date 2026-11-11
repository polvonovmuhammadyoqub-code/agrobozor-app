import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../lib/api';
import { OrderCard } from '../components/OrderCard';
import { Package, RefreshCw, Layers } from 'lucide-react';

interface OrdersPageProps {
  onOpenDispute: (order: Order) => void;
  onOpenInvoice: (orderId: string) => void;
  onOpenReview: (order: Order) => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  onOpenDispute,
  onOpenInvoice,
  onOpenReview,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchOrders = async (silent = false) => {
    if(!silent) setLoading(true);
    try {
      const data = await api.orders.getAll();
      setOrders(data); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buyurtmalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    const timer = setInterval(() => { if(!document.hidden) void fetchOrders(true); }, 10000);
    return () => clearInterval(timer);
  }, []);

  const filterTabs = [
    { id: 'ALL', label: 'Barchasi' },
    { id: 'PENDING_PAYMENT', label: '🟠 To\'lov kutilmoqda' },
    { id: 'PAID_IN_ESCROW', label: '🟡 Escrowda' },
    { id: 'CONFIRMED_BY_FARMER', label: '🔵 Fermer tasdiqlagan' },
    { id: 'IN_TRANSIT', label: '🟠 Yo\'lda' },
    { id: 'DELIVERED', label: '🟢 Yetkazilgan' },
    { id: 'COMPLETED', label: '✅ Yakunlangan' },
    { id: 'DISPUTED', label: '🔴 Nizolar' },
  ];

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Sarlavha va Yangilash */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center space-x-2">
            <Package className="w-6 h-6 text-agro-green" />
            <span>Mening Buyurtmalarim</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Escrow kafolatlangan buyurtmalar zanjiri va yetkazib berish holati
          </p>
        </div>

        <button
          onClick={() => fetchOrders()}
          className="flex items-center space-x-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-2xl text-xs font-bold transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>

      {error && <p role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{error}</p>}
      {/* Status Filtrlari */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === tab.id
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Buyurtmalar Ro'yxati */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-agro-green border-t-transparent" />
          <p className="mt-2 text-xs text-gray-500 font-medium">Buyurtmalar yuklanmoqda...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-gray-200 p-8 space-y-2">
          <Layers className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">Buyurtmalar topilmadi</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Hozircha ushbu holatdagi buyurtmalar mavjud emas. Bozordan xarid qiling!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onRefresh={fetchOrders}
              onOpenDispute={onOpenDispute}
              onOpenInvoice={onOpenInvoice}
              onOpenReview={onOpenReview}
            />
          ))}
        </div>
      )}
    </div>
  );
};

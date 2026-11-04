import React, { useState, useEffect } from 'react';
import { Product, Order } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Tractor,
  PlusCircle,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Star,
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit,
} from 'lucide-react';
import { OrderCard } from '../components/OrderCard';

interface FarmerDashboardProps {
  onOpenAddProduct: () => void;
  onOpenWallet: () => void;
  onOpenDispute: (order: Order) => void;
  onOpenInvoice: (orderId: string) => void;
  onOpenReview: (order: Order) => void;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  onOpenAddProduct,
  onOpenWallet,
  onOpenDispute,
  onOpenInvoice,
  onOpenReview,
}) => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  const [farmerOrders, setFarmerOrders] = useState<Order[]>([]);
  const [farmerProducts, setFarmerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ordersData, productsData] = await Promise.all([
        api.orders.getAll(),
        api.products.getAll({ farmer_id: user.id }),
      ]);
      setFarmerOrders(ordersData);
      setFarmerProducts(productsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Ushbu mahsulotni o\'chirishni tasdiqlaysizmi?')) return;
    try {
      await api.products.delete(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'O\'chirishda xatolik');
    }
  };

  const isKycApproved = user?.kyc_status === 'APPROVED' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* KYC Status Banner */}
      {isKycApproved ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-agro-amber" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                <span>KYC Tasdiqlangan Fermer</span>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                  APPROVED
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Sizning hisobingiz to'liq tekshiruvdan o'tgan. Mahsulotlaringiz bozorda kafolatlangan belgi bilan sotiladi.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAddProduct}
            className="hidden sm:flex items-center space-x-1.5 bg-agro-green hover:bg-agro-lightGreen text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4 text-agro-amber" />
            <span>Yangi Mahsulot Qo'shish</span>
          </button>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                <span>Fermerlik Hisobingiz Tekshirilmoqda</span>
                <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold">
                  KYC: PENDING
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Admin tomonidan pasport/STIR ma'lumotlaringiz ko'rib chiqilmoqda. Tasdiqlangandan so'ng mahsulot sotish huquqiga ega bo'lasiz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fermer KPI Kartalari */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Yechishga tayyor balans */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Yechishga tayyor mablag'</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-gray-900">
            {(user?.wallet_available || 0).toLocaleString()} <span className="text-xs font-normal">so'm</span>
          </div>
          <button
            onClick={onOpenWallet}
            className="text-[11px] text-agro-green font-bold hover:underline"
          >
            Hisobdan yechish &rarr;
          </button>
        </div>

        {/* Escrowda muzlatilgan */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Escrow Kafolat Balansi</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600">
            {(user?.wallet_escrow || 0).toLocaleString()} <span className="text-xs font-normal">so'm</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Xaridor mahsulotni qabul qilgach o'tadi
          </p>
        </div>

        {/* Mahsulotlar soni */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Faol Mahsulotlar</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-gray-900">
            {farmerProducts.length} <span className="text-xs font-normal">ta lot</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Katalogda ommabop sotuvda
          </p>
        </div>

        {/* Reyting va Premium */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
            <span>Fermer Reytingi</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
          </div>
          <div className="text-xl font-black text-gray-900 flex items-center space-x-1.5">
            <span>{user?.rating?.toFixed(1) || '5.0'}</span>
            {user?.is_premium && (
              <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md font-bold">
                PREMIUM
              </span>
            )}
          </div>
          <button
            onClick={onOpenWallet}
            className="text-[11px] text-amber-700 font-bold hover:underline"
          >
            {user?.is_premium ? 'Oltin a\'zolik faol' : 'Oltin Premium sotib olish &rarr;'}
          </button>
        </div>
      </div>

      {/* Tabs: Tushgan Buyurtmalar va Mening Mahsulotlarim */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'orders'
                  ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70'
              }`}
            >
              Tushgan Buyurtmalar ({farmerOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'products'
                  ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70'
              }`}
            >
              Mening Mahsulotlarim ({farmerProducts.length})
            </button>
          </div>

          <button
            onClick={onOpenAddProduct}
            className="flex items-center space-x-1.5 bg-agro-green hover:bg-agro-lightGreen text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4 text-agro-amber" />
            <span>Mahsulot Qo'shish</span>
          </button>
        </div>

        {/* Tanlangan bo'lim kontenti */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Yuklanmoqda...</div>
        ) : activeTab === 'orders' ? (
          farmerOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Hozircha yangi tushgan buyurtmalar yo'q
            </div>
          ) : (
            <div className="space-y-4">
              {farmerOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onRefresh={fetchData}
                  onOpenDispute={onOpenDispute}
                  onOpenInvoice={onOpenInvoice}
                  onOpenReview={onOpenReview}
                />
              ))}
            </div>
          )
        ) : (
          /* Mahsulotlar Jadvali */
          farmerProducts.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Siz hali hech qanday mahsulot joylashtirmadingiz. "Mahsulot Qo'shish" tugmasini bosing!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2.5">Rasm</th>
                    <th className="py-2.5">Mahsulot nomi</th>
                    <th className="py-2.5">Kategoriya</th>
                    <th className="py-2.5">Narx (1 kg)</th>
                    <th className="py-2.5">Omborda qoldiq</th>
                    <th className="py-2.5">Hosil sanasi</th>
                    <th className="py-2.5 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {farmerProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5">
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      </td>
                      <td className="py-2.5 font-bold text-gray-900">{p.title}</td>
                      <td className="py-2.5 text-gray-600">{p.category}</td>
                      <td className="py-2.5 font-bold text-agro-green">
                        {p.price_per_kg.toLocaleString()} so'm
                      </td>
                      <td className="py-2.5">{p.available_quantity_kg} kg</td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(p.harvest_date).toLocaleDateString('uz-UZ')}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};

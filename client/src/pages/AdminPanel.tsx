import React, { useState, useEffect } from 'react';
import { AdminStats, User, Dispute, Transaction, Order, WithdrawalRequest } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Scale,
  RefreshCw,
  Clock,
  Sparkles,
  CreditCard,
  Building2,
  Truck,
  ArrowDownToLine,
  Check,
  X,
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { refreshUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [farmers, setFarmers] = useState<User[]>([]);
  const [couriers, setCouriers] = useState<User[]>([]);
  const [b2bOrders, setB2bOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpi' | 'kyc' | 'b2b' | 'withdrawals' | 'disputes' | 'transactions'>('kpi');
  const [kycRoleTab, setKycRoleTab] = useState<'FARMER' | 'COURIER'>('FARMER');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, farmersData, couriersData, b2bData, withdrawalsData, disputesData, txData] = await Promise.all([
        api.admin.getStats(),
        api.admin.getFarmers(),
        api.admin.getCouriers().catch(() => []),
        api.admin.getB2bOrders().catch(() => []),
        api.admin.getWithdrawals().catch(() => []),
        api.disputes.getAll(),
        api.admin.getTransactions(),
      ]);
      setStats(statsData);
      setFarmers(farmersData);
      setCouriers(couriersData);
      setB2bOrders(b2bData);
      setWithdrawals(withdrawalsData);
      setDisputes(disputesData);
      setTransactions(txData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  // KYC holatini yangilash (Fermer yoki Kuryer)
  const handleUpdateKyc = async (userId: string, status: string) => {
    setActionLoading(`kyc-${userId}`);
    try {
      await api.admin.updateKyc(userId, status);
      await fetchAllAdminData();
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'KYC yangilashda xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  // B2B bank to'lovini tasdiqlash
  const handleConfirmB2bPayment = async (orderId: string) => {
    if (!confirm("Haqiqatan ham bank orqali ushbu to'lov kelib tushganini tasdiqlaysizmi? Mablag' Escrow'ga o'tkaziladi.")) {
      return;
    }
    setActionLoading(`b2b-${orderId}`);
    try {
      await api.admin.confirmPayment(orderId);
      alert("B2B to'lovi tasdiqlandi va buyurtma Escrow holatiga o'tkazildi!");
      await fetchAllAdminData();
      await refreshUser();
    } catch (err: any) {
      alert(err.message || "B2B to'lovini tasdiqlashda xatolik");
    } finally {
      setActionLoading(null);
    }
  };

  // Pul yechish so'rovini tasdiqlash (PAID)
  const handleApproveWithdrawal = async (id: string) => {
    if (!confirm("Foydalanuvchi kartasiga pul o'tkazilganini tasdiqlaysizmi?")) return;
    setActionLoading(`withdraw-${id}`);
    try {
      await api.admin.approveWithdrawal(id);
      alert("Pul yechish so'rovi to'langan deb belgilandi!");
      await fetchAllAdminData();
    } catch (err: any) {
      alert(err.message || 'Tasdiqlashda xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  // Pul yechish so'rovini rad etish va balansni qaytarish
  const handleRejectWithdrawal = async (id: string) => {
    const reason = prompt('Rad etish sababini kiriting (mablag‘ foydalanuvchi balansiga qaytariladi):', 'Karta rekvizitlarida xatolik');
    if (reason === null) return;
    setActionLoading(`withdraw-${id}`);
    try {
      await api.admin.rejectWithdrawal(id, reason);
      alert("So'rov rad etildi va mablag' foydalanuvchi hisobiga qaytarildi!");
      await fetchAllAdminData();
    } catch (err: any) {
      alert(err.message || 'Rad etishda xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  // Nizo bo'yicha arbitraj qarori qabul qilish
  const handleResolveDispute = async (
    disputeId: string,
    resolution: 'RESOLVED_REFUND_FULL' | 'RESOLVED_REFUND_PARTIAL' | 'RESOLVED_FARMER_WIN'
  ) => {
    const confirmationLabels = {
      RESOLVED_REFUND_FULL: 'Pul to\'liq xaridorga qaytarilsinmi? Fermerning Escrow hisobidan yechiladi.',
      RESOLVED_REFUND_PARTIAL: 'Pul 50/50 teng taqsimlansinmi? Yarim pul xaridorga, yarmi fermerga o\'tadi.',
      RESOLVED_FARMER_WIN: 'Fermer haqligi tasdiqlansinmi? Escrowdagi pul to\'liq fermerning asosiy hisobiga o\'tkaziladi.',
    };

    if (!confirm(confirmationLabels[resolution])) return;

    setActionLoading(`dispute-${disputeId}`);
    try {
      await api.disputes.resolve(disputeId, {
        resolution,
        admin_comment: `Bosh Administrator tomonidan arbitraj qarori: ${resolution}`,
      });
      alert('Arbitraj qarori ijro etildi va moliyaviy hisoblar yangilandi!');
      await fetchAllAdminData();
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Nizoni hal qilishda xatolik');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingB2bCount = b2bOrders.filter((o) => o.status === 'PENDING_PAYMENT').length;
  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'PENDING').length;
  const pendingCouriersKyc = couriers.filter((c) => c.kyc_status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
              ADMIN BOSHQARUV PANELI
            </span>
            <span className="text-xs text-gray-400">
              Escrow & KYC Nazorati
            </span>
          </div>
          <h1 className="text-2xl font-black text-agro-dark mt-1">
            AgroBozor Milliy Tizimi Boshqaruvi
          </h1>
        </div>

        <button
          onClick={fetchAllAdminData}
          disabled={loading}
          className="flex items-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-agro-green' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>

      {/* KPI Ko'rsatkichlari */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Jami GMV</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-agro-green">
              {stats.totalGmv.toLocaleString()} <span className="text-xs font-bold">so'm</span>
            </div>
            <div className="text-[10px] text-gray-500">
              O'rtacha chek: {stats.aov.toLocaleString()} so'm
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sof Komissiya</span>
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-gray-900">
              {stats.platformNetRevenue.toLocaleString()} <span className="text-xs font-bold">so'm</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">
              Barcha yakunlangan savdolar
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Kutilayotgan KYC</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-black text-purple-700">
              {stats.pendingKycCount} <span className="text-xs font-bold">nafar</span>
            </div>
            <div className="text-[10px] text-gray-500">
              Fermer va kuryer tekshiruvlari
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">B2B & Pul Yechish</span>
              <ArrowDownToLine className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600">
              {pendingB2bCount + pendingWithdrawalsCount} <span className="text-xs font-bold">so'rov</span>
            </div>
            <div className="text-[10px] text-gray-500">
              B2B: {pendingB2bCount} | Yechish: {pendingWithdrawalsCount}
            </div>
          </div>
        </div>
      )}

      {/* Asosiy Admin Tablari */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('kpi')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'kpi'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Umumiy Statistika
          </button>

          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'kyc'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>KYC Tekshiruvi</span>
            {stats && stats.pendingKycCount > 0 && (
              <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {stats.pendingKycCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('b2b')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'b2b'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>B2B Bank To'lovlari</span>
            {pendingB2bCount > 0 && (
              <span className="bg-purple-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {pendingB2bCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'withdrawals'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>Pul Yechish So'rovlari</span>
            {pendingWithdrawalsCount > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {pendingWithdrawalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'disputes'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>Nizolar Arbitraji</span>
            {stats && stats.openDisputesCount > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {stats.openDisputesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'transactions'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tranzaksiyalar Auditi
          </button>
        </div>

        {/* Tab 1: KPI Tafsilotlari */}
        {activeTab === 'kpi' && stats && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-sm text-gray-900">Platforma Foydalanuvchilari va Buyurtmalar Holati</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500">Fermerlar:</span>
                <p className="text-lg font-black text-gray-900 mt-1">{stats.farmersCount}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500">Kuryerlar:</span>
                <p className="text-lg font-black text-gray-900 mt-1">{stats.couriersCount}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500">Xaridorlar:</span>
                <p className="text-lg font-black text-gray-900 mt-1">{stats.buyersCount}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-gray-500">Faol Mahsulotlar:</span>
                <p className="text-lg font-black text-gray-900 mt-1">{stats.activeProductsCount}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
              <span className="font-bold text-gray-700">Buyurtmalar holati:</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <span key={status} className="px-3 py-1 bg-white border border-gray-200 rounded-xl font-medium text-gray-700">
                    {status}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: KYC (Fermerlar va Kuryerlar) */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-gray-600 font-medium">
                Pasport va STIR ma'lumotlarini tekshirib, foydalanuvchilar faoliyatini tasdiqlang.
              </div>

              {/* Sub-tabs: Fermerlar vs Kuryerlar */}
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setKycRoleTab('FARMER')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    kycRoleTab === 'FARMER' ? 'bg-white text-agro-green shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Fermerlar ({farmers.length})
                </button>
                <button
                  onClick={() => setKycRoleTab('COURIER')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center space-x-1 ${
                    kycRoleTab === 'COURIER' ? 'bg-white text-agro-green shadow-xs' : 'text-gray-600'
                  }`}
                >
                  <span>Kuryerlar ({couriers.length})</span>
                  {pendingCouriersKyc > 0 && (
                    <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full text-[9px] font-black">
                      {pendingCouriersKyc}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2.5">{kycRoleTab === 'FARMER' ? "Fermer / Xo'jalik" : "Kuryer / Ism"}</th>
                    <th className="py-2.5">STIR / Pasport</th>
                    <th className="py-2.5">Hudud</th>
                    <th className="py-2.5">Telefon</th>
                    <th className="py-2.5">KYC Holati</th>
                    <th className="py-2.5 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {(kycRoleTab === 'FARMER' ? farmers : couriers).map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 font-bold text-gray-900">
                        <div>{u.full_name}</div>
                        {u.farm_or_company_name && (
                          <div className="text-[11px] text-gray-500 font-normal">
                            {u.farm_or_company_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 font-mono font-semibold text-gray-700">
                        {u.tin_or_passport}
                      </td>
                      <td className="py-3 text-gray-600">{u.region}</td>
                      <td className="py-3 text-gray-600">{u.phone}</td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.kyc_status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : u.kyc_status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.kyc_status}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-1.5">
                        {u.kyc_status !== 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateKyc(u.id, 'APPROVED')}
                            disabled={actionLoading === `kyc-${u.id}`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            Tasdiqlash
                          </button>
                        )}
                        {u.kyc_status !== 'REJECTED' && (
                          <button
                            onClick={() => handleUpdateKyc(u.id, 'REJECTED')}
                            disabled={actionLoading === `kyc-${u.id}`}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            Rad etish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(kycRoleTab === 'FARMER' ? farmers : couriers).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        Foydalanuvchilar mavjud emas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: B2B Bank To'lovlari Tasdiqlash */}
        {activeTab === 'b2b' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-600 font-medium">
              Biznes xaridorlar (B2B) tomonidan rasmiy bank hisob-fakturasi orqali to'langan mablag'larni tekshirish va Escrow'ga o'tkazish:
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2.5">Hisob-faktura / Buyurtma</th>
                    <th className="py-2.5">Kompaniya (Xaridor)</th>
                    <th className="py-2.5">Mahsulot</th>
                    <th className="py-2.5">Summa</th>
                    <th className="py-2.5">Holati</th>
                    <th className="py-2.5 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {b2bOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 font-mono font-bold text-gray-900">
                        <div>AGRO-INV-{order.id.slice(0, 8).toUpperCase()}</div>
                        <span className="text-[10px] text-gray-400 font-normal">
                          {new Date(order.created_at).toLocaleDateString('uz-UZ')}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-gray-900">{order.buyer?.farm_or_company_name || order.buyer?.full_name}</div>
                        <div className="text-[11px] text-gray-500 font-normal">STIR: {order.buyer?.tin_or_passport} | Tel: {order.buyer?.phone}</div>
                      </td>
                      <td className="py-3 text-gray-700">
                        {order.product?.title} ({order.quantity_kg} kg)
                      </td>
                      <td className="py-3 font-extrabold text-agro-green">
                        {order.total_paid.toLocaleString()} so'm
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'PENDING_PAYMENT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {order.status === 'PENDING_PAYMENT' ? "To'lov kutilmoqda" : order.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {order.status === 'PENDING_PAYMENT' ? (
                          <button
                            onClick={() => handleConfirmB2bPayment(order.id)}
                            disabled={actionLoading === `b2b-${order.id}`}
                            className="bg-agro-green hover:bg-agro-lightGreen text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-xs disabled:opacity-50"
                          >
                            To'lovni Tasdiqlash (Escrow)
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Escrow'da faol</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {b2bOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        B2B buyurtmalar mavjud emas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Pul Yechish So'rovlari */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-600 font-medium">
              Fermer va kuryerlarning ishlab topgan mablag'larini bank kartalariga o'tkazish so'rovlari:
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2.5">Sana</th>
                    <th className="py-2.5">Foydalanuvchi</th>
                    <th className="py-2.5">Karta Raqami</th>
                    <th className="py-2.5">Summa</th>
                    <th className="py-2.5">Holat</th>
                    <th className="py-2.5 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 text-gray-500 font-mono text-[11px]">
                        {new Date(w.created_at).toLocaleDateString('uz-UZ', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 font-bold text-gray-900">
                        <div>{w.user?.full_name}</div>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {w.user?.role} | Tel: {w.user?.phone}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold text-gray-800">
                        {w.card_number}
                      </td>
                      <td className="py-3 font-black text-agro-green">
                        {w.amount.toLocaleString()} so'm
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            w.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {w.status === 'PENDING' ? "Kutilmoqda" : w.status === 'PAID' ? "O'tkazildi" : "Rad etildi"}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        {w.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => handleApproveWithdrawal(w.id)}
                              disabled={actionLoading === `withdraw-${w.id}`}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              O'tkazildi (Tasdiqlash)
                            </button>
                            <button
                              onClick={() => handleRejectWithdrawal(w.id)}
                              disabled={actionLoading === `withdraw-${w.id}`}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              Rad etish
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            {w.admin_comment || (w.status === 'PAID' ? "Yakunlangan" : "Qaytarilgan")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        Pul yechish so'rovlari mavjud emas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Nizolar Arbitraji */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-600 font-medium">
              Xaridor va fermer o'rtasidagi kelishmovchiliklarni ko'rib chiqish va yakuniy moliyaviy qaror qabul qilish:
            </div>

            {disputes.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                Hozircha hech qanday nizolar ochilmagan
              </div>
            ) : (
              <div className="space-y-4">
                {disputes.map((d) => (
                  <div
                    key={d.id}
                    className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span className="font-extrabold text-sm text-gray-900">
                          Nizo #{d.id.slice(0, 8)}: {d.order?.product?.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'OPEN'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {d.status === 'OPEN' ? 'OCHIQ (KO\'RIB CHIQILMOQDA)' : d.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1.5">
                        <div>
                          <strong>Xaridor:</strong> {d.buyer?.full_name} ({d.buyer?.phone})
                        </div>
                        <div>
                          <strong>Fermer:</strong> {d.order?.farmer?.full_name} ({d.order?.farmer?.phone})
                        </div>
                        <div>
                          <strong>Buyurtma summasi:</strong> {d.order?.total_paid?.toLocaleString()} so'm
                        </div>
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                          <strong>Shikoyat sababi:</strong> {d.reason}
                        </div>
                        {d.admin_comment && (
                          <div className="text-gray-600">
                            <strong>Admin xulosasi:</strong> {d.admin_comment}
                          </div>
                        )}
                      </div>

                      {/* Dalil fotosurati */}
                      {d.evidence_image_url && (
                        <div>
                          <div className="text-[11px] font-bold text-gray-500 mb-1">
                            Xaridor taqdim etgan dalil fotosurati:
                          </div>
                          <img
                            src={d.evidence_image_url}
                            alt="Evidence"
                            className="w-full h-32 object-cover rounded-xl border border-gray-200 shadow-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Arbitraj Harakatlari */}
                    {d.status === 'OPEN' && (
                      <div className="pt-2 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => handleResolveDispute(d.id, 'RESOLVED_REFUND_FULL')}
                          disabled={actionLoading === `dispute-${d.id}`}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                        >
                          1) To'liq xaridorga qaytarish (Refund)
                        </button>
                        <button
                          onClick={() => handleResolveDispute(d.id, 'RESOLVED_REFUND_PARTIAL')}
                          disabled={actionLoading === `dispute-${d.id}`}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                        >
                          2) 50/50 Qisman Qoplash
                        </button>
                        <button
                          onClick={() => handleResolveDispute(d.id, 'RESOLVED_FARMER_WIN')}
                          disabled={actionLoading === `dispute-${d.id}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                        >
                          3) Fermer Haq (Pulni o'tkazish)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Tranzaksiyalar Auditi */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-600 font-medium">
              Barcha moliyaviy amallar va Escrow o'tkazmalari jurnali:
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2">Vaqt</th>
                    <th className="py-2">Foydalanuvchi</th>
                    <th className="py-2">Tur</th>
                    <th className="py-2">Bog'liq Buyurtma</th>
                    <th className="py-2 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/80">
                      <td className="py-2 text-gray-500">
                        {new Date(tx.created_at).toLocaleDateString('uz-UZ', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 font-bold text-gray-800">
                        {tx.user?.full_name} ({tx.user?.role})
                      </td>
                      <td className="py-2 font-mono text-[11px]">{tx.type}</td>
                      <td className="py-2 text-gray-500">
                        {tx.order ? `#${tx.order.id.slice(0, 8)} (${tx.order.product?.title})` : '-'}
                      </td>
                      <td className="py-2 text-right font-extrabold text-gray-900">
                        {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} so'm
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

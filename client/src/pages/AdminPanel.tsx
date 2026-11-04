import React, { useState, useEffect } from 'react';
import { AdminStats, User, Dispute, Transaction } from '../types';
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
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { refreshUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [farmers, setFarmers] = useState<User[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kpi' | 'kyc' | 'disputes' | 'transactions'>('kpi');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, farmersData, disputesData, txData] = await Promise.all([
        api.admin.getStats(),
        api.admin.getFarmers(),
        api.disputes.getAll(),
        api.admin.getTransactions(),
      ]);
      setStats(statsData);
      setFarmers(farmersData);
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

  // KYC holatini yangilash
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

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center space-x-2">
            <ShieldCheck className="w-7 h-7 text-rose-600" />
            <span>AgroBozor Markaziy Admin Paneli</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Bozor nazorati, real-vaqt moliyaviy KPIs, KYC verifikatsiyasi va nizolar arbitraji
          </p>
        </div>

        <button
          onClick={fetchAllAdminData}
          className="flex items-center space-x-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-2xl text-xs font-bold transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>

      {/* Real-vaqt KPI Bloklari */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GMV */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
              <span>Jami Savdo Aylanmasi (GMV)</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-gray-900">
              {stats.totalGmv.toLocaleString()} <span className="text-xs font-normal">so'm</span>
            </div>
            <p className="text-[11px] text-gray-400">
              Jami amalga oshirilgan to'lovlar
            </p>
          </div>

          {/* Sof Daromad */}
          <div className="bg-gradient-to-br from-agro-dark to-agro-green text-white p-5 rounded-3xl shadow-md space-y-1">
            <div className="flex justify-between items-center text-xs text-emerald-200 font-semibold">
              <span>Platforma Sof Daromadi</span>
              <TrendingUp className="w-4 h-4 text-agro-amber" />
            </div>
            <div className="text-xl font-black text-white">
              {stats.platformNetRevenue.toLocaleString()} <span className="text-xs font-normal">so'm</span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              10% savdo komissiyasi + 3 000 so'm logistika marjasi
            </p>
          </div>

          {/* AOV */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
              <span>O'rtacha Buyurtma (AOV)</span>
              <Scale className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-gray-900">
              {stats.aov.toLocaleString()} <span className="text-xs font-normal">so'm</span>
            </div>
            <p className="text-[11px] text-gray-400">
              {stats.totalOrdersCount} ta jami buyurtma asosida
            </p>
          </div>

          {/* Ishtirokchilar */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm space-y-1">
            <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
              <span>Foydalanuvchilar Tarmog'i</span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-sm font-bold text-gray-800 space-y-0.5 pt-0.5">
              <div className="flex justify-between">
                <span>Fermerlar:</span> <strong>{stats.farmersCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Xaridorlar:</span> <strong>{stats.buyersCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Kuryerlar:</span> <strong>{stats.couriersCount}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asosiy Admin Tablari */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'kyc'
                ? 'bg-agro-green text-white shadow-md shadow-emerald-900/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>KYC Fermerlar Navbati</span>
            {stats && stats.pendingKycCount > 0 && (
              <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {stats.pendingKycCount}
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
            Moliya va Tranzaksiyalar Auditi
          </button>
        </div>

        {/* Tab Kontentlari */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-600 font-medium">
              Fermerlarni pasport/STIR bo'yicha tekshirish va tasdiqlash. Faqat <strong>APPROVED</strong> bo'lgan fermerlar mahsulot sota oladi.
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2.5">Fermer / Xo'jalik</th>
                    <th className="py-2.5">STIR / Pasport</th>
                    <th className="py-2.5">Hudud</th>
                    <th className="py-2.5">Telefon</th>
                    <th className="py-2.5">KYC Holati</th>
                    <th className="py-2.5 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {farmers.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 font-bold text-gray-900">
                        <div>{f.full_name}</div>
                        {f.farm_or_company_name && (
                          <div className="text-[11px] text-gray-500 font-normal">
                            {f.farm_or_company_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 font-mono font-semibold text-gray-700">
                        {f.tin_or_passport}
                      </td>
                      <td className="py-3 text-gray-600">{f.region}</td>
                      <td className="py-3 text-gray-600">{f.phone}</td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            f.kyc_status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : f.kyc_status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {f.kyc_status}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-1.5">
                        {f.kyc_status !== 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateKyc(f.id, 'APPROVED')}
                            disabled={actionLoading === `kyc-${f.id}`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            Tasdiqlash
                          </button>
                        )}
                        {f.kyc_status !== 'REJECTED' && (
                          <button
                            onClick={() => handleUpdateKyc(f.id, 'REJECTED')}
                            disabled={actionLoading === `kyc-${f.id}`}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            Rad etish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Nizolar Arbitraji */}
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

        {/* Tranzaksiyalar Auditi */}
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

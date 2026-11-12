import {formatUnitName, formatQty} from '../lib/units';
import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronRight,
  Calendar,
} from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onRefresh: () => void;
  onOpenDispute: (order: Order) => void;
  onOpenInvoice: (orderId: string) => void;
  onOpenReview: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onRefresh,
  onOpenDispute,
  onOpenInvoice,
  onOpenReview,
}) => {
  const { user, refreshUser } = useAuth();
  const [pinInput,setPinInput]=useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return {
          label: "To'lov kutilmoqda",
          color: 'bg-orange-100 text-orange-800 border-orange-300',
        };
      case 'CANCELLED':
        return {
          label: 'Bekor qilindi',
          color: 'bg-gray-100 text-gray-600 border-gray-300',
        };
      case 'PAID_IN_ESCROW':
        return {
          label: "To'lov Escrowda Muzlatilgan",
          color: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'CONFIRMED_BY_FARMER':
        return {
          label: 'Fermer Tasdiqladi',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'IN_TRANSIT':
        return {
          label: "Kuryer Yo'lda",
          color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        };
      case 'DELIVERED':
        return {
          label: 'Yetkazib Berildi',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'COMPLETED':
        return {
          label: 'Muvaffaqiyatli Yakunlandi',
          color: 'bg-emerald-700 text-white border-transparent',
        };
      case 'DISPUTED':
        return {
          label: "Nizo Ochilgan (Ko'rib chiqilmoqda)",
          color: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      case 'REFUNDED':
        return {
          label: "Mablag' Qaytarildi",
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
    }
  };

  const direct = order.payment_method === 'DIRECT_FARMER';
  const statusBadge = getStatusBadge(order.status);
  if (direct && order.status === 'CONFIRMED_BY_FARMER')
    statusBadge.label = 'Fermer to‘lovni oldi';

  // Stepper holatlari
  const steps: { key: OrderStatus; label: string }[] = [
    {
      key: 'PAID_IN_ESCROW',
      label: direct ? 'Fermerga to‘lov' : "To'lov (Escrow)",
    },
    { key: 'CONFIRMED_BY_FARMER', label: 'Fermer tayyorladi' },
    { key: 'IN_TRANSIT', label: "Kuryer yo'lda" },
    { key: 'DELIVERED', label: 'Yetkazildi' },
    { key: 'COMPLETED', label: 'Yakunlandi' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'DISPUTED' || status === 'REFUNDED') return 3;
    const idx = steps.findIndex((s) => s.key === status);
    return idx === -1 ? 0 : idx;
  };

  const currentStepIdx = getStepIndex(order.status);

  const [paymentError, setPaymentError] = useState('');
  const confirmDirect = async () => {
    if (
      !confirm(
        `${order.total_paid.toLocaleString()} so‘m sizga haqiqatan kelib tushdimi? Xaridor yozganiga qarab emas, o‘z hisobingizdan tekshirib tasdiqlang.`,
      )
    )
      return;
    setLoadingAction('direct');
    setPaymentError('');
    try {
      await api.orders.confirmDirectPayment(order.id, order.total_paid);
      onRefresh();
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Tasdiqlashda xatolik');
    } finally {
      setLoadingAction(null);
    }
  };
  const handlePay = async () => {
    setLoadingAction('pay');
    setPaymentError('');
    try {
      const result = await api.orders.pay(order.id);
      if (result.pending_payment && result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      if (result.pending_invoice) onOpenInvoice(order.id);
      await refreshUser();
      onRefresh();
    } catch (e) {
      setPaymentError(
        e instanceof Error ? e.message : 'To‘lovni bajarib bo‘lmadi',
      );
    } finally {
      setLoadingAction(null);
    }
  };

  // Xaridor buyurtmani yakunlashi (Escrow pulini yechish)
  const handleCompleteOrder = async () => {
    if (
      !confirm(
        direct
          ? 'Mahsulotni to‘liq qabul qildingizmi? Bu yerda pul o‘tkazilmaydi.'
          : "Mahsulotni to'liq qabul qildingizmi? Tasdiqlasangiz, mablag' fermer va kuryer hisobiga o'tkaziladi.",
      )
    ) {
      return;
    }
    setLoadingAction('complete');
    try {
      await api.orders.complete(order.id);
      await refreshUser();
      onRefresh();
      // Baholash modalini ochish
      onOpenReview(order);
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  // Fermer buyurtmani tasdiqlashi
  const handleFarmerConfirm = async () => {
    setLoadingAction('confirm');
    try {
      await api.orders.updateStatus(order.id, 'CONFIRMED_BY_FARMER');
      await refreshUser();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  // Fermer buyurtmani rad etadi (xaridorga to'liq qaytariladi)
  const handleFarmerReject = async () => {
    if (
      !confirm("Buyurtmani rad etasizmi? Mablag' xaridorga to'liq qaytariladi.")
    )
      return;
    setLoadingAction('reject');
    try {
      await api.orders.reject(order.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  // Xaridor to'lanmagan buyurtmani bekor qiladi
  const handleCancelUnpaid = async () => {
    setLoadingAction('cancel');
    try {
      await api.orders.cancel(order.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  // Kuryer yo'lga chiqishi
  const handleCourierPickup = async () => {
    setLoadingAction('pickup');
    try {
      await api.orders.updateStatus(order.id, 'IN_TRANSIT');
      await refreshUser();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  // Kuryer yetkazildi deb belgilashi
  const handleCourierDeliver = async () => {
    setLoadingAction('deliver');
    try {
      await api.orders.updateStatus(order.id, 'DELIVERED',pinInput);
      await refreshUser();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoadingAction(null);
    }
  };

  const isBuyer = user?.id === order.buyer_id;
  const isFarmer = user?.id === order.farmer_id;
  const isCourier = user?.role === 'COURIER';

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm hover:shadow-md transition-shadow overflow-hidden p-5 sm:p-6 space-y-5">
      {/* Sarlavha: ID, sana va Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-sm text-gray-900">
            Buyurtma #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            {new Date(order.created_at).toLocaleDateString('uz-UZ', {
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`text-xs px-3 py-1 rounded-full border font-bold ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>
          <button
            onClick={() => onOpenInvoice(order.id)}
            className="flex items-center space-x-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-xl font-semibold transition-colors border border-purple-200"
            title="Hisob-fakturani ko'rish"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invoice</span>
          </button>
        </div>
      </div>

      {user?.id===order.buyer_id && order.delivery_pin && !['COMPLETED','CANCELLED','REFUNDED'].includes(order.status) && <section className="p-4 bg-emerald-50 rounded-xl"><p className="text-sm font-bold">Yetkazish PIN kodi</p><strong className="text-3xl tracking-[.3em]">{order.delivery_pin}</strong><p className="text-xs mt-2">Faqat mahsulotni olganingizda logistga ayting.</p></section>}
      {user?.role==='COURIER' && order.status==='IN_TRANSIT' && <label className="block text-sm">Yetkazish PIN kodi<input aria-label="Yetkazish PIN kodi" inputMode="numeric" maxLength={4} value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,''))} className="block border rounded-xl p-3 mt-2"/></label>}
      {user?.role==='ADMIN' && ['PAID_IN_ESCROW','CONFIRMED_BY_FARMER','IN_TRANSIT'].includes(order.status) && <div className="flex flex-wrap gap-2"><button className="p-3 border rounded-xl" onClick={async()=>{const reason=prompt('PIN yangilash sababi');if(!reason)return;try{await api.admin.resetPin(order.id,reason);onRefresh();}catch(e){alert((e as Error).message);}}}>PIN yangilash</button>{order.status==='IN_TRANSIT' && <button className="p-3 border rounded-xl" onClick={async()=>{const reason=prompt('Yetkazishni qo‘lda tasdiqlash sababi (kamida 5 belgi)');if(!reason)return;try{await api.admin.deliverOverride(order.id,reason);onRefresh();}catch(e){alert((e as Error).message);}}}>Yetkazishni tasdiqlash (admin)</button>}</div>}
      {/* Stepper Vizual Jarayon */}
      <div className="hidden sm:block py-1">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gray-200 w-full z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-agro-green transition-all duration-500 z-0"
            style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step, idx) => {
            const isCompleted = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div
                key={step.key}
                className="relative z-10 flex flex-col items-center"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'bg-agro-green text-white shadow-md'
                      : 'bg-white border-2 border-gray-300 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-1.5 font-medium whitespace-nowrap ${
                    isCurrent ? 'font-bold text-agro-dark' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mahsulot ma'lumotlari */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
        <div className="flex items-center space-x-3.5">
          <img
            src={order.product?.image_url}
            alt={order.product_title || order.product?.title}
            className="w-16 h-16 rounded-2xl object-cover border border-gray-200"
          />
          <div>
            <h4 className="font-bold text-gray-900 text-sm">
              {order.product_title || order.product?.title}
            </h4>
            <div className="text-xs text-gray-500 mt-0.5">
              Fermer:{' '}
              <strong className="text-gray-700">
                {order.farmer?.farm_or_company_name || order.farmer?.full_name}
              </strong>{' '}
              ({order.farmer?.region})
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Miqdor:{' '}
              <strong className="text-gray-900">{formatQty(order.quantity_kg,order.unit||order.product?.unit)}</strong>{' '}
              × {(order.unit_price_per_kg ?? order.product?.price_per_kg)?.toLocaleString()} so'm
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
          <div className="text-xs text-gray-500">
            {order.status === 'PENDING_PAYMENT'
              ? 'To‘lanishi kerak:'
              : direct
                ? 'Fermer olgan summa:'
                : "Jami to'langan summa:"}
          </div>
          <div className="text-lg font-black text-agro-green">
            {order.total_paid.toLocaleString()} so'm
          </div>
          <div className="text-[11px] text-gray-400">
            (Mahsulot: {order.product_total_amount.toLocaleString()} +
            Yetkazish: {order.delivery_fee.toLocaleString()})
          </div>
        </div>
      </div>

      {/* Yetkazib berish ma'lumotlari */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
        <div className="flex items-start space-x-2 bg-gray-50 p-3 rounded-xl">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-gray-800">
              Yetkazish manzili:
            </div>
            <div>{order.delivery_address}</div>
          </div>
        </div>

        <div className="flex items-start space-x-2 bg-gray-50 p-3 rounded-xl">
          <Truck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-gray-800">
              Yetkazib beruvchi kuryer:
            </div>
            <div>
              {order.courier ? (
                <span>
                  {order.courier.full_name} ({order.courier.phone})
                </span>
              ) : (
                <span className="text-amber-600 font-medium">
                  Tayinlanmagan (kutilmoqda)
                </span>
              )}
            </div>
          </div>
        </div>

        {order.delivery_schedule && (
          <div className="sm:col-span-2 flex items-start space-x-2 bg-purple-50 p-3 rounded-xl text-purple-900 border border-purple-100">
            <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">B2B Rejali Jadval:</span>{' '}
              {order.delivery_schedule}
            </div>
          </div>
        )}
      </div>

      {/* Agar nizo bo'lsa */}
      {order.dispute && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
          <div className="flex items-center space-x-2 text-rose-800 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Nizo Holati: {order.dispute.status}</span>
          </div>
          <p className="text-rose-700">
            <strong>Shikoyat sababi:</strong> {order.dispute.reason}
          </p>
          {order.dispute.admin_comment && (
            <p className="text-rose-900 font-medium bg-rose-100/60 p-2 rounded-lg mt-1">
              <strong>Admin xulosasi:</strong> {order.dispute.admin_comment}
            </p>
          )}
        </div>
      )}

      {direct && (
        <div className="bg-amber-50 text-amber-900 rounded-xl p-4 text-sm space-y-2">
          <p>
            To‘lov bevosita fermerga. Platformada escrow yo‘q va hamyonlarga pul
            qo‘shilmaydi. Yetkazish haqini fermer kuryerga qo‘lda beradi.
            Qaytarishni ham fermer bilan kelishing.
          </p>
          {order.farmer?.phone && (
            <a
              href={`tel:${order.farmer.phone}`}
              className="block font-bold underline"
            >
              Fermerga qo‘ng‘iroq: {order.farmer.phone}
            </a>
          )}
        </div>
      )}

      {/* Harakatlar Tugmalari (Har bir rol uchun) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {/* Escrow kafolat eslatmasi */}
          {!direct &&
            !['COMPLETED', 'REFUNDED', 'CANCELLED', 'PENDING_PAYMENT'].includes(
              order.status,
            ) && (
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Escrowda himoyalangan</span>
              </div>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {direct &&
            order.status === 'PENDING_PAYMENT' &&
            user?.role === 'FARMER' &&
            user.id === order.farmer_id && (
              <button
                onClick={confirmDirect}
                disabled={!!loadingAction}
                className="bg-agro-green text-white rounded-xl py-3 px-4 font-bold disabled:opacity-40"
              >
                {loadingAction === 'direct'
                  ? 'Saqlanmoqda…'
                  : 'To‘lovni oldim — tasdiqlash'}
              </button>
            )}
          {paymentError && (
            <p role="alert" className="text-rose-700 text-xs w-full">
              {paymentError}
            </p>
          )}
          {isBuyer &&
            order.status === 'PENDING_PAYMENT' &&
            !['INVOICE_B2B', 'DIRECT_FARMER'].includes(
              order.payment_method,
            ) && (
              <button
                onClick={handlePay}
                disabled={!!loadingAction}
                className="bg-agro-green text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40"
              >
                {loadingAction === 'pay' ? 'Kutilmoqda…' : 'To‘lash'}
              </button>
            )}
          {isBuyer && order.status === 'PENDING_PAYMENT' && (
            <button
              onClick={handleCancelUnpaid}
              disabled={loadingAction === 'cancel'}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
            >
              Bekor qilish
            </button>
          )}
          {isFarmer && order.status === 'PAID_IN_ESCROW' && (
            <button
              onClick={handleFarmerReject}
              disabled={loadingAction === 'reject'}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
            >
              Rad etish
            </button>
          )}
          {/* Fermer tasdiqlashi */}
          {isFarmer && order.status === 'PAID_IN_ESCROW' && (
            <button
              onClick={handleFarmerConfirm}
              disabled={loadingAction === 'confirm'}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loadingAction === 'confirm'
                ? 'Tasdiqlanmoqda...'
                : 'Buyurtmani Tasdiqlash'}
            </button>
          )}

          {/* Kuryer buyurtmani olishi */}
          {isCourier && order.status === 'CONFIRMED_BY_FARMER' && (
            <button
              onClick={handleCourierPickup}
              disabled={loadingAction === 'pickup'}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loadingAction === 'pickup'
                ? 'Qabul qilinmoqda...'
                : "Yetkazib berishga olish (12 000 so'm)"}
            </button>
          )}

          {/* Kuryer yetkazildi deb belgilashi */}
          {isCourier && order.status === 'IN_TRANSIT' && (
            <button
              onClick={handleCourierDeliver}
              disabled={loadingAction === 'deliver'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {loadingAction === 'deliver'
                ? 'Belgilanmoqda...'
                : 'Mijozga Yetkazdim'}
            </button>
          )}

          {/* Xaridor Harakatlari: Qabul qildim yoki Shikoyat */}
          {isBuyer &&
            (order.status === 'DELIVERED' ||
              order.status === 'IN_TRANSIT' ||
              order.status === 'CONFIRMED_BY_FARMER') && (
              <>
                {!direct && (
                  <button
                    onClick={() => onOpenDispute(order)}
                    className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors"
                  >
                    Shikoyat qilish (Nizo)
                  </button>
                )}
                <button
                  onClick={handleCompleteOrder}
                  disabled={loadingAction === 'complete'}
                  className="bg-agro-green hover:bg-agro-lightGreen text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md shadow-emerald-900/15 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-agro-amber" />
                  <span>
                    {loadingAction === 'complete'
                      ? direct
                        ? 'Yakunlanmoqda…'
                        : 'Pul yechilmoqda...'
                      : "Qabul qildim, e'tirozim yo'q"}
                  </span>
                </button>
              </>
            )}

          {/* Sharh qoldirish (Yakunlangan buyurtmalar uchun) */}
          {isBuyer &&
            order.status === 'COMPLETED' &&
            (!order.reviews || order.reviews.length === 0) && (
              <button
                onClick={() => onOpenReview(order)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                <span>Fermerga baho berish</span>
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

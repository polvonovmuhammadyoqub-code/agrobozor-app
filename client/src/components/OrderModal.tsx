import {DistrictSelect} from './DistrictSelect';
import {formatUnitName, formatQty} from '../lib/units';
import { useEffect, useState } from 'react';
import { Product, PaymentMethod } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ModalFrame } from './ModalFrame';
import { PaymentSelector, usePaymentOptions } from './PaymentSelector';
export function OrderModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [district,setDistrict]=useState('');
  const { user, refreshUser } = useAuth();
  const options = usePaymentOptions(!!product, user?.role === 'BUYER_B2B');
  const [quantity, setQuantity] = useState(product?.min_order_kg || 1);
  const [address, setAddress] = useState(user?.region || '');
  const [schedule, setSchedule] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(
    user?.role === 'BUYER_B2B' ? 'INVOICE_B2B' : 'CLICK',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    message: string;
    url?: string;
    paid: boolean;
  } | null>(null);
  useEffect(() => {
    setReceipt(null);
    setError('');
    setQuantity(product?.min_order_kg || 1);
  }, [product?.id]);
  useEffect(() => {
    if (!options.loading)
      setMethod((old) =>
        options.methods.includes(old) ? old : options.methods[0] || 'CLICK',
      );
  }, [options.loading, options.mode, options.methods.join(',')]);
  if (!product) return null;
  const total = Math.round(quantity * product.price_per_kg) + 15000;
  const finish = () => {
    onSuccess();
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || receipt) return;
    setBusy(true);
    setError('');
    try {
      if (
        !Number.isFinite(quantity) ||
        quantity < product.min_order_kg ||
        quantity > product.available_quantity_kg
      )
        throw new Error('Miqdorni mavjud qoldiq chegarasida kiriting');
      const order = await api.orders.create({
        product_id: product.id,
        quantity_kg: quantity,
        payment_method: method,
        delivery_address: address,
        delivery_district: district||undefined,
        delivery_schedule: schedule || undefined,
      });
      try {
        const result = await api.orders.pay(order.id);
        if (result.pending_direct)
          setReceipt({
            message:
              'Buyurtma yaratildi. To‘lovni fermer bilan kelishing. Fermer pul tushganini tasdiqlagach yetkazish boshlanadi. Platforma pul qabul qilmaydi.',
            paid: false,
          });
        else if (result.pending_payment)
          setReceipt({
            message:
              'Buyurtma yaratildi. To‘lov hali tasdiqlanmagan. Payme sahifasida yakunlang.',
            url: result.checkout_url,
            paid: false,
          });
        else if (result.pending_invoice)
          setReceipt({
            message:
              'Hisob-faktura yaratildi. Bank o‘tkazmasi tasdiqlanishi kutilmoqda.',
            paid: false,
          });
        else if (result.order.status === 'PAID_IN_ESCROW') {
          setReceipt({
            message: result.is_demo
              ? 'Sinov to‘lovi bajarildi. Haqiqiy pul yechilmadi.'
              : 'To‘lov tasdiqlandi.',
            paid: true,
          });
          await refreshUser();
        } else
          setReceipt({
            message:
              'Buyurtma yaratildi. To‘lov hali tasdiqlanmadi; Buyurtmalar bo‘limida holatini tekshiring.',
            paid: false,
          });
      } catch (e) {
        setReceipt({
          message:
            'Buyurtma yaratildi, lekin to‘lov tasdiqlanmadi. Buyurtmalar sahifasida holatni tekshirib, qayta to‘lang.',
          paid: false,
        });
        setError(e instanceof Error ? e.message : 'To‘lov xatosi');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buyurtma yaratishda xatolik');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalFrame title="Buyurtma berish" onClose={onClose}>
      <div className="flex items-center gap-3">
        <img
          src={product.image_url}
          alt=""
          className="w-16 h-16 rounded-xl object-cover"
        />
        <div>
          <h3 className="font-bold">{product.title}</h3>
          <p className="text-sm text-emerald-800">
            {product.price_per_kg.toLocaleString()} so‘m / {formatUnitName(product.unit)}
          </p>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="text-rose-700 bg-rose-50 p-3 rounded-xl text-sm"
        >
          {error}
        </p>
      )}
      {receipt ? (
        <div className="space-y-4">
          <p
            role="status"
            className={`p-4 rounded-xl text-sm ${receipt.paid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
          >
            {receipt.message}
          </p>
          {receipt.url && (
            <a
              href={receipt.url}
              className="block text-center p-4 rounded-xl bg-agro-green text-white font-bold"
            >
              Payme orqali to‘lash
            </a>
          )}
          <button
            onClick={finish}
            className="w-full p-3 border rounded-xl font-bold"
          >
            Buyurtmalarni ko‘rish
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            Miqdor ({formatUnitName(product.unit)})
            <input
              type="number"
              step={['DONA','BANKA','QUTI'].includes(product.unit||'KG')?1:0.001}
              min={product.min_order_kg}
              max={product.available_quantity_kg}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="block mt-2 w-full p-3 border rounded-xl"
            />
          </label>
          <label className="block text-sm">
            Yetkazib berish manzili
            <input
              required
              minLength={5}
              maxLength={300}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tuman, ko‘cha, uy raqami"
              className="block mt-2 w-full p-3 border rounded-xl"
            />
          </label>
          {user?.role === 'BUYER_B2B' && (
            <label className="block text-sm">
              Yetkazib berish jadvali
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="block w-full mt-2 p-3 border rounded-xl"
              />
            </label>
          )}
          <DistrictSelect value={district} onChange={setDistrict}/>
          <PaymentSelector
            options={options}
            value={method}
            onChange={setMethod}
          />
          <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-2">
            <p className="flex justify-between">
              <span>Mahsulot</span>
              <strong>
                {Math.round(quantity * product.price_per_kg).toLocaleString()}{' '}
                so‘m
              </strong>
            </p>
            <p className="flex justify-between">
              <span>Yetkazish</span>
              <strong>15 000 so‘m</strong>
            </p>
            <p className="flex justify-between border-t pt-2">
              <span>Jami</span>
              <strong>{total.toLocaleString()} so‘m</strong>
            </p>
          </div>
          <button
            disabled={
              busy || options.loading || !options.methods.includes(method)
            }
            className="w-full bg-agro-green text-white p-4 rounded-xl font-bold disabled:opacity-40"
          >
            {busy ? 'Rasmiylashtirilmoqda…' : 'Buyurtmani rasmiylashtirish'}
          </button>
        </form>
      )}
    </ModalFrame>
  );
}

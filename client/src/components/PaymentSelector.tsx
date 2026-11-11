import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PaymentMethod } from '../types';
export function usePaymentOptions(open: boolean, business: boolean) {
  const [data, setData] = useState<{
    mode: string;
    methods: string[];
    message: string;
  }>({ mode: 'disabled', methods: [], message: '' });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    api.payments
      .options()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active)
          setData({
            mode: 'disabled',
            methods: [],
            message:
              'To‘lov usullarini yuklab bo‘lmadi. Oynani yopib qayta oching.',
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);
  return {
    ...data,
    loading,
    methods: [
      ...data.methods,
      ...(business ? ['INVOICE_B2B'] : []),
    ] as PaymentMethod[],
  };
}
export function PaymentSelector({
  options,
  value,
  onChange,
}: {
  options: ReturnType<typeof usePaymentOptions>;
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-bold text-sm">To‘lov usuli</legend>
      <p
        role="status"
        className="text-xs text-amber-900 bg-amber-50 p-3 rounded-xl"
      >
        {options.loading ? 'To‘lov usullari yuklanmoqda…' : options.message}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.methods.map((m) => (
          <label
            key={m}
            className={`p-3 rounded-xl border flex items-center gap-2 text-sm ${value === m ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200'}`}
          >
            <input
              type="radio"
              name="payment-method"
              checked={value === m}
              onChange={() => onChange(m)}
              className="accent-emerald-700"
            />
            {m === 'INVOICE_B2B'
              ? 'Bank hisob-fakturasi'
              : `${m}${options.mode === 'mock' ? ' (sinov)' : ''}`}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import {formatUnitName, formatQty} from '../lib/units';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Product, ProductAnalytics } from '../types';
import { api } from '../lib/api';
import { ModalFrame } from './ModalFrame';
export function ProductAnalyticsModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProductAnalytics | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    api.products
      .analytics(product.id)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [product.id, retry]);
  return (
    <ModalFrame title={`${product.title} statistikasi`} onClose={onClose}>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="text-emerald-800 underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : !data ? (
        <p role="status">Statistika yuklanmoqda…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Ko‘rgan odamlar', data.unique_views],
              ['Buyurtmalar', data.order_count],
              ['Sotilgan', formatQty(data.sold_kg,product.unit)],
              ['Daromad', `${data.earned.toLocaleString()} so‘m`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <strong className="text-xl text-emerald-800 break-words">
                  {value}
                </strong>
              </div>
            ))}
          </div>
          <section>
            <h3 className="font-bold mb-1">Kimlar ko‘rdi?</h3>
            <p className="text-xs text-gray-500 mb-4">
              Hisobga kirgan odamlar ko‘rsatiladi. Bir odam bir marta sanaladi.
              Oxirgi 50 ta ko‘ruvchi.
            </p>
            {data.viewers.length ? (
              <ul className="divide-y">
                {data.viewers.map((v) => (
                  <li key={v.id} className="py-3 flex gap-3 items-center">
                    <span className="rounded-full bg-emerald-50 text-emerald-800 p-3">
                      <Eye size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm break-words">
                        {v.viewer.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {v.viewer.region} ·{' '}
                        {new Date(v.last_viewed_at).toLocaleDateString('uz-UZ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 bg-gray-50 rounded-2xl text-sm text-gray-500">
                Mahsulotingizni hali hech kim ochmagan.
              </p>
            )}
          </section>
        </>
      )}
    </ModalFrame>
  );
}

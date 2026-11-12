import {formatUnitName, formatQty} from '../lib/units';
import { useState } from 'react';
import { Product } from '../types';
import { api } from '../lib/api';
import { ModalFrame } from './ModalFrame';
export function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(String(product.price_per_kg));
  const [stock, setStock] = useState(String(product.available_quantity_kg));
  const [active, setActive] = useState(product.is_active);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.products.update(product.id, {
        title: title.trim(),
        price_per_kg: Number(price),
        available_quantity_kg: Number(stock),
        is_active: active,
        expected_quantity_kg: product.available_quantity_kg,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalFrame title="Mahsulotni tahrirlash" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-semibold">
          Mahsulot nomi
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            className="block w-full mt-2 rounded-xl border p-3 text-base"
          />
        </label>
        <label className="block text-sm font-semibold">
          Narx (so‘m / {formatUnitName(product.unit)})
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={10000000}
            step={1}
            className="block w-full mt-2 rounded-xl border p-3 text-base"
          />
        </label>
        <label className="block text-sm font-semibold">
          Ombordagi qoldiq ({formatUnitName(product.unit)})
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={1000000}
            step={['DONA','BANKA','QUTI'].includes(product.unit||'KG')?1:0.001}
            className="block w-full mt-2 rounded-xl border p-3 text-base"
          />
        </label>
        <label className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 text-sm">
          <input
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            type="checkbox"
            className="w-5 h-5 accent-emerald-700"
          />
          Bozorda sotuvga qo‘yish
        </label>
        {error && (
          <p role="alert" className="text-rose-700 text-sm">
            {error}
          </p>
        )}
        <button
          disabled={saving}
          className="w-full py-4 bg-agro-green text-white rounded-2xl font-bold disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda…' : 'O‘zgarishlarni saqlash'}
        </button>
      </form>
    </ModalFrame>
  );
}

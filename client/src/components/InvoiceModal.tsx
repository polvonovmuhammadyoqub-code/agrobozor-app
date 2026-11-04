import React, { useEffect, useState } from 'react';
import { InvoiceData } from '../types';
import { api } from '../lib/api';
import { X, Printer, ShieldCheck, Building2, CheckCircle2 } from 'lucide-react';

interface InvoiceModalProps {
  orderId: string | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ orderId, onClose }) => {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const fetchInvoice = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.orders.getInvoice(orderId);
        setInvoice(data);
      } catch (err: any) {
        setError(err.message || 'Hisob-fakturani yuklashda xatolik');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [orderId]);

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-agro-dark text-white p-4 px-6 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-agro-amber" />
            <h2 className="text-base font-bold">Rasmiy B2B Hisob-faktura (Invoice)</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4 text-agro-amber" />
              <span>Chop etish / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Kontenti */}
        <div id="printable-invoice" className="p-6 sm:p-8 space-y-6 text-xs text-gray-800">
          {loading && (
            <div className="py-12 text-center text-gray-500">
              Hisob-faktura shakllanmoqda...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-xl">{error}</div>
          )}

          {invoice && (
            <>
              {/* Ustki qism: Kompaniya va Invoice raqami */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div>
                  <div className="text-2xl font-black text-agro-green tracking-tight flex items-center space-x-1">
                    <span>Agro</span>
                    <span className="text-agro-amber">Bozor</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    "AgroBozor O'zbekiston" Elektron Savdo Platformasi MCHJ
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Toshkent sh., Mirobod t., Amir Temur shox ko'chasi 107
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-sm text-gray-900">
                    {invoice.invoice_number}
                  </div>
                  <div className="text-gray-500 text-[11px] mt-0.5">
                    Sana: {new Date(invoice.created_at).toLocaleDateString('uz-UZ')}
                  </div>
                  <div className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                    To'lov holati: {invoice.status}
                  </div>
                </div>
              </div>

              {/* Sotuvchi va Xaridor rekvizitlari */}
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Yetkazib beruvchi (Fermer):
                  </div>
                  <div className="font-bold text-gray-900 text-sm">{invoice.seller.name}</div>
                  <div>STIR / Pasport: <strong>{invoice.seller.tin}</strong></div>
                  <div>Manzil: {invoice.seller.address}</div>
                  <div>Tel: {invoice.seller.phone}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Buyurtmachi (Mijoz):
                  </div>
                  <div className="font-bold text-gray-900 text-sm">{invoice.buyer.name}</div>
                  <div>STIR / Pasport: <strong>{invoice.buyer.tin}</strong></div>
                  <div>Yetkazish manzili: {invoice.buyer.address}</div>
                  <div>Tel: {invoice.buyer.phone}</div>
                </div>
              </div>

              {/* Jadval: Mahsulotlar */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-gray-500 text-[11px] uppercase">
                      <th className="py-2">№</th>
                      <th className="py-2">Mahsulot nomi</th>
                      <th className="py-2">Kategoriya</th>
                      <th className="py-2 text-right">Miqdor (kg)</th>
                      <th className="py-2 text-right">Narxi (so'm)</th>
                      <th className="py-2 text-right">Jami (so'm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {invoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 text-gray-400">{idx + 1}</td>
                        <td className="py-2.5 font-bold text-gray-900">{it.name}</td>
                        <td className="py-2.5 text-gray-500">{it.category}</td>
                        <td className="py-2.5 text-right font-bold">{it.quantity_kg}</td>
                        <td className="py-2.5 text-right">{it.price_per_kg.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-bold text-gray-900">
                          {it.total_price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Hisob-kitoblar */}
              <div className="border-t border-gray-200 pt-3 flex justify-end">
                <div className="w-64 space-y-1.5 text-right">
                  <div className="flex justify-between text-gray-600">
                    <span>Mahsulotlar summasi:</span>
                    <span>{invoice.items.reduce((s, i) => s + i.total_price, 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Logistika yetkazish:</span>
                    <span>{invoice.delivery_fee.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Xizmat komissiyasi (10%):</span>
                    <span>{invoice.platform_service_fee.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-agro-green border-t border-gray-200 pt-1.5">
                    <span>Yakuniy to'lov:</span>
                    <span>{invoice.grand_total.toLocaleString()} so'm</span>
                  </div>
                </div>
              </div>

              {/* Jadval va Muhr */}
              <div className="pt-4 border-t border-gray-200 flex flex-wrap justify-between items-center gap-4">
                <div className="text-[11px] text-gray-500 max-w-xs">
                  <strong>Yetkazib berish sharti:</strong> {invoice.delivery_schedule}
                </div>

                {/* Elektron Muhr */}
                <div className="border-2 border-dashed border-emerald-600 rounded-2xl p-2.5 px-4 text-center bg-emerald-50/50">
                  <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center justify-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ELEKTRON RAQAMLI MUHR</span>
                  </div>
                  <div className="text-[9px] text-emerald-600 font-bold mt-0.5">
                    AGROBOZOR ESCROW PLATFORMA VERIFIED
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

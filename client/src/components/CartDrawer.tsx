import React from 'react';
import { useCart } from '../context/CartContext';
import { X, Trash2, ShoppingBag, ShieldCheck, ArrowRight } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckoutProduct: (product: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onCheckoutProduct,
}) => {
  const { items, removeFromCart, updateQuantity, subtotal, deliveryFee, grandTotal } =
    useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 px-6 bg-agro-green text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-agro-amber" />
            <h2 className="text-base font-bold">Savatcha ({items.length})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <ShoppingBag className="w-12 h-12 stroke-1 text-gray-300 mb-2" />
              <p className="font-semibold text-gray-600">Savatingiz hozircha bo'sh</p>
              <p className="text-xs text-gray-400 mt-1">
                Katalogdan yangi uzilgan meva-sabzavotlarni tanlang
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="py-3 flex space-x-3 text-xs">
                <img
                  src={item.product.image_url}
                  alt={item.product.title}
                  className="w-16 h-16 rounded-xl object-cover border"
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 leading-tight">
                      {item.product.title}
                    </h4>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {item.product.price_per_kg.toLocaleString()} so'm / kg
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            Math.max(item.product.min_order_kg, item.quantity_kg - 1)
                          )
                        }
                        className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900">{item.quantity_kg} kg</span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            Math.min(
                              item.product.available_quantity_kg,
                              item.quantity_kg + 1
                            )
                          )
                        }
                        className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-agro-green">
                        {(item.quantity_kg * item.product.price_per_kg).toLocaleString()} so'm
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-gray-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3 text-xs">
            <div className="space-y-1.5 text-gray-600">
              <div className="flex justify-between">
                <span>Mahsulotlar:</span>
                <span className="font-bold text-gray-900">{subtotal.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between">
                <span>Yetkazib berish (Standart):</span>
                <span className="font-bold text-gray-900">{deliveryFee.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between text-sm font-black text-agro-green pt-1.5 border-t border-gray-200">
                <span>Jami:</span>
                <span>{grandTotal.toLocaleString()} so'm</span>
              </div>
            </div>

            <div className="text-[10px] text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Escrow xavfsiz to'lov tizimi orqali to'lanadi</span>
            </div>

            <button
              onClick={() => {
                onCheckoutProduct(items[0].product);
                onClose();
              }}
              className="w-full bg-agro-green hover:bg-agro-lightGreen text-white font-extrabold py-3 rounded-2xl flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/15"
            >
              <span>Buyurtmani Rasmiylashtirish</span>
              <ArrowRight className="w-4 h-4 text-agro-amber" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { createContext, useContext, useState } from 'react';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity_kg: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity_kg?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity_kg: number) => void;
  clearCart: () => void;
  totalQuantity: number;
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  activeOrderProduct: Product | null;
  setActiveOrderProduct: (product: Product | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeOrderProduct, setActiveOrderProduct] = useState<Product | null>(null);

  const addToCart = (product: Product, quantity_kg = product.min_order_kg || 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity_kg: item.quantity_kg + quantity_kg }
            : item
        );
      }
      return [...prev, { product, quantity_kg }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity_kg: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity_kg } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalQuantity = items.reduce((acc, item) => acc + item.quantity_kg, 0);
  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity_kg * item.product.price_per_kg,
    0
  );
  // Fermerlar bo'yicha ajratilgan yetkazib berish haqi: har bir alohida fermer uchun 15 000 so'm
  const distinctFarmersCount = new Set(items.map((item) => item.product.farmer_id)).size;
  const deliveryFee = distinctFarmersCount * 15000;
  const grandTotal = subtotal + deliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalQuantity,
        subtotal,
        deliveryFee,
        grandTotal,
        activeOrderProduct,
        setActiveOrderProduct,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

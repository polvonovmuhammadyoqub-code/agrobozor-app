import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Marketplace } from './pages/Marketplace';
import { OrdersPage } from './pages/OrdersPage';
import { FarmerDashboard } from './pages/FarmerDashboard';
import { CourierDashboard } from './pages/CourierDashboard';
import { AdminPanel } from './pages/AdminPanel';

import { OrderModal } from './components/OrderModal';
import { DisputeModal } from './components/DisputeModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ReviewModal } from './components/ReviewModal';
import { AddProductModal } from './components/AddProductModal';
import { WalletModal } from './components/WalletModal';
import { CartDrawer } from './components/CartDrawer';
import { LoginModal } from './components/LoginModal';
import { RegisterModal } from './components/RegisterModal';
import { Product, Order } from './types';
import { ShieldCheck, Sprout, LogIn, UserPlus } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('marketplace');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal holatlari
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Auth modal holatlari
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Buyurtma berilgach
  const handleOrderSuccess = () => {
    setCurrentTab('orders');
  };

  // Himoyalangan tabga kirmoqchi bo'lganda
  const handleProtectedTab = (tab: string) => {
    if (!user) {
      setIsLoginOpen(true);
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/60 text-gray-900">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          // Himoyalangan tablar
          if (!user && tab !== 'marketplace') {
            setIsLoginOpen(true);
            return;
          }
          setCurrentTab(tab);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        openWalletModal={() => setIsWalletOpen(true)}
        openCartDrawer={() => setIsCartOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenAddProduct={() => {
          if (!user) {
            setIsLoginOpen(true);
            return;
          }
          if (user.role !== 'FARMER') {
            alert("Mahsulot sotish uchun 'Fermer' roli bilan ro'yxatdan o'ting.");
            return;
          }
          setIsAddProductOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'marketplace' && (
          <Marketplace
            onOrderClick={(product) => {
              if (!user) {
                setIsLoginOpen(true);
                return;
              }
              setOrderModalProduct(product);
            }}
            onOpenAddProduct={() => {
              if (!user) {
                setIsLoginOpen(true);
                return;
              }
              if (user.role !== 'FARMER') {
                alert("Mahsulot sotish uchun 'Fermer' roli bilan ro'yxatdan o'ting.");
                return;
              }
              setIsAddProductOpen(true);
            }}
            searchQuery={searchQuery}
          />
        )}

        {currentTab === 'orders' && user && (
          <OrdersPage
            onOpenDispute={(order) => setDisputeOrder(order)}
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
            onOpenReview={(order) => setReviewOrder(order)}
          />
        )}

        {currentTab === 'farmer' && user && (
          <FarmerDashboard
            onOpenAddProduct={() => setIsAddProductOpen(true)}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenDispute={(order) => setDisputeOrder(order)}
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
            onOpenReview={(order) => setReviewOrder(order)}
          />
        )}

        {currentTab === 'courier' && user && (
          <CourierDashboard
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
          />
        )}

        {currentTab === 'admin' && user && <AdminPanel />}

        {/* Mehmon holati: himoyalangan tab uchun chaqiruv ekrani */}
        {!user && currentTab !== 'marketplace' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="w-20 h-20 rounded-2xl bg-agro-paleGreen flex items-center justify-center mb-6">
              <ShieldCheck className="w-10 h-10 text-agro-green" />
            </div>
            <h2 className="text-2xl font-bold text-agro-dark mb-2">
              Kirish talab etiladi
            </h2>
            <p className="text-gray-500 mb-6 max-w-sm">
              Bu sahifani ko'rish uchun tizimga kirishingiz yoki yangi akkaunt yaratishingiz kerak.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-agro-dark border-2 border-agro-green hover:bg-agro-paleGreen transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Tizimga kirish</span>
              </button>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-white bg-agro-green hover:bg-agro-lightGreen shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Ro'yxatdan o'tish</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global Modallar */}
      <OrderModal
        product={orderModalProduct}
        onClose={() => setOrderModalProduct(null)}
        onSuccess={handleOrderSuccess}
      />

      <DisputeModal
        order={disputeOrder}
        onClose={() => setDisputeOrder(null)}
        onSuccess={() => {}}
      />

      <InvoiceModal
        orderId={invoiceOrderId}
        onClose={() => setInvoiceOrderId(null)}
      />

      <ReviewModal
        order={reviewOrder}
        onClose={() => setReviewOrder(null)}
        onSuccess={() => {}}
      />

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={() => {
          if (currentTab === 'farmer') {
            // refresh
          }
        }}
      />

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckoutProduct={(product) => {
          if (!user) {
            setIsCartOpen(false);
            setIsLoginOpen(true);
            return;
          }
          setOrderModalProduct(product);
        }}
      />

      {/* Auth Modallar */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSwitchToRegister={() => {
          setIsLoginOpen(false);
          setIsRegisterOpen(true);
        }}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => {
          setIsRegisterOpen(false);
          setIsLoginOpen(true);
        }}
        onSuccess={(role) => {
          setIsRegisterOpen(false);
          if (role === 'FARMER') setCurrentTab('farmer');
          else if (role === 'COURIER') setCurrentTab('courier');
          else setCurrentTab('marketplace');
        }}
      />

      {/* Footer */}
      <footer className="bg-agro-dark text-white border-t border-emerald-950 mt-12 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-gray-400">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-agro-green flex items-center justify-center text-white">
              <Sprout className="w-5 h-5 text-agro-amber" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm">
                Agro<span className="text-agro-amber">Bozor</span>
              </div>
              <div className="text-[11px] text-gray-400">
                O'zbekistonning Ishonchli va Xavfsiz Agro-Savdo Tizimi
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-[11px]">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Escrow Kafolati</span>
            </span>
            <span>Toshkent, O'zbekiston</span>
            <span>Tel: +998 (71) 200-00-00</span>
          </div>

          <div className="text-[11px] text-gray-500">
            &copy; {new Date().getFullYear()} AgroBozor. Barcha huquqlar himoyalangan.
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;

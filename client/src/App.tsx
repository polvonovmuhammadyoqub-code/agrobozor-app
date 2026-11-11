import React, { useState, useEffect } from 'react';
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
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { LoginModal } from './components/LoginModal';
import { RegisterModal } from './components/RegisterModal';
import { Product, Order } from './types';
import { WelcomePage } from './components/WelcomePage';
import { ProductDetails } from './components/ProductDetails';
import { MessagesPage } from './pages/MessagesPage';
import { api } from './lib/api';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = () => setDataVersion((n) => n + 1);
  const [currentTab, setCurrentTab] = useState<string>(() =>
    !user
      ? 'welcome'
      : user.role === 'FARMER'
        ? 'farmer'
        : user.role === 'COURIER'
          ? 'courier'
          : user.role === 'ADMIN'
            ? 'admin'
            : 'marketplace',
  );
  const [detailsId, setDetailsId] = useState<string | null>(() =>
    sessionStorage.getItem('agro_pending_product'),
  );
  const [chatId, setChatId] = useState<string | null>(null);
  useEffect(() => {
    if (user) sessionStorage.removeItem('agro_pending_product');
  }, [user?.id]);
  useEffect(() => {
    if(user && ['BUYER_B2C','BUYER_B2B'].includes(user.role) && new URLSearchParams(window.location.search).has('payment_return')) setCurrentTab('orders');
  }, [user?.id]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal holatlari
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(
    null,
  );
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckoutOpen, setIsCartCheckoutOpen] = useState(false);

  // Auth modal holatlari
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Buyurtma berilgach
  const handleOrderSuccess = () => {
    refreshData();
    setCurrentTab('orders');
  };

  const openConversation = async (productId: string) => {
    const conversation = await api.messages.open(productId);
    setChatId(conversation.id);
    setDetailsId(null);
    setCurrentTab('messages');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/60 text-gray-900">
      {currentTab !== 'welcome' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            // Himoyalangan tablar
            if (!user && !['marketplace', 'welcome'].includes(tab)) {
              setIsLoginOpen(true);
              return;
            }
            setCurrentTab(tab);
          }}
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
              alert(
                "Mahsulot sotish uchun 'Fermer' roli bilan ro'yxatdan o'ting.",
              );
              return;
            }
            setIsAddProductOpen(true);
          }}
        />
      )}

      <main
        className={
          currentTab === 'welcome'
            ? 'flex-1'
            : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-8'
        }
      >
        {currentTab === 'welcome' && (
          <WelcomePage
            onLogin={() => setIsLoginOpen(true)}
            onRegister={() => setIsRegisterOpen(true)}
            onMarket={() => setCurrentTab('marketplace')}
          />
        )}
        {currentTab === 'messages' && user && (
          <MessagesPage
            initialConversationId={chatId}
            onProduct={setDetailsId}
          />
        )}
        {currentTab === 'marketplace' && (
          <Marketplace
            key={`marketplace-${dataVersion}`}
            onViewProduct={(product) => setDetailsId(product.id)}
            onSearchChange={setSearchQuery}
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
                alert(
                  "Mahsulot sotish uchun 'Fermer' roli bilan ro'yxatdan o'ting.",
                );
                return;
              }
              setIsAddProductOpen(true);
            }}
            searchQuery={searchQuery}
          />
        )}

        {currentTab === 'orders' && user && (
          <OrdersPage
            key={`orders-${dataVersion}`}
            onOpenDispute={(order) => setDisputeOrder(order)}
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
            onOpenReview={(order) => setReviewOrder(order)}
          />
        )}

        {currentTab === 'farmer' && user?.role === 'FARMER' && (
          <FarmerDashboard
            key={`farmer-${dataVersion}`}
            onOpenAddProduct={() => setIsAddProductOpen(true)}
            onMarket={() => setCurrentTab('marketplace')}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenDispute={(order) => setDisputeOrder(order)}
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
            onOpenReview={(order) => setReviewOrder(order)}
          />
        )}

        {currentTab === 'courier' && user?.role === 'COURIER' && (
          <CourierDashboard
            onOpenInvoice={(orderId) => setInvoiceOrderId(orderId)}
          />
        )}

        {currentTab === 'admin' && user?.role === 'ADMIN' && <AdminPanel />}

        {/* Mehmon holati: himoyalangan tab uchun chaqiruv ekrani */}
        {!user && currentTab !== 'marketplace' && currentTab !== 'welcome' && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="w-20 h-20 rounded-2xl bg-agro-paleGreen flex items-center justify-center mb-6">
              <ShieldCheck className="w-10 h-10 text-agro-green" />
            </div>
            <h2 className="text-2xl font-bold text-agro-dark mb-2">
              Kirish talab etiladi
            </h2>
            <p className="text-gray-500 mb-6 max-w-sm">
              Bu sahifani ko'rish uchun tizimga kirishingiz yoki yangi akkaunt
              yaratishingiz kerak.
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
      {orderModalProduct && (
        <OrderModal
          key={orderModalProduct.id}
          product={orderModalProduct}
          onClose={() => setOrderModalProduct(null)}
          onSuccess={handleOrderSuccess}
        />
      )}

      <DisputeModal
        order={disputeOrder}
        onClose={() => setDisputeOrder(null)}
        onSuccess={refreshData}
      />

      <InvoiceModal
        orderId={invoiceOrderId}
        onClose={() => setInvoiceOrderId(null)}
      />

      <ReviewModal
        order={reviewOrder}
        onClose={() => setReviewOrder(null)}
        onSuccess={refreshData}
      />

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={refreshData}
      />

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckoutAll={() => {
          if (!user) {
            setIsCartOpen(false);
            setIsLoginOpen(true);
            return;
          }
          setIsCartCheckoutOpen(true);
        }}
        onCheckoutProduct={(product) => {
          if (!user) {
            setIsCartOpen(false);
            setIsLoginOpen(true);
            return;
          }
          setOrderModalProduct(product);
        }}
      />

      <CartCheckoutModal
        isOpen={isCartCheckoutOpen}
        onClose={() => setIsCartCheckoutOpen(false)}
        onSuccess={handleOrderSuccess}
      />

      {detailsId && (
        <ProductDetails
          key={detailsId}
          id={detailsId}
          onClose={() => setDetailsId(null)}
          onBuy={(product) => {
            setDetailsId(null);
            setOrderModalProduct(product);
          }}
          onMessage={openConversation}
          onLogin={() => {
            sessionStorage.setItem('agro_pending_product', detailsId);
            setDetailsId(null);
            setIsLoginOpen(true);
          }}
        />
      )}

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

      {currentTab !== 'welcome' && (
        <footer className="hidden md:block text-center text-xs text-gray-400 p-6">
          © {new Date().getFullYear()} AgroBozor · Fermer, xaridor va logist bir
          joyda
        </footer>
      )}
    </div>
  );
};

const SessionContent: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        role="status"
        className="min-h-screen flex items-center justify-center text-emerald-800 bg-[#f6f8f2]"
      >
        AgroBozor yuklanmoqda…
      </div>
    );
  return (
    <CartProvider key={user?.id || 'guest'}>
      <AppContent />
    </CartProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SessionContent />
    </AuthProvider>
  );
}

export default App;

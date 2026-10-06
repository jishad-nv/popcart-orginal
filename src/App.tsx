/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { SearchModal } from './components/common/SearchModal';
import { CartDrawer } from './components/common/CartDrawer';
import { QuickViewModal } from './components/common/QuickViewModal';
import { AuthModal } from './components/common/AuthModal';
import { ToastContainer } from './components/common/ToastContainer';

// Pages
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProfilePage } from './pages/ProfilePage';
import { WishlistPage } from './pages/WishlistPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { InfoPages } from './pages/InfoPages';

const MainRouter: React.FC = () => {
  const { currentPage } = useStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'shop':
        return <ShopPage />;
      case 'product-detail':
        return <ProductDetailPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'wishlist':
        return <WishlistPage />;
      case 'profile':
        return <ProfilePage />;
      case 'admin':
        return <AdminDashboard />;
      case 'about':
      case 'contact':
      case 'faq':
      case 'privacy':
      case 'terms':
      case 'shipping-policy':
      case 'refund-policy':
        return <InfoPages />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-900 selection:bg-violet-500 selection:text-white pb-16 md:pb-0 w-full max-w-full overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full max-w-full">
        {renderPage()}
      </main>
      <Footer />

      {/* Global Modals & Navigation Drawers */}
      <MobileBottomNav />
      <SearchModal />
      <CartDrawer />
      <QuickViewModal />
      <AuthModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainRouter />
    </StoreProvider>
  );
}

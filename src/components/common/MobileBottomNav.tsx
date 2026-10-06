import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Home, LayoutGrid, ShoppingBag, Heart, User } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { currentPage, navigateTo, cartCount, wishlistCount, setCartDrawerOpen, setAuthModalOpen, isLoggedIn } = useStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-4 md:hidden shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Home */}
        <button
          onClick={() => navigateTo('home')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
            currentPage === 'home' ? 'text-violet-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        {/* Products / Shop */}
        <button
          onClick={() => navigateTo('shop')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
            currentPage === 'shop' ? 'text-violet-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px]">Products</span>
        </button>

        {/* Cart */}
        <button
          onClick={() => navigateTo('cart')}
          className={`flex flex-col items-center gap-0.5 p-1 relative transition-colors ${
            currentPage === 'cart' ? 'text-violet-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-0 right-2 px-1 py-0.2 bg-violet-600 text-white rounded-full text-[9px] font-bold ring-2 ring-white">
              {cartCount}
            </span>
          )}
          <span className="text-[10px]">Cart</span>
        </button>

        {/* Wishlist */}
        <button
          onClick={() => navigateTo('wishlist')}
          className={`flex flex-col items-center gap-0.5 p-1 relative transition-colors ${
            currentPage === 'wishlist' ? 'text-violet-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-5 h-5" />
          {wishlistCount > 0 && (
            <span className="absolute top-0 right-2 px-1 py-0.2 bg-violet-600 text-white rounded-full text-[9px] font-bold ring-2 ring-white">
              {wishlistCount}
            </span>
          )}
          <span className="text-[10px]">Wishlist</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => navigateTo('profile')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
            currentPage === 'profile' ? 'text-violet-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </nav>
  );
};

import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/product/ProductCard';
import { Heart, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';

export const WishlistPage: React.FC = () => {
  const {
    wishlistProducts,
    wishlistCount,
    navigateTo,
    addToCart,
    toggleWishlist,
    addToast,
  } = useStore();

  const handleAddAllToCart = () => {
    if (wishlistProducts.length === 0) return;
    wishlistProducts.forEach((p) => {
      addToCart(p, 1, p.colors?.[0]?.name);
    });
    addToast('All Added to Cart', `${wishlistProducts.length} items moved to your cart!`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-rose-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              My Wishlist
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
              {wishlistCount} {wishlistCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Save items you love now, order whenever you're ready.
          </p>
        </div>

        {wishlistProducts.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddAllToCart}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add All to Cart</span>
            </button>
            <button
              onClick={() => navigateTo('shop')}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {wishlistProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto my-8 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <Heart className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Your Wishlist is Empty</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Explore our trending flagship audio, smart wearables, and power accessories. Tap the heart on any product to save it here.
            </p>
          </div>
          <button
            onClick={() => navigateTo('shop')}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-violet-500/25"
          >
            <span>Explore Trending Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {wishlistProducts.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

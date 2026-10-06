import React, { useState } from 'react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Heart, Star, ShoppingBag, Check, Eye } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const {
    formatPrice,
    addToCart,
    toggleWishlist,
    isWishlisted,
    navigateTo,
    setQuickViewProduct,
  } = useStore();

  const [isAdded, setIsAdded] = useState(false);
  const wishlisted = isWishlisted(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1, product.colors?.[0]?.name);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1800);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickViewProduct(product);
  };

  return (
    <div
      onClick={() => navigateTo('product-detail', { productId: product.id })}
      className="group relative bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-3.5 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/5 hover:-translate-y-1 hover:border-violet-200 flex flex-col justify-between h-full cursor-pointer"
    >
      <div>
        {/* Card Header Tags & Wishlist Button */}
        <div className="flex items-center justify-between mb-1.5">
          {product.discountPercent > 0 ? (
            <span className="text-[10px] sm:text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-md leading-none">
              -{product.discountPercent}%
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 leading-none">In Stock</span>
          )}

          <button
            onClick={handleWishlist}
            className={`p-1 rounded-full transition-colors ${
              wishlisted
                ? 'text-rose-500 bg-rose-50'
                : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'
            }`}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            title="Wishlist"
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Product Image with Quick View Overlay */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-2 flex items-center justify-center">
          <img
            src={product.images[0]}
            alt={product.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Quick View Button */}
          <button
            onClick={handleQuickView}
            className="absolute inset-x-2.5 bottom-2 py-1.5 bg-white/95 hover:bg-white text-slate-800 text-[11px] font-semibold rounded-lg shadow-md backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
            title="Quick view product"
          >
            <Eye className="w-3 h-3 text-violet-600" />
            <span>Quick View</span>
          </button>
        </div>

        {/* Brand & Category */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-0.5">
          <span className="font-bold uppercase tracking-wider text-violet-600 truncate mr-1">
            {product.brand}
          </span>
          <div className="flex items-center gap-1 text-amber-500 shrink-0">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700 text-[11px]">{product.rating}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-1 leading-snug min-h-[16px]">
          {product.name}
        </h3>

        {/* Short Spec line */}
        <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug min-h-[26px]">
          {product.shortDescription}
        </p>
      </div>

      {/* Card Bottom: Price & Add to Cart */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 tabular-nums leading-none">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice > product.price && (
              <span className="text-[10px] sm:text-[11px] text-slate-400 line-through tabular-nums leading-none">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          {product.originalPrice > product.price && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded shrink-0 leading-none">
              Save {formatPrice(product.originalPrice - product.price)}
            </span>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          className={`w-full h-8 sm:h-8.5 py-1 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
            isAdded
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20'
          }`}
        >
          {isAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Added!</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Star, ShoppingBag, Eye, Check, ShieldCheck, Truck } from 'lucide-react';

export const QuickViewModal: React.FC = () => {
  const { quickViewProduct, setQuickViewProduct, addToCart, formatPrice, navigateTo } = useStore();
  const [selectedImage, setSelectedImage] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const activeColor = selectedColor || product.colors?.[0]?.name || '';

  const handleAddToCart = () => {
    addToCart(product, quantity, activeColor);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleViewFullDetails = () => {
    const id = product.id;
    setQuickViewProduct(null);
    navigateTo('product-detail', { productId: id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative animate-in zoom-in-95 duration-150 flex flex-col md:flex-row max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setQuickViewProduct(null)}
          className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-slate-700 bg-white/80 hover:bg-slate-100 rounded-full transition-colors shadow-sm"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Media (Left) */}
        <div className="md:w-1/2 p-6 bg-slate-50/50 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100">
          <div className="aspect-square w-full rounded-2xl overflow-hidden bg-white border border-slate-200/60 flex items-center justify-center relative">
            <img
              src={product.images[selectedImage] || product.images[0]}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-all duration-300"
            />
            {product.discountPercent > 0 && (
              <span className="absolute top-3 left-3 bg-violet-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                -{product.discountPercent}%
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2.5 mt-4 justify-center">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === idx ? 'border-violet-600 ring-2 ring-violet-500/20' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info (Right) */}
        <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                {product.brand} · {product.categoryId}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1 leading-snug">
                {product.name}
              </h3>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span className="text-xs font-bold text-slate-800 ml-1">{product.rating}</span>
                </div>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">{product.reviewCount} customer reviews</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-sm text-slate-400 line-through tabular-nums">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              <span className="text-xs font-semibold text-emerald-600">
                Save {formatPrice(product.originalPrice - product.price)}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
              {product.description}
            </p>

            {/* Color Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  Select Color: <span className="font-normal text-slate-500">{activeColor}</span>
                </label>
                <div className="flex gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        activeColor === c.name ? 'border-violet-600 ring-2 ring-violet-500/30 scale-110' : 'border-slate-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {activeColor === c.name && (
                        <Check className={`w-3.5 h-3.5 ${c.hex === '#f8fafc' || c.hex === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-colors"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-bold tabular-nums text-slate-800">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  In Stock ({product.stockQuantity} units left)
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-6 space-y-2.5">
            <button
              onClick={handleAddToCart}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                isAdded
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20'
              }`}
            >
              {isAdded ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              <span>{isAdded ? 'Added to Shopping Bag!' : 'Add to Cart'}</span>
            </button>

            <button
              onClick={handleViewFullDetails}
              className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              <span>View Full Specifications & Reviews</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

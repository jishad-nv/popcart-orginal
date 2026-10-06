import React from 'react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';

interface TrendingCardProps {
  product: Product;
  gradientClass?: string;
}

export const TrendingCard: React.FC<TrendingCardProps> = ({
  product,
  gradientClass = 'from-violet-100/60 via-purple-50/40 to-amber-50/40',
}) => {
  const { navigateTo, formatPrice, addToCart } = useStore();

  const handleCardClick = () => {
    navigateTo('product-detail', { productId: product.id });
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1, product.colors?.[0]?.name);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative shrink-0 w-44 sm:w-52 h-72 sm:h-80 rounded-3xl p-4 flex flex-col justify-between overflow-hidden border border-slate-200/60 bg-gradient-to-b ${gradientClass} shadow-sm hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer`}
    >
      {/* Top Tag */}
      <div className="flex items-center justify-between z-10">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-xs text-[10px] font-bold text-slate-800 shadow-2xs tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-pulse" />
          Trending
        </span>
        <button
          onClick={handleQuickAdd}
          className="w-7 h-7 rounded-full bg-white/90 hover:bg-violet-600 hover:text-white text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
          title="Quick Add"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Center Product Image with Glow */}
      <div className="relative my-auto flex items-center justify-center py-2">
        <div className="absolute inset-0 bg-white/40 blur-xl rounded-full transform scale-75" />
        <img
          src={product.images[0]}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="relative max-h-36 sm:max-h-40 max-w-[85%] object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      {/* Bottom Frosted Title Banner */}
      <div className="z-10 bg-slate-900/80 backdrop-blur-md rounded-2xl p-2.5 text-white flex items-center justify-between border border-white/10 group-hover:bg-violet-900/90 transition-colors">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold truncate leading-tight">{product.name}</p>
          <p className="text-[11px] font-semibold text-violet-200 tabular-nums">
            {formatPrice(product.price)}
          </p>
        </div>
        <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:text-slate-900 transition-colors">
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

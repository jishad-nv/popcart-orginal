import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ArrowRight, Check, Sparkles, Tag, ShieldCheck, Zap } from 'lucide-react';

interface PriceOption {
  id: string;
  min?: number;
  max?: number;
  title: string;
  displayPrice: string;
  badgeText: string;
  tagline: string;
  gradient: string;
  borderHover: string;
  shadowColor: string;
  ringColor: string;
  iconBg: string;
  accentColor: string;
}

export const ShopByPriceSection: React.FC = () => {
  const { products, navigateTo, activePriceFilter, formatPrice, settings } = useStore();

  const priceOptions: PriceOption[] = [
    {
      id: 'under-99',
      min: 0,
      max: 99,
      title: 'Under ₹99',
      displayPrice: '₹99',
      badgeText: 'Under',
      tagline: 'Pocket friendly steals',
      gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
      borderHover: 'hover:border-emerald-300',
      shadowColor: 'hover:shadow-emerald-500/10',
      ringColor: 'ring-emerald-500/15',
      iconBg: 'bg-emerald-50 text-emerald-700',
      accentColor: 'text-emerald-700',
    },
    {
      id: 'under-499',
      min: 0,
      max: 499,
      title: 'Under ₹499',
      displayPrice: '₹499',
      badgeText: 'Under',
      tagline: 'Everyday tech essentials',
      gradient: 'from-blue-500 via-indigo-500 to-indigo-600',
      borderHover: 'hover:border-indigo-300',
      shadowColor: 'hover:shadow-indigo-500/10',
      ringColor: 'ring-indigo-500/15',
      iconBg: 'bg-indigo-50 text-indigo-700',
      accentColor: 'text-indigo-700',
    },
    {
      id: 'under-999',
      min: 0,
      max: 999,
      title: 'Under ₹999',
      displayPrice: '₹999',
      badgeText: 'Under',
      tagline: 'Best value smart gear',
      gradient: 'from-violet-600 via-purple-600 to-violet-700',
      borderHover: 'hover:border-violet-300',
      shadowColor: 'hover:shadow-violet-500/10',
      ringColor: 'ring-violet-500/15',
      iconBg: 'bg-violet-50 text-violet-700',
      accentColor: 'text-violet-700',
    },
    {
      id: 'above-1000',
      min: 1000,
      max: 100000,
      title: 'Above ₹1000',
      displayPrice: '₹1000+',
      badgeText: 'Above',
      tagline: 'Flagship & pro devices',
      gradient: 'from-amber-500 via-orange-500 to-amber-600',
      borderHover: 'hover:border-amber-300',
      shadowColor: 'hover:shadow-amber-500/10',
      ringColor: 'ring-amber-500/15',
      iconBg: 'bg-amber-50 text-amber-700',
      accentColor: 'text-amber-700',
    },
  ];

  // Calculate live product count for each price bracket
  const getProductCount = (min: number = 0, max: number = Infinity) => {
    return products.filter((p) => {
      if (max < 100000) {
        return p.price <= max;
      }
      return p.price >= min;
    }).length;
  };

  const handlePriceClick = (opt: PriceOption) => {
    navigateTo('shop', {
      priceFilter: {
        min: opt.min,
        max: opt.max,
        label: opt.title,
      },
    });
  };

  return (
    <section className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4 sm:mb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Tag className="w-3 h-3" />
              <span>Budget Shopping</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Shop by Price
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Find the perfect products within your budget.
            </p>
          </div>

          <button
            onClick={() => navigateTo('shop')}
            className="text-xs sm:text-sm font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 group w-fit cursor-pointer"
          >
            <span>Explore All Prices</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* 4 Circular Price Filter Options */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
          {priceOptions.map((opt) => {
            const count = getProductCount(opt.min, opt.max);
            const isActive = activePriceFilter?.label === opt.title;

            return (
              <button
                key={opt.id}
                onClick={() => handlePriceClick(opt)}
                className={`group relative text-left p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-300 flex flex-col items-center justify-between text-center cursor-pointer bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 active:translate-y-0 ${
                  opt.borderHover
                } ${opt.shadowColor} ${
                  isActive
                    ? 'border-violet-600 ring-2 ring-violet-500/30 bg-violet-50/30 shadow-md'
                    : 'border-slate-200/85 hover:bg-slate-50/50'
                }`}
              >
                {/* Active Indicator Chip */}
                {isActive && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>Active</span>
                  </span>
                )}

                {/* 3D Elevated Circular Badge */}
                <div className="relative my-1 sm:my-2">
                  {/* Subtle outer glow ring */}
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center p-1.5 ring-4 ${opt.ringColor} transition-transform duration-300 group-hover:scale-105`}
                  >
                    {/* Inner 3D Gradient Circle */}
                    <div
                      className={`w-full h-full rounded-full bg-gradient-to-br ${opt.gradient} text-white shadow-md shadow-slate-900/15 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 group-hover:shadow-lg`}
                    >
                      {/* Glossy lighting overlay highlight */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent rounded-t-full pointer-events-none" />

                      {/* Circular content */}
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-white/85 leading-none mb-0.5">
                        {opt.badgeText}
                      </span>
                      <span className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-none text-white drop-shadow-xs">
                        {opt.displayPrice}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Information Area */}
                <div className="w-full mt-2 sm:mt-3 space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight group-hover:text-violet-700 transition-colors">
                      {opt.title}
                    </h3>
                  </div>

                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    {opt.tagline}
                  </p>

                  <div className="pt-2 flex items-center justify-center gap-1.5 text-xs">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      {count} {count === 1 ? 'product' : 'products'}
                    </span>
                    <span className="text-violet-600 font-semibold inline-flex items-center text-[11px] group-hover:translate-x-0.5 transition-transform">
                      Browse <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

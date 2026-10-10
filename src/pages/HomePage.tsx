import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { TrendingCarousel } from '../components/home/TrendingCarousel';
import { ShopByPriceSection } from '../components/home/ShopByPriceSection';
import { ProductCard } from '../components/product/ProductCard';
import {
  Sparkles,
  ArrowRight,
  Headphones,
  Smartphone,
  Watch,
  BatteryCharging,
  Gamepad2,
  Home,
  Shield,
  LayoutGrid,
  Star,
  UtensilsCrossed,
  Archive,
  Lamp,
  Wrench,
  HeartPulse,
  Smile,
  Puzzle,
  Pencil,
  Shirt,
  Flower2,
  Car,
  Gift,
  Dumbbell,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    products,
    categories,
    navigateTo,
    settings,
    reviews,
  } = useStore();

  // Map icon names
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Headphones':
        return <Headphones className="w-5 h-5" />;
      case 'Smartphone':
        return <Smartphone className="w-5 h-5" />;
      case 'Watch':
        return <Watch className="w-5 h-5" />;
      case 'BatteryCharging':
        return <BatteryCharging className="w-5 h-5" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-5 h-5" />;
      case 'Home':
        return <Home className="w-5 h-5" />;
      case 'Shield':
        return <Shield className="w-5 h-5" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-5 h-5" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'Archive':
        return <Archive className="w-5 h-5" />;
      case 'Lamp':
        return <Lamp className="w-5 h-5" />;
      case 'Wrench':
        return <Wrench className="w-5 h-5" />;
      case 'HeartPulse':
        return <HeartPulse className="w-5 h-5" />;
      case 'Smile':
        return <Smile className="w-5 h-5" />;
      case 'Puzzle':
        return <Puzzle className="w-5 h-5" />;
      case 'Pencil':
        return <Pencil className="w-5 h-5" />;
      case 'Shirt':
        return <Shirt className="w-5 h-5" />;
      case 'Flower2':
        return <Flower2 className="w-5 h-5" />;
      case 'Car':
        return <Car className="w-5 h-5" />;
      case 'Gift':
        return <Gift className="w-5 h-5" />;
      case 'Dumbbell':
        return <Dumbbell className="w-5 h-5" />;
      default:
        return <LayoutGrid className="w-5 h-5" />;
    }
  };

  // Only show active, in-stock products with a valid primary image on the homepage
  const activeProducts = useMemo(() => {
    return products.filter(
      (p) =>
        (p.status || 'active') === 'active' &&
        p.inStock !== false &&
        Array.isArray(p.images) &&
        p.images.length > 0 &&
        Boolean(p.images[0])
    );
  }, [products]);

  const hpConfig = settings.homepageConfig || {};

  // 1. Discover What's Trending products (admin custom order or isTrending flag fallback)
  const trendingProducts = useMemo(() => {
    if (Array.isArray(hpConfig.trendingProductIds) && hpConfig.trendingProductIds.length > 0) {
      const map = new Map(activeProducts.map((p) => [p.id, p]));
      const ordered = hpConfig.trendingProductIds
        .map((id) => map.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (ordered.length > 0) return ordered.slice(0, 12);
    }
    const flagged = activeProducts.filter((p) => p.isTrending);
    if (flagged.length >= 6) return flagged.slice(0, 12);
    // Fallback to top active products if fewer than 6 are flagged
    const combined = [...flagged];
    for (const p of activeProducts) {
      if (combined.length >= 12) break;
      if (!combined.some((item) => item.id === p.id)) {
        combined.push(p);
      }
    }
    return combined;
  }, [activeProducts, hpConfig.trendingProductIds]);

  // 2. Popular & Trending Products (admin custom order or isFeatured / top 8 fallback)
  const popularProducts = useMemo(() => {
    if (Array.isArray(hpConfig.popularProductIds) && hpConfig.popularProductIds.length > 0) {
      const map = new Map(activeProducts.map((p) => [p.id, p]));
      const ordered = hpConfig.popularProductIds
        .map((id) => map.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (ordered.length > 0) return ordered.slice(0, 12);
    }
    const featured = activeProducts.filter((p) => p.isFeatured);
    if (featured.length >= 8) return featured.slice(0, 8);
    const combined = [...featured];
    for (const p of activeProducts) {
      if (combined.length >= 8) break;
      if (!combined.some((item) => item.id === p.id)) {
        combined.push(p);
      }
    }
    return combined;
  }, [activeProducts, hpConfig.popularProductIds]);

  // 3. New Arrivals (admin custom order or isNewArrival fallback)
  const newArrivals = useMemo(() => {
    if (Array.isArray(hpConfig.newArrivalsProductIds) && hpConfig.newArrivalsProductIds.length > 0) {
      const map = new Map(activeProducts.map((p) => [p.id, p]));
      const ordered = hpConfig.newArrivalsProductIds
        .map((id) => map.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (ordered.length > 0) return ordered.slice(0, 8);
    }
    const arrivals = activeProducts.filter((p) => p.isNewArrival);
    if (arrivals.length >= 4) return arrivals.slice(0, 8);
    const combined = [...arrivals];
    for (const p of activeProducts) {
      if (combined.length >= 4) break;
      if (!combined.some((item) => item.id === p.id)) {
        combined.push(p);
      }
    }
    return combined;
  }, [activeProducts, hpConfig.newArrivalsProductIds]);

  // Gradient themes for carousel cards
  const gradients = [
    'from-violet-100/70 via-purple-50/50 to-amber-50/40',
    'from-amber-100/60 via-orange-50/40 to-slate-50',
    'from-sky-100/60 via-indigo-50/40 to-purple-50/40',
    'from-rose-100/60 via-violet-50/40 to-slate-50',
    'from-emerald-100/60 via-teal-50/40 to-slate-50',
    'from-purple-100/60 via-violet-50/40 to-amber-50/40',
  ];

  return (
    <div className="space-y-3 sm:space-y-6 pb-10">
      {/* 1. DISCOVER WHAT'S TRENDING SECTION (As in Video 00:03) */}
      <section className="pt-3 sm:pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {hpConfig.trendingTitle || "Discover What's Trending"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-1.5">
              {hpConfig.trendingSubtitle ||
                'Discover useful home, kitchen and lifestyle products at honest prices.'}
            </p>
          </div>

          {/* Smooth Infinite-Loop Horizontal Carousel */}
          <TrendingCarousel
            products={trendingProducts}
            gradients={gradients}
            autoPlay={hpConfig.autoPlayTrending !== false}
            speedMs={hpConfig.trendingSpeedMs || 2800}
          />
        </div>
      </section>

      {/* 2. CATEGORIES ROW (As in Video 00:04 & Screenshot 1) */}
      <section className="bg-slate-50/60 py-4 sm:py-5 border-y border-slate-200/60 w-full min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-w-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Categories</h2>
            <button
              onClick={() => navigateTo('shop')}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 group cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Dedicated Horizontal Scroll Container */}
          <div
            className="w-full min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain py-1 pb-1.5"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            <div className="flex items-center gap-2.5 sm:gap-3.5 lg:gap-4 flex-nowrap w-max md:w-full md:justify-center pr-4 sm:pr-0">
              {/* 'All' Category button */}
              <button
                onClick={() => navigateTo('shop')}
                className="flex-none flex flex-col items-center gap-1.5 p-2.5 sm:p-3.5 rounded-2xl bg-violet-600 text-white min-w-[76px] sm:min-w-[92px] shadow-sm shadow-violet-500/20 transition-transform hover:scale-105 cursor-pointer select-none"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs font-bold">All</span>
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigateTo('shop', { categoryId: cat.id })}
                  className="flex-none flex flex-col items-center gap-1.5 p-2.5 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 text-slate-700 hover:border-violet-300 hover:text-violet-700 min-w-[76px] sm:min-w-[92px] transition-all hover:scale-105 hover:shadow-xs cursor-pointer select-none"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    {getCategoryIcon(cat.iconName)}
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. SHOP BY PRICE (Four attractive round/circular price filter buttons) */}
      <ShopByPriceSection />

      {/* 4. POPULAR & TRENDING PRODUCTS (As in Video 00:08) */}
      <section className="py-2 sm:py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {hpConfig.popularTitle || 'Popular & Trending Products'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {hpConfig.popularSubtitle ||
                  'Hand-picked flagship essentials engineered for everyday excellence.'}
              </p>
            </div>
            <button
              onClick={() => navigateTo('shop')}
              className="text-xs sm:text-sm font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 group whitespace-nowrap cursor-pointer"
            >
              <span>Full Catalog</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. NEW ARRIVALS (As in Video 00:13) */}
      <section className="py-2 sm:py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-violet-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {hpConfig.newArrivalsSubtitle || 'Freshly Dropped'}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {hpConfig.newArrivalsTitle || 'New Arrivals'}
              </h2>
            </div>
            <button
              onClick={() => navigateTo('shop')}
              className="text-xs sm:text-sm font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 group cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 6. VERIFIED CUSTOMER REVIEWS & SOCIAL PROOF */}
      <section className="bg-slate-50/70 py-8 sm:py-10 border-t border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-lg mx-auto mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Trusted by 120,000+ Customers
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Read authentic feedback from verified buyers across India & globally.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {reviews.slice(0, 3).map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{rev.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{rev.userName}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Verified Buyer</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{rev.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

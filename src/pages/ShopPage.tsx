import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/product/ProductCard';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Star,
  ChevronDown,
  X,
  Filter,
} from 'lucide-react';

export const ShopPage: React.FC = () => {
  const {
    products,
    categories,
    selectedCategoryFilter,
    activeSearchQuery,
    setActiveSearchQuery,
    activePriceFilter,
    setActivePriceFilter,
    settings,
    formatPrice,
    navigateTo,
  } = useStore();

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(selectedCategoryFilter || 'all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(75000);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [minDiscount, setMinDiscount] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating' | 'newest'>('featured');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(48);

  // Sync category filter if changed from navigation
  useEffect(() => {
    if (selectedCategoryFilter) {
      setSelectedCategory(selectedCategoryFilter);
    }
  }, [selectedCategoryFilter]);

  // Sync active price filter from navigation (e.g. from Shop by Price section)
  useEffect(() => {
    if (activePriceFilter) {
      setMinPrice(activePriceFilter.min !== undefined ? activePriceFilter.min : 0);
      setMaxPrice(activePriceFilter.max !== undefined ? activePriceFilter.max : 75000);
    }
  }, [activePriceFilter]);

  // Extract unique brands
  const allBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    products.forEach((p) => brandsSet.add(p.brand));
    return Array.from(brandsSet);
  }, [products]);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setMinPrice(0);
    setMaxPrice(75000);
    setActivePriceFilter(null);
    setSelectedBrands([]);
    setMinRating(null);
    setMinDiscount(null);
    setInStockOnly(false);
    setActiveSearchQuery('');
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  // Filter and sort computation
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (activeSearchQuery.trim()) {
          const q = activeSearchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchBrand = p.brand.toLowerCase().includes(q);
          const matchDesc = p.shortDescription.toLowerCase().includes(q);
          if (!matchName && !matchBrand && !matchDesc) return false;
        }

        // Category
        if (selectedCategory !== 'all') {
          const isHomeMatch =
            (selectedCategory === 'home' || selectedCategory === 'smart-home') &&
            (p.categoryId === 'home' || p.categoryId === 'smart-home');
          if (!isHomeMatch && p.categoryId !== selectedCategory) {
            return false;
          }
        }

        // Price Filter
        if (minPrice > 0 && p.price < minPrice) {
          return false;
        }
        if (maxPrice < 100000 && p.price > maxPrice) {
          return false;
        }

        // Brands
        if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) {
          return false;
        }

        // Rating
        if (minRating !== null && p.rating < minRating) {
          return false;
        }

        // Discount
        if (minDiscount !== null && p.discountPercent < minDiscount) {
          return false;
        }

        // In stock
        if (inStockOnly && !p.inStock) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return a.price - b.price;
          case 'price-high':
            return b.price - a.price;
          case 'rating':
            return b.rating - a.rating;
          case 'newest':
            return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
          case 'featured':
          default:
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        }
      });
  }, [
    products,
    activeSearchQuery,
    selectedCategory,
    minPrice,
    maxPrice,
    selectedBrands,
    minRating,
    minDiscount,
    inStockOnly,
    sortBy,
  ]);

  const pricePresets = [
    { label: 'Under ₹99', min: 0, max: 99 },
    { label: 'Under ₹499', min: 0, max: 499 },
    { label: 'Under ₹999', min: 0, max: 999 },
    { label: 'Above ₹1000', min: 1000, max: 100000 },
  ];

  const handlePricePreset = (preset: { label: string; min: number; max: number }) => {
    if (activePriceFilter?.label === preset.label) {
      // Toggle off if already selected
      setMinPrice(0);
      setMaxPrice(75000);
      setActivePriceFilter(null);
    } else {
      setMinPrice(preset.min);
      setMaxPrice(preset.max);
      setActivePriceFilter(preset);
    }
  };

  const handleClearPriceFilter = () => {
    setMinPrice(0);
    setMaxPrice(75000);
    setActivePriceFilter(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-5 space-y-3 sm:space-y-4">
      {/* Top Search Input Bar (As in Video 00:25) */}
      <div className="relative">
        <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={activeSearchQuery}
          onChange={(e) => setActiveSearchQuery(e.target.value)}
          placeholder="Search products by title, brand, features, or keywords..."
          className="w-full pl-9 sm:pl-10 pr-9 py-2.5 sm:py-3 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
        />
        {activeSearchQuery && (
          <button
            onClick={() => setActiveSearchQuery('')}
            className="absolute right-3.5 top-3 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Top Horizontal Category Tabs */}
      <div
        className="w-full min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain pb-0.5"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
        }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap w-max pr-4 sm:pr-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex-none px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
              selectedCategory === 'all'
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            All Products ({products.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-none px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                selectedCategory === cat.id
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout: Sidebar + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 items-start">
        {/* Mobile Filter Toggle Button */}
        <div className="lg:hidden flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-violet-600" />
            <span>Filter Catalog</span>
          </button>
          <span className="text-xs text-slate-500 font-medium">{filteredProducts.length} items</span>
        </div>

        {/* Left Filter Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-80 bg-white p-5 shadow-2xl transition-transform lg:static lg:w-auto lg:p-5 lg:shadow-xs lg:rounded-2xl lg:border lg:border-slate-200/80 overflow-y-auto custom-scrollbar ${
            isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">Filters</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5 text-xs">
            {/* Category selection */}
            <div>
              <label className="font-bold text-slate-900 block mb-2">Category</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                  <input
                    type="radio"
                    name="cat"
                    checked={selectedCategory === 'all'}
                    onChange={() => setSelectedCategory('all')}
                    className="accent-violet-600"
                  />
                  <span>All Categories</span>
                </label>
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900"
                  >
                    <input
                      type="radio"
                      name="cat"
                      checked={selectedCategory === c.id}
                      onChange={() => setSelectedCategory(c.id)}
                      className="accent-violet-600"
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shop by Budget Presets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-slate-900">Shop by Budget</label>
                {activePriceFilter && (
                  <button
                    onClick={handleClearPriceFilter}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {pricePresets.map((preset) => {
                  const isSelected = activePriceFilter?.label === preset.label;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handlePricePreset(preset)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold text-center border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-violet-600 bg-violet-600 text-white shadow-xs font-bold'
                          : 'border-slate-200 hover:border-violet-300 bg-slate-50/70 text-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-900">Custom Max Price</label>
                <span className="font-bold text-violet-700 tabular-nums">
                  {formatPrice(maxPrice)}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={75000}
                step={1000}
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(Number(e.target.value));
                  setActivePriceFilter(null);
                }}
                className="w-full accent-violet-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                <span>{formatPrice(1000)}</span>
                <span>{formatPrice(75000)}</span>
              </div>
            </div>

            {/* Brand Checkboxes */}
            <div>
              <label className="font-bold text-slate-900 block mb-2">Brand</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {allBrands.map((b) => (
                  <label key={b} className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(b)}
                      onChange={() => toggleBrand(b)}
                      className="rounded accent-violet-600 w-3.5 h-3.5"
                    />
                    <span>{b}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Customer Rating */}
            <div>
              <label className="font-bold text-slate-900 block mb-2">Customer Rating</label>
              <div className="space-y-1.5">
                {[4.5, 4.0].map((star) => (
                  <button
                    key={star}
                    onClick={() => setMinRating(minRating === star ? null : star)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      minRating === star
                        ? 'border-violet-600 bg-violet-50 text-violet-700 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{star}★ & above</span>
                    </span>
                    {minRating === star && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Filter */}
            <div>
              <label className="font-bold text-slate-900 block mb-2">Special Discount</label>
              <div className="flex flex-wrap gap-1.5">
                {[20, 25, 30].map((disc) => (
                  <button
                    key={disc}
                    onClick={() => setMinDiscount(minDiscount === disc ? null : disc)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      minDiscount === disc
                        ? 'border-violet-600 bg-violet-600 text-white font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {disc}% or more
                  </button>
                ))}
              </div>
            </div>

            {/* In Stock Only */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-bold text-slate-900">In Stock Only</span>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded accent-violet-600 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </aside>

        {/* Right Product Grid Area */}
        <div className="lg:col-span-3 space-y-3 sm:space-y-4">
          {/* Header Controls: Count & Sort */}
          <div className="flex flex-row items-center justify-between gap-2 bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Showing <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> of{' '}
                {products.length}
              </span>
              {selectedCategory !== 'all' && (
                <span className="truncate px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] sm:text-[11px] font-semibold rounded-md">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                </span>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/90 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
              >
                <option value="featured">Featured Picks</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          {(activePriceFilter || selectedCategory !== 'all' || selectedBrands.length > 0 || minRating || minDiscount || inStockOnly) && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap bg-violet-50/70 border border-violet-200/80 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-2xs">
              <span className="text-xs font-bold text-violet-950">Active:</span>

              {activePriceFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-[11px] font-bold shadow-xs">
                  <span>Price: {activePriceFilter.label}</span>
                  <button
                    onClick={handleClearPriceFilter}
                    className="hover:bg-violet-700 rounded-full p-0.5 ml-0.5 cursor-pointer"
                    title="Remove price filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-white text-[11px] font-semibold shadow-xs">
                  <span>{categories.find((c) => c.id === selectedCategory)?.name}</span>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="hover:bg-slate-700 rounded-full p-0.5 ml-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedBrands.map((brand) => (
                <span key={brand} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-semibold">
                  <span>{brand}</span>
                  <button
                    onClick={() => toggleBrand(brand)}
                    className="hover:bg-slate-300 rounded-full p-0.5 ml-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <button
                onClick={handleResetFilters}
                className="text-[11px] text-violet-700 hover:text-violet-900 underline ml-auto font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No matching products found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No items match your active filters. Try adjusting price range or clear filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {filteredProducts.slice(0, visibleCount).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {visibleCount < filteredProducts.length && (
                <div className="pt-4 text-center">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 48)}
                    className="px-6 py-3 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Load More Products ({filteredProducts.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

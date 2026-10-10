import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, X, TrendingUp, ArrowRight } from 'lucide-react';

export const SearchModal: React.FC = () => {
  const { isSearchModalOpen, setSearchModalOpen, products, navigateTo, formatPrice } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isSearchModalOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchModalOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  const trendingTags = [
    'Kitchen Organizer',
    'Water Bottle',
    'Storage Box',
    'LED Lamp',
    'Cleaning Brush',
    'Kids Toy',
    'Tool Kit',
  ];

  const filteredProducts = searchTerm.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.shortDescription.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : products.filter((p) => p.isTrending || p.isFeatured).slice(0, 5);

  const handleSelectProduct = (productId: string) => {
    setSearchModalOpen(false);
    navigateTo('product-detail', { productId });
  };

  const handleTagClick = (tag: string) => {
    setSearchTerm(tag);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products, categories, brands, or keywords..."
            className="flex-1 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setSearchModalOpen(false)}
            className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Quick Trending Tags */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0 mr-1">
            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
            <span>Trending:</span>
          </div>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-violet-700 bg-white hover:bg-violet-50 border border-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results / Suggestions */}
        <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {searchTerm ? `Results (${filteredProducts.length})` : 'Popular & Suggested Products'}
          </p>

          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-medium">No products matching "{searchTerm}"</p>
              <p className="text-xs text-slate-400 mt-1">Try checking for typos or searching general terms like "kitchen" or "storage"</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod.id)}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-lg bg-slate-100 border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider block">
                        {prod.brand} · {prod.categoryId}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors truncate">
                        {prod.name}
                      </h4>
                      <p className="text-xs text-slate-400 truncate max-w-sm">
                        {prod.shortDescription}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3 flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatPrice(prod.price)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer View All In Shop */}
        {searchTerm && filteredProducts.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setSearchModalOpen(false);
                navigateTo('shop', { search: searchTerm });
              }}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800"
            >
              See all results for "{searchTerm}" in Catalog &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

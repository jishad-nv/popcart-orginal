import React from 'react';
import { useStore } from '../../context/StoreContext';
import { PopcartyLogo } from './PopcartyLogo';
import { Truck, ShieldCheck, RefreshCw, Headphones } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigateTo, categories, settings } = useStore();

  return (
    <footer className="bg-white border-t border-slate-200 mt-8 sm:mt-12 transition-colors">
      {/* Brand Trust Strip (Adjacency & Guarantees) */}
      <div className="border-b border-slate-100 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">Express Delivery</h4>
                <p className="text-[11px] text-slate-500">Fast weight-based shipping across India</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">1-Year Warranty</h4>
                <p className="text-[11px] text-slate-500">Official brand guarantee & certified parts</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">7-Day Replacement</h4>
                <p className="text-[11px] text-slate-500">Hassle-free instant return or swap</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">24/7 Dedicated Care</h4>
                <p className="text-[11px] text-slate-500">Instant chat & prompt ticket dispatch</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <PopcartyLogo size="md" showSubtitle={true} />
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Useful home, kitchen and lifestyle products at honest prices, delivered to your doorstep.
            </p>
          </div>

          {/* Column 1: Shop Categories */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Shop Categories
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              {categories.slice(0, 5).map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => navigateTo('shop', { categoryId: cat.id })}
                    className="hover:text-violet-700 transition-colors text-left"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="text-violet-600 hover:text-violet-800 font-semibold"
                >
                  View All Products &rarr;
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Customer Experience */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Customer Experience
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => navigateTo('profile')} className="hover:text-violet-700 transition-colors">
                  Track My Order
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shipping-policy')} className="hover:text-violet-700 transition-colors">
                  Shipping Rates & Timelines
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('refund-policy')} className="hover:text-violet-700 transition-colors">
                  Easy Return Portal
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('faq')} className="hover:text-violet-700 transition-colors">
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('contact')} className="hover:text-violet-700 transition-colors">
                  Contact Support
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Trust */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Company & Legal
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => navigateTo('about')} className="hover:text-violet-700 transition-colors">
                  About AuraCart
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('privacy')} className="hover:text-violet-700 transition-colors">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('terms')} className="hover:text-violet-700 transition-colors">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('admin')} className="text-slate-400 hover:text-slate-600 transition-colors">
                  Staff Admin Portal
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 {settings.storeName} Retail Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Encrypted 256-Bit SSL Checkout</span>
            <span aria-hidden="true">·</span>
            <span>Made for Better Living</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { PopcartyLogo } from './PopcartyLogo';
import {
  Search,
  ShoppingBag,
  Heart,
  Bell,
  User as UserIcon,
  ShieldCheck,
  LogOut,
  Package,
  MapPin,
  ChevronDown,
  X,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentPage,
    navigateTo,
    cartCount,
    cartTotal,
    wishlistCount,
    currentUser,
    isLoggedIn,
    isAdmin,
    isLoggingOut,
    selectedCategoryFilter,
    categories,
    logout,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    settings,
    updateSettings,
    formatPrice,
    setSearchModalOpen,
    setCartDrawerOpen,
    setAuthModalOpen,
  } = useStore();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeCategoryMenu = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeCategoryMenu);
    return () => document.removeEventListener('mousedown', closeCategoryMenu);
  }, []);

  // Exactly one nav item is highlighted at a time
  const onShop = currentPage === 'shop';
  const activeCategory = onShop ? selectedCategoryFilter || '' : '';

  const navLinks: {
    label: string;
    page: 'home' | 'shop' | 'profile';
    categoryId?: string;
    active?: boolean;
    menu?: boolean;
  }[] = [
    { label: 'Home', page: 'home', active: currentPage === 'home' },
    { label: 'Shop All', page: 'shop', categoryId: '', active: onShop && !activeCategory },
    { label: 'Categories', page: 'shop', menu: true },
    { label: 'Kitchen', page: 'shop', categoryId: 'kitchen', active: activeCategory === 'kitchen' },
    { label: 'My Orders', page: 'profile', active: currentPage === 'profile' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Main Top Bar (Constitutional 3-Zone Contract) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Decreased logo & brand name, neatly placed */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => navigateTo('home')}
            className="group flex items-center py-1 px-1.5 -ml-1 rounded-xl hover:bg-slate-100/70 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label="Popcarty Home"
          >
            <PopcartyLogo size="sm" showSubtitle={true} />
          </button>
        </div>

        {/* Zone 2: 4-6 text navigation links, centered */}
        <nav className="hidden md:flex items-center justify-center gap-7 text-sm font-medium text-slate-600 flex-1">
          {navLinks.map((link) => {
            if (link.menu) {
              const categoriesActive = !!activeCategory && activeCategory !== 'kitchen';
              return (
                <div key={link.label} ref={categoryMenuRef} className="relative">
                  <button
                    onClick={() => setIsCategoryMenuOpen((open) => !open)}
                    className={`transition-colors text-left hover:text-violet-700 ${
                      categoriesActive || isCategoryMenuOpen ? 'text-violet-700 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    Categories ▾
                  </button>
                  {isCategoryMenuOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-52 bg-white border border-slate-200 rounded-2xl shadow-lg py-2 z-50">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setIsCategoryMenuOpen(false);
                            navigateTo('shop', { categoryId: cat.id });
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                            activeCategory === cat.id ? 'text-violet-700 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={link.label}
                onClick={() => navigateTo(link.page, { categoryId: link.categoryId })}
                className={`transition-colors text-left hover:text-violet-700 ${
                  link.active ? 'text-violet-700 font-semibold' : 'text-slate-600'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => navigateTo('admin')}
              className={`transition-colors flex items-center gap-1.5 ${
                currentPage === 'admin'
                  ? 'text-violet-700 font-semibold'
                  : 'text-violet-600 hover:text-violet-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        {/* Zone 3: 1-2 primary actions (Search, Notifications, Wishlist, Cart Drawer, User Menu) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Currency Switcher */}
          <button
            onClick={() =>
              updateSettings({
                currency: settings.currency === 'INR' ? 'USD' : 'INR',
              })
            }
            className="hidden sm:flex items-center px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Switch currency"
          >
            {settings.currency === 'INR' ? '₹ INR' : '$ USD'}
          </button>

          {/* Search Trigger */}
          <button
            onClick={() => setSearchModalOpen(true)}
            className="p-2 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl transition-colors cursor-pointer"
            aria-label="Open search dialog"
            title="Search products (Ctrl+K)"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-ping" />
              )}
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-700 rounded-md">
                        {unreadNotificationsCount} new
                      </span>
                    )}
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar mt-2">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`py-3 px-2 flex items-start gap-3 rounded-lg transition-colors cursor-pointer ${
                        !notif.read ? 'bg-violet-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-violet-600 opacity-80" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 leading-tight">
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {notif.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wishlist Link Button */}
          <button
            onClick={() => navigateTo('wishlist')}
            className={`p-2 rounded-xl transition-colors relative cursor-pointer hidden sm:flex ${
              currentPage === 'wishlist'
                ? 'text-violet-700 bg-violet-50'
                : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50'
            }`}
            aria-label="Wishlist"
            title="My Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-violet-600 text-white rounded-full text-[11px] font-bold ring-2 ring-white">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Cart Bag Drawer Trigger */}
          <button
            onClick={() => setCartDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-violet-500/20 transition-all group cursor-pointer"
            aria-label="View shopping bag"
          >
            <ShoppingBag className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="text-xs font-bold font-mono tabular-nums">{cartCount}</span>
            <span className="hidden lg:inline text-xs font-medium text-violet-100 border-l border-white/20 pl-2">
              {formatPrice(cartTotal)}
            </span>
          </button>

          {/* User Account Menu / Login */}
          <div className="relative" ref={userMenuRef}>
            {isLoggedIn ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {currentUser?.name.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {isUserMenuOpen && isLoggedIn && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{currentUser?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                    {currentUser?.role === 'admin' ? 'Store Administrator' : 'VIP Member'}
                  </span>
                </div>

                <div className="space-y-0.5 text-xs font-medium text-slate-700">
                  <button
                    onClick={() => {
                      navigateTo('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      navigateTo('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                  >
                    <Package className="w-4 h-4 text-slate-400" />
                    <span>My Orders</span>
                  </button>
                  <button
                    onClick={() => {
                      navigateTo('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>Saved Addresses</span>
                  </button>
                  <button
                    onClick={() => {
                      navigateTo('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                  >
                    <Heart className="w-4 h-4 text-slate-400" />
                    <span>My Wishlist ({wishlistCount})</span>
                  </button>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigateTo('admin');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-violet-700 hover:bg-violet-50 rounded-lg transition-colors text-left font-semibold"
                      >
                        <ShieldCheck className="w-4 h-4 text-violet-600" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={async () => {
                        const ok = await logout();
                        if (ok) {
                          setIsUserMenuOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-left font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

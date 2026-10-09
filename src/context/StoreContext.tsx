import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Product,
  Category,
  CartItem,
  User,
  Address,
  Order,
  OrderStatus,
  Coupon,
  StoreSettings,
  NotificationItem,
  Review,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_SETTINGS,
  INITIAL_ADDRESSES,
  INITIAL_NOTIFICATIONS,
  INITIAL_REVIEWS,
} from '../data/mockData';
import { AUTH_TOKEN_KEY, clearStoredAuthToken } from '../services/productImporter';

export type PageView =
  | 'home'
  | 'shop'
  | 'product-detail'
  | 'cart'
  | 'checkout'
  | 'wishlist'
  | 'profile'
  | 'admin'
  | 'about'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'shipping-policy'
  | 'refund-policy';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'info' | 'error';
}

interface StoreContextType {
  // Navigation
  currentPage: PageView;
  navigateTo: (
    page: PageView,
    options?: {
      productId?: string;
      categoryId?: string;
      search?: string;
      priceFilter?: { min?: number; max?: number; label?: string } | null;
      replace?: boolean;
    }
  ) => void;
  selectedProductId: string | null;
  selectedCategoryFilter: string | null;
  activeSearchQuery: string;
  setActiveSearchQuery: (query: string) => void;
  activePriceFilter: { min?: number; max?: number; label?: string } | null;
  setActivePriceFilter: (filter: { min?: number; max?: number; label?: string } | null) => void;

  // Products
  products: Product[];
  categories: Category[];
  addProduct: (product: Omit<Product, 'id' | 'slug'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  restockProduct: (id: string, amount?: number) => void;
  getProductById: (id: string) => Product | undefined;
  bulkDeleteProducts: (ids: string[]) => void;
  bulkUpdateCategory: (ids: string[], categoryId: string) => void;
  bulkUpdateStatus: (ids: string[], status: 'active' | 'draft' | 'archived') => void;
  bulkUpdateMarkup: (ids: string[], markupType: 'percent' | 'fixed', value: number) => void;
  importProducts: (
    newProducts: (Omit<Product, 'id' | 'slug'> & { id?: string; slug?: string })[]
  ) => { imported: number; updated: number };
  resetToDefaultCatalog: () => void;

  // Reviews
  reviews: Review[];
  addReview: (productId: string, rating: number, title: string, comment: string) => void;
  getProductReviews: (productId: string) => Review[];

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, color?: string) => void;
  updateCartQty: (productId: string, quantity: number, color?: string) => void;
  removeFromCart: (productId: string, color?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartDiscount: number;
  cartShipping: number;
  cartTax: number;
  cartTotal: number;

  // Wishlist
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  wishlistCount: number;
  wishlistProducts: Product[];

  // Coupons
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usageCount'>) => void;
  deleteCoupon: (id: string) => void;

  // User & Auth
  currentUser: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoggingOut: boolean;
  login: (email: string, role?: 'customer' | 'admin', password?: string) => Promise<boolean>;
  register: (name: string, email: string, phone: string, password?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateProfile: (name: string, email: string, phone: string) => void;
  addresses: Address[];
  addAddress: (addr: Omit<Address, 'id' | 'userId'>) => void;
  updateAddress: (id: string, updates: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  // Orders
  orders: Order[];
  createOrder: (orderData: {
    shippingAddress: Address;
    shippingMethod: 'standard';
    paymentMethod: 'card' | 'apple_pay' | 'upi';
  }) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  userOrders: Order[];
  getOrderById: (orderId: string) => Order | undefined;

  // Settings & Utilities
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  formatPrice: (amount: number) => string;

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;

  // Modals & Drawers
  isSearchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;

  // Toasts
  toasts: Toast[];
  addToast: (title: string, message?: string, type?: 'success' | 'info' | 'error') => void;
  removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRODUCTS: 'auracart_products_v3',
  CATEGORIES: 'auracart_categories_v3',
  CART: 'auracart_cart_v3',
  WISHLIST: 'auracart_wishlist_v3',
  USER: 'auracart_user_v3',
  ADDRESSES: 'auracart_addresses_v3',
  ORDERS: 'auracart_orders_v3',
  COUPONS: 'auracart_coupons_v3',
  SETTINGS: 'auracart_settings_v3',
  NOTIFICATIONS: 'auracart_notifications_v3',
  REVIEWS: 'auracart_reviews_v3',
};

const pathToPage = (pathname: string): PageView => {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  switch (clean) {
    case '/shop':
      return 'shop';
    case '/product':
    case '/product-detail':
      return 'product-detail';
    case '/cart':
      return 'cart';
    case '/checkout':
      return 'checkout';
    case '/wishlist':
      return 'wishlist';
    case '/profile':
    case '/orders':
    case '/settings':
      return 'profile';
    case '/admin':
    case '/dashboard':
      return 'admin';
    case '/about':
      return 'about';
    case '/contact':
      return 'contact';
    case '/faq':
      return 'faq';
    case '/privacy':
      return 'privacy';
    case '/terms':
      return 'terms';
    case '/shipping-policy':
      return 'shipping-policy';
    case '/refund-policy':
      return 'refund-policy';
    default:
      return 'home';
  }
};

const pageToPath = (page: PageView): string => {
  if (page === 'home') return '/';
  return `/${page}`;
};

const isProtectedPage = (page: PageView): boolean => {
  return page === 'profile' || page === 'admin';
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local storage helper
  const loadStorage = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && saved !== undefined && saved !== 'undefined') {
        return JSON.parse(saved);
      }
    } catch {
      // fallback to initial
    }
    return fallback;
  };

  // Safe localStorage setter (prevents QuotaExceededError on large product catalogs)
  const safeSetStorage = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota errors
    }
  };

  // Strict Initial Auth State: Requires BOTH a stored token and user record; never defaults to a mock user
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (!token || token === 'null' || token === 'undefined' || !savedUser || savedUser === 'null') {
        return null;
      }
      const parsed = JSON.parse(savedUser);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
        return parsed as User;
      }
    } catch {
      // fallback to logged out
    }
    return null;
  });

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const currentUserRef = useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;

  // Navigation State initialized from URL with route protection
  const [currentPage, setCurrentPage] = useState<PageView>(() => {
    if (typeof window === 'undefined') return 'home';
    const initialTarget = pathToPage(window.location.pathname);
    if (initialTarget === 'profile' && !currentUser) {
      return 'home';
    }
    if (initialTarget === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
      return 'admin'; // AdminDashboard renders restricted access view or redirects
    }
    return initialTarget;
  });

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [activePriceFilter, setActivePriceFilter] = useState<{ min?: number; max?: number; label?: string } | null>(null);

  // Modals
  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [isCartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (title: string, message?: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-1), { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // State initialization
  const [products, setProducts] = useState<Product[]>(() => {
    const loaded = loadStorage<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_PRODUCTS;
  });
  const [categories, setCategories] = useState<Category[]>(() => loadStorage(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
  const [cart, setCart] = useState<CartItem[]>(() => loadStorage(STORAGE_KEYS.CART, []));
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => loadStorage(STORAGE_KEYS.WISHLIST, []));
  const [addresses, setAddresses] = useState<Address[]>(() =>
    currentUser ? loadStorage(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES) : []
  );
  const [orders, setOrders] = useState<Order[]>(() => loadStorage(STORAGE_KEYS.ORDERS, []));
  const [coupons, setCoupons] = useState<Coupon[]>(() => loadStorage(STORAGE_KEYS.COUPONS, INITIAL_COUPONS));
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(() => loadStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    loadStorage(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)
  );
  const [reviews, setReviews] = useState<Review[]>(() => loadStorage(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS));

  // Verify backend session on mount and load real catalog from backend database
  useEffect(() => {
    // 1. Check direct URL protection on initial load
    if (typeof window !== 'undefined') {
      const target = pathToPage(window.location.pathname);
      if (target === 'profile' && !currentUserRef.current) {
        window.history.replaceState({ page: 'home' }, '', '/');
        setCurrentPage('home');
        setAuthModalOpen(true);
      }
    }

    // 2. Verify active session token with backend (/api/auth/me)
    const verifyBackendSession = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || token === 'null' || token === 'undefined') {
        if (currentUserRef.current) {
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          // Session invalid/expired/logged-out on server -> purge client auth state
          clearStoredAuthToken();
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
          setCurrentUser(null);
          setAddresses([]);
          if (isProtectedPage(pathToPage(window.location.pathname))) {
            window.history.replaceState({ page: 'home' }, '', '/');
            setCurrentPage('home');
          }
        } else {
          const data = await res.json();
          if (data.user) {
            const refreshedUser: User = {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              phone: data.user.phone || currentUserRef.current?.phone || '',
              role: data.user.role === 'admin' ? 'admin' : 'customer',
              memberSince: data.user.memberSince || currentUserRef.current?.memberSince || 'October 2026',
            };
            currentUserRef.current = refreshedUser;
            setCurrentUser(refreshedUser);
            safeSetStorage(STORAGE_KEYS.USER, refreshedUser);
          }
        }
      } catch {
        // Keep current state on transient offline error
      }
    };

    // 3. Sync real products, coupons, settings, and orders from backend database
    const syncBackendData = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.products) && data.products.length > 0) {
            setProducts(data.products);
          }
        }
      } catch {
        // Fallback to local state
      }

      try {
        const couponRes = await fetch('/api/coupons');
        if (couponRes.ok) {
          const couponData = await couponRes.json();
          if (Array.isArray(couponData.coupons) && couponData.coupons.length > 0) {
            setCoupons(couponData.coupons);
          }
        }
      } catch {
        // Fallback to local state
      }

      try {
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.settings) {
            setSettings(settingsData.settings);
          }
        }
      } catch {
        // Fallback to local state
      }

      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token && token !== 'null' && token !== 'undefined') {
        try {
          const ordersRes = await fetch('/api/orders', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          });
          if (ordersRes.ok) {
            const ordersData = await ordersRes.json();
            if (Array.isArray(ordersData.orders)) {
              setOrders(ordersData.orders);
            }
          }
        } catch {
          // Fallback to local state
        }

        try {
          const addrRes = await fetch('/api/addresses', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          });
          if (addrRes.ok) {
            const addrData = await addrRes.json();
            if (Array.isArray(addrData.addresses)) {
              setAddresses(addrData.addresses);
            }
          }
        } catch {
          // Fallback to local state
        }
      }
    };

    verifyBackendSession();
    syncBackendData();
  }, []);

  // Browser Back / Forward (popstate) route protection
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetPage: PageView = event.state?.page || pathToPage(window.location.pathname);

      // Prevent logged-out user from pressing Back to access protected pages
      if (targetPage === 'profile' && !currentUserRef.current) {
        window.history.replaceState({ page: 'home' }, '', '/');
        setCurrentPage('home');
        setAuthModalOpen(true);
        return;
      }

      if (targetPage === 'admin' && (!currentUserRef.current || currentUserRef.current.role !== 'admin')) {
        window.history.replaceState({ page: 'home' }, '', '/');
        setCurrentPage('home');
        setAuthModalOpen(true);
        return;
      }

      setCurrentPage(targetPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync to local storage on changes
  useEffect(() => {
    // Only cache up to 100 items in localStorage to avoid browser quota limits
    safeSetStorage(STORAGE_KEYS.PRODUCTS, products.slice(0, 100));
  }, [products]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.CATEGORIES, categories);
  }, [categories]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.CART, cart);
  }, [cart]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.WISHLIST, wishlistIds);
  }, [wishlistIds]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch {
      // ignore storage errors
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
      }
    } catch {
      // ignore storage errors
    }
  }, [addresses, currentUser]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.COUPONS, coupons);
  }, [coupons]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.REVIEWS, reviews);
  }, [reviews]);

  // Scroll to top & sync URL history on navigation
  const navigateTo = (
    page: PageView,
    options?: {
      productId?: string;
      categoryId?: string;
      search?: string;
      priceFilter?: { min?: number; max?: number; label?: string } | null;
      replace?: boolean;
    }
  ) => {
    // Route protection for Profile when logged out
    if (page === 'profile' && !currentUserRef.current) {
      setAuthModalOpen(true);
      setCurrentPage('home');
      try {
        window.history.replaceState({ page: 'home' }, '', '/');
      } catch {
        // ignore history error
      }
      return;
    }

    setCurrentPage(page);
    if (options?.productId) {
      setSelectedProductId(options.productId);
    }
    if (options?.categoryId !== undefined) {
      setSelectedCategoryFilter(options.categoryId);
    }
    if (options?.search !== undefined) {
      setActiveSearchQuery(options.search);
    }
    if (options?.priceFilter !== undefined) {
      setActivePriceFilter(options.priceFilter);
      if (options?.categoryId === undefined) {
        setSelectedCategoryFilter(null);
      }
    }

    try {
      const targetPath = pageToPath(page);
      if (options?.replace) {
        window.history.replaceState({ page }, '', targetPath);
      } else if (window.location.pathname !== targetPath) {
        window.history.pushState({ page }, '', targetPath);
      }
    } catch {
      // ignore history errors
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Price formatting
  const formatPrice = (amount: number): string => {
    if (settings.currency === 'USD') {
      const inUSD = amount / settings.currencyRate;
      return `$${inUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Product management
  const addProduct = (newProd: Omit<Product, 'id' | 'slug'>) => {
    const id = `prod-${Date.now()}`;
    const slug = newProd.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const primaryImage =
      Array.isArray(newProd.images) && newProd.images.length > 0
        ? newProd.images[0]
        : 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';
    const fullProduct: Product = {
      ...newProd,
      images: [primaryImage],
      id,
      slug,
    };
    setProducts((prev) => [fullProduct, ...prev]);

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(fullProduct),
      }).catch(() => {});
    }

    addToast('Product Added', `${fullProduct.name} has been added to catalog.`, 'success');
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const normalizedUpdates = updates.images?.length
      ? { ...updates, images: [updates.images[0]] }
      : updates;

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...normalizedUpdates } : p)));

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(normalizedUpdates),
      }).catch(() => {});
    }

    addToast('Product Updated', 'Changes saved successfully.', 'success');
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {});
    }

    addToast('Product Deleted', 'Item removed from store.', 'info');
  };

  const restockProduct = (id: string, amount: number = 25) => {
    const existing = products.find((p) => p.id === id);
    const newQty = (existing ? existing.stockQuantity : 0) + amount;
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stockQuantity: p.stockQuantity + amount, inStock: true } : p))
    );

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ stockQuantity: newQty, inStock: true }),
      }).catch(() => {});
    }

    addToast('Stock Replenished', `Added +${amount} units to inventory.`, 'success');
  };

  const getProductById = (id: string) => {
    return products.find((p) => p.id === id);
  };

  const bulkDeleteProducts = (ids: string[]) => {
    const idSet = new Set(ids);
    setProducts((prev) => prev.filter((p) => !idSet.has(p.id)));

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      }).catch(() => {});
    }

    addToast('Bulk Deleted', `Removed ${ids.length} products from store.`, 'info');
  };

  const bulkUpdateCategory = (ids: string[], categoryId: string) => {
    const idSet = new Set(ids);
    setProducts((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, categoryId, updatedAt: new Date().toISOString() } : p))
    );

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ ids, updates: { categoryId } }),
      }).catch(() => {});
    }

    addToast('Category Updated', `Updated category for ${ids.length} products.`, 'success');
  };

  const bulkUpdateStatus = (ids: string[], status: 'active' | 'draft' | 'archived') => {
    const idSet = new Set(ids);
    setProducts((prev) =>
      prev.map((p) =>
        idSet.has(p.id)
          ? { ...p, status, inStock: status === 'active' && p.stockQuantity > 0, updatedAt: new Date().toISOString() }
          : p
      )
    );

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ ids, updates: { status } }),
      }).catch(() => {});
    }

    addToast('Status Updated', `Updated status to ${status} for ${ids.length} products.`, 'success');
  };

  const bulkUpdateMarkup = (ids: string[], markupType: 'percent' | 'fixed', value: number) => {
    const idSet = new Set(ids);
    setProducts((prev) =>
      prev.map((p) => {
        if (!idSet.has(p.id)) return p;
        const cost = p.costPrice || p.price;
        const newSellingPrice = markupType === 'percent' ? Math.round(cost * (1 + value / 100)) : cost + value;
        const profitAmount = newSellingPrice - cost;
        const profitPercentage = cost > 0 ? Math.round((profitAmount / cost) * 100) : 0;
        const originalPrice = Math.max(newSellingPrice, p.originalPrice);
        const discountPercent =
          originalPrice > newSellingPrice ? Math.round(((originalPrice - newSellingPrice) / originalPrice) * 100) : 0;

        return {
          ...p,
          price: newSellingPrice,
          profitAmount,
          profitPercentage,
          originalPrice,
          discountPercent,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ ids, updates: { markupType, markupValue: value } }),
      }).catch(() => {});
    }

    addToast('Prices Updated', `Adjusted profit markup for ${ids.length} products.`, 'success');
  };

  const importProducts = (newProductsList: (Omit<Product, 'id' | 'slug'> & { id?: string; slug?: string })[]) => {
    let importedCount = 0;
    let updatedCount = 0;

    setProducts((prev) => {
      const updated = [...prev];
      newProductsList.forEach((item) => {
        const primaryImg =
          Array.isArray(item.images) && item.images.length > 0
            ? item.images[0]
            : 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';

        const existingIdx = updated.findIndex(
          (p) =>
            (item.sourceProductId && p.sourceProductId === item.sourceProductId) ||
            (item.sku && p.sku && p.sku === item.sku) ||
            (item.id && p.id === item.id)
        );

        if (existingIdx >= 0) {
          updatedCount++;
        } else {
          const id = item.id || `prod-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          updated.unshift({
            ...item,
            images: [primaryImg],
            id,
            slug,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedCount++;
        }
      });
      return updated;
    });

    addToast(
      'Import Complete',
      `Imported ${importedCount} new items (${updatedCount} already in store).`,
      'success'
    );

    return { imported: importedCount, updated: updatedCount };
  };

  const resetToDefaultCatalog = () => {
    // Protect imported production products — never wipe imported items
    setProducts((prev) => {
      const importedOnly = prev.filter((p) => p.isImported || p.sourceProductId);
      return importedOnly.length > 0 ? importedOnly : INITIAL_PRODUCTS;
    });
    addToast('Catalog Synced', 'Verified production catalog.', 'info');
  };

  // Reviews
  const addReview = (productId: string, rating: number, title: string, comment: string) => {
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      productId,
      userName: currentUser?.name || 'Verified Customer',
      rating,
      title,
      comment,
      date: 'Just now',
      verifiedPurchase: true,
    };
    setReviews((prev) => [newRev, ...prev]);

    const prodReviews = reviews.filter((r) => r.productId === productId).concat(newRev);
    const avg = prodReviews.reduce((sum, r) => sum + r.rating, 0) / prodReviews.length;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, rating: parseFloat(avg.toFixed(1)), reviewCount: p.reviewCount + 1 } : p
      )
    );

    addToast('Review Submitted', 'Thank you for your feedback!', 'success');
  };

  const getProductReviews = (productId: string) => {
    return reviews.filter((r) => r.productId === productId);
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1, color?: string) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === product.id && item.selectedColor === color
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          selectedColor: color || product.colors?.[0]?.name,
          quantity,
        },
      ];
    });

    addToast('Added to Cart', `${product.name} (${quantity}) added to bag.`, 'success');
  };

  const updateCartQty = (productId: string, quantity: number, color?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, color);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId && item.selectedColor === color ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string, color?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.selectedColor === color))
    );
    addToast('Item Removed', 'Product removed from shopping cart.', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (cartSubtotal < appliedCoupon.minSpend) return 0;

    if (appliedCoupon.discountType === 'percentage') {
      return Math.round((cartSubtotal * appliedCoupon.discountValue) / 100);
    }
    return Math.min(appliedCoupon.discountValue, cartSubtotal);
  }, [cartSubtotal, appliedCoupon]);

  const cartShipping = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    if (cartSubtotal >= settings.freeShippingThreshold) return 0;
    return settings.standardShippingFee;
  }, [cartSubtotal, settings]);

  const cartTax = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    const taxableAmount = Math.max(0, cartSubtotal - cartDiscount);
    return Math.round(taxableAmount * settings.taxRate);
  }, [cartSubtotal, cartDiscount, settings.taxRate]);

  const cartTotal = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    return Math.max(0, cartSubtotal - cartDiscount + cartShipping + cartTax);
  }, [cartSubtotal, cartDiscount, cartShipping, cartTax]);

  // Wishlist
  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        addToast('Removed from Wishlist', 'Item removed from your saved list.', 'info');
        return prev.filter((id) => id !== productId);
      } else {
        addToast('Added to Wishlist', 'Item saved to your wishlist!', 'success');
        return [...prev, productId];
      }
    });
  };

  const isWishlisted = (productId: string) => wishlistIds.includes(productId);

  const wishlistCount = wishlistIds.length;

  const wishlistProducts = useMemo(() => {
    return products.filter((p) => wishlistIds.includes(p.id));
  }, [products, wishlistIds]);

  // Coupons
  const applyCoupon = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === trimmed && c.isActive);

    if (!found) {
      return { success: false, message: 'Invalid or expired coupon code.' };
    }
    if (cartSubtotal < found.minSpend) {
      return {
        success: false,
        message: `This coupon requires a minimum spend of ${formatPrice(found.minSpend)}.`,
      };
    }

    setAppliedCoupon(found);
    addToast(
      'Coupon Applied!',
      `Saved ${found.discountValue}${found.discountType === 'percentage' ? '%' : ''} on your order.`,
      'success'
    );
    return { success: true, message: `Coupon ${found.code} applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    addToast('Coupon Removed', 'Promo code removed from cart.', 'info');
  };

  const addCoupon = (newCoupon: Omit<Coupon, 'id' | 'usageCount'>) => {
    const id = `coupon-${Date.now()}`;
    const fullCoupon: Coupon = {
      ...newCoupon,
      id,
      usageCount: 0,
    };
    setCoupons((prev) => [fullCoupon, ...prev]);

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(fullCoupon),
      }).catch(() => {});
    }

    addToast('Coupon Created', `Promo code ${fullCoupon.code} is now active.`, 'success');
  };

  const deleteCoupon = (id: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    if (appliedCoupon?.id === id) {
      setAppliedCoupon(null);
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`/api/coupons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {});
    }

    addToast('Coupon Deleted', 'Coupon removed from store.', 'info');
  };

  // Auth & Profile (Backed by Real Server Session, Password Hashing & Token Revocation)
  const login = async (
    email: string,
    _role: 'customer' | 'admin' = 'customer',
    password?: string
  ): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        addToast('Sign In Failed', 'Please enter both your email address and password.', 'error');
        return false;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast('Sign In Failed', errData.message || 'Invalid email or password.', 'error');
        return false;
      }

      const data = await res.json();
      const verifiedRole: 'customer' | 'admin' = data.user?.role === 'admin' ? 'admin' : 'customer';

      const user: User = {
        id: data.user?.id || (verifiedRole === 'admin' ? 'usr-admin' : `usr-${Date.now()}`),
        name:
          data.user?.name ||
          (verifiedRole === 'admin' ? 'Store Administrator' : 'Popcarty User'),
        email: data.user?.email || cleanEmail,
        phone: data.user?.phone || '+91 98765 43210',
        role: verifiedRole,
        memberSince: data.user?.memberSince || 'October 2026',
        avatar:
          verifiedRole === 'admin'
            ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      };

      if (data.token) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        } catch {
          // ignore storage error
        }
      }

      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } catch {
        // ignore storage error
      }

      currentUserRef.current = user;
      setCurrentUser(user);

      // Sync user orders and addresses from backend
      if (data.token) {
        fetch('/api/orders', {
          headers: { Authorization: `Bearer ${data.token}` },
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.orders)) setOrders(d.orders);
          })
          .catch(() => {});

        fetch('/api/addresses', {
          headers: { Authorization: `Bearer ${data.token}` },
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.addresses)) setAddresses(d.addresses);
          })
          .catch(() => {});
      }

      setAuthModalOpen(false);
      addToast('Signed In', `Welcome back, ${user.name}!`, 'success');
      return true;
    } catch (err: any) {
      addToast('Sign In Error', err?.message || 'Unable to connect to authentication server.', 'error');
      return false;
    }
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          password: password || '',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast('Registration Failed', errData.message || 'Unable to create account.', 'error');
        return false;
      }

      const data = await res.json();
      const user: User = {
        id: data.user?.id || `usr-${Date.now()}`,
        name: data.user?.name || name.trim() || 'Popcarty User',
        email: data.user?.email || cleanEmail,
        phone: data.user?.phone || phone.trim(),
        role: 'customer',
        memberSince: data.user?.memberSince || 'October 2026',
      };

      if (data.token) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        } catch {
          // ignore storage error
        }
      }

      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } catch {
        // ignore storage error
      }

      currentUserRef.current = user;
      setCurrentUser(user);
      setAddresses([]);
      setAuthModalOpen(false);
      addToast('Account Created', 'Welcome to Popcarty! Your account is ready.', 'success');
      return true;
    } catch (err: any) {
      addToast('Registration Error', err?.message || 'Unable to create account.', 'error');
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    if (isLoggingOut) return false;
    setIsLoggingOut(true);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!res.ok) {
        setIsLoggingOut(false);
        addToast('Sign Out Failed', 'Could not terminate session on server. Please try again.', 'error');
        return false;
      }

      // 1. Clear all tokens, localStorage & sessionStorage auth state
      clearStoredAuthToken();
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
        sessionStorage.clear();
      } catch {
        // ignore storage error
      }

      // 2. Clear in-memory authenticated user state & private caches
      currentUserRef.current = null;
      setCurrentUser(null);
      setAddresses([]);
      setAppliedCoupon(null);

      // 3. Redirect to public home page & replace browser history entry so Back cannot reopen protected pages
      setCurrentPage('home');
      try {
        window.history.replaceState({ page: 'home', signedOut: true }, '', '/');
      } catch {
        // ignore history error
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

      addToast('Signed Out', 'You have been logged out safely.', 'info');
      setIsLoggingOut(false);
      return true;
    } catch {
      setIsLoggingOut(false);
      addToast('Sign Out Failed', 'Network error while signing out. Please try again.', 'error');
      return false;
    }
  };

  const updateProfile = (name: string, email: string, phone: string) => {
    if (!currentUser) return;
    const updatedUser: User = {
      ...currentUser,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
    };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
        }),
      }).catch(() => {});
    }

    addToast('Profile Saved', 'Your account details have been updated.', 'success');
  };

  const syncAddressesWithBackend = (nextAddresses: Address[]) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch('/api/addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ addresses: nextAddresses }),
      }).catch(() => {});
    }
  };

  // Addresses
  const addAddress = (addr: Omit<Address, 'id' | 'userId'>) => {
    if (!currentUser) return;
    const newAddr: Address = {
      ...addr,
      id: `addr-${Date.now()}`,
      userId: currentUser.id,
    };
    setAddresses((prev) => {
      const next = newAddr.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false })).concat(newAddr)
        : [...prev, newAddr];
      syncAddressesWithBackend(next);
      return next;
    });
    addToast('Address Saved', 'New delivery address added.', 'success');
  };

  const updateAddress = (id: string, updates: Partial<Address>) => {
    if (!currentUser) return;
    setAddresses((prev) => {
      const next = prev.map((a) => {
        if (a.id === id) {
          return { ...a, ...updates };
        }
        if (updates.isDefault) {
          return { ...a, isDefault: false };
        }
        return a;
      });
      syncAddressesWithBackend(next);
      return next;
    });
    addToast('Address Updated', 'Changes saved successfully.', 'success');
  };

  const deleteAddress = (id: string) => {
    if (!currentUser) return;
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      syncAddressesWithBackend(next);
      return next;
    });
    addToast('Address Deleted', 'Address removed from book.', 'info');
  };

  const setDefaultAddress = (id: string) => {
    if (!currentUser) return;
    setAddresses((prev) => {
      const next = prev.map((a) => ({ ...a, isDefault: a.id === id }));
      syncAddressesWithBackend(next);
      return next;
    });
    addToast('Default Address Set', 'Default shipping location updated.', 'success');
  };

  // Orders
  const createOrder = (orderData: {
    shippingAddress: Address;
    shippingMethod: 'standard';
    paymentMethod: 'card' | 'apple_pay' | 'upi';
  }): Order => {
    const orderNumber = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const shippingFee = cartShipping;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      userId: currentUser?.id || 'guest',
      customerName: currentUser?.name || orderData.shippingAddress.name,
      customerEmail: currentUser?.email || 'customer@example.com',
      customerPhone: currentUser?.phone || orderData.shippingAddress.phone,
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        productImage: item.product.images[0],
        brand: item.product.brand,
        color: item.selectedColor,
        price: item.product.price,
        quantity: item.quantity,
      })),
      shippingAddress: orderData.shippingAddress,
      shippingMethod: 'standard',
      shippingCost: shippingFee,
      subtotal: cartSubtotal,
      discountAmount: cartDiscount,
      couponCode: appliedCoupon?.code,
      tax: cartTax,
      totalAmount: Math.max(0, cartSubtotal - cartDiscount + shippingFee + cartTax),
      paymentMethod: orderData.paymentMethod,
      paymentStatus: 'paid',
      orderStatus: 'placed',
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: `Order placed via ${orderData.paymentMethod.toUpperCase()}`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(newOrder),
    }).catch(() => {});

    // Deduct stock
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((c) => c.productId === p.id);
        if (cartMatch) {
          const newQty = Math.max(0, p.stockQuantity - cartMatch.quantity);
          return { ...p, stockQuantity: newQty, inStock: newQty > 0 };
        }
        return p;
      })
    );

    // Save order
    setOrders((prev) => [newOrder, ...prev]);

    // Update coupon usage
    if (appliedCoupon) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === appliedCoupon.id ? { ...c, usageCount: c.usageCount + 1 } : c))
      );
    }

    // Add notification
    const orderNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `Order #${newOrder.orderNumber} Confirmed`,
      message: `Your payment was processed. Tracking will update once shipped.`,
      timestamp: 'Just now',
      read: false,
      type: 'order',
    };
    setNotifications((prev) => [orderNotif, ...prev]);

    // Clear cart and coupon
    clearCart();
    setAppliedCoupon(null);

    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newHistory = [
            ...o.statusHistory,
            {
              status,
              timestamp,
              note: note || `Status updated to ${status.replace(/_/g, ' ')}`,
            },
          ];
          return {
            ...o,
            orderStatus: status,
            statusHistory: newHistory,
          };
        }
        return o;
      })
    );

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ status }),
      }).catch(() => {});
    }

    addToast('Order Status Updated', `Order ${orderId} is now ${status}.`, 'info');
  };

  // Strictly return empty array when logged out — never leak orders to unauthenticated state
  const userOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter(
      (o) =>
        o.userId === currentUser.id ||
        o.customerEmail?.toLowerCase() === currentUser.email.toLowerCase()
    );
  }, [orders, currentUser]);

  const getOrderById = (orderId: string) => {
    if (!currentUser) return undefined;
    return orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('All Caught Up', 'All notifications marked as read.', 'info');
  };

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Settings
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify(updated),
        }).catch(() => {});
      }
      return updated;
    });
    addToast('Settings Saved', 'Store configuration updated.', 'success');
  };

  return (
    <StoreContext.Provider
      value={{
        currentPage,
        navigateTo,
        selectedProductId,
        selectedCategoryFilter,
        activeSearchQuery,
        setActiveSearchQuery,
        activePriceFilter,
        setActivePriceFilter,
        products,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        restockProduct,
        getProductById,
        bulkDeleteProducts,
        bulkUpdateCategory,
        bulkUpdateStatus,
        bulkUpdateMarkup,
        importProducts,
        resetToDefaultCatalog,
        reviews,
        addReview,
        getProductReviews,
        cart,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotal,
        cartDiscount,
        cartShipping,
        cartTax,
        cartTotal,
        wishlistIds,
        toggleWishlist,
        isWishlisted,
        wishlistCount,
        wishlistProducts,
        coupons,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        addCoupon,
        deleteCoupon,
        currentUser,
        isLoggedIn: !!currentUser,
        isAdmin: currentUser?.role === 'admin',
        isLoggingOut,
        login,
        register,
        logout,
        updateProfile,
        addresses: currentUser ? addresses : [],
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        orders: currentUser?.role === 'admin' ? orders : userOrders,
        createOrder,
        updateOrderStatus,
        userOrders,
        getOrderById,
        settings,
        updateSettings,
        formatPrice,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        unreadNotificationsCount,
        isSearchModalOpen,
        setSearchModalOpen,
        isCartDrawerOpen,
        setCartDrawerOpen,
        isAuthModalOpen,
        setAuthModalOpen,
        quickViewProduct,
        setQuickViewProduct,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

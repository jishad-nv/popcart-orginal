import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Product,
  Category,
  CartItem,
  User,
  Address,
  Order,
  OrderStatus,
  PaymentMethodType,
  PaymentStatusType,
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
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  getDocsFromCache,
  getDoc,
  getDocFromCache,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function isQuotaExceededError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as any)?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted')
  );
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaExceededError(error)) {
    // Gracefully fallback to local/cached state when Firebase free tier daily read quota is exhausted
    console.warn(`[Firestore] Free-tier daily quota reached for ${operationType} on "${path}". Using cached store data.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Helper to recursively strip `undefined` properties before writing to Firestore
function cleanFirestorePayload<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

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
  bulkUpdateFlags: (
    ids: string[],
    flags: { isTrending?: boolean; isFeatured?: boolean; isNewArrival?: boolean }
  ) => void;
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
  addToCart: (product: Product, quantity?: number, color?: string, size?: string, variantTitle?: string) => void;
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
  addAddress: (addr: Omit<Address, 'id' | 'userId'>) => Address;
  updateAddress: (id: string, updates: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  // Orders
  orders: Order[];
  createOrder: (orderData: {
    shippingAddress: Address;
    shippingMethod: 'standard';
    paymentMethod: PaymentMethodType;
  }) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  updateOrderMetadata: (
    orderId: string,
    updates: {
      paymentStatus?: PaymentStatusType;
      trackingNumber?: string;
      courierName?: string;
      adminNotes?: string;
    }
  ) => Promise<void>;
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
  PRODUCTS_SYNC_AT: 'auracart_products_sync_at_v1',
  CATEGORIES: 'auracart_categories_v4',
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

  // Strict Initial Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (!savedUser || savedUser === 'null' || savedUser === 'undefined') {
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
      return 'admin';
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
    currentUser ? loadStorage(`${STORAGE_KEYS.ADDRESSES}_${currentUser.id}`, loadStorage(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES)) : []
  );
  const [orders, setOrders] = useState<Order[]>(() => loadStorage(STORAGE_KEYS.ORDERS, []));
  const [coupons, setCoupons] = useState<Coupon[]>(() => loadStorage(STORAGE_KEYS.COUPONS, INITIAL_COUPONS));
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(() => loadStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    loadStorage(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)
  );
  const [reviews, setReviews] = useState<Review[]>(() => loadStorage(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS));

  // Firebase Auth, Products & Settings Sync on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const target = pathToPage(window.location.pathname);
      if (target === 'profile' && !currentUserRef.current) {
        window.history.replaceState({ page: 'home' }, '', '/');
        setCurrentPage('home');
        setAuthModalOpen(true);
      }
    }

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = (firebaseUser.email || '').toLowerCase();
        const isAdminUser = userEmail === 'popcarty7@gmail.com';
        // Preserve user's locally saved name/phone if they updated their profile
        const existingLocal = loadStorage<User | null>(STORAGE_KEYS.USER, null);
        const user: User = {
          id: firebaseUser.uid,
          name:
            firebaseUser.displayName ||
            (existingLocal?.id === firebaseUser.uid ? existingLocal.name : '') ||
            (isAdminUser ? 'Store Administrator' : 'Popcarty Customer'),
          email: userEmail,
          phone:
            firebaseUser.phoneNumber ||
            (existingLocal?.id === firebaseUser.uid ? existingLocal.phone : '') ||
            '',
          role: isAdminUser ? 'admin' : 'customer',
          memberSince: 'October 2026',
          avatar: isAdminUser
            ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        };
        currentUserRef.current = user;
        setCurrentUser(user);
        safeSetStorage(STORAGE_KEYS.USER, user);

        // Load user-specific saved addresses
        const userAddrs = loadStorage<Address[]>(
          `${STORAGE_KEYS.ADDRESSES}_${user.id}`,
          loadStorage(STORAGE_KEYS.ADDRESSES, [])
        );
        setAddresses(Array.isArray(userAddrs) ? userAddrs : []);
      } else {
        currentUserRef.current = null;
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    });

    const loadFirestoreProducts = async () => {
      const productsCol = collection(db, 'products');

      // 1. First try reading from persistent IndexedDB Firestore cache (0 daily read quota consumed)
      try {
        const cachedSnap = await getDocsFromCache(productsCol);
        if (!cachedSnap.empty) {
          const cachedProds: Product[] = [];
          cachedSnap.forEach((docSnap) => {
            cachedProds.push(docSnap.data() as Product);
          });
          if (cachedProds.length > 0) {
            setProducts(cachedProds);
            const lastSync = Number(localStorage.getItem(STORAGE_KEYS.PRODUCTS_SYNC_AT) || 0);
            const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
            // Skip full-collection server read if synced within the last 6 hours
            if (Date.now() - lastSync < SIX_HOURS_MS) {
              return;
            }
          }
        }
      } catch {
        // Cache miss or unavailable; fall through to network fetch
      }

      // 2. Fetch from Firestore server if cache was empty or stale
      try {
        const querySnapshot = await getDocs(productsCol);
        if (!querySnapshot.empty) {
          const prods: Product[] = [];
          querySnapshot.forEach((docSnap) => {
            prods.push(docSnap.data() as Product);
          });
          if (prods.length > 0) {
            setProducts(prods);
            try {
              localStorage.setItem(STORAGE_KEYS.PRODUCTS_SYNC_AT, String(Date.now()));
            } catch {}
          }
        } else {
          setProducts((prev) => (prev.length > 0 ? prev : INITIAL_PRODUCTS));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    };

    const loadFirestoreSettings = async () => {
      const settingsRef = doc(db, 'settings', 'storefront');
      try {
        const cachedSnap = await getDocFromCache(settingsRef).catch(() => null);
        if (cachedSnap && cachedSnap.exists()) {
          const cachedData = cachedSnap.data() as Partial<StoreSettings>;
          setSettings((prev) => ({
            ...prev,
            ...cachedData,
            announcementBar: {
              ...prev.announcementBar,
              ...(cachedData.announcementBar || {}),
            },
            homepageConfig: {
              ...(prev.homepageConfig || {}),
              ...(cachedData.homepageConfig || {}),
            },
          }));
        }

        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<StoreSettings>;
          setSettings((prev) => ({
            ...prev,
            ...data,
            announcementBar: {
              ...prev.announcementBar,
              ...(data.announcementBar || {}),
            },
            homepageConfig: {
              ...(prev.homepageConfig || {}),
              ...(data.homepageConfig || {}),
            },
          }));
        }
      } catch {
        // Fallback to local settings when quota is reached or offline
      }
    };

    loadFirestoreProducts();
    loadFirestoreSettings();
    return () => unsubAuth();
  }, []);

  // Real-time Orders Listener from Firestore "orders" collection
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const ordersRef = collection(db, 'orders');
    const q =
      currentUser.role === 'admin'
        ? ordersRef
        : query(ordersRef, where('userId', '==', currentUser.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          if (data && data.orderNumber) {
            fetchedOrders.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });

        // Sort newest first by createdAt
        fetchedOrders.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

        setOrders((prev) => {
          // Merge any local orders that might not yet be synced
          const map = new Map<string, Order>();
          fetchedOrders.forEach((o) => map.set(o.orderNumber, o));
          prev.forEach((o) => {
            if (!map.has(o.orderNumber)) {
              if (currentUser.role === 'admin' || o.userId === currentUser.id) {
                map.set(o.orderNumber, o);
              }
            }
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          return merged;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role]);

  // Browser Back / Forward (popstate) route protection
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetPage: PageView = event.state?.page || pathToPage(window.location.pathname);

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
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(`${STORAGE_KEYS.ADDRESSES}_${currentUser.id}`, JSON.stringify(addresses));
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
      }
    } catch {}
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
    if (page === 'profile' && !currentUserRef.current) {
      setAuthModalOpen(true);
      setCurrentPage('home');
      try {
        window.history.replaceState({ page: 'home' }, '', '/');
      } catch {}
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
    } catch {}

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

  // Product management with Firestore (preserving multiple product images)
  const addProduct = async (newProd: Omit<Product, 'id' | 'slug'>) => {
    const id = `prod-${Date.now()}`;
    const slug = newProd.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const cleanImages =
      Array.isArray(newProd.images) && newProd.images.filter(Boolean).length > 0
        ? newProd.images.filter(Boolean)
        : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'];
    const fullProduct: Product = {
      ...newProd,
      images: cleanImages,
      id,
      slug,
    };
    setProducts((prev) => [fullProduct, ...prev]);

    try {
      await setDoc(doc(db, 'products', id), cleanFirestorePayload(fullProduct));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `products/${id}`);
    }

    addToast('Product Added', `${fullProduct.name} has been added to catalog.`, 'success');
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const normalizedUpdates =
      Array.isArray(updates.images) && updates.images.filter(Boolean).length > 0
        ? { ...updates, images: updates.images.filter(Boolean) }
        : updates;

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...normalizedUpdates } : p)));

    try {
      await updateDoc(doc(db, 'products', id), cleanFirestorePayload(normalizedUpdates));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `products/${id}`);
    }

    addToast('Product Updated', 'Changes saved to Firestore.', 'success');
  };

  const deleteProduct = async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));

    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }

    addToast('Product Deleted', 'Item removed from store.', 'info');
  };

  const restockProduct = async (id: string, amount: number = 25) => {
    const existing = products.find((p) => p.id === id);
    const newQty = (existing ? existing.stockQuantity : 0) + amount;
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stockQuantity: p.stockQuantity + amount, inStock: true } : p))
    );

    try {
      await updateDoc(doc(db, 'products', id), {
        stockQuantity: newQty,
        inStock: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `products/${id}`);
    }

    addToast('Stock Replenished', `Added +${amount} units to inventory.`, 'success');
  };

  const getProductById = (id: string) => {
    return products.find((p) => p.id === id);
  };

  const bulkDeleteProducts = async (ids: string[]) => {
    const idSet = new Set(ids);
    setProducts((prev) => prev.filter((p) => !idSet.has(p.id)));

    try {
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = writeBatch(db);
        ids.slice(i, i + chunkSize).forEach((id) => {
          batch.delete(doc(db, 'products', id));
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'products/bulk');
    }

    addToast('Bulk Deleted', `Removed ${ids.length} products from store.`, 'info');
  };

  const bulkUpdateCategory = async (ids: string[], categoryId: string) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, categoryId, updatedAt: now } : p))
    );

    try {
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = writeBatch(db);
        ids.slice(i, i + chunkSize).forEach((id) => {
          batch.update(doc(db, 'products', id), { categoryId, updatedAt: now });
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products/bulk-category');
    }

    addToast('Category Updated', `Updated category for ${ids.length} products.`, 'success');
  };

  const bulkUpdateStatus = async (ids: string[], status: 'active' | 'draft' | 'archived') => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) =>
        idSet.has(p.id)
          ? { ...p, status, inStock: status === 'active' && p.stockQuantity > 0, updatedAt: now }
          : p
      )
    );

    try {
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = writeBatch(db);
        ids.slice(i, i + chunkSize).forEach((id) => {
          batch.update(doc(db, 'products', id), { status, updatedAt: now });
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products/bulk-status');
    }

    addToast('Status Updated', `Updated status to ${status} for ${ids.length} products.`, 'success');
  };

  const bulkUpdateMarkup = async (ids: string[], markupType: 'percent' | 'fixed', value: number) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatedProductsMap = new Map<string, Partial<Product>>();

    setProducts((prev) =>
      prev.map((p) => {
        if (!idSet.has(p.id)) return p;
        const cost = p.costPrice || p.price;
        const rawSellingPrice = markupType === 'percent' ? Math.round(cost * (1 + value / 100)) : cost + value;
        const newSellingPrice = Math.max(9, Math.round(rawSellingPrice / 10) * 10 - 1);
        const profitAmount = newSellingPrice - cost;
        const profitPercentage = cost > 0 ? Math.round((profitAmount / cost) * 100) : 0;
        const originalPrice = Math.max(newSellingPrice, p.originalPrice);
        const discountPercent =
          originalPrice > newSellingPrice ? Math.round(((originalPrice - newSellingPrice) / originalPrice) * 100) : 0;

        const patch: Partial<Product> = {
          price: newSellingPrice,
          profitAmount,
          profitPercentage,
          originalPrice,
          discountPercent,
          updatedAt: now,
        };
        updatedProductsMap.set(p.id, patch);

        return {
          ...p,
          ...patch,
        };
      })
    );

    try {
      const entries = Array.from(updatedProductsMap.entries());
      const chunkSize = 400;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const batch = writeBatch(db);
        entries.slice(i, i + chunkSize).forEach(([id, patch]) => {
          batch.update(doc(db, 'products', id), patch);
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products/bulk-markup');
    }

    addToast('Prices Updated', `Adjusted profit markup for ${ids.length} products.`, 'success');
  };

  const bulkUpdateFlags = async (
    ids: string[],
    flags: { isTrending?: boolean; isFeatured?: boolean; isNewArrival?: boolean }
  ) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, ...flags, updatedAt: now } : p))
    );

    try {
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = writeBatch(db);
        ids.slice(i, i + chunkSize).forEach((id) => {
          batch.update(doc(db, 'products', id), cleanFirestorePayload({ ...flags, updatedAt: now }));
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products/bulk-flags');
    }

    addToast('Homepage Placement Updated', `Updated ${ids.length} products.`, 'success');
  };

  const importProducts = (newProductsList: (Omit<Product, 'id' | 'slug'> & { id?: string; slug?: string })[]) => {
    let importedCount = 0;
    let updatedCount = 0;

    setProducts((prev) => {
      const updated = [...prev];
      newProductsList.forEach((item) => {
        const cleanImages =
          Array.isArray(item.images) && item.images.filter(Boolean).length > 0
            ? item.images.filter(Boolean)
            : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'];

        const existingIdx = updated.findIndex(
          (p) =>
            (item.sourceProductId && p.sourceProductId === item.sourceProductId) ||
            (item.sku && p.sku && p.sku === item.sku) ||
            (item.id && p.id === item.id)
        );

        if (existingIdx >= 0) {
          const existing = updated[existingIdx];
          updated[existingIdx] = {
            ...existing,
            ...item,
            images: cleanImages,
            id: existing.id,
            slug: existing.slug,
            updatedAt: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          const id = item.id || `prod-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          updated.unshift({
            ...item,
            images: cleanImages,
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
      `Imported ${importedCount} new items (${updatedCount} updated in store).`,
      'success'
    );

    return { imported: importedCount, updated: updatedCount };
  };

  const resetToDefaultCatalog = () => {
    setProducts((prev) => {
      const importedOnly = prev.filter((p) => p.isImported || p.sourceProductId);
      return importedOnly.length > 0 ? importedOnly : INITIAL_PRODUCTS;
    });
    addToast('Catalog Synced', 'Verified production catalog.', 'info');
  };

  // Reviews
  const addReview = async (productId: string, rating: number, title: string, comment: string) => {
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      productId,
      userName: currentUser?.name || 'Verified Customer',
      rating,
      title,
      comment,
      date: new Date().toLocaleDateString(),
      verifiedPurchase: true,
    };
    setReviews((prev) => [newRev, ...prev]);

    try {
      await setDoc(doc(db, 'reviews', newRev.id), cleanFirestorePayload(newRev));
    } catch {}

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
  const addToCart = (
    product: Product,
    quantity = 1,
    color?: string,
    size?: string,
    variantTitle?: string
  ) => {
    setCart((prev) => {
      const targetColor = color || product.colors?.[0]?.name;
      const existingIndex = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          item.selectedColor === targetColor &&
          item.selectedSize === size
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
          selectedColor: targetColor,
          selectedSize: size,
          selectedVariantTitle: variantTitle || product.variants?.[0]?.title,
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

  const addCoupon = async (newCoupon: Omit<Coupon, 'id' | 'usageCount'>) => {
    const id = `coupon-${Date.now()}`;
    const fullCoupon: Coupon = {
      ...newCoupon,
      id,
      usageCount: 0,
    };
    setCoupons((prev) => [fullCoupon, ...prev]);

    try {
      await setDoc(doc(db, 'coupons', id), cleanFirestorePayload(fullCoupon));
    } catch {}

    addToast('Coupon Created', `Promo code ${fullCoupon.code} is now active.`, 'success');
  };

  const deleteCoupon = async (id: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    if (appliedCoupon?.id === id) {
      setAppliedCoupon(null);
    }

    try {
      await deleteDoc(doc(db, 'coupons', id));
    } catch {}

    addToast('Coupon Deleted', 'Coupon removed from store.', 'info');
  };

  // Auth & Profile (Backed by Firebase Authentication)
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

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userEmail = (cred.user.email || cleanEmail).toLowerCase();
      const isAdminUser = userEmail === 'popcarty7@gmail.com';

      const user: User = {
        id: cred.user.uid,
        name: cred.user.displayName || (isAdminUser ? 'Store Administrator' : 'Popcarty User'),
        email: userEmail,
        phone: cred.user.phoneNumber || '',
        role: isAdminUser ? 'admin' : 'customer',
        memberSince: 'October 2026',
        avatar: isAdminUser
          ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80'
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      };

      currentUserRef.current = user;
      setCurrentUser(user);
      safeSetStorage(STORAGE_KEYS.USER, user);
      setAuthModalOpen(false);
      addToast('Signed In', `Welcome back, ${user.name}!`, 'success');
      return true;
    } catch (err: any) {
      addToast('Sign In Failed', err?.message || 'Invalid email or password.', 'error');
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
      if (!password || password.length < 6) {
        addToast('Registration Failed', 'Password must be at least 6 characters long.', 'error');
        return false;
      }
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const isAdminUser = cleanEmail === 'popcarty7@gmail.com';
      const user: User = {
        id: cred.user.uid,
        name: name.trim() || 'Popcarty User',
        email: cleanEmail,
        phone: phone.trim(),
        role: isAdminUser ? 'admin' : 'customer',
        memberSince: 'October 2026',
      };

      currentUserRef.current = user;
      setCurrentUser(user);
      safeSetStorage(STORAGE_KEYS.USER, user);
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
      await signOut(auth);
      clearStoredAuthToken();
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
        sessionStorage.clear();
      } catch {}

      currentUserRef.current = null;
      setCurrentUser(null);
      setAddresses([]);
      setAppliedCoupon(null);

      setCurrentPage('home');
      try {
        window.history.replaceState({ page: 'home', signedOut: true }, '', '/');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });

      addToast('Signed Out', 'You have been logged out safely.', 'info');
      setIsLoggingOut(false);
      return true;
    } catch {
      setIsLoggingOut(false);
      addToast('Sign Out Failed', 'Could not sign out. Please try again.', 'error');
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
    safeSetStorage(STORAGE_KEYS.USER, updatedUser);

    addToast('Profile Saved', 'Your account details have been updated.', 'success');
  };

  // Addresses
  const addAddress = (addr: Omit<Address, 'id' | 'userId'>): Address => {
    const newAddr: Address = {
      ...addr,
      fullName: addr.fullName || addr.name,
      name: addr.name || addr.fullName || currentUser?.name || '',
      pincode: addr.pincode || addr.zipCode,
      zipCode: addr.zipCode || addr.pincode || '',
      id: `addr-${Date.now()}`,
      userId: currentUser?.id || 'guest',
    };
    setAddresses((prev) => {
      const next = newAddr.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false })).concat(newAddr)
        : [...prev, newAddr];
      return next;
    });
    addToast('Address Saved', 'New delivery address added.', 'success');
    return newAddr;
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
      return next;
    });
    addToast('Address Updated', 'Changes saved successfully.', 'success');
  };

  const deleteAddress = (id: string) => {
    if (!currentUser) return;
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    addToast('Address Deleted', 'Address removed from book.', 'info');
  };

  const setDefaultAddress = (id: string) => {
    if (!currentUser) return;
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    addToast('Default Address Set', 'Default shipping location updated.', 'success');
  };

  // Orders — Persisted in Firestore collection "orders" (doc id = orderNumber)
  const createOrder = async (orderData: {
    shippingAddress: Address;
    shippingMethod: 'standard';
    paymentMethod: PaymentMethodType;
  }): Promise<Order> => {
    const firebaseUid = auth.currentUser?.uid || currentUser?.id;
    if (!firebaseUid) {
      setAuthModalOpen(true);
      throw new Error('Please sign in to your account to place an order.');
    }

    const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const shippingFee = cartShipping;
    const nowIso = new Date().toISOString();

    const normalizedAddress: Address = {
      ...orderData.shippingAddress,
      fullName: orderData.shippingAddress.fullName || orderData.shippingAddress.name || currentUser?.name || '',
      name: orderData.shippingAddress.name || orderData.shippingAddress.fullName || currentUser?.name || '',
      phone: orderData.shippingAddress.phone || currentUser?.phone || '',
      houseNo: orderData.shippingAddress.houseNo || '',
      street: orderData.shippingAddress.street || '',
      area: orderData.shippingAddress.area || '',
      landmark: orderData.shippingAddress.landmark || '',
      city: orderData.shippingAddress.city || '',
      district: orderData.shippingAddress.district || '',
      state: orderData.shippingAddress.state || '',
      zipCode: orderData.shippingAddress.zipCode || orderData.shippingAddress.pincode || '',
      pincode: orderData.shippingAddress.pincode || orderData.shippingAddress.zipCode || '',
      country: orderData.shippingAddress.country || 'India',
    };

    const isCod = orderData.paymentMethod === 'cod';
    const paymentStatus: PaymentStatusType = isCod ? 'cod_pending' : 'paid';

    const newOrder: Order = {
      id: orderNumber,
      orderNumber,
      userId: firebaseUid,
      customerName: normalizedAddress.fullName || normalizedAddress.name || currentUser?.name || 'Popcarty Customer',
      customerEmail:
        orderData.shippingAddress.email ||
        auth.currentUser?.email ||
        currentUser?.email ||
        '',
      customerPhone: normalizedAddress.phone || currentUser?.phone || '',
      items: cart.map((item) => ({
        productId: item.productId,
        sourceProductId: item.product.sourceProductId || item.productId,
        supplierSku: (item.product as any).supplierSku || item.product.sku || '',
        sku: item.product.sku || (item.product as any).supplierSku || item.productId,
        productName: item.product.name,
        productImage: item.product.images[0] || '',
        brand: item.product.brand || 'Popcarty',
        color: item.selectedColor || '',
        size: item.selectedSize || '',
        variantTitle: item.selectedVariantTitle || item.selectedColor || 'Default',
        costPrice: item.product.costPrice || Math.round(item.product.price * 0.7),
        price: item.product.price,
        quantity: item.quantity,
      })),
      shippingAddress: normalizedAddress,
      shippingMethod: 'standard',
      shippingCost: shippingFee,
      subtotal: cartSubtotal,
      discountAmount: cartDiscount,
      couponCode: appliedCoupon?.code || '',
      tax: cartTax,
      totalAmount: Math.max(0, cartSubtotal - cartDiscount + shippingFee + cartTax),
      paymentMethod: orderData.paymentMethod,
      paymentStatus,
      orderStatus: 'placed',
      trackingNumber: '',
      courierName: '',
      adminNotes: '',
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date().toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          note: isCod
            ? 'Order placed via Cash on Delivery (COD)'
            : `Order placed & paid via ${orderData.paymentMethod.toUpperCase()}`,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Save complete order snapshot to Firestore collection "orders" with doc id = orderNumber
    try {
      await setDoc(doc(db, 'orders', orderNumber), cleanFirestorePayload(newOrder));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${orderNumber}`);
      if (!isQuotaExceededError(error)) {
        throw error;
      }
    }

    // Deduct stock locally
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

    // Save order in state
    setOrders((prev) => {
      if (prev.some((o) => o.orderNumber === newOrder.orderNumber)) return prev;
      return [newOrder, ...prev];
    });

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
      message: isCod
        ? 'Your Cash on Delivery order is confirmed and being prepared.'
        : 'Your payment was processed. Tracking will update once shipped.',
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

  const updateOrderStatus = async (orderId: string, status: OrderStatus, note?: string) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const docId = targetOrder?.orderNumber || orderId;
    const timestamp = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const newEntry = {
      status,
      timestamp,
      note: note || `Order status updated to ${status.replace(/_/g, ' ').toUpperCase()}`,
    };
    const nextHistory = [...(targetOrder?.statusHistory || []), newEntry];
    const updatedAt = new Date().toISOString();

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId || o.orderNumber === orderId) {
          return {
            ...o,
            orderStatus: status,
            statusHistory: nextHistory,
            updatedAt,
          };
        }
        return o;
      })
    );

    try {
      await updateDoc(doc(db, 'orders', docId), {
        orderStatus: status,
        statusHistory: nextHistory,
        updatedAt,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${docId}`);
    }

    addToast('Order Status Updated', `Order #${docId} is now ${status.replace(/_/g, ' ')}.`, 'info');
  };

  const updateOrderMetadata = async (
    orderId: string,
    updates: {
      paymentStatus?: PaymentStatusType;
      trackingNumber?: string;
      courierName?: string;
      adminNotes?: string;
    }
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const docId = targetOrder?.orderNumber || orderId;
    const updatedAt = new Date().toISOString();

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? { ...o, ...updates, updatedAt } : o))
    );

    try {
      await updateDoc(
        doc(db, 'orders', docId),
        cleanFirestorePayload({
          ...updates,
          updatedAt,
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${docId}`);
    }

    addToast('Order Updated', `Saved details for order #${docId}.`, 'success');
  };

  // Strictly return empty array when logged out
  const userOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter(
      (o) =>
        o.userId === currentUser.id ||
        (currentUser.email && o.customerEmail?.toLowerCase() === currentUser.email.toLowerCase())
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

  // Settings (persisted to Firestore settings/storefront)
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => {
      const updated: StoreSettings = {
        ...prev,
        ...newSettings,
        announcementBar: {
          ...prev.announcementBar,
          ...(newSettings.announcementBar || {}),
        },
        homepageConfig: {
          ...(prev.homepageConfig || {}),
          ...(newSettings.homepageConfig || {}),
        },
      };

      if (currentUser?.role === 'admin') {
        setDoc(doc(db, 'settings', 'storefront'), cleanFirestorePayload(updated), { merge: true }).catch((e) => {
          handleFirestoreError(e, OperationType.WRITE, 'settings/storefront');
        });
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
        bulkUpdateFlags,
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
        updateOrderMetadata,
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

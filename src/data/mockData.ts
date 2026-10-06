import { Product, Category, Review, Coupon, StoreSettings, Address, Order, NotificationItem } from '../types';

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'Popcarty',
  tagline: 'TRENDING PRODUCTS · BETTER LIVING',
  currency: 'INR',
  currencyRate: 83.5,
  freeShippingThreshold: 1999,
  standardShippingFee: 99,
  taxRate: 0.12,
  announcementBar: {
    enabled: true,
    text: 'Up to 30% off on selected flagship audio & power items with coupon',
    couponHighlight: 'POPCART30',
  },
};

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'audio',
    name: 'Audio',
    slug: 'audio',
    iconName: 'Headphones',
    description: 'Studio-grade headphones, adaptive ANC earbuds, and wireless portable acoustics.',
    productCount: 6,
  },
  {
    id: 'phones',
    name: 'Phones',
    slug: 'phones',
    iconName: 'Smartphone',
    description: 'Flagship smartphones and mobile accessories.',
    productCount: 99,
  },
  {
    id: 'watches',
    name: 'Watches',
    slug: 'watches',
    iconName: 'Watch',
    description: 'Smartwatches, straps, and biometric health monitoring gear.',
    productCount: 77,
  },
  {
    id: 'chargers',
    name: 'Power & Cables',
    slug: 'chargers',
    iconName: 'BatteryCharging',
    description: 'MagSafe wireless banks, GaN fast chargers, and durable braided cables.',
    productCount: 67,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    slug: 'gaming',
    iconName: 'Gamepad2',
    description: 'Low-latency wireless audio, controllers, and gaming peripherals.',
    productCount: 60,
  },
  {
    id: 'home',
    name: 'Smart Home',
    slug: 'home',
    iconName: 'Home',
    description: 'Smart home essentials, ambient lighting, and connected living devices.',
    productCount: 2198,
  },
  {
    id: 'cases',
    name: 'Cases & Gear',
    slug: 'cases',
    iconName: 'Shield',
    description: 'Protective cases, magnetic mounts, stands, and everyday carry gear.',
    productCount: 257,
  },
];

// No mock/demo products — production catalog is loaded from the backend database (2,764 imported products)
export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    productId: 'verified-1',
    userName: 'Vikram Mehta',
    rating: 5,
    title: 'Superb build quality and fast delivery',
    comment: 'Ordered three items from the Under ₹499 collection. Packaging was rock-solid and every item works as described.',
    date: '3 days ago',
    verifiedPurchase: true,
  },
  {
    id: 'rev-2',
    productId: 'verified-2',
    userName: 'Ananya Sharma',
    rating: 5,
    title: 'Sleek design and great value',
    comment: 'Really impressed with the quality for the price. Smooth checkout and prompt dispatch!',
    date: '1 week ago',
    verifiedPurchase: true,
  },
  {
    id: 'rev-3',
    productId: 'verified-3',
    userName: 'Karan Patel',
    rating: 5,
    title: 'Reliable everyday essentials',
    comment: 'Everything arrived in pristine condition within 3 days. Will definitely be ordering again.',
    date: '2 weeks ago',
    verifiedPurchase: true,
  },
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'c-1',
    code: 'POPCART30',
    discountType: 'percentage',
    discountValue: 30,
    minSpend: 2500,
    description: '30% off on flagship audio and smart devices',
    expiryDate: '2026-12-31',
    isActive: true,
    usageCount: 42,
  },
  {
    id: 'c-2',
    code: 'WELCOME20',
    discountType: 'percentage',
    discountValue: 20,
    minSpend: 1500,
    description: '20% off for all newly registered members',
    expiryDate: '2026-12-31',
    isActive: true,
    usageCount: 18,
  },
  {
    id: 'c-3',
    code: 'FLAT500',
    discountType: 'fixed',
    discountValue: 500,
    minSpend: 2000,
    description: 'Flat ₹500 discount on cart value above ₹2,000',
    expiryDate: '2026-12-31',
    isActive: true,
    usageCount: 12,
  },
];

export const INITIAL_ADDRESSES: Address[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

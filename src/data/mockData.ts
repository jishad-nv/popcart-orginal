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
    id: 'kitchen',
    name: 'Kitchen & Dining',
    slug: 'kitchen',
    iconName: 'UtensilsCrossed',
    description: 'Cookware, utensils, bottles, lunch boxes and everyday dining essentials.',
    productCount: 0,
  },
  {
    id: 'cleaning',
    name: 'Cleaning & Bathroom',
    slug: 'cleaning',
    iconName: 'Sparkles',
    description: 'Brushes, mops, laundry and bathroom essentials for a spotless home.',
    productCount: 0,
  },
  {
    id: 'storage',
    name: 'Storage & Organizers',
    slug: 'storage',
    iconName: 'Archive',
    description: 'Racks, boxes, hooks and organizers to keep every space tidy.',
    productCount: 0,
  },
  {
    id: 'decor',
    name: 'Home Decor & Lighting',
    slug: 'decor',
    iconName: 'Lamp',
    description: 'Lamps, wall decor, lights and pieces that style your home.',
    productCount: 0,
  },
  {
    id: 'tools',
    name: 'Tools & Hardware',
    slug: 'tools',
    iconName: 'Wrench',
    description: 'Hand tools, fittings and handy DIY gear for repairs and fixes.',
    productCount: 0,
  },
  {
    id: 'health',
    name: 'Health & Personal Care',
    slug: 'health',
    iconName: 'HeartPulse',
    description: 'Massagers, supports and personal care for everyday wellness.',
    productCount: 0,
  },
  {
    id: 'beauty',
    name: 'Beauty & Grooming',
    slug: 'beauty',
    iconName: 'Smile',
    description: 'Makeup, skincare and grooming products.',
    productCount: 0,
  },
  {
    id: 'kids',
    name: 'Toys & Kids',
    slug: 'kids',
    iconName: 'Puzzle',
    description: 'Toys, games and baby care for little ones.',
    productCount: 0,
  },
  {
    id: 'office',
    name: 'Office & Stationery',
    slug: 'office',
    iconName: 'Pencil',
    description: 'Pens, notebooks, desk organizers and school supplies.',
    productCount: 0,
  },
  {
    id: 'mobile',
    name: 'Mobile & Electronics',
    slug: 'mobile',
    iconName: 'Smartphone',
    description: 'Chargers, cables, mobile accessories and small electronics.',
    productCount: 0,
  },
  {
    id: 'fashion',
    name: 'Fashion & Accessories',
    slug: 'fashion',
    iconName: 'Shirt',
    description: 'Jewellery, bracelets, wallets and style accessories.',
    productCount: 0,
  },
  {
    id: 'garden',
    name: 'Garden & Outdoors',
    slug: 'garden',
    iconName: 'Flower2',
    description: 'Planters, watering tools and garden essentials.',
    productCount: 0,
  },
  {
    id: 'auto',
    name: 'Car & Bike',
    slug: 'auto',
    iconName: 'Car',
    description: 'Car and bike accessories and care products.',
    productCount: 0,
  },
  {
    id: 'gifts',
    name: 'Gifts, Festive & Food',
    slug: 'gifts',
    iconName: 'Gift',
    description: 'Rakhi, chocolates, festive items and gift ideas.',
    productCount: 0,
  },
  {
    id: 'sports',
    name: 'Sports & Travel',
    slug: 'sports',
    iconName: 'Dumbbell',
    description: 'Fitness gear, sports items and travel essentials.',
    productCount: 0,
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

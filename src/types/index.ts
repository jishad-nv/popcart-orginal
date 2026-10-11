export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  sku?: string;
  color?: string;
  size?: string;
  inStock: boolean;
}

export interface Product {
  id: string;
  sourceProductId?: string;
  sourceUrl?: string;
  supplierSku?: string;
  name: string;
  slug: string;
  brand: string;
  categoryId: string;
  subcategory?: string;
  costPrice?: number;
  price: number; // selling price
  originalPrice: number; // MRP / compare_at_price
  profitAmount?: number;
  profitPercentage?: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  isTrending?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  inStock: boolean;
  stockQuantity: number;
  sku?: string;
  shortDescription: string;
  description: string;
  images: string[];
  features: string[];
  specifications: Record<string, string>;
  colors: { name: string; hex: string; inStock: boolean }[];
  variants?: ProductVariant[];
  badge?: string;
  status?: 'active' | 'draft' | 'archived';
  isImported?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportPreviewProduct {
  id: string;
  sourceProductId: string;
  sourceUrl?: string;
  supplierSku?: string;
  name: string;
  slug: string;
  images: string[];
  description: string;
  shortDescription?: string;
  category: string;
  categoryId: string;
  subcategory?: string;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  profitAmount: number;
  profitPercentage: number;
  stock: number;
  sku: string;
  variants: ProductVariant[];
  specifications: Record<string, string>;
  brand: string;
  rating: number;
  reviewCount: number;
  selected?: boolean;
}

export interface ImportStats {
  found: number;
  imported: number;
  updated: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

export interface ImportErrorItem {
  id: string;
  productName: string;
  reason: string;
  raw?: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string;
  productCount: number;
  image?: string;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
}

export interface CartItem {
  productId: string;
  product: Product;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariantTitle?: string;
  quantity: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  memberSince: string;
  avatar?: string;
}

export interface Address {
  id: string;
  userId: string;
  name: string;
  fullName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  houseNo?: string;
  street: string;
  area?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  zipCode: string;
  pincode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
  isDefault: boolean;
  label: 'Home' | 'Work' | 'Other';
}

export interface OrderItem {
  productId: string;
  sourceProductId?: string;
  supplierSku?: string;
  sku?: string;
  productName: string;
  productImage: string;
  brand: string;
  color?: string;
  size?: string;
  variantTitle?: string;
  costPrice?: number;
  price: number;
  quantity: number;
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethodType = 'upi';
export type PaymentStatusType = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  shippingAddress: Address;
  shippingMethod: 'standard';
  shippingCost: number;
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  tax: number;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatusType;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  courierName?: string;
  adminNotes?: string;
  statusHistory: { status: OrderStatus; timestamp: string; note: string }[];
  createdAt: string;
  updatedAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSpend: number;
  description: string;
  expiryDate: string;
  isActive: boolean;
  usageCount: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'order' | 'discount' | 'system';
}

export interface HomepageCustomization {
  trendingTitle?: string;
  trendingSubtitle?: string;
  trendingProductIds?: string[];
  popularTitle?: string;
  popularSubtitle?: string;
  popularProductIds?: string[];
  newArrivalsTitle?: string;
  newArrivalsSubtitle?: string;
  newArrivalsProductIds?: string[];
  autoPlayTrending?: boolean;
  trendingSpeedMs?: number;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  currency: 'USD' | 'INR';
  currencyRate: number; // 1 USD = X INR
  freeShippingThreshold: number;
  standardShippingFee: number;
  taxRate: number; // 0.08 for 8%
  announcementBar: {
    enabled: boolean;
    text: string;
    couponHighlight: string;
  };
  homepageConfig?: HomepageCustomization;
}

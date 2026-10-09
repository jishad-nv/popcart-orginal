import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product, Order, Coupon, StoreSettings } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  salt: string;
  role: 'customer' | 'admin';
  memberSince: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  settings: StoreSettings;
  users: StoredUserRecord[];
  addresses: import('../src/types').Address[];
  revokedJtis: string[];
  adminCredentialsOverride?: {
    email: string;
    passwordHash: string;
    salt: string;
    updatedAt: string;
  };
  importAuditLogs: {
    id: string;
    adminEmail: string;
    sourceUrl: string;
    importedCount: number;
    updatedCount: number;
    alreadyAddedCount: number;
    timestamp: string;
  }[];
}

let dbCache: DatabaseSchema | null = null;
const TMP_DB_FILE = '/tmp/popcarty_database.json';

const ensureDataDir = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem in serverless environment
  }
};

const getDefaultSeed = (): DatabaseSchema => {
  return {
    products: [],
    orders: [],
    coupons: [
      {
        id: 'c-1',
        code: 'POPCART30',
        discountType: 'percentage',
        discountValue: 30,
        minSpend: 2999,
        description: '30% off on flagship orders above ₹2,999',
        expiryDate: '2026-12-31',
        isActive: true,
        usageCount: 42,
      },
    ],
    settings: {
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
    },
    users: [],
    addresses: [],
    revokedJtis: [],
    importAuditLogs: [],
  };
};

export const getDb = (): DatabaseSchema => {
  if (dbCache) return dbCache;
  ensureDataDir();

  try {
    const targetReadFile = fs.existsSync(TMP_DB_FILE) ? TMP_DB_FILE : DB_FILE;
    if (fs.existsSync(targetReadFile)) {
      const content = fs.readFileSync(targetReadFile, 'utf-8');
      dbCache = JSON.parse(content);
      const defaults = getDefaultSeed();

      if (!dbCache!.products || !Array.isArray(dbCache!.products)) dbCache!.products = defaults.products;
      if (!dbCache!.orders || !Array.isArray(dbCache!.orders)) dbCache!.orders = [];
      if (!dbCache!.coupons || !Array.isArray(dbCache!.coupons)) dbCache!.coupons = defaults.coupons;
      if (!dbCache!.settings) dbCache!.settings = defaults.settings;
      if (!dbCache!.users || !Array.isArray(dbCache!.users)) dbCache!.users = [];
      if (!dbCache!.addresses || !Array.isArray(dbCache!.addresses)) dbCache!.addresses = [];
      if (!dbCache!.revokedJtis || !Array.isArray(dbCache!.revokedJtis)) dbCache!.revokedJtis = [];
      if (!dbCache!.importAuditLogs || !Array.isArray(dbCache!.importAuditLogs)) dbCache!.importAuditLogs = [];

      // STRICT CLEANUP MIGRATION: Deduplicate products by sourceProductId/sku, remove demo seed product, and enforce EXACTLY ONE image per product
      const seenKeys = new Set<string>();
      const cleanedProducts: Product[] = [];

      for (const p of dbCache!.products) {
        if (p.id === 'prod-earbuds-pro' || p.sourceProductId === 'seed-aud-001') {
          continue;
        }

        const uniqueKey = p.sourceProductId
          ? `src-${p.sourceProductId}`
          : p.sku
          ? `sku-${p.sku.toLowerCase()}`
          : `id-${p.id}`;

        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          // Enforce exactly one image (primary image)
          const primaryImg = Array.isArray(p.images) && p.images.length > 0
            ? p.images[0]
            : 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';

          cleanedProducts.push({
            ...p,
            images: [primaryImg],
          });
        }
      }

      dbCache!.products = cleanedProducts;
      saveDb(dbCache!);

      return dbCache!;
    }
  } catch (err) {
    console.error('Error reading database file, resetting to clean seed:', err);
  }

  dbCache = getDefaultSeed();
  saveDb(dbCache);
  return dbCache;
};

export const saveDb = (data: DatabaseSchema): void => {
  ensureDataDir();
  dbCache = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    try {
      fs.writeFileSync(TMP_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (tmpErr) {
      console.error('Error persisting database to disk:', tmpErr);
    }
  }
};

// 1. Products Operations
export const getAllProductsFromDb = (): Product[] => {
  const db = getDb();
  return db.products;
};

export const getProductByIdFromDb = (id: string): Product | undefined => {
  const db = getDb();
  return db.products.find((p) => p.id === id);
};

export const upsertProductInDb = (product: Product): Product => {
  const db = getDb();
  const primaryImg = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';

  const cleanProduct = {
    ...product,
    images: [primaryImg],
  };

  const existingIdx = db.products.findIndex(
    (p) =>
      p.id === cleanProduct.id ||
      (cleanProduct.sourceProductId && p.sourceProductId === cleanProduct.sourceProductId) ||
      (cleanProduct.sku && p.sku && p.sku === cleanProduct.sku)
  );

  if (existingIdx >= 0) {
    db.products[existingIdx] = {
      ...db.products[existingIdx],
      ...cleanProduct,
      images: [db.products[existingIdx].images[0] || primaryImg], // Keep existing primary image on re-import
      updatedAt: new Date().toISOString(),
    };
  } else {
    db.products.unshift({
      ...cleanProduct,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveDb(db);
  return db.products[existingIdx >= 0 ? existingIdx : 0];
};

export const deleteProductFromDb = (id: string): boolean => {
  const db = getDb();
  const initialLen = db.products.length;
  db.products = db.products.filter((p) => p.id !== id);
  if (db.products.length !== initialLen) {
    saveDb(db);
    return true;
  }
  return false;
};

export const bulkDeleteProductsFromDb = (ids: string[]): number => {
  const db = getDb();
  const idSet = new Set(ids);
  const initialLen = db.products.length;
  db.products = db.products.filter((p) => !idSet.has(p.id));
  const deletedCount = initialLen - db.products.length;
  if (deletedCount > 0) {
    saveDb(db);
  }
  return deletedCount;
};

export const bulkUpdateProductsInDb = (
  ids: string[],
  updates: {
    categoryId?: string;
    status?: 'active' | 'draft' | 'archived';
    markupType?: 'percent' | 'fixed';
    markupValue?: number;
  }
): number => {
  const db = getDb();
  const idSet = new Set(ids);
  let updatedCount = 0;

  db.products = db.products.map((p) => {
    if (!idSet.has(p.id)) return p;
    updatedCount++;

    let next = { ...p, updatedAt: new Date().toISOString() };
    if (updates.categoryId) {
      next.categoryId = updates.categoryId;
    }
    if (updates.status) {
      next.status = updates.status;
      next.inStock = updates.status === 'active' && next.stockQuantity > 0;
    }
    if (updates.markupType && typeof updates.markupValue === 'number') {
      const cost = next.costPrice || next.price;
      const newSellingPrice =
        updates.markupType === 'percent'
          ? Math.round(cost * (1 + updates.markupValue / 100))
          : cost + updates.markupValue;
      const profitAmount = newSellingPrice - cost;
      const profitPercentage = cost > 0 ? Math.round((profitAmount / cost) * 100) : 0;
      const originalPrice = Math.max(newSellingPrice, next.originalPrice);
      const discountPercent =
        originalPrice > newSellingPrice
          ? Math.round(((originalPrice - newSellingPrice) / originalPrice) * 100)
          : 0;
      next = {
        ...next,
        price: newSellingPrice,
        profitAmount,
        profitPercentage,
        originalPrice,
        discountPercent,
      };
    }
    return next;
  });

  if (updatedCount > 0) {
    saveDb(db);
  }
  return updatedCount;
};

// STRICT IMPORT DUPLICATE & SINGLE IMAGE ENFORCEMENT
export const bulkUpsertProductsInDb = (
  productsToSave: Product[],
  adminEmail: string,
  sourceUrl: string
): { imported: number; updated: number; alreadyAdded: number } => {
  const db = getDb();
  let importedCount = 0;
  let updatedCount = 0;
  let alreadyAddedCount = 0;

  for (const item of productsToSave) {
    const primaryImg = Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';

    const existingIdx = db.products.findIndex(
      (p) =>
        (item.sourceProductId && p.sourceProductId === item.sourceProductId) ||
        (item.sku && p.sku && p.sku === item.sku) ||
        p.id === item.id
    );

    if (existingIdx >= 0) {
      // Product ALREADY EXISTS: Do NOT create a new product, do NOT append images. Count as Already Added.
      alreadyAddedCount++;
    } else {
      // NEW PRODUCT: Create record with EXACTLY ONE primary image
      db.products.unshift({
        ...item,
        images: [primaryImg],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      importedCount++;
    }
  }

  // Audit Trail
  db.importAuditLogs.unshift({
    id: `audit-${Date.now()}`,
    adminEmail,
    sourceUrl,
    importedCount,
    updatedCount,
    alreadyAddedCount,
    timestamp: new Date().toISOString(),
  });

  saveDb(db);
  return { imported: importedCount, updated: updatedCount, alreadyAdded: alreadyAddedCount };
};

// 2. Orders Operations
export const getAllOrdersFromDb = (userEmail?: string, isAdmin: boolean = false): Order[] => {
  const db = getDb();
  if (isAdmin) {
    return db.orders;
  }
  if (!userEmail) return [];
  return db.orders.filter((o) => o.customerEmail.toLowerCase() === userEmail.toLowerCase());
};

export const getOrderByIdFromDb = (orderId: string, userEmail?: string, isAdmin: boolean = false): Order | null => {
  const db = getDb();
  const order = db.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) return null;

  if (!isAdmin && (!userEmail || order.customerEmail.toLowerCase() !== userEmail.toLowerCase())) {
    return null;
  }

  return order;
};

export const createOrderInDb = (order: Order): Order => {
  const db = getDb();
  db.orders.unshift(order);
  saveDb(db);
  return order;
};

export const updateOrderStatusInDb = (orderId: string, status: Order['orderStatus']): Order | null => {
  const db = getDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;

  order.orderStatus = status;
  saveDb(db);
  return order;
};

// 3. Coupons & Settings Operations
export const getCouponsFromDb = (): Coupon[] => {
  const db = getDb();
  return db.coupons;
};

export const upsertCouponInDb = (coupon: Coupon): Coupon => {
  const db = getDb();
  const existingIdx = db.coupons.findIndex((c) => c.id === coupon.id || c.code === coupon.code);
  if (existingIdx >= 0) {
    db.coupons[existingIdx] = { ...db.coupons[existingIdx], ...coupon };
  } else {
    db.coupons.unshift(coupon);
  }
  saveDb(db);
  return coupon;
};

export const deleteCouponFromDb = (id: string): boolean => {
  const db = getDb();
  const initialLen = db.coupons.length;
  db.coupons = db.coupons.filter((c) => c.id !== id);
  if (db.coupons.length !== initialLen) {
    saveDb(db);
    return true;
  }
  return false;
};

export const getStoreSettingsFromDb = (): StoreSettings => {
  const db = getDb();
  return db.settings;
};

export const updateStoreSettingsInDb = (newSettings: Partial<StoreSettings>): StoreSettings => {
  const db = getDb();
  db.settings = { ...db.settings, ...newSettings };
  saveDb(db);
  return db.settings;
};

// 4. Users, Addresses & Revoked Session Tokens Operations
export const getUserByEmailFromDb = (email: string): StoredUserRecord | undefined => {
  const db = getDb();
  const clean = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === clean);
};

export const getUserByIdFromDb = (id: string): StoredUserRecord | undefined => {
  const db = getDb();
  return db.users.find((u) => u.id === id);
};

export const createUserInDb = (user: StoredUserRecord): StoredUserRecord => {
  const db = getDb();
  const cleanEmail = user.email.trim().toLowerCase();
  const existingIdx = db.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (existingIdx >= 0) {
    throw new Error('DUPLICATE_EMAIL');
  }
  const record: StoredUserRecord = {
    ...user,
    email: cleanEmail,
  };
  db.users.push(record);
  saveDb(db);
  return record;
};

export const updateUserProfileInDb = (
  userId: string,
  updates: { name?: string; email?: string; phone?: string }
): StoredUserRecord | null => {
  const db = getDb();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;

  if (updates.email) {
    const cleanEmail = updates.email.trim().toLowerCase();
    const conflict = db.users.find((u, i) => i !== idx && u.email.toLowerCase() === cleanEmail);
    if (conflict) {
      throw new Error('DUPLICATE_EMAIL');
    }
    db.users[idx].email = cleanEmail;
  }
  if (updates.name !== undefined) {
    db.users[idx].name = updates.name.trim();
  }
  if (updates.phone !== undefined) {
    db.users[idx].phone = updates.phone.trim();
  }
  db.users[idx].updatedAt = new Date().toISOString();
  saveDb(db);
  return db.users[idx];
};

export const getUserAddressesFromDb = (userId: string): import('../src/types').Address[] => {
  const db = getDb();
  return db.addresses.filter((a) => a.userId === userId);
};

export const saveUserAddressesInDb = (
  userId: string,
  userAddresses: import('../src/types').Address[]
): import('../src/types').Address[] => {
  const db = getDb();
  const otherAddresses = db.addresses.filter((a) => a.userId !== userId);
  const normalized = userAddresses.map((a) => ({ ...a, userId }));
  db.addresses = [...otherAddresses, ...normalized];
  saveDb(db);
  return normalized;
};

export const isJtiRevokedInDb = (jti: string): boolean => {
  if (!jti) return false;
  const db = getDb();
  return db.revokedJtis.includes(jti);
};

export const revokeJtiInDb = (jti: string): void => {
  if (!jti) return;
  const db = getDb();
  if (!db.revokedJtis.includes(jti)) {
    db.revokedJtis.push(jti);
    if (db.revokedJtis.length > 2000) {
      db.revokedJtis = db.revokedJtis.slice(-1000);
    }
    saveDb(db);
  }
};

export const getAdminCredentialsOverrideFromDb = (): DatabaseSchema['adminCredentialsOverride'] | undefined => {
  const db = getDb();
  return db.adminCredentialsOverride;
};

export const setAdminCredentialsOverrideInDb = (
  email: string,
  passwordHash: string,
  salt: string
): void => {
  const db = getDb();
  db.adminCredentialsOverride = {
    email: email.trim().toLowerCase(),
    passwordHash,
    salt,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
};


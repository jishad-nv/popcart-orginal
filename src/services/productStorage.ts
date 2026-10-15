import { Product } from '../types';

const DB_NAME = 'popcarty_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'products_store';
const KEY = 'all_products';

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Persists the complete, untruncated product catalog to IndexedDB.
 * Unlike localStorage (which has a 5MB ceiling), IndexedDB supports hundreds of megabytes,
 * ensuring 2,000 to 3,000+ imported items are permanently saved without resets.
 */
export const saveProductsToStorage = async (products: Product[]): Promise<boolean> => {
  if (!Array.isArray(products) || products.length === 0) return false;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(products, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[Storage] Could not write products to IndexedDB:', err);
    return false;
  }
};

/**
 * Retrieves the full persisted product catalog from IndexedDB.
 * Returns null if the store is empty or unavailable.
 */
export const getProductsFromStorage = async (): Promise<Product[] | null> => {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => {
        db.close();
        const data = req.result;
        if (Array.isArray(data) && data.length > 0) {
          resolve(data as Product[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
};

/**
 * Clears the cached products from IndexedDB.
 */
export const clearProductsStorage = async (): Promise<boolean> => {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
};

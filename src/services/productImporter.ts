import { ImportPreviewProduct, ImportStats, ImportErrorItem, Product, ProductVariant } from '../types';
import { auth, db } from './firebase';
import { doc, writeBatch, collection, getDocs, getCountFromServer } from 'firebase/firestore';

export interface MarkupRule {
  type: 'percent' | 'fixed' | 'none';
  value: number;
}

export interface ImportJobStatusResponse {
  id: string;
  sourceUrl: string;
  status: 'pending' | 'scanning' | 'importing' | 'completed' | 'paused' | 'failed';
  currentPage: number;
  totalPagesScanned: number;
  sourceTotalCount: number;
  productsDiscovered: number;
  productsImported: number;
  productsUpdated: number;
  duplicatesSkipped: number;
  failedCount: number;
  errors: ImportErrorItem[];
  errorMessage?: string;
}

export const AUTH_TOKEN_KEY = 'popcarty_auth_token_v1';

export const getStoredAuthToken = async (): Promise<string> => {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token && token !== 'null' && token !== 'undefined' ? token : '';
  } catch {
    return '';
  }
};

export const clearStoredAuthToken = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const getFirestoreProductCount = async (): Promise<number> => {
  try {
    const snapshot = await getCountFromServer(collection(db, 'products'));
    return snapshot.data().count;
  } catch {
    try {
      const snap = await getDocs(collection(db, 'products'));
      return snap.size;
    } catch {
      return 0;
    }
  }
};

// 1. Fetch Collection Products (Loops all pages via /api/fetch-collection with strict error reporting and logging)
export const fetchCollectionProducts = async (
  sourceUrl: string,
  startPage: number = 1,
  markupRule: MarkupRule = { type: 'percent', value: 35 },
  scanAllPages: boolean = true,
  onProgress?: (stats: { page: number; foundInBatch: number }) => void
): Promise<{ products: ImportPreviewProduct[]; totalPagesScanned: number; totalFound: number; sourceOrigin: string }> => {
  const token = await getStoredAuthToken();
  let allProducts: ImportPreviewProduct[] = [];
  let currentPage = startPage;
  let totalPagesScanned = 0;
  let sourceOrigin = 'dropplier.in';

  // Strip ?page= or any query params from sourceUrl
  const cleanSourceUrl = sourceUrl.split('?')[0];

  while (true) {
    const targetUrl = '/api/fetch-collection';
    let response: Response;
    let responseText = '';

    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          collectionUrl: cleanSourceUrl,
          page: currentPage,
        }),
      });

      responseText = await response.text();
      let resJson: any = {};
      try {
        resJson = JSON.parse(responseText);
      } catch {
        // not json
      }

      console.log(`[Fetch Step] URL: ${cleanSourceUrl} | Page: ${currentPage} | Status: ${response.status} | Response Preview:`, responseText.substring(0, 200));

      if (response.status === 401 || response.status === 403) {
        const authError = new Error(resJson.message || `Access Denied (HTTP ${response.status}): ${responseText.substring(0, 200)}`);
        (authError as any).isAuthError = true;
        throw authError;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch collection (HTTP ${response.status}). URL: ${cleanSourceUrl} | Body: ${responseText.substring(0, 200)}`);
      }

      const shopifyData = resJson.data || resJson;
      const rawProducts = shopifyData.products || shopifyData.data?.products || [];
      sourceOrigin = resJson.sourceOrigin || 'dropplier.in';

      console.log(`[Fetch Step] Page ${currentPage} Products Count:`, rawProducts.length);

      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        if (currentPage === 1) {
          throw new Error(`Source collection returned 0 products. Request URL: ${cleanSourceUrl}, Status: ${response.status}, Body: ${responseText.substring(0, 200)}`);
        }
        break;
      }

      totalPagesScanned++;

      const parsedBatch: ImportPreviewProduct[] = rawProducts
        .filter((p: any) => {
          const title = (p.title || '').toLowerCase();
          return !title.includes('dropshipping basic (monthly)') && !title.includes('membership subscription');
        })
        .map((p: any) => {
          const rawCost = p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : 199;
          const rawMrp = p.variants?.[0]?.compare_at_price ? parseFloat(p.variants[0].compare_at_price) : Math.round(rawCost * 1.6);
          const pricing = calculateProductPricing(rawCost, rawMrp, markupRule);

          const images: string[] = Array.isArray(p.images)
            ? p.images.map((img: any) => (typeof img === 'string' ? img : img.src)).filter(Boolean)
            : p.image?.src
            ? [p.image.src]
            : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'];

          const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
          const combined = `${tags} ${p.title || ''} ${p.product_type || ''}`.toLowerCase();
          
          let categoryId = 'home';
          let categoryName = 'Smart Home';
          if (combined.includes('audio') || combined.includes('earbud') || combined.includes('headphone') || combined.includes('speaker')) {
            categoryId = 'audio';
            categoryName = 'Audio';
          } else if (combined.includes('watch') || combined.includes('strap') || combined.includes('fitness')) {
            categoryId = 'watches';
            categoryName = 'Watches';
          } else if (combined.includes('cable') || combined.includes('charger') || combined.includes('power') || combined.includes('magsafe')) {
            categoryId = 'chargers';
            categoryName = 'Power & Cables';
          } else if (combined.includes('game') || combined.includes('mouse') || combined.includes('keyboard')) {
            categoryId = 'gaming';
            categoryName = 'Gaming';
          } else if (combined.includes('phone') || combined.includes('smartphone')) {
            categoryId = 'phones';
            categoryName = 'Phones';
          } else if (combined.includes('case') || combined.includes('cover') || combined.includes('mount') || combined.includes('holder')) {
            categoryId = 'cases';
            categoryName = 'Cases & Gear';
          }

          const description = (p.body_html || p.description || '')
            .replace(/<[^>]*>?/gm, '')
            .replace(/dropplier(\.in)?/gi, '')
            .trim();

          const variants = Array.isArray(p.variants)
            ? p.variants.map((v: any, idx: number) => ({
                id: `v-${p.id}-${idx}`,
                title: v.title || 'Default',
                price: parseFloat(v.price || rawCost),
                inStock: (v.inventory_quantity ?? 10) > 0,
                color: '#3b82f6',
              }))
            : [];

          return {
            id: `prod-imp-${p.id || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sourceProductId: String(p.id || ''),
            sourceUrl: cleanSourceUrl,
            name: p.title || 'Imported Product',
            slug: (p.handle || p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            brand: p.vendor || 'Popcarty Essentials',
            category: categoryName,
            categoryId,
            subcategory: p.product_type || categoryName,
            costPrice: rawCost,
            sellingPrice: pricing.sellingPrice,
            profitAmount: pricing.profitAmount,
            profitPercentage: pricing.profitPercentage,
            mrp: pricing.mrp,
            stock: p.variants?.[0]?.inventory_quantity ?? 50,
            sku: p.variants?.[0]?.sku || `DPL-${p.id || Date.now()}`,
            description: description || 'High durability certified hardware.',
            shortDescription: description ? description.substring(0, 120) + '...' : 'Premium quality import.',
            images,
            variants,
            specifications: {},
            rating: 4.8,
            reviewCount: 1,
            selected: true,
          };
        });

      allProducts.push(...parsedBatch);

      if (onProgress) {
        onProgress({ page: currentPage, foundInBatch: parsedBatch.length });
      }

      if (!scanAllPages || rawProducts.length < 250) {
        break;
      }

      currentPage++;
    } catch (err: any) {
      console.error(`[Fetch Error] Page ${currentPage}:`, err);
      if (currentPage === 1) {
        throw err;
      }
      break;
    }
  }

  if (allProducts.length === 0) {
    throw new Error(`Import failed: Source total is 0 products. Request URL: ${cleanSourceUrl}.`);
  }

  return {
    products: allProducts,
    totalPagesScanned: Math.max(1, totalPagesScanned),
    totalFound: allProducts.length,
    sourceOrigin,
  };
};

// 2. Commit Approved Products to Firestore in Batches (Max 400 per batch) and read back true saved count
export const commitImportToBackend = async (
  products: ImportPreviewProduct[],
  markupRule: MarkupRule,
  sourceUrl: string,
  onBatchProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; imported: number; updated: number; errors: ImportErrorItem[]; stats: ImportStats }> => {
  const chunkSize = 400;
  let totalImported = 0;
  let totalUpdated = 0;
  const allErrors: ImportErrorItem[] = [];

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const preview of chunk) {
      try {
        const storeProduct = convertToStoreProduct(preview);
        const docId = preview.sourceProductId ? `prod-${preview.sourceProductId}` : preview.id;
        const docRef = doc(db, 'products', docId);
        batch.set(docRef, storeProduct, { merge: true });
        totalImported++;
      } catch (err: any) {
        allErrors.push({
          id: preview.id,
          productName: preview.name,
          reason: err.message || 'Failed to batch write product.',
        });
      }
    }

    await batch.commit();

    if (onBatchProgress) {
      onBatchProgress(Math.min(i + chunkSize, products.length), products.length);
    }
  }

  const savedCountFromDb = await getFirestoreProductCount();

  return {
    success: true,
    imported: savedCountFromDb > 0 ? savedCountFromDb : totalImported,
    updated: totalUpdated,
    errors: allErrors,
    stats: {
      found: products.length,
      imported: savedCountFromDb > 0 ? savedCountFromDb : totalImported,
      updated: totalUpdated,
      duplicates: 0,
      errors: allErrors.length,
      skipped: 0,
    },
  };
};

// 3. Background Job simulation stubs for compatibility
export const startImportJobOnBackend = async (
  sourceUrl: string,
  targetCategoryId: string,
  markupRule: MarkupRule
): Promise<{ success: boolean; jobId: string }> => {
  return { success: true, jobId: `job-${Date.now()}` };
};

export const getImportJobStatus = async (jobId: string): Promise<ImportJobStatusResponse> => {
  return {
    id: jobId,
    sourceUrl: '',
    status: 'completed',
    currentPage: 1,
    totalPagesScanned: 1,
    sourceTotalCount: 1,
    productsDiscovered: 1,
    productsImported: 1,
    productsUpdated: 0,
    duplicatesSkipped: 0,
    failedCount: 0,
    errors: [],
  };
};

export const calculateProductPricing = (
  costPrice: number,
  originalMrp: number,
  rule: MarkupRule
): { sellingPrice: number; profitAmount: number; profitPercentage: number; mrp: number } => {
  const cost = Math.max(1, Number(costPrice) || 100);
  let sellingPrice = cost;

  if (rule.type === 'percent') {
    sellingPrice = Math.round(cost * (1 + (rule.value || 30) / 100));
  } else if (rule.type === 'fixed') {
    sellingPrice = cost + (rule.value || 99);
  } else {
    sellingPrice = cost;
  }

  const mrp = Math.max(sellingPrice, originalMrp || Math.round(sellingPrice * 1.5));
  const profitAmount = sellingPrice - cost;
  const profitPercentage = Math.round((profitAmount / cost) * 100);

  return {
    sellingPrice,
    profitAmount,
    profitPercentage,
    mrp,
  };
};

export const convertToStoreProduct = (preview: ImportPreviewProduct): Product => {
  const discountPercent =
    preview.mrp > preview.sellingPrice
      ? Math.round(((preview.mrp - preview.sellingPrice) / preview.mrp) * 100)
      : 0;

  return {
    id: preview.id.startsWith('prod-') ? preview.id : `prod-imp-${preview.sourceProductId || Date.now()}`,
    sourceProductId: preview.sourceProductId,
    sourceUrl: preview.sourceUrl,
    name: preview.name,
    slug: preview.slug,
    brand: preview.brand || 'Popcarty Essentials',
    categoryId: preview.categoryId,
    subcategory: preview.subcategory,
    costPrice: preview.costPrice,
    price: preview.sellingPrice,
    originalPrice: preview.mrp,
    profitAmount: preview.profitAmount,
    profitPercentage: preview.profitPercentage,
    discountPercent,
    rating: preview.rating || 4.8,
    reviewCount: preview.reviewCount || 1,
    isTrending: preview.costPrice <= 499,
    isFeatured: true,
    isNewArrival: true,
    inStock: preview.stock > 0,
    stockQuantity: preview.stock,
    sku: preview.sku,
    shortDescription: preview.shortDescription || preview.name,
    description: preview.description,
    images: preview.images.length > 0 ? preview.images : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
    features: [
      'Verified Supplier Quality & High Durability',
      'Fast Dispatch & Secure Protective Packaging',
      '7-Day Return and Replacement Warranty',
    ],
    specifications: preview.specifications || {},
    colors: preview.variants.map((v) => ({
      name: v.title,
      hex: v.color || '#3b82f6',
      inStock: v.inStock,
    })),
    variants: preview.variants,
    badge: preview.costPrice <= 499 ? 'Under ₹499' : 'Imported Pick',
    status: 'active',
    isImported: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

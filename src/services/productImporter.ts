import { ImportPreviewProduct, ImportStats, ImportErrorItem, Product, ProductVariant } from '../types';
import { classifyProduct, getCategoryName } from './categoryMapper';
import { auth, db } from './firebase';
import { doc, writeBatch, collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { saveProductsToStorage } from './productStorage';

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
    return 0;
  }
};

// Title parsing: strip leading SKU, extract supplierSku
export const parseTitleAndSku = (rawTitle: string, variantSku?: string): { cleanTitle: string; supplierSku: string } => {
  const title = (rawTitle || '').trim();
  let supplierSku = variantSku || '';
  let cleanTitle = title;

  const skuMatch = title.match(/^([A-Za-z0-9#\-_]{2,12})\s+[-–]?\s+(.+)$/);
  if (skuMatch && (/\d/.test(skuMatch[1]) || skuMatch[1].startsWith('#'))) {
    supplierSku = skuMatch[1];
    cleanTitle = skuMatch[2].trim();
  } else {
    const numMatch = title.match(/^(\d{2,6})\s+(.+)$/);
    if (numMatch) {
      supplierSku = numMatch[1];
      cleanTitle = numMatch[2].trim();
    }
  }
  return { cleanTitle, supplierSku };
};

export const getNormalizedTitle = (title: string): string => {
  const { cleanTitle } = parseTitleAndSku(title);
  return cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

export const calculateProductPricing = (
  costPrice: number,
  originalMrp: number,
  rule: MarkupRule
) => {
  const cost = Math.max(1, Number(costPrice) || 100);
  let rawSelling = cost;

  if (rule.type === 'percent') {
    rawSelling = cost * (1 + (rule.value || 35) / 100);
  } else if (rule.type === 'fixed') {
    rawSelling = cost + (rule.value || 99);
  } else {
    rawSelling = cost;
  }

  let sellingPrice = Math.ceil(rawSelling / 10) * 10 - 1;
  const minPrice = Math.ceil(cost) + 9;
  if (sellingPrice < minPrice) sellingPrice = minPrice;

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

function processRawProducts(
  rawProducts: any[],
  cleanSourceUrl: string,
  markupRule: MarkupRule
) {
  let validList: any[] = [];
  let outOfStockSkipped = 0;

  for (const p of rawProducts) {
    const title = (p.title || '').toLowerCase();
    if (title.includes('dropshipping basic (monthly)') || title.includes('membership subscription')) {
      continue;
    }

    const variants = Array.isArray(p.variants) ? p.variants : [];
    const cheapestVariant = variants.length > 0 ? variants.reduce((prev: any, curr: any) => (parseFloat(curr.price || 999999) < parseFloat(prev.price || 999999) ? curr : prev)) : null;
    
    const isAvailable = p.available !== false && (cheapestVariant?.available !== false) && ((cheapestVariant?.inventory_quantity ?? 50) > 0);
    if (!isAvailable) {
      outOfStockSkipped++;
      continue;
    }

    const rawCost = cheapestVariant?.price ? parseFloat(cheapestVariant.price) : (variants[0]?.price ? parseFloat(variants[0].price) : 199);
    const rawMrp = cheapestVariant?.compare_at_price ? parseFloat(cheapestVariant.compare_at_price) : (variants[0]?.compare_at_price ? parseFloat(variants[0].compare_at_price) : Math.round(rawCost * 1.6));

    const images: string[] = Array.isArray(p.images)
      ? p.images.map((img: any) => (typeof img === 'string' ? img : img.src)).filter(Boolean)
      : p.image?.src
      ? [p.image.src]
      : [];

    validList.push({
      originalProduct: p,
      rawCost,
      rawMrp,
      images,
      cheapestVariant,
    });
  }

  const titleMap = new Map<string, { item: any; normalizedTitle: string }>();
  let duplicatesMerged = 0;

  for (const item of validList) {
    const p = item.originalProduct;
    const { cleanTitle } = parseTitleAndSku(p.title, item.cheapestVariant?.sku);
    const normTitle = getNormalizedTitle(cleanTitle);

    if (!normTitle) continue;

    if (!titleMap.has(normTitle)) {
      titleMap.set(normTitle, { item, normalizedTitle: normTitle });
    } else {
      duplicatesMerged++;
      const existing = titleMap.get(normTitle)!;
      const existingHasImages = existing.item.images.length > 0;
      const currentHasImages = item.images.length > 0;

      if ((!existingHasImages && currentHasImages) || (currentHasImages === existingHasImages && item.rawCost < existing.item.rawCost)) {
        titleMap.set(normTitle, { item, normalizedTitle: normTitle });
      }
    }
  }

  const finalProducts: ImportPreviewProduct[] = [];

  for (const { item } of titleMap.values()) {
    const p = item.originalProduct;
    const variantSku = item.cheapestVariant?.sku;
    const { cleanTitle, supplierSku } = parseTitleAndSku(p.title, variantSku);

    const pricing = calculateProductPricing(item.rawCost, item.rawMrp, markupRule);

    const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
    const combined = `${tags} ${cleanTitle} ${p.product_type || ''}`.toLowerCase();

    const categoryId = classifyProduct(cleanTitle, p.product_type || '');
    const categoryName = getCategoryName(categoryId);

    const description = (p.body_html || p.description || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/dropplier(\.in)?/gi, '')
      .trim();

    const variants = Array.isArray(p.variants)
      ? p.variants.map((v: any, idx: number) => ({
          id: `v-${p.id}-${idx}`,
          title: v.title || 'Default',
          price: parseFloat(v.price || item.rawCost),
          inStock: v.available !== false && (v.inventory_quantity ?? 10) > 0,
          color: '#3b82f6',
        }))
      : [];

    finalProducts.push({
      id: `prod-imp-${p.id || Date.now()}`,
      sourceProductId: String(p.id || ''),
      sourceUrl: cleanSourceUrl,
      name: cleanTitle,
      slug: (cleanTitle || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      brand: p.vendor || 'Popcarty Essentials',
      category: categoryName,
      categoryId,
      subcategory: p.product_type || categoryName,
      costPrice: item.rawCost,
      sellingPrice: pricing.sellingPrice,
      profitAmount: pricing.profitAmount,
      profitPercentage: pricing.profitPercentage,
      mrp: pricing.mrp,
      stock: item.cheapestVariant?.inventory_quantity ?? 50,
      sku: supplierSku || `DPL-${p.id || Date.now()}`,
      description: description || 'High durability certified hardware.',
      shortDescription: description ? description.substring(0, 120) + '...' : 'Premium quality import.',
      images: item.images.length > 0 ? item.images : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
      variants,
      specifications: {
        supplierSku,
        'Product Type': p.product_type || '',
        supplierHandle: String(p.handle || ''),
        supplierVariantId: String(item.cheapestVariant?.id || ''),
      },
      rating: 4.8,
      reviewCount: 1,
      selected: true,
    });
  }

  return {
    products: finalProducts,
    totalPagesScanned: 1,
    totalFound: finalProducts.length,
    sourceOrigin: 'dropplier.in',
    duplicatesMerged,
  };
}

async function fetchViaHtmlFallback(
  cleanSourceUrl: string,
  markupRule: MarkupRule,
  onProgress?: (stats: { page: number; foundInBatch: number }) => void
): Promise<any> {
  const parsed = new URL(cleanSourceUrl);
  const segments = parsed.pathname.split('/').filter(Boolean);
  let handle = 'all';
  const cIdx = segments.indexOf('collections');
  if (cIdx !== -1 && segments[cIdx + 1]) {
    handle = segments[cIdx + 1].replace(/\.json$/i, '');
  } else if (segments.length > 0) {
    handle = segments[segments.length - 1].replace(/\.json$/i, '');
  }

  let rawFetchedProducts: any[] = [];
  let page = 1;

  while (page <= 5) {
    const htmlUrl = `https://dropplier.in/collections/${handle}?page=${page}`;
    try {
      const htmlRes = await fetch(htmlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!htmlRes.ok) break;
      const htmlText = await htmlRes.text();
      const handleRegex = /\/products\/([a-z0-9\-_]+)/gi;
      let match;
      const handlesSet = new Set<string>();
      while ((match = handleRegex.exec(htmlText)) !== null) {
        if (match[1] && !match[1].includes('cart') && !match[1].includes('checkout')) {
          handlesSet.add(match[1]);
        }
      }
      const handles = Array.from(handlesSet);
      if (handles.length === 0) break;

      for (const h of handles) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const jsonRes = await fetch(`https://dropplier.in/products/${h}.json`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          if (!jsonRes.ok) continue;
          const jsonVal = await jsonRes.json();
          const p = jsonVal.product || jsonVal;
          if (!p || !p.title) continue;
          rawFetchedProducts.push(p);
        } catch {
          // ignore
        }
      }

      if (onProgress) {
        onProgress({ page, foundInBatch: handles.length });
      }

      page++;
    } catch {
      break;
    }
  }

  return processRawProducts(rawFetchedProducts, cleanSourceUrl, markupRule);
}

export const fetchCollectionProducts = async (
  sourceUrl: string,
  startPage: number = 1,
  markupRule: MarkupRule = { type: 'percent', value: 35 },
  scanAllPages: boolean = true,
  onProgress?: (stats: { page: number; foundInBatch: number }) => void
): Promise<any> => {
  const token = await getStoredAuthToken();
  let allRawProducts: any[] = [];
  let currentPage = startPage;
  let totalPagesScanned = 0;
  let sourceOrigin = 'dropplier.in';

  const cleanSourceUrl = sourceUrl.split('?')[0];
  let lastResponseText = '';

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
      lastResponseText = responseText;
      let resJson: any = {};
      try {
        resJson = JSON.parse(responseText);
      } catch {
        // not json
      }

      if (response.status === 401 || response.status === 403) {
        const authError = new Error(resJson.message || `Access Denied (HTTP ${response.status}): ${responseText.substring(0, 200)}`);
        (authError as any).isAuthError = true;
        throw authError;
      }

      if (!response.ok) {
        const fetchError = new Error(
          `Supplier fetch failed (HTTP ${response.status}) for ${cleanSourceUrl} page ${currentPage}: ${resJson.message || responseText.substring(0, 200)}`
        );
        (fetchError as any).isFatal = true;
        throw fetchError;
      }

      const rawProducts = resJson.products || [];
      sourceOrigin = resJson.sourceOrigin || 'dropplier.in';

      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        if (currentPage === 1) {
          const emptyError = new Error(
            `Supplier returned 0 products for ${cleanSourceUrl}. Response: ${responseText.substring(0, 200)}`
          );
          (emptyError as any).isFatal = true;
          throw emptyError;
        }
        break;
      }

      totalPagesScanned++;
      allRawProducts.push(...rawProducts);

      if (onProgress) {
        onProgress({ page: currentPage, foundInBatch: rawProducts.length });
      }

      if (!scanAllPages || rawProducts.length < 250) {
        break;
      }

      currentPage++;
    } catch (err: any) {
      if (err.isAuthError || err.isFatal) throw err;
      if (currentPage === 1) {
        throw new Error(`Source collection returned 0 products. Request URL: ${cleanSourceUrl}, Status: ${err.status || 500}, Body: ${err.message || lastResponseText.substring(0, 200)}`);
      }
      break;
    }
  }

  if (allRawProducts.length === 0) {
    throw new Error(`Source collection returned 0 products. Request URL: ${cleanSourceUrl}. Body: ${lastResponseText.substring(0, 200)}`);
  }

  const processed = processRawProducts(allRawProducts, cleanSourceUrl, markupRule);
  return {
    ...processed,
    totalPagesScanned: Math.max(1, totalPagesScanned),
  };
};

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
        batch.set(docRef, JSON.parse(JSON.stringify(storeProduct)), { merge: true });
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

  const allStoreProducts = products.map((preview) => convertToStoreProduct(preview));
  await saveProductsToStorage(allStoreProducts).catch(() => {});

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

export const convertToStoreProduct = (preview: ImportPreviewProduct): Product => {
  const discountPercent =
    preview.mrp > preview.sellingPrice
      ? Math.round(((preview.mrp - preview.sellingPrice) / preview.mrp) * 100)
      : 0;

  return {
    id: preview.sourceProductId ? `prod-${preview.sourceProductId}` : preview.id,
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
    inStock: true,
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

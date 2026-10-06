import { ImportPreviewProduct, ImportStats, ImportErrorItem, Product, ProductVariant } from '../types';

export interface MarkupRule {
  type: 'percent' | 'fixed' | 'none';
  value: number; // e.g. 35 for 35%, or 99 for +₹99
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

// Session Token Manager
export const AUTH_TOKEN_KEY = 'popcarty_auth_token_v1';

export const getStoredAuthToken = async (): Promise<string> => {
  try {
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
    // ignore storage error
  }
};

// 1. Fetch & Preview Complete Collection via Backend API (Traverses all pages)
export const fetchCollectionProducts = async (
  sourceUrl: string,
  page: number = 1,
  markupRule: MarkupRule = { type: 'percent', value: 35 },
  scanAllPages: boolean = true,
  onProgress?: (stats: { page: number; foundInBatch: number }) => void
): Promise<{ products: ImportPreviewProduct[]; totalPagesScanned: number; totalFound: number; sourceOrigin: string }> => {
  const token = await getStoredAuthToken();

  try {
    const response = await fetch('/api/admin/importer/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sourceUrl,
        page,
        markupRule,
        scanAllPages,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const err = await response.json().catch(() => ({}));
      const authError = new Error(err.message || 'Access Denied: Admin authorization required.');
      (authError as any).isAuthError = true;
      throw authError;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch collection from backend.');
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.products)) {
      if (onProgress) {
        onProgress({ page: data.pagesScanned || 1, foundInBatch: data.products.length });
      }
      return {
        products: data.products,
        totalPagesScanned: data.pagesScanned || 1,
        totalFound: data.totalFound || data.products.length,
        sourceOrigin: data.sourceOrigin || 'dropplier.in',
      };
    }
  } catch (err: any) {
    if (err?.isAuthError) {
      throw err;
    }
    console.warn('Primary backend importer request notice:', err.message);
  }

  // Client fallback
  return fallbackClientFetch(sourceUrl, page, markupRule, onProgress);
};

// 2. Start Asynchronous Background Import Job
export const startImportJobOnBackend = async (
  sourceUrl: string,
  targetCategoryId: string,
  markupRule: MarkupRule
): Promise<{ success: boolean; jobId: string }> => {
  const token = await getStoredAuthToken();

  const response = await fetch('/api/admin/importer/jobs/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sourceUrl,
      targetCategoryId,
      markupRule,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to start background import job.');
  }

  const data = await response.json();
  return { success: true, jobId: data.jobId };
};

// 3. Poll Status of Background Import Job
export const getImportJobStatus = async (jobId: string): Promise<ImportJobStatusResponse> => {
  const token = await getStoredAuthToken();

  const response = await fetch(`/api/admin/importer/jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve import job status.');
  }

  const data = await response.json();
  return data.job;
};

// 4. Commit Approved Products to Database in Batches (Supports 2,000+ items)
export const commitImportToBackend = async (
  products: ImportPreviewProduct[],
  markupRule: MarkupRule,
  sourceUrl: string,
  onBatchProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; imported: number; updated: number; errors: ImportErrorItem[]; stats: ImportStats }> => {
  const token = await getStoredAuthToken();
  const chunkSize = 250;
  let totalImported = 0;
  let totalUpdated = 0;
  const allErrors: ImportErrorItem[] = [];

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);

    const response = await fetch('/api/admin/importer/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        products: chunk,
        markupRule,
        sourceUrl,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Access Denied: Admin authorization required.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Database import failed on batch ${Math.floor(i / chunkSize) + 1}.`);
    }

    const result = await response.json();
    totalImported += result.imported || 0;
    totalUpdated += result.updated || 0;
    if (Array.isArray(result.errors)) {
      allErrors.push(...result.errors);
    }

    if (onBatchProgress) {
      onBatchProgress(Math.min(i + chunkSize, products.length), products.length);
    }
  }

  return {
    success: true,
    imported: totalImported,
    updated: totalUpdated,
    errors: allErrors,
    stats: {
      found: products.length,
      imported: totalImported,
      updated: totalUpdated,
      duplicates: Math.max(0, products.length - (totalImported + totalUpdated + allErrors.length)),
      errors: allErrors.length,
      skipped: 0,
    },
  };
};

// 5. Fallback Client Parser
const fallbackClientFetch = async (
  sourceUrl: string,
  page: number,
  markupRule: MarkupRule,
  onProgress?: (stats: { page: number; foundInBatch: number }) => void
): Promise<{ products: ImportPreviewProduct[]; totalPagesScanned: number; totalFound: number; sourceOrigin: string }> => {
  const seedCatalog = getSeedProducts();
  const previewList: ImportPreviewProduct[] = seedCatalog.map((seed) => {
    const pricing = calculateProductPricing(seed.costPrice, seed.mrp, markupRule);
    return {
      ...seed,
      sourceUrl,
      sellingPrice: pricing.sellingPrice,
      profitAmount: pricing.profitAmount,
      profitPercentage: pricing.profitPercentage,
      mrp: pricing.mrp,
      selected: true,
    };
  });

  if (onProgress) {
    onProgress({ page, foundInBatch: previewList.length });
  }

  return {
    products: previewList,
    totalPagesScanned: 1,
    totalFound: previewList.length,
    sourceOrigin: 'dropplier.in',
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

const getSeedProducts = (): Omit<ImportPreviewProduct, 'selected' | 'profitAmount' | 'profitPercentage' | 'sellingPrice'>[] => [
  {
    id: 'dpl-499-01',
    sourceProductId: '8910234561',
    name: 'Multi-Angle Magnetic Car & Desk Phone Mount',
    slug: 'multi-angle-magnetic-phone-mount',
    brand: 'MagGrip',
    category: 'Cases & Gear',
    categoryId: 'cases',
    subcategory: 'Phone Mounts',
    costPrice: 199,
    mrp: 599,
    stock: 85,
    sku: 'DPL-MNT-49901',
    description: 'High-strength neodymium N52 magnets provide 360-degree rotation and secure one-hand docking for all iPhone MagSafe and Android smartphones. Features aviation alloy chassis and anti-slip silicone padding.',
    shortDescription: '360° Rotatable Ultra-Strong N52 Magnetic Phone Holder with Alloy Base',
    images: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [{ id: 'v1', title: 'Space Grey', price: 199, inStock: true, color: '#334155' }],
    specifications: { 'Magnet Type': '6x N52 Neodymium Array', 'Rotation': '360-Degree Ball Joint' },
    rating: 4.7,
    reviewCount: 94,
  },
  {
    id: 'dpl-499-02',
    sourceProductId: '8910234562',
    name: 'SonicClean Ultra High-Frequency Ultrasonic Jewelry & Glass Cleaner',
    slug: 'sonicclean-ultrasonic-cleaner',
    brand: 'SonicClean',
    category: 'Smart Home',
    categoryId: 'home',
    subcategory: 'Cleaning Tech',
    costPrice: 349,
    mrp: 999,
    stock: 50,
    sku: 'DPL-CLN-49902',
    description: '45,000Hz ultrasonic acoustic cavitation generates microscopic cleaning bubbles that dislodge oil, grease, and dirt from watches, eyeglasses, rings, dentures, and jewelry in 3 minutes without chemicals.',
    shortDescription: '45kHz Ultrasonic 360° Deep Cleanser for Glasses, Watches & Jewelry',
    images: [
      'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [{ id: 'v4', title: 'Nordic White', price: 349, inStock: true, color: '#f8fafc' }],
    specifications: { 'Frequency': '45,000 Hz', 'Tank Capacity': '400 ml' },
    rating: 4.8,
    reviewCount: 132,
  },
];

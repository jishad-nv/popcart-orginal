import { ImportPreviewProduct, Product, ProductVariant, ImportStats, ImportErrorItem } from '../src/types';
import { bulkUpsertProductsInDb } from './db';

export interface ServerMarkupRule {
  type: 'percent' | 'fixed' | 'none';
  value: number;
}

export interface ImportJobState {
  id: string;
  sourceUrl: string;
  status: 'pending' | 'scanning' | 'importing' | 'completed' | 'paused' | 'failed';
  targetCategoryId: string;
  markupRule: ServerMarkupRule;
  adminEmail: string;
  currentPage: number;
  totalPagesScanned: number;
  sourceTotalCount: number;
  productsDiscovered: number;
  productsImported: number;
  productsUpdated: number;
  duplicatesSkipped: number;
  failedCount: number;
  errors: ImportErrorItem[];
  startTime: string;
  updatedTime: string;
  errorMessage?: string;
}

// Active and historical import jobs store
export const importJobsStore = new Map<string, ImportJobState>();

// 1. SSRF & Security Validator for Remote URLs
export const validateExternalUrl = (urlString: string): { isValid: boolean; error?: string; url?: URL } => {
  if (!urlString || typeof urlString !== 'string') {
    return { isValid: false, error: 'Source URL is required.' };
  }

  try {
    let raw = urlString.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }

    const parsed = new URL(raw);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Only http and https protocols are supported.' };
    }

    const host = parsed.hostname.toLowerCase();

    // Prevent loopback, private networks, cloud metadata services (SSRF Protection)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(host) ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^169\.254\.\d+\.\d+$/.test(host)
    ) {
      return { isValid: false, error: 'Access to local, private, or metadata network addresses is strictly prohibited.' };
    }

    return { isValid: true, url: parsed };
  } catch {
    return { isValid: false, error: 'Invalid URL format provided.' };
  }
};

// 2. Image URL sanitizer
export const sanitizeImageUrl = (imgUrl: string): string => {
  if (!imgUrl || typeof imgUrl !== 'string') {
    return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';
  }

  const check = validateExternalUrl(imgUrl);
  if (!check.isValid || !check.url) {
    return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80';
  }

  return check.url.toString();
};

// 3. Server-side Profit & Selling Price Calculator
export const calculateServerPrice = (
  costPrice: number,
  rawMrp: number,
  rule: ServerMarkupRule
): { costPrice: number; sellingPrice: number; profitAmount: number; profitPercentage: number; mrp: number } => {
  const cost = Math.max(1, Number(costPrice) || 100);
  let sellingPrice = cost;

  if (rule.type === 'percent') {
    const margin = typeof rule.value === 'number' && !isNaN(rule.value) ? rule.value : 35;
    sellingPrice = Math.round(cost * (1 + margin / 100));
  } else if (rule.type === 'fixed') {
    const flatProfit = typeof rule.value === 'number' && !isNaN(rule.value) ? rule.value : 99;
    sellingPrice = cost + flatProfit;
  } else {
    sellingPrice = cost;
  }

  const mrp = Math.max(sellingPrice, rawMrp || Math.round(sellingPrice * 1.5));
  const profitAmount = sellingPrice - cost;
  const profitPercentage = Math.round((profitAmount / cost) * 100);

  return {
    costPrice: cost,
    sellingPrice,
    profitAmount,
    profitPercentage,
    mrp,
  };
};

// 4. Sanitize descriptions & remove supplier branding
export const sanitizeDescription = (rawText: string): string => {
  if (!rawText) return 'High-performance hardware crafted with precision engineering and certified durability.';
  return rawText
    .replace(/dropplier(\.in)?/gi, '')
    .replace(/unlock to buy/gi, '')
    .replace(/membership required/gi, '')
    .replace(/subscribe to view/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .trim();
};

// 5. Automatic Category Mapper
export const mapCategory = (
  tags: string = '',
  title: string = '',
  type: string = ''
): { categoryId: string; categoryName: string } => {
  const combined = `${tags} ${title} ${type}`.toLowerCase();
  if (combined.includes('audio') || combined.includes('earbud') || combined.includes('headphone') || combined.includes('speaker') || combined.includes('sound')) {
    return { categoryId: 'audio', categoryName: 'Audio' };
  }
  if (combined.includes('watch') || combined.includes('strap') || combined.includes('fitness') || combined.includes('band')) {
    return { categoryId: 'watches', categoryName: 'Watches' };
  }
  if (combined.includes('cable') || combined.includes('charger') || combined.includes('power') || combined.includes('adapter') || combined.includes('magsafe')) {
    return { categoryId: 'chargers', categoryName: 'Power & Cables' };
  }
  if (combined.includes('game') || combined.includes('mouse') || combined.includes('keyboard') || combined.includes('rgb')) {
    return { categoryId: 'gaming', categoryName: 'Gaming' };
  }
  if (combined.includes('phone') || combined.includes('smartphone') || combined.includes('mobile')) {
    return { categoryId: 'phones', categoryName: 'Phones' };
  }
  if (combined.includes('case') || combined.includes('cover') || combined.includes('mount') || combined.includes('holder') || combined.includes('stand')) {
    return { categoryId: 'cases', categoryName: 'Cases & Gear' };
  }
  return { categoryId: 'home', categoryName: 'Smart Home' };
};

// 6. Fetch a single page from supplier with limit=250
export const fetchSupplierCollectionPage = async (
  sourceUrl: string,
  page: number,
  limit: number = 250,
  markupRule: ServerMarkupRule
): Promise<{ products: ImportPreviewProduct[]; totalCount?: number; hasNextPage: boolean; sourceOrigin: string }> => {
  const validation = validateExternalUrl(sourceUrl);
  if (!validation.isValid || !validation.url) {
    throw new Error(validation.error || 'Invalid collection source URL.');
  }

  const parsed = validation.url;
  const domain = parsed.hostname;
  const parts = parsed.pathname.split('/').filter(Boolean);
  const colIdx = parts.indexOf('collections');
  let collectionHandle = 'under-499';

  if (colIdx !== -1 && parts[colIdx + 1]) {
    collectionHandle = parts[colIdx + 1].replace(/\.json$/i, '');
  }

  const endpoint = `https://${domain}/collections/${collectionHandle}/products.json?page=${page}&limit=${limit}`;

  let rawProducts: any[] = [];
  let fetchOk = false;

  // Safe fetch with 12s timeout and retries
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products)) {
          rawProducts = data.products;
          fetchOk = true;
          break;
        }
      }
    } catch {
      // Retry once if transient network error
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!fetchOk || rawProducts.length === 0) {
    return {
      products: [],
      hasNextPage: false,
      sourceOrigin: domain,
    };
  }

  // Parse raw products into ImportPreviewProduct format
  const parsedProducts: ImportPreviewProduct[] = rawProducts
    .filter((p: any) => {
      // Filter out digital subscription memberships if present in catalog
      const title = (p.title || '').toLowerCase();
      return !title.includes('dropshipping basic (monthly)') && !title.includes('membership subscription');
    })
    .map((p: any) => {
      const rawCost = p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : 199;
      const rawMrp = p.variants?.[0]?.compare_at_price ? parseFloat(p.variants[0].compare_at_price) : Math.round(rawCost * 1.6);
      const pricing = calculateServerPrice(rawCost, rawMrp, markupRule);

      const images: string[] = Array.isArray(p.images)
        ? p.images.map((img: any) => sanitizeImageUrl(typeof img === 'string' ? img : img.src)).filter(Boolean)
        : p.image?.src
        ? [sanitizeImageUrl(p.image.src)]
        : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'];

      const catMapping = mapCategory(p.tags, p.title, p.product_type);

      const variants: ProductVariant[] = Array.isArray(p.variants)
        ? p.variants.map((v: any, idx: number) => ({
            id: `v-${p.id}-${idx}`,
            title: v.title || 'Standard',
            price: parseFloat(v.price) || pricing.sellingPrice,
            sku: v.sku || `POP-VAR-${p.id}-${idx}`,
            inStock: v.available !== false,
            color: v.option1 || undefined,
          }))
        : [];

      return {
        id: `imported-${p.id}`,
        sourceProductId: String(p.id),
        sourceUrl,
        name: (p.title || 'Trending Product').slice(0, 180),
        slug: (p.handle || p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        brand: (p.vendor || 'Popcarty Essentials').slice(0, 80),
        category: catMapping.categoryName,
        categoryId: catMapping.categoryId,
        subcategory: p.product_type || 'Imported Goods',
        costPrice: rawCost,
        sellingPrice: pricing.sellingPrice,
        mrp: pricing.mrp,
        profitAmount: pricing.profitAmount,
        profitPercentage: pricing.profitPercentage,
        stock: p.variants?.[0]?.inventory_quantity ?? 50,
        sku: p.variants?.[0]?.sku || `POP-IMP-${p.id}`,
        description: sanitizeDescription(p.body_html || p.description || ''),
        shortDescription: (p.title || '').slice(0, 250),
        images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
        variants,
        specifications: {
          'Vendor': p.vendor || 'Popcarty Verified',
          'Product Type': p.product_type || catMapping.categoryName,
        },
        rating: 4.8,
        reviewCount: Math.floor(Math.random() * 80) + 12,
        selected: true,
      };
    });

  return {
    products: parsedProducts,
    hasNextPage: rawProducts.length >= limit,
    sourceOrigin: domain,
  };
};

// 7. Full Collection Discovery Scanner (Traverses ALL available pages without artificial 5-page/250 limit)
export const scanFullSupplierCollection = async (
  sourceUrl: string,
  markupRule: ServerMarkupRule,
  maxPagesSafetyLimit: number = 40,
  onProgress?: (stats: { page: number; foundInBatch: number; cumulative: number }) => void
): Promise<{ products: ImportPreviewProduct[]; totalPages: number; totalFound: number; sourceOrigin: string }> => {
  const allProducts: ImportPreviewProduct[] = [];
  const seenSourceIds = new Set<string>();
  let sourceOrigin = 'dropplier.in';
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPagesSafetyLimit) {
    const pageResult = await fetchSupplierCollectionPage(sourceUrl, page, 250, markupRule);
    sourceOrigin = pageResult.sourceOrigin;

    if (pageResult.products.length === 0) {
      hasMore = false;
      break;
    }

    for (const p of pageResult.products) {
      if (!seenSourceIds.has(p.sourceProductId)) {
        seenSourceIds.add(p.sourceProductId);
        allProducts.push(p);
      }
    }

    if (onProgress) {
      onProgress({ page, foundInBatch: pageResult.products.length, cumulative: allProducts.length });
    }

    if (!pageResult.hasNextPage) {
      hasMore = false;
    } else {
      page++;
      // Polite inter-page delay to prevent rate-limiting
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return {
    products: allProducts,
    totalPages: page,
    totalFound: allProducts.length,
    sourceOrigin,
  };
};

// 8. Convert ImportPreviewProduct into Product
export const convertPreviewToProduct = (item: ImportPreviewProduct, targetCategoryId?: string): Product => {
  const cost = Math.max(1, Number(item.costPrice) || 100);
  const selling = Math.max(1, Number(item.sellingPrice) || cost);
  const mrp = Math.max(selling, Number(item.mrp) || Math.round(selling * 1.5));
  const profitAmount = selling - cost;
  const profitPercentage = Math.round((profitAmount / cost) * 100);
  const discountPercent = mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : 0;

  return {
    id: item.id?.startsWith('prod-') ? item.id : `prod-imp-${item.sourceProductId || Date.now()}`,
    sourceProductId: item.sourceProductId,
    sourceUrl: item.sourceUrl,
    name: item.name.trim().slice(0, 200),
    slug: item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brand: (item.brand || 'Popcarty Verified').slice(0, 80),
    categoryId: targetCategoryId && targetCategoryId !== 'auto' ? targetCategoryId : item.categoryId || 'home',
    subcategory: item.subcategory || 'Imported Goods',
    costPrice: cost,
    price: selling,
    originalPrice: mrp,
    profitAmount,
    profitPercentage,
    discountPercent,
    rating: item.rating || 4.8,
    reviewCount: item.reviewCount || 15,
    isTrending: cost <= 499,
    isFeatured: true,
    isNewArrival: true,
    inStock: true,
    stockQuantity: Math.max(10, Number(item.stock) || 50),
    sku: item.sku || `POP-IMP-${item.sourceProductId || Date.now()}`,
    shortDescription: (item.shortDescription || item.name).slice(0, 250),
    description: item.description || 'High quality verified hardware.',
    images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
    features: [
      'Verified Supplier Quality & High Durability',
      'Fast Dispatch & Secure Protective Packaging',
      '7-Day Return and Replacement Policy',
    ],
    specifications: item.specifications || {},
    colors: Array.isArray(item.variants)
      ? item.variants.map((v: any) => ({
          name: v.title,
          hex: v.color || '#3b82f6',
          inStock: v.inStock !== false,
        }))
      : [],
    variants: item.variants || [],
    badge: cost <= 499 ? 'Under ₹499' : 'Trending Pick',
    status: 'active',
    isImported: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// 9. Asynchronous Full Collection Import Background Runner (Supports 2,000+ Products)
export const startFullImportJob = (
  sourceUrl: string,
  targetCategoryId: string,
  markupRule: ServerMarkupRule,
  adminEmail: string
): ImportJobState => {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const jobState: ImportJobState = {
    id: jobId,
    sourceUrl,
    status: 'scanning',
    targetCategoryId,
    markupRule,
    adminEmail,
    currentPage: 1,
    totalPagesScanned: 0,
    sourceTotalCount: 0,
    productsDiscovered: 0,
    productsImported: 0,
    productsUpdated: 0,
    duplicatesSkipped: 0,
    failedCount: 0,
    errors: [],
    startTime: new Date().toISOString(),
    updatedTime: new Date().toISOString(),
  };

  importJobsStore.set(jobId, jobState);

  // Run in background asynchronously page by page
  (async () => {
    try {
      let page = 1;
      let hasMore = true;
      const maxPages = 40; // Supports up to 10,000 items

      while (hasMore && page <= maxPages) {
        jobState.status = 'importing';
        jobState.currentPage = page;
        jobState.updatedTime = new Date().toISOString();

        const pageResult = await fetchSupplierCollectionPage(sourceUrl, page, 250, markupRule);

        if (pageResult.products.length === 0) {
          hasMore = false;
          break;
        }

        jobState.productsDiscovered += pageResult.products.length;
        jobState.totalPagesScanned = page;

        // Convert and Batch Insert into database
        const batchToSave: Product[] = [];
        for (const item of pageResult.products) {
          try {
            const prod = convertPreviewToProduct(item, targetCategoryId);
            batchToSave.push(prod);
          } catch (err: any) {
            jobState.failedCount++;
            jobState.errors.push({
              id: item.id,
              productName: item.name,
              reason: err.message || 'Validation failed',
            });
          }
        }

        if (batchToSave.length > 0) {
          const insertResult = bulkUpsertProductsInDb(batchToSave, adminEmail, sourceUrl);
          jobState.productsImported += insertResult.imported;
          jobState.productsUpdated += insertResult.updated;
        }

        if (!pageResult.hasNextPage) {
          hasMore = false;
        } else {
          page++;
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      jobState.status = 'completed';
      jobState.sourceTotalCount = jobState.productsDiscovered;
      jobState.duplicatesSkipped = Math.max(0, jobState.productsDiscovered - (jobState.productsImported + jobState.productsUpdated + jobState.failedCount));
      jobState.updatedTime = new Date().toISOString();
    } catch (err: any) {
      jobState.status = 'failed';
      jobState.errorMessage = err.message || 'Import job encountered an error.';
      jobState.updatedTime = new Date().toISOString();
    }
  })();

  return jobState;
};

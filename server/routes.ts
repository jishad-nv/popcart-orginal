import { Router, Request, Response } from 'express';
import {
  requireAdminAuth,
  requireAuth,
  authenticateUser,
  createSessionToken,
  revokeSessionToken,
  extractRequestToken,
  isAdminEmail,
  authenticateAdminCredentials,
  AuthenticatedRequest,
  AuthUser,
} from './auth';
import {
  getAllProductsFromDb,
  getProductByIdFromDb,
  upsertProductInDb,
  deleteProductFromDb,
  bulkDeleteProductsFromDb,
  bulkUpdateProductsInDb,
  bulkUpsertProductsInDb,
  getAllOrdersFromDb,
  getOrderByIdFromDb,
  createOrderInDb,
  updateOrderStatusInDb,
  getCouponsFromDb,
  upsertCouponInDb,
  deleteCouponFromDb,
  getStoreSettingsFromDb,
  updateStoreSettingsInDb,
} from './db';
import {
  fetchSupplierCollectionPage,
  scanFullSupplierCollection,
  startFullImportJob,
  importJobsStore,
  calculateServerPrice,
  ServerMarkupRule,
  validateExternalUrl,
  sanitizeImageUrl,
} from './importerService';
import {
  authRateLimiter,
  importerRateLimiter,
  generalApiRateLimiter,
} from './middleware/rateLimiter';
import { Product, ImportPreviewProduct, Order, OrderStatus, Coupon } from '../src/types';

export const apiRouter = Router();

// Apply General Rate Limiter across API
apiRouter.use(generalApiRateLimiter);

// ==========================================
// 1. AUTHENTICATION ROUTES (PHASE 3 & 4 HARDENING)
// ==========================================

apiRouter.post('/auth/login', authRateLimiter, (req: Request, res: Response): void => {
  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Validation Error', message: 'A valid email address is required.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  // SERVER-SIDE ROLE VERIFICATION: Never trust client-sent role!
  let assignedRole: 'admin' | 'customer' = 'customer';
  let userName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : 'Popcarty User';

  if (isAdminEmail(cleanEmail)) {
    if (!authenticateAdminCredentials(cleanEmail, password)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid administrator email or password.',
      });
      return;
    }
    assignedRole = 'admin';
    userName = 'Store Administrator';
  }

  const user: AuthUser = {
    id: assignedRole === 'admin' ? 'usr-admin' : `usr-${cleanEmail.replace(/[^a-z0-9]/g, '')}`,
    email: cleanEmail,
    name: userName,
    role: assignedRole,
  };

  const token = createSessionToken(user);
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('popcarty_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    token,
    user,
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response): void => {
  const token = extractRequestToken(req);
  if (token) {
    revokeSessionToken(token);
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('popcarty_session', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    success: true,
    message: 'Session terminated and signed out successfully.',
  });
});

apiRouter.get('/auth/me', authenticateUser, (req: AuthenticatedRequest, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'No active session found.' });
    return;
  }
  res.json({ success: true, user: req.user });
});

// ==========================================
// 2. PRODUCT CATALOG ROUTES
// ==========================================

apiRouter.get('/products', (_req: Request, res: Response): void => {
  try {
    const products = getAllProductsFromDb();
    res.json({ success: true, count: products.length, products });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve products.' });
  }
});

apiRouter.get('/products/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid ID', message: 'Product ID is required.' });
    return;
  }

  const product = getProductByIdFromDb(id);
  if (!product) {
    res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
    return;
  }
  res.json({ success: true, product });
});

apiRouter.post('/products', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const payload: Partial<Product> = req.body;
    if (!payload.name || typeof payload.name !== 'string') {
      res.status(400).json({ error: 'Validation Error', message: 'Product title is required.' });
      return;
    }

    const cost = Math.max(1, Number(payload.costPrice) || 100);
    const price = Math.max(1, Number(payload.price) || 150);
    const mrp = Math.max(price, Number(payload.originalPrice) || Math.round(price * 1.5));
    const profitAmount = price - cost;
    const profitPercentage = Math.round((profitAmount / cost) * 100);

    const safeProduct: Product = {
      id: `prod-${Date.now()}`,
      name: payload.name.trim().slice(0, 200),
      slug: (payload.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      brand: String(payload.brand || 'Popcarty Verified').slice(0, 80),
      categoryId: String(payload.categoryId || 'audio'),
      subcategory: payload.subcategory ? String(payload.subcategory).slice(0, 80) : undefined,
      costPrice: cost,
      price,
      originalPrice: mrp,
      profitAmount,
      profitPercentage,
      discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
      rating: 4.8,
      reviewCount: 1,
      isTrending: !!payload.isTrending,
      isFeatured: !!payload.isFeatured,
      isNewArrival: true,
      inStock: payload.status !== 'draft' && Number(payload.stockQuantity || 0) > 0,
      stockQuantity: Math.max(0, Number(payload.stockQuantity) || 50),
      sku: payload.sku ? String(payload.sku).slice(0, 50) : `POP-SKU-${Date.now()}`,
      shortDescription: String(payload.shortDescription || payload.name).slice(0, 250),
      description: String(payload.description || 'High quality verified product.'),
      images: Array.isArray(payload.images) && payload.images.length > 0
        ? payload.images.map((img) => sanitizeImageUrl(String(img)))
        : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
      features: Array.isArray(payload.features) ? payload.features.slice(0, 10) : [],
      specifications: typeof payload.specifications === 'object' && payload.specifications ? payload.specifications : {},
      colors: Array.isArray(payload.colors) ? payload.colors : [],
      variants: Array.isArray(payload.variants) ? payload.variants : [],
      badge: payload.badge ? String(payload.badge).slice(0, 30) : undefined,
      status: payload.status === 'draft' || payload.status === 'archived' ? payload.status : 'active',
      isImported: !!payload.isImported,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = upsertProductInDb(safeProduct);
    res.status(201).json({ success: true, product: saved });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create product.' });
  }
});

apiRouter.put('/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const id = String(req.params.id || '').trim();
    const existing = getProductByIdFromDb(id);
    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
      return;
    }

    const payload = req.body;
    const cost = payload.costPrice !== undefined ? Math.max(1, Number(payload.costPrice)) : existing.costPrice || 100;
    const price = payload.price !== undefined ? Math.max(1, Number(payload.price)) : existing.price;
    const mrp = payload.originalPrice !== undefined ? Math.max(price, Number(payload.originalPrice)) : existing.originalPrice;
    const profitAmount = price - cost;
    const profitPercentage = Math.round((profitAmount / cost) * 100);

    const updated = upsertProductInDb({
      ...existing,
      ...payload,
      id,
      costPrice: cost,
      price,
      originalPrice: mrp,
      profitAmount,
      profitPercentage,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, product: updated });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update product.' });
  }
});

apiRouter.post('/products/bulk-delete', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: 'Validation Error', message: 'Product IDs array is required.' });
      return;
    }
    const deletedCount = bulkDeleteProductsFromDb(ids);
    res.json({ success: true, deletedCount });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to bulk delete products.' });
  }
});

apiRouter.post('/products/bulk-update', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const updates = req.body?.updates || {};
    if (ids.length === 0) {
      res.status(400).json({ error: 'Validation Error', message: 'Product IDs array is required.' });
      return;
    }
    const updatedCount = bulkUpdateProductsInDb(ids, updates);
    res.json({ success: true, updatedCount });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to bulk update products.' });
  }
});

apiRouter.delete('/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const id = String(req.params.id || '').trim();
    const success = deleteProductFromDb(id);
    if (!success) {
      res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
      return;
    }
    res.json({ success: true, message: 'Product deleted.' });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete product.' });
  }
});

// ==========================================
// 3. ADMIN PRODUCT IMPORTER ENGINE (ADMIN ONLY + RATE LIMITED + SSRF HARDENED)
// ==========================================

// Step 1: Scan & Preview Supplier Collection (Traverses complete collection without 250/300 limit)
apiRouter.post(
  '/admin/importer/preview',
  requireAdminAuth,
  importerRateLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { sourceUrl, targetCategoryId, markupRule, scanAllPages } = req.body;

    const urlValidation = validateExternalUrl(sourceUrl);
    if (!urlValidation.isValid) {
      res.status(400).json({
        error: 'Invalid Source URL',
        message: urlValidation.error || 'Please provide a valid HTTP/HTTPS URL.',
      });
      return;
    }

    const rule: ServerMarkupRule = {
      type: markupRule?.type === 'fixed' ? 'fixed' : markupRule?.type === 'none' ? 'none' : 'percent',
      value: Number(markupRule?.value) || 35,
    };

    try {
      if (scanAllPages) {
        // Traverses ALL available collection pages until exhausted (e.g. 2,800+ items across 12+ pages)
        const fullScan = await scanFullSupplierCollection(sourceUrl, rule, 50);

        const processed = fullScan.products.map((p) => {
          if (targetCategoryId && targetCategoryId !== 'auto') {
            return { ...p, categoryId: targetCategoryId };
          }
          return p;
        });

        res.json({
          success: true,
          products: processed,
          totalFound: processed.length,
          pagesScanned: fullScan.totalPages,
          sourceOrigin: fullScan.sourceOrigin,
        });
      } else {
        // Single page fetch (limit 250)
        const singlePage = await fetchSupplierCollectionPage(sourceUrl, 1, 250, rule);

        const processed = singlePage.products.map((p) => {
          if (targetCategoryId && targetCategoryId !== 'auto') {
            return { ...p, categoryId: targetCategoryId };
          }
          return p;
        });

        res.json({
          success: true,
          products: processed,
          totalFound: processed.length,
          pagesScanned: 1,
          sourceOrigin: singlePage.sourceOrigin,
        });
      }
    } catch (err: any) {
      res.status(502).json({
        error: 'Collection Fetch Error',
        message: err.message || 'Failed to fetch collection products.',
      });
    }
  }
);

// Step 2: Start Asynchronous Background Import Job (For 2,000+ Products)
apiRouter.post(
  '/admin/importer/jobs/start',
  requireAdminAuth,
  importerRateLimiter,
  (req: AuthenticatedRequest, res: Response): void => {
    const { sourceUrl, targetCategoryId, markupRule } = req.body;

    const urlValidation = validateExternalUrl(sourceUrl);
    if (!urlValidation.isValid) {
      res.status(400).json({
        error: 'Invalid Source URL',
        message: urlValidation.error || 'Please provide a valid HTTP/HTTPS URL.',
      });
      return;
    }

    const rule: ServerMarkupRule = {
      type: markupRule?.type === 'fixed' ? 'fixed' : markupRule?.type === 'none' ? 'none' : 'percent',
      value: Number(markupRule?.value) || 35,
    };

    const adminEmail = req.user?.email || 'admin@popcarty.com';
    const job = startFullImportJob(sourceUrl, targetCategoryId || 'home', rule, adminEmail);

    res.json({
      success: true,
      jobId: job.id,
      job,
    });
  }
);

// Step 3: Get Status of Background Import Job
apiRouter.get(
  '/admin/importer/jobs/:id',
  requireAdminAuth,
  (req: AuthenticatedRequest, res: Response): void => {
    const jobId = String(req.params.id || '').trim();
    const job = importJobsStore.get(jobId);

    if (!job) {
      res.status(404).json({ error: 'Not Found', message: 'Import job not found.' });
      return;
    }

    res.json({ success: true, job });
  }
);

// Step 4: Direct Confirmed Products Import
apiRouter.post(
  '/admin/importer/import',
  requireAdminAuth,
  importerRateLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { products: rawProducts, markupRule, sourceUrl } = req.body;

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Please select at least one product to import.',
      });
      return;
    }

    const rule: ServerMarkupRule = {
      type: markupRule?.type === 'fixed' ? 'fixed' : markupRule?.type === 'none' ? 'none' : 'percent',
      value: Number(markupRule?.value) || 35,
    };

    const adminEmail = req.user?.email || 'admin@popcarty.com';
    const productsToSave: Product[] = [];
    const errors: { id: string; name: string; reason: string }[] = [];

    // Recalculate price on backend - never trust client pricing!
    for (const item of rawProducts) {
      try {
        if (!item.name || typeof item.name !== 'string') {
          throw new Error('Product title is required');
        }

        const cost = Math.max(1, Number(item.costPrice) || 100);
        const rawMrp = Number(item.mrp) || Math.round(cost * 1.6);
        const pricing = calculateServerPrice(cost, rawMrp, rule);
        const discountPercent =
          pricing.mrp > pricing.sellingPrice
            ? Math.round(((pricing.mrp - pricing.sellingPrice) / pricing.mrp) * 100)
            : 0;

        const storeProduct: Product = {
          id: item.id?.startsWith('prod-') ? item.id : `prod-imp-${item.sourceProductId || Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          sourceProductId: item.sourceProductId ? String(item.sourceProductId) : undefined,
          sourceUrl: sourceUrl || item.sourceUrl,
          name: String(item.name).trim().slice(0, 200),
          slug: (item.slug || item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          brand: (item.brand || 'Popcarty Verified').slice(0, 80),
          categoryId: item.categoryId || 'home',
          subcategory: item.subcategory || 'Imported Goods',
          costPrice: pricing.costPrice,
          price: pricing.sellingPrice,
          originalPrice: pricing.mrp,
          profitAmount: pricing.profitAmount,
          profitPercentage: pricing.profitPercentage,
          discountPercent,
          rating: 4.8,
          reviewCount: Math.floor(Math.random() * 50) + 5,
          isTrending: pricing.costPrice <= 499,
          isFeatured: true,
          isNewArrival: true,
          inStock: true,
          stockQuantity: Math.max(10, Number(item.stock) || 50),
          sku: item.sku || `POP-IMP-${Date.now()}`,
          shortDescription: (item.shortDescription || item.name).slice(0, 250),
          description: String(item.description || 'High quality certified hardware.'),
          images: Array.isArray(item.images) && item.images.length > 0
            ? [sanitizeImageUrl(String(item.images[0]))]
            : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
          features: [
            'Verified Supplier Build & Durability',
            'Fast Dispatch & Secure Packaging',
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
          badge: pricing.costPrice <= 499 ? 'Under ₹499' : 'Trending Pick',
          status: 'active',
          isImported: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        productsToSave.push(storeProduct);
      } catch (err: any) {
        errors.push({
          id: item.id || 'unknown',
          name: item.name || 'Unknown item',
          reason: err.message || 'Validation failed',
        });
      }
    }

    if (productsToSave.length === 0) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'No valid products could be processed.',
        errors,
      });
      return;
    }

    const result = bulkUpsertProductsInDb(productsToSave, adminEmail, sourceUrl || 'dropplier.in');

    res.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      totalProcessed: productsToSave.length,
      errors,
      stats: {
        found: rawProducts.length,
        imported: result.imported,
        updated: result.updated,
        duplicates: rawProducts.length - (result.imported + result.updated),
        errors: errors.length,
      },
    });
  }
);

// ==========================================
// 4. ORDERS ROUTES (WITH IDOR AUTHORIZATION ENFORCEMENT)
// ==========================================

apiRouter.get('/orders', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;

  const orders = getAllOrdersFromDb(userEmail, isAdmin);
  res.json({ success: true, count: orders.length, orders });
});

apiRouter.post('/orders', authenticateUser, (req: AuthenticatedRequest, res: Response): void => {
  const payload = req.body || {};
  const rawPaymentMethod = String(payload.paymentMethod || '').trim().toLowerCase();
  const rawShippingMethod = String(payload.shippingMethod || '').trim().toLowerCase();

  // Strictly reject Cash on Delivery (COD)
  if (
    rawPaymentMethod === 'cod' ||
    rawPaymentMethod === 'cash_on_delivery' ||
    rawPaymentMethod === 'cashondelivery' ||
    rawPaymentMethod.includes('cash on del')
  ) {
    res.status(400).json({
      error: 'Unsupported Payment Method',
      message: 'Cash on Delivery (COD) is not supported. Only online payment methods are accepted.',
    });
    return;
  }

  // Strictly reject Express Priority Air
  if (
    rawShippingMethod === 'express' ||
    rawShippingMethod === 'express_priority_air' ||
    rawShippingMethod.includes('express') ||
    rawShippingMethod.includes('priority air')
  ) {
    res.status(400).json({
      error: 'Unsupported Shipping Method',
      message: 'Express Priority Air shipping is not supported. Only Standard Ground shipping is accepted.',
    });
    return;
  }

  const allowedPaymentMethods = ['card', 'upi', 'apple_pay'];
  if (!allowedPaymentMethods.includes(rawPaymentMethod)) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid payment method. Supported online payment methods: card, upi, apple_pay.',
    });
    return;
  }

  if (rawShippingMethod !== 'standard') {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid shipping method. Supported shipping method: standard.',
    });
    return;
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Order must contain at least one item.',
    });
    return;
  }

  const order: Order = {
    id: payload.id || `ord-${Date.now()}`,
    orderNumber: payload.orderNumber || `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
    userId: req.user?.id || payload.userId || 'guest',
    customerName: String(payload.customerName || req.user?.name || 'Customer').slice(0, 100),
    customerEmail: String(payload.customerEmail || req.user?.email || 'customer@example.com').toLowerCase(),
    customerPhone: String(payload.customerPhone || '+91 98765 43210').slice(0, 30),
    items: payload.items,
    shippingAddress: payload.shippingAddress,
    shippingMethod: 'standard',
    shippingCost: Number(payload.shippingCost) || 0,
    subtotal: Number(payload.subtotal) || 0,
    discountAmount: Number(payload.discountAmount) || 0,
    couponCode: payload.couponCode,
    tax: Number(payload.tax) || 0,
    totalAmount: Number(payload.totalAmount) || 0,
    paymentMethod: rawPaymentMethod as 'card' | 'upi' | 'apple_pay',
    paymentStatus: 'paid',
    orderStatus: 'placed',
    statusHistory: Array.isArray(payload.statusHistory)
      ? payload.statusHistory
      : [
          {
            status: 'placed',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: `Order placed via ${rawPaymentMethod.toUpperCase()}`,
          },
        ],
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  const savedOrder = createOrderInDb(order);
  res.status(201).json({ success: true, order: savedOrder });
});

apiRouter.get('/orders/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;
  const orderId = String(req.params.id || '').trim();

  const order = getOrderByIdFromDb(orderId, userEmail, isAdmin);
  if (!order) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You are not authorized to view this order, or it does not exist.',
    });
    return;
  }
  res.json({ success: true, order });
});

apiRouter.put('/orders/:id/status', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  const orderId = String(req.params.id || '').trim();
  const { status } = req.body;

  const validStatuses: OrderStatus[] = [
    'placed',
    'confirmed',
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ];

  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid order status provided.' });
    return;
  }

  const updated = updateOrderStatusInDb(orderId, status);
  if (!updated) {
    res.status(404).json({ error: 'Not Found', message: 'Order not found.' });
    return;
  }

  res.json({ success: true, order: updated });
});

// ==========================================
// 5. COUPONS & STORE SETTINGS
// ==========================================

apiRouter.get('/coupons', (_req: Request, res: Response): void => {
  const coupons = getCouponsFromDb();
  res.json({ success: true, coupons });
});

apiRouter.post('/coupons', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  const payload: Coupon = req.body;
  if (!payload.code) {
    res.status(400).json({ error: 'Validation Error', message: 'Coupon code is required.' });
    return;
  }
  const saved = upsertCouponInDb({
    ...payload,
    id: `coupon-${Date.now()}`,
    code: payload.code.trim().toUpperCase(),
    usageCount: 0,
  });
  res.status(201).json({ success: true, coupon: saved });
});

apiRouter.delete('/coupons/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  const id = String(req.params.id || '').trim();
  const deleted = deleteCouponFromDb(id);
  if (!deleted) {
    res.status(404).json({ error: 'Not Found', message: 'Coupon not found.' });
    return;
  }
  res.json({ success: true, message: 'Coupon removed.' });
});

apiRouter.get('/settings', (_req: Request, res: Response): void => {
  const settings = getStoreSettingsFromDb();
  res.json({ success: true, settings });
});

apiRouter.put('/settings', requireAdminAuth, (req: AuthenticatedRequest, res: Response): void => {
  const updated = updateStoreSettingsInDb(req.body);
  res.json({ success: true, settings: updated });
});

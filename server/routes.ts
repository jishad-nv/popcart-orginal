import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import {
  requireAdminAuth,
  requireAuth,
  authenticateUser,
  createSessionToken,
  revokeSessionToken,
  extractRequestToken,
  isAdminEmail,
  authenticateAdminCredentials,
  hashPassword,
  verifyPassword,
  generateSalt,
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
  getUserByEmailFromDb,
  getUserByIdFromDb,
  createUserInDb,
  updateUserProfileInDb,
  getUserAddressesFromDb,
  saveUserAddressesInDb,
  StoredUserRecord,
  getDb,
  saveDb,
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

// Fetch collection proxy endpoint for local development and Vercel consistency
apiRouter.all('/fetch-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.method === 'POST' ? req.body : req.query;
    const collectionUrl = body?.collectionUrl || body?.sourceUrl || req.query?.url;
    const page = Number(body?.page || req.query?.page || 1);

    if (!collectionUrl || typeof collectionUrl !== 'string') {
      res.status(400).json({ error: 'Validation Error', message: 'Collection URL is required.' });
      return;
    }

    const parsed = new URL(collectionUrl);
    if (parsed.hostname !== 'dropplier.in' && !parsed.hostname.endsWith('.dropplier.in')) {
      res.status(403).json({ error: 'Forbidden', message: 'Only dropplier.in domain is allowed.' });
      return;
    }

    const result = await fetchSupplierCollectionPage(collectionUrl, page, 250, { type: 'percent', value: 35 });
    res.json({
      success: true,
      page,
      data: { products: result.products },
      sourceOrigin: result.sourceOrigin,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to fetch collection.' });
  }
});

// ==========================================
// 1. AUTHENTICATION ROUTES (PHASE 3 & 4 HARDENING)
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidMobileNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

apiRouter.post('/auth/register', authRateLimiter, (req: Request, res: Response): void => {
  try {
    const { name, email, phone, password } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Validation Error', message: 'Full name is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isAdminEmail(cleanEmail)) {
      res.status(409).json({
        error: 'Duplicate Account',
        message: 'An account with this email address already exists. Please sign in instead.',
      });
      return;
    }

    if (!phone || typeof phone !== 'string' || !isValidMobileNumber(phone.trim())) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Please enter a valid 10-digit mobile number.',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    const existing = getUserByEmailFromDb(cleanEmail);
    if (existing) {
      res.status(409).json({
        error: 'Duplicate Account',
        message: 'An account with this email address already exists. Please sign in instead.',
      });
      return;
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const nowIso = new Date().toISOString();
    const memberSince = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const newUserRecord: StoredUserRecord = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim().slice(0, 80),
      email: cleanEmail,
      phone: phone.trim().slice(0, 25),
      passwordHash,
      salt,
      role: 'customer',
      memberSince,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const saved = createUserInDb(newUserRecord);

    const authUser: AuthUser = {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      phone: saved.phone,
      role: saved.role,
      memberSince: saved.memberSince,
    };

    const token = createSessionToken(authUser);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('popcarty_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      token,
      user: authUser,
    });
  } catch (err: any) {
    if (err?.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({
        error: 'Duplicate Account',
        message: 'An account with this email address already exists. Please sign in instead.',
      });
      return;
    }
    res.status(500).json({
      error: 'Registration Error',
      message: 'An unexpected error occurred while creating your account.',
    });
  }
});

apiRouter.post('/auth/login', authRateLimiter, (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Validation Error', message: 'Password is required to sign in.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check Administrator Authentication
    if (isAdminEmail(cleanEmail)) {
      if (!authenticateAdminCredentials(cleanEmail, password)) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid administrator email or password.',
        });
        return;
      }

      const adminUser: AuthUser = {
        id: 'usr-admin',
        email: cleanEmail,
        name: 'Store Administrator',
        phone: '+91 98765 43210',
        role: 'admin',
        memberSince: 'October 2026',
      };

      const token = createSessionToken(adminUser);
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
        user: adminUser,
      });
      return;
    }

    // 2. Check Persistent Customer Database
    const storedUser = getUserByEmailFromDb(cleanEmail);
    if (!storedUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password. If you are a new shopper, please create an account first.',
      });
      return;
    }

    const isPasswordValid = verifyPassword(password, storedUser.passwordHash, storedUser.salt);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password. Please check your credentials and try again.',
      });
      return;
    }

    const user: AuthUser = {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      phone: storedUser.phone,
      role: storedUser.role,
      memberSince: storedUser.memberSince || 'October 2026',
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
  } catch {
    res.status(500).json({
      error: 'Authentication Error',
      message: 'An unexpected error occurred during sign in.',
    });
  }
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

  // Enrich with latest DB record if customer exists in DB
  if (req.user.role !== 'admin') {
    const dbUser = getUserByIdFromDb(req.user.id) || getUserByEmailFromDb(req.user.email);
    if (dbUser) {
      res.json({
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          phone: dbUser.phone,
          role: dbUser.role,
          memberSince: dbUser.memberSince,
        },
      });
      return;
    }
  }

  res.json({ success: true, user: req.user });
});

apiRouter.put('/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { name, email, phone } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Validation Error', message: 'Full name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Validation Error', message: 'A valid email address is required.' });
      return;
    }

    if (req.user!.role === 'admin') {
      res.json({
        success: true,
        user: {
          ...req.user,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? String(phone).trim() : '+91 98765 43210',
        },
      });
      return;
    }

    const updated = updateUserProfileInDb(userId, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).trim() : '',
    });

    if (!updated) {
      res.json({
        success: true,
        user: {
          ...req.user,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? String(phone).trim() : '',
        },
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
        memberSince: updated.memberSince,
      },
    });
  } catch (err: any) {
    if (err?.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({
        error: 'Duplicate Email',
        message: 'Another account is already using this email address.',
      });
      return;
    }
    res.status(500).json({ error: 'Server Error', message: 'Failed to update profile.' });
  }
});

apiRouter.get('/addresses', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const addresses = getUserAddressesFromDb(req.user!.id);
  res.json({ success: true, addresses });
});

apiRouter.put('/addresses', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const list = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  const saved = saveUserAddressesInDb(req.user!.id, list);
  res.json({ success: true, addresses: saved });
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
// 4. ORDERS & RAZORPAY PAYMENT ROUTES
// ==========================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockKeyId',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mockKeySecret',
});

apiRouter.get('/orders', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const isAdmin = req.user?.role === 'admin';
  const userEmail = req.user?.email;

  const orders = getAllOrdersFromDb(userEmail, isAdmin);
  res.json({ success: true, count: orders.length, orders });
});

apiRouter.post('/create-order', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Validation Error', message: 'Cart is empty.' });
      return;
    }

    const dbProducts = getAllProductsFromDb();
    const settings = getStoreSettingsFromDb();
    const coupons = getCouponsFromDb();

    let subtotal = 0;
    const verifiedItems = items.map((cartItem: any) => {
      const prod = dbProducts.find((p) => p.id === cartItem.productId || p.id === cartItem.product?.id);
      if (!prod) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }
      const price = prod.price;
      const qty = Math.max(1, Number(cartItem.quantity) || 1);
      subtotal += price * qty;
      return {
        productId: prod.id,
        sourceProductId: prod.sourceProductId || prod.id,
        supplierSku: prod.supplierSku || prod.sku || '',
        sku: prod.sku || prod.supplierSku || prod.id,
        productName: prod.name,
        productImage: prod.images?.[0] || 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
        brand: prod.brand || 'Popcarty',
        color: cartItem.selectedColor || '',
        size: cartItem.selectedSize || '',
        variantTitle: cartItem.selectedVariantTitle || cartItem.selectedColor || 'Default',
        costPrice: prod.costPrice || Math.round(prod.price * 0.7),
        price,
        quantity: qty,
      };
    });

    let discountAmount = 0;
    let appliedCouponCode = '';
    if (payload.couponCode) {
      const coupon = coupons.find((c) => c.code.toUpperCase() === String(payload.couponCode).trim().toUpperCase() && c.isActive);
      if (coupon && subtotal >= coupon.minSpend) {
        appliedCouponCode = coupon.code;
        if (coupon.discountType === 'percentage') {
          discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
        } else {
          discountAmount = Math.min(coupon.discountValue, subtotal);
        }
      }
    }

    const taxable = Math.max(0, subtotal - discountAmount);
    const shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;
    const tax = Math.round(taxable * settings.taxRate);
    const totalAmount = Math.max(0, taxable + shippingCost + tax);
    const amountInPaise = Math.round(totalAmount * 100);

    const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: { userId: req.user?.id || 'guest', customerEmail: payload.customerEmail || req.user?.email || '' },
    });

    const newOrder: Order = {
      id: orderNumber,
      orderNumber,
      userId: req.user?.id || payload.userId || 'guest',
      customerName: String(payload.customerName || req.user?.name || 'Customer').slice(0, 100),
      customerEmail: String(payload.customerEmail || req.user?.email || 'customer@example.com').toLowerCase(),
      customerPhone: String(payload.customerPhone || '+91 98765 43210').slice(0, 30),
      items: verifiedItems,
      shippingAddress: payload.shippingAddress,
      shippingMethod: 'standard',
      shippingCost,
      subtotal,
      discountAmount,
      couponCode: appliedCouponCode,
      tax,
      totalAmount,
      paymentMethod: 'upi',
      paymentStatus: 'pending',
      orderStatus: 'placed',
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          note: `Razorpay order initialized (ID: ${rzpOrder.id})`,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    (newOrder as any).razorpayOrderId = rzpOrder.id;
    createOrderInDb(newOrder);

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockKeyId',
      amount: amountInPaise,
      currency: 'INR',
      orderNumber,
      totalAmount,
    });
  } catch (err: any) {
    console.error('Create Razorpay order error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to create payment order.' });
  }
});

apiRouter.post('/verify-payment', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderNumber) {
      res.status(400).json({ error: 'Validation Error', message: 'Missing payment verification parameters.' });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'mockKeySecret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    const bufA = Buffer.from(generatedSignature);
    const bufB = Buffer.from(razorpay_signature);

    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      res.status(400).json({ error: 'Verification Failed', message: 'Invalid payment signature.' });
      return;
    }

    const order = getOrderByIdFromDb(orderNumber);
    if (!order) {
      res.status(404).json({ error: 'Not Found', message: 'Order not found.' });
      return;
    }

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      note: `Payment verified successfully via UPI (Payment ID: ${razorpay_payment_id})`,
    });
    order.updatedAt = new Date().toISOString();

    const db = getDb();
    for (const it of order.items) {
      const prod = db.products.find((p) => p.id === it.productId);
      if (prod) {
        prod.stockQuantity = Math.max(0, prod.stockQuantity - it.quantity);
        prod.inStock = prod.stockQuantity > 0;
      }
    }
    saveDb(db);

    res.json({ success: true, order });
  } catch (err: any) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message || 'Payment verification failed.' });
  }
});

apiRouter.post('/razorpay-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockWebhookSecret';
    const signature = req.headers['x-razorpay-signature'] as string;
    const bodyString = JSON.stringify(req.body);

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(bodyString).digest('hex');
    const bufA = Buffer.from(expectedSignature);
    const bufB = Buffer.from(signature || '');

    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      res.status(400).json({ error: 'Invalid Signature' });
      return;
    }

    const event = req.body?.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      if (rzpOrderId) {
        const db = getDb();
        const order = db.orders.find((o: any) => o.razorpayOrderId === rzpOrderId);
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid';
          order.orderStatus = 'confirmed';
          order.statusHistory.push({
            status: 'confirmed',
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            note: 'Verified via Razorpay Webhook',
          });
          saveDb(db);
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Webhook Error' });
  }
});

apiRouter.post('/orders', authenticateUser, (req: AuthenticatedRequest, res: Response): void => {
  const payload = req.body || {};
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
    paymentMethod: 'upi',
    paymentStatus: payload.paymentStatus || 'pending',
    orderStatus: 'placed',
    statusHistory: payload.statusHistory || [],
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

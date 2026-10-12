// Vercel serverless function: prepares an order and a Razorpay (UPI) payment for it.
// Prices, shipping, tax and coupons are ALL calculated here from Firestore. The browser only sends product ids,
// quantities, the address and a coupon code, so nobody can change what they pay.
// The unpaid order is saved in "pendingOrders". It becomes a real order in "orders" only after the payment is verified.
import crypto from 'node:crypto';

// ---------------- shared helpers (inlined: this function must not import other project files) ----------------
// Small Firestore + Firebase Auth REST helpers for Vercel serverless functions.
// No service-account key is needed: the server signs in as a dedicated "shop server" Firebase user
// (SHOP_BOT_EMAIL / SHOP_BOT_PASSWORD) and Firestore security rules decide what that user may do.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'elemental-bonito-9mn89';
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-auracartmodernec-0fd366e2-b474-47ee-ac89-22d3d6ddd38c';
// Public Firebase web key (not a secret).
const WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBCEQY_CufBR1gR7I2KrgLs1-LN48ch_kc';

const BASE_DB_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
const DOCS = `${BASE_DB_URL}/documents`;

interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
}

/** Checks a customer's Firebase ID token with Google and returns who they are (or null). */
async function verifyIdToken(idToken: string): Promise<VerifiedUser | null> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data: any = await res.json().catch(() => ({}));
    const user = data?.users?.[0];
    if (!res.ok || !user || user.disabled) return null;
    return {
      uid: String(user.localId),
      email: String(user.email || '').toLowerCase(),
      name: String(user.displayName || ''),
    };
  } catch {
    return null;
  }
}

let botCache: { token: string; expiresAt: number } | null = null;
let botSignInPromise: Promise<string> | null = null;

/** ID token of the shop-server user, cached until shortly before it expires. Coalesces concurrent sign-ins. */
async function getBotToken(): Promise<string> {
  if (botCache && botCache.expiresAt > Date.now() + 60_000) return botCache.token;
  if (botSignInPromise) return botSignInPromise;

  botSignInPromise = (async () => {
    try {
      const email = process.env.SHOP_BOT_EMAIL;
      const password = process.env.SHOP_BOT_PASSWORD;
      if (!email || !password) {
        throw new Error('Server account is not configured (SHOP_BOT_EMAIL / SHOP_BOT_PASSWORD).');
      }

      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.idToken) {
        throw new Error(`Server sign-in failed: ${data?.error?.message || res.status}`);
      }
      botCache = { token: data.idToken, expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000 };
      return botCache.token;
    } finally {
      botSignInPromise = null;
    }
  })();

  return botSignInPromise;
}

// ---------- value conversion ----------
const toFs = (v: any): any => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { nullValue: null };
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) fields[k] = toFs(x);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
};

const fromFs = (v: any): any => {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) out[k] = fromFs(x);
    return out;
  }
  return null;
};

const docToObj = (d: any): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, x] of Object.entries(d?.fields || {})) out[k] = fromFs(x);
  return out;
};

const objToFields = (obj: Record<string, any>) => {
  const fields: Record<string, any> = {};
  for (const [k, x] of Object.entries(obj)) if (x !== undefined) fields[k] = toFs(x);
  return fields;
};

const headers = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export class FirestoreError extends Error {
  status: number;
  googleStatus: string;
  googleMessage: string;
  quotaDetails: any[];
  isDailyQuotaExhausted: boolean;
  isTransientRetryable: boolean;
  operation: string;

  constructor(opts: {
    status: number;
    operation: string;
    googleStatus?: string;
    googleMessage?: string;
    quotaDetails?: any[];
    rawText?: string;
  }) {
    const detailMsg = opts.googleMessage || (opts.rawText || '').slice(0, 300) || `HTTP ${opts.status}`;
    super(`${opts.operation} failed (${opts.status}): ${detailMsg}`);
    this.name = 'FirestoreError';
    this.status = opts.status;
    this.operation = opts.operation;
    this.googleStatus = opts.googleStatus || '';
    this.googleMessage = opts.googleMessage || detailMsg;
    this.quotaDetails = opts.quotaDetails || [];

    const lowerMsg = this.googleMessage.toLowerCase();
    // Detect Firebase Spark free-tier daily quota exhaustion vs transient per-minute rate limit
    this.isDailyQuotaExhausted =
      opts.status === 429 &&
      (lowerMsg.includes('quota limit exceeded') ||
        lowerMsg.includes('retry after quota limits are reset') ||
        lowerMsg.includes('enable billing') ||
        lowerMsg.includes('daily'));

    this.isTransientRetryable =
      opts.status === 502 ||
      opts.status === 503 ||
      opts.status === 504 ||
      (opts.status === 429 && !this.isDailyQuotaExhausted);
  }
}

const parseFirestoreFailure = async (res: Response, operation: string): Promise<never> => {
  const text = await res.text().catch(() => '');
  let googleStatus = '';
  let googleMessage = '';
  let quotaDetails: any[] = [];

  try {
    const parsed = JSON.parse(text);
    const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    if (errObj && typeof errObj === 'object') {
      googleStatus = String(errObj.status || '');
      googleMessage = String(errObj.message || '');
      if (Array.isArray(errObj.details)) {
        quotaDetails = errObj.details;
      }
    }
  } catch {
    // Non-JSON response body
  }

  throw new FirestoreError({
    status: res.status,
    operation,
    googleStatus,
    googleMessage,
    quotaDetails,
    rawText: text,
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bounded exponential backoff with jitter ONLY for transient errors (502/503/504 or burst 429).
 * Immediately throws without retrying if the daily quota is exhausted or if the error is a 4xx client/conflict error.
 */
async function withFirestoreRetry<T>(operation: string, fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isRetryable =
        err instanceof FirestoreError
          ? err.isTransientRetryable
          : err?.name === 'TypeError' || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';

      if (!isRetryable || attempt >= maxAttempts) {
        if (err instanceof FirestoreError) {
          console.error(
            JSON.stringify({
              level: 'error',
              context: 'firestore_operation_failed',
              operation: err.operation,
              httpStatus: err.status,
              googleStatus: err.googleStatus,
              googleMessage: err.googleMessage,
              isDailyQuotaExhausted: err.isDailyQuotaExhausted,
              quotaDetails: err.quotaDetails,
              attempts: attempt,
              projectId: PROJECT_ID,
              databaseId: DATABASE_ID,
            })
          );
        }
        throw err;
      }

      const baseDelay = Math.min(1000, 200 * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * 150);
      await sleep(baseDelay + jitter);
    }
  }
}

/** Reads one document ("collection/id"). Returns null when it does not exist. */
async function fsGet(path: string, token?: string): Promise<Record<string, any> | null> {
  return withFirestoreRetry(`Read ${path}`, async () => {
    const res = await fetch(`${DOCS}/${path}`, { headers: headers(token) });
    if (res.status === 404) return null;
    if (!res.ok) await parseFirestoreFailure(res, `Read ${path}`);
    return docToObj(await res.json());
  });
}

/**
 * Reads multiple distinct documents in a SINGLE Firestore REST `documents:batchGet` request.
 * Paths are relative to `/documents/`, e.g. `["products/prod-1", "products/prod-2", "settings/store"]`.
 * Returns a Map from relative path (`collection/docId`) to parsed document object (or null if missing).
 */
async function fsBatchGet(paths: string[], token?: string): Promise<Map<string, Record<string, any> | null>> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const result = new Map<string, Record<string, any> | null>();
  if (uniquePaths.length === 0) return result;

  // If only 1 path is requested, a single GET is equally efficient and simpler
  if (uniquePaths.length === 1) {
    const singlePath = uniquePaths[0];
    const docObj = await fsGet(singlePath, token);
    result.set(singlePath, docObj);
    return result;
  }

  const fullDocPrefix = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/`;
  const fullNames = uniquePaths.map((p) => `${fullDocPrefix}${p}`);

  return withFirestoreRetry(`BatchGet (${uniquePaths.length} docs: ${uniquePaths.slice(0, 5).join(', ')})`, async () => {
    const res = await fetch(`${BASE_DB_URL}/documents:batchGet`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ documents: fullNames }),
    });
    if (!res.ok) {
      await parseFirestoreFailure(res, `Read ${uniquePaths[0]}`);
    }

    const entries: any[] = await res.json();
    for (const p of uniquePaths) {
      result.set(p, null);
    }

    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry?.found?.name) {
          const relPath = String(entry.found.name).startsWith(fullDocPrefix)
            ? String(entry.found.name).slice(fullDocPrefix.length)
            : String(entry.found.name).split('/documents/').pop() || '';
          if (relPath) {
            result.set(relPath, docToObj(entry.found));
          }
        } else if (entry?.missing) {
          const relPath = String(entry.missing).startsWith(fullDocPrefix)
            ? String(entry.missing).slice(fullDocPrefix.length)
            : String(entry.missing).split('/documents/').pop() || '';
          if (relPath) {
            result.set(relPath, null);
          }
        }
      }
    }

    return result;
  });
}

/**
 * Queries a single coupon document matching `code == wanted` using `:runQuery` with `limit: 1`
 * instead of listing 200 documents from the `coupons` collection.
 */
async function fsQueryCouponByCode(wantedCode: string, token?: string): Promise<Record<string, any> | null> {
  return withFirestoreRetry(`Query coupon ${wantedCode}`, async () => {
    const res = await fetch(`${BASE_DB_URL}/documents:runQuery`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'coupons' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'code' },
              op: 'EQUAL',
              value: { stringValue: wantedCode },
            },
          },
          limit: 1,
        },
      }),
    });
    if (res.status === 404) return null;
    if (!res.ok) await parseFirestoreFailure(res, `Query coupons/${wantedCode}`);
    const rows: any[] = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      if (row?.document) {
        return {
          __id: String(row.document.name).split('/').pop(),
          ...docToObj(row.document),
        };
      }
    }
    return null;
  });
}

/** Creates a document; throws FirestoreError(409) when the id already exists. */
async function fsCreate(collection: string, id: string, obj: Record<string, any>, token: string) {
  return withFirestoreRetry(`Create ${collection}/${id}`, async () => {
    const res = await fetch(`${DOCS}/${collection}?documentId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ fields: objToFields(obj) }),
    });
    if (!res.ok) await parseFirestoreFailure(res, `Create ${collection}/${id}`);
  });
}

// ---------------- Warm-Instance Caches & Idempotency State ----------------
const DEFAULT_SETTINGS = { freeShippingThreshold: 1999, standardShippingFee: 99, taxRate: 0.12 };
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for non-stock store settings
let settingsCache: { data: typeof DEFAULT_SETTINGS; expiresAt: number } | null = null;

// Same coupons the storefront ships with. Coupons stored in Firestore (collection "coupons") win.
const DEFAULT_COUPONS: any[] = [
  { code: 'POPCART30', discountType: 'percentage', discountValue: 30, minSpend: 2500, expiryDate: '2026-12-31', isActive: true },
  { code: 'WELCOME20', discountType: 'percentage', discountValue: 20, minSpend: 1500, expiryDate: '2026-12-31', isActive: true },
  { code: 'FLAT500', discountType: 'fixed', discountValue: 500, minSpend: 2000, expiryDate: '2026-12-31', isActive: true },
];
const couponCache = new Map<string, { coupon: Record<string, any> | null; expiresAt: number }>();
const COUPON_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CachedCheckoutResponse {
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  totals: { subtotal: number; shippingCost: number; discountAmount: number; tax: number; totalAmount: number };
  prefill: { name: string; email: string; contact: string };
  createdAtMs: number;
}

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const inFlightCheckouts = new Map<string, Promise<CachedCheckoutResponse>>();
const recentPendingOrders = new Map<string, CachedCheckoutResponse>();

function pruneIdempotencyCache() {
  const now = Date.now();
  for (const [k, v] of recentPendingOrders.entries()) {
    if (now - v.createdAtMs > IDEMPOTENCY_WINDOW_MS) {
      recentPendingOrders.delete(k);
    }
  }
}

const clean = (v: any, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: any, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);
const digits = (v: any) => String(v ?? '').replace(/\D/g, '');
const tenDigits = (v: any) => {
  let d = digits(v);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
const coord = (v: any, limit: number) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

const bad = (res: any, status: number, message: string, extra?: Record<string, any>) =>
  res.status(status).json({ error: 'Order Error', message, ...(extra || {}) });

interface CartLineItem {
  lineKey: string;
  productId: string;
  quantity: number;
  color: string;
  size: string;
  variantTitle: string;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return bad(res, 503, 'Online payment is not available yet. Please try again later.');
  }

  // 1. Who is ordering?
  const authHeader: string = req.headers?.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = idToken ? await verifyIdToken(idToken) : null;
  if (!user) return bad(res, 401, 'Please sign in to place your order.');

  // 2. Validate the request
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length < 1 || rawItems.length > 40) return bad(res, 400, 'Your cart is empty or too large.');

  // Preserve distinct variant lines while tracking total quantity per productId
  const lines = new Map<string, CartLineItem>();
  const productQuantityTotals = new Map<string, number>();

  for (const it of rawItems) {
    const productId = String(it?.productId || '');
    const quantity = Number(it?.quantity);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(productId)) return bad(res, 400, 'Invalid product in cart.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return bad(res, 400, 'Invalid quantity.');

    const color = clean(it?.color, 40);
    const size = clean(it?.size, 40);
    const variantTitle = clean(it?.variantTitle, 80);
    const lineKey = `${productId}::${color.toLowerCase()}::${size.toLowerCase()}::${variantTitle.toLowerCase()}`;

    const existing = lines.get(lineKey);
    if (existing) {
      existing.quantity = Math.min(20, existing.quantity + quantity);
    } else {
      lines.set(lineKey, {
        lineKey,
        productId,
        quantity,
        color,
        size,
        variantTitle,
      });
    }

    const currentProdQty = productQuantityTotals.get(productId) || 0;
    productQuantityTotals.set(productId, Math.min(40, currentProdQty + quantity));
  }

  const a = body.shippingAddress || {};
  const name = clean(a.fullName || a.name, 80);
  const phone = tenDigits(a.phone);
  const alternatePhone = tenDigits(a.alternatePhone);
  const zip = digits(a.zipCode || a.pincode).slice(0, 6);
  const address = {
    id: clean(a.id, 60),
    userId: user.uid,
    name,
    fullName: name,
    phone,
    alternatePhone: /^[6-9]\d{9}$/.test(alternatePhone) ? alternatePhone : '',
    email: clean(a.email, 120).toLowerCase(),
    houseNo: clean(a.houseNo, 60),
    street: clean(a.street, 120),
    area: clean(a.area, 120),
    landmark: clean(a.landmark, 100),
    city: clean(a.city, 80),
    district: clean(a.district, 80),
    state: clean(a.state, 80),
    zipCode: zip,
    pincode: zip,
    country: 'India',
    latitude: coord(a.latitude ?? a.lat, 90),
    longitude: coord(a.longitude ?? a.lng, 180),
    deliveryInstructions: clean(a.deliveryInstructions, 200),
    isDefault: false,
    label: ['Home', 'Work', 'Other'].includes(String(a.label)) ? String(a.label) : 'Home',
  };
  if (address.name.length < 2) return bad(res, 400, 'Please enter the receiver name.');
  if (!/^[6-9]\d{9}$/.test(address.phone)) return bad(res, 400, 'Please enter a valid 10-digit mobile number.');
  if ([address.houseNo, address.street, address.area].join(' ').trim().length < 5) {
    return bad(res, 400, 'Please enter the house/flat number and street address.');
  }
  if (address.city.length < 2) return bad(res, 400, 'Please enter the city.');
  if (address.state.length < 2) return bad(res, 400, 'Please enter the state.');
  if (!/^[1-9]\d{5}$/.test(address.zipCode)) return bad(res, 400, 'Please enter a valid 6-digit PIN code.');

  const wantedCoupon = clean(body.couponCode, 40).toUpperCase();

  // Compute server-authoritative idempotency fingerprint & deterministic 8-digit ORD-XXXXXXXX candidate
  pruneIdempotencyCache();
  const canonicalCart = [...lines.values()]
    .sort((x, y) => x.lineKey.localeCompare(y.lineKey))
    .map((l) => `${l.productId}:${l.quantity}:${l.color}:${l.size}:${l.variantTitle}`)
    .join('|');
  const canonicalAddr = `${address.name}|${address.phone}|${address.zipCode}|${address.houseNo}|${address.street}|${address.city}|${address.state}`;
  const timeBucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
  const idempotencyHash = crypto
    .createHmac('sha256', keySecret)
    .update(`${user.uid}||${canonicalCart}||${canonicalAddr}||${wantedCoupon}||${timeBucket}`)
    .digest();
  const idempotencyKey = idempotencyHash.toString('hex').slice(0, 32);
  const deterministicDigits = 10000000 + (idempotencyHash.readUInt32BE(0) % 90000000);
  const candidateOrderNumber = `ORD-${deterministicDigits}`;

  // Fast path 1: Reuse recent unpaid pending order from warm instance memory (0 Firestore reads)
  const cachedOrder = recentPendingOrders.get(idempotencyKey);
  if (cachedOrder && Date.now() - cachedOrder.createdAtMs < IDEMPOTENCY_WINDOW_MS) {
    return res.status(200).json({
      success: true,
      orderNumber: cachedOrder.orderNumber,
      razorpayOrderId: cachedOrder.razorpayOrderId,
      keyId: cachedOrder.keyId,
      amount: cachedOrder.amount,
      currency: cachedOrder.currency,
      totals: cachedOrder.totals,
      prefill: cachedOrder.prefill,
    });
  }

  // Fast path 2: Coalesce concurrent identical requests (e.g. rapid double-clicks)
  const existingInFlight = inFlightCheckouts.get(idempotencyKey);
  if (existingInFlight) {
    try {
      const result = await existingInFlight;
      return res.status(200).json({
        success: true,
        orderNumber: result.orderNumber,
        razorpayOrderId: result.razorpayOrderId,
        keyId: result.keyId,
        amount: result.amount,
        currency: result.currency,
        totals: result.totals,
        prefill: result.prefill,
      });
    } catch (err: any) {
      return handleOrderException(res, err);
    }
  }

  const checkoutPromise = (async (): Promise<CachedCheckoutResponse> => {
    const botToken = await getBotToken();

    // 3. Batch-read all unique cart product documents (+ settings/store if cache expired + candidate pending/completed order)
    const uniqueProductIds = Array.from(productQuantityTotals.keys());
    const productPaths = uniqueProductIds.map((id) => `products/${id}`);
    const needSettingsFetch = !settingsCache || settingsCache.expiresAt <= Date.now();
    const pendingOrderPath = `pendingOrders/${candidateOrderNumber}`;
    const completedOrderPath = `orders/${candidateOrderNumber}`;

    const batchPaths = [
      ...productPaths,
      ...(needSettingsFetch ? ['settings/store'] : []),
      pendingOrderPath,
      completedOrderPath,
    ];

    const docsMap = await fsBatchGet(batchPaths, botToken);

    // Check if an identical pending order was already created (e.g. across cold starts) and is still unpaid
    const existingCompleted = docsMap.get(completedOrderPath);
    const existingPending = docsMap.get(pendingOrderPath);

    // Validate every unique product once and store in a map for line construction
    const validatedProducts = new Map<string, Record<string, any>>();
    for (const productId of uniqueProductIds) {
      const p = docsMap.get(`products/${productId}`);
      if (!p) {
        throw new ClientOrderError(409, 'A product in your cart is no longer available. Please refresh the page.');
      }
      if (p.inStock === false || p.status === 'inactive' || p.status === 'draft' || p.status === 'archived') {
        throw new ClientOrderError(
          409,
          `"${clean(p.name, 60)}" is out of stock. Please remove it from your cart.`
        );
      }
      const totalWantedQty = productQuantityTotals.get(productId) || 1;
      if (typeof p.stockQuantity === 'number' && Number.isFinite(p.stockQuantity) && p.stockQuantity < totalWantedQty) {
        if (p.stockQuantity <= 0) {
          throw new ClientOrderError(
            409,
            `"${clean(p.name, 60)}" is out of stock. Please remove it from your cart.`
          );
        }
        throw new ClientOrderError(
          409,
          `Only ${p.stockQuantity} unit(s) of "${clean(p.name, 60)}" are available in stock.`
        );
      }
      const price = Number(p.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new ClientOrderError(409, 'A product has no valid price. Please try again later.');
      }
      validatedProducts.set(productId, p);
    }

    // Build order line items reusing the already-fetched product documents
    let subtotal = 0;
    const orderItems: any[] = [];
    for (const line of lines.values()) {
      const p = validatedProducts.get(line.productId)!;
      // Check variant availability if variants exist on the product document
      if (Array.isArray(p.variants) && p.variants.length > 0 && (line.variantTitle || line.color)) {
        const matchedVariant = p.variants.find(
          (v: any) =>
            (line.variantTitle && String(v?.title || '').toLowerCase() === line.variantTitle.toLowerCase()) ||
            (line.color && String(v?.color || '').toLowerCase() === line.color.toLowerCase())
        );
        if (matchedVariant && matchedVariant.inStock === false) {
          throw new ClientOrderError(
            409,
            `The selected option for "${clean(p.name, 60)}" is out of stock.`
          );
        }
      }

      const price = Number(p.price);
      subtotal += price * line.quantity;
      const specs = (p.specifications && typeof p.specifications === 'object' ? p.specifications : {}) as any;
      orderItems.push({
        productId: line.productId,
        sourceProductId: clean(p.sourceProductId, 40) || line.productId,
        supplierSku: clean(specs.supplierSku || p.supplierSku, 80),
        sku: clean(p.sku || specs.supplierSku, 80) || line.productId,
        supplierHandle: clean(specs.supplierHandle, 160),
        supplierVariantId: clean(specs.supplierVariantId, 40),
        productName: clean(p.name, 200),
        productImage: Array.isArray(p.images) ? String(p.images[0] || '') : '',
        brand: clean(p.brand, 80) || 'Popcarty',
        color: line.color,
        size: line.size,
        variantTitle: line.variantTitle || line.color || 'Default',
        costPrice: Number.isFinite(Number(p.costPrice)) ? Number(p.costPrice) : 0,
        price,
        quantity: line.quantity,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // 4. Shipping, coupon, tax (same formulas the storefront shows)
    let settings = DEFAULT_SETTINGS;
    if (needSettingsFetch) {
      const stored = docsMap.get('settings/store') || {};
      settings = {
        freeShippingThreshold: num(stored.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
        standardShippingFee: num(stored.standardShippingFee, DEFAULT_SETTINGS.standardShippingFee),
        taxRate: Math.min(1, num(stored.taxRate, DEFAULT_SETTINGS.taxRate)),
      };
      settingsCache = { data: settings, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    } else if (settingsCache) {
      settings = settingsCache.data;
    }

    const shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;

    let discountAmount = 0;
    let couponCode = '';
    if (wantedCoupon) {
      let coupon: Record<string, any> | null = null;
      const cachedCoupon = couponCache.get(wantedCoupon);
      if (cachedCoupon && cachedCoupon.expiresAt > Date.now()) {
        coupon = cachedCoupon.coupon;
      } else {
        try {
          coupon = await fsQueryCouponByCode(wantedCoupon, botToken);
        } catch {
          coupon = null;
        }
        if (!coupon) {
          coupon = DEFAULT_COUPONS.find((c) => String(c.code).toUpperCase() === wantedCoupon) || null;
        }
        couponCache.set(wantedCoupon, { coupon, expiresAt: Date.now() + COUPON_CACHE_TTL_MS });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (!coupon || coupon.isActive === false || (coupon.expiryDate && String(coupon.expiryDate) < today)) {
        throw new ClientOrderError(400, 'This coupon is invalid or expired.');
      }
      if (subtotal < num(coupon.minSpend, 0)) {
        throw new ClientOrderError(400, `This coupon needs a minimum spend of ₹${num(coupon.minSpend, 0)}.`);
      }
      discountAmount =
        coupon.discountType === 'percentage'
          ? Math.round((subtotal * num(coupon.discountValue, 0)) / 100)
          : Math.min(num(coupon.discountValue, 0), subtotal);
      couponCode = String(coupon.code).toUpperCase();
    }

    const tax = Math.round(Math.max(0, subtotal - discountAmount) * settings.taxRate);
    const totalAmount = Math.max(0, Math.round((subtotal - discountAmount + shippingCost + tax) * 100) / 100);
    const amountPaise = Math.round(totalAmount * 100);
    if (amountPaise < 100) {
      throw new ClientOrderError(400, 'The order total is too low to pay online.');
    }

    // If an identical unpaid pendingOrder already exists in Firestore (and wasn't converted yet), reuse it!
    if (
      !existingCompleted &&
      existingPending &&
      existingPending.userId === user.uid &&
      existingPending.converted !== true &&
      existingPending.idempotencyKey === idempotencyKey &&
      existingPending.amountPaise === amountPaise &&
      typeof existingPending.razorpayOrderId === 'string' &&
      existingPending.razorpayOrderId.length > 4
    ) {
      const reused: CachedCheckoutResponse = {
        orderNumber: candidateOrderNumber,
        razorpayOrderId: existingPending.razorpayOrderId,
        keyId,
        amount: amountPaise,
        currency: 'INR',
        totals: { subtotal, shippingCost, discountAmount, tax, totalAmount },
        prefill: { name: address.name, email: address.email || user.email, contact: address.phone },
        createdAtMs: Date.now(),
      };
      recentPendingOrders.set(idempotencyKey, reused);
      return reused;
    }

    // Determine final orderNumber (use deterministic candidateOrderNumber unless already taken)
    const orderNumber =
      !existingCompleted && !existingPending
        ? candidateOrderNumber
        : `ORD-${crypto.randomInt(10000000, 99999999)}`;

    // 5. Razorpay order for exactly that amount
    const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: orderNumber,
        notes: { orderNumber, uid: user.uid },
      }),
    });
    const rz: any = await rzRes.json().catch(() => ({}));
    if (!rzRes.ok || !rz.id) {
      console.error('Razorpay order failed', rzRes.status, JSON.stringify(rz).slice(0, 300));
      throw new ClientOrderError(502, 'Could not start the payment. Please try again.');
    }

    // 6. Save the UNPAID order. It moves to "orders" after the payment is verified.
    const nowIso = new Date().toISOString();
    const pendingDoc = {
      id: orderNumber,
      orderNumber,
      idempotencyKey,
      userId: user.uid,
      customerName: address.name,
      customerEmail: address.email || user.email,
      customerPhone: address.phone,
      items: orderItems,
      shippingAddress: address,
      shippingMethod: 'standard',
      shippingCost,
      subtotal,
      discountAmount,
      couponCode,
      tax,
      totalAmount,
      amountPaise,
      paymentMethod: 'upi',
      paymentGateway: 'razorpay',
      paymentStatus: 'pending',
      razorpayOrderId: rz.id,
      orderStatus: 'placed',
      trackingNumber: '',
      courierName: '',
      adminNotes: '',
      statusHistory: [],
      converted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await fsCreate('pendingOrders', orderNumber, pendingDoc, botToken);
    } catch (err: any) {
      if (err instanceof FirestoreError && err.status === 409) {
        const currentPending = await fsGet(`pendingOrders/${orderNumber}`, botToken);
        if (currentPending && currentPending.userId === user.uid && currentPending.razorpayOrderId) {
          const recovered: CachedCheckoutResponse = {
            orderNumber,
            razorpayOrderId: currentPending.razorpayOrderId,
            keyId,
            amount: currentPending.amountPaise || amountPaise,
            currency: 'INR',
            totals: { subtotal, shippingCost, discountAmount, tax, totalAmount },
            prefill: { name: address.name, email: address.email || user.email, contact: address.phone },
            createdAtMs: Date.now(),
          };
          recentPendingOrders.set(idempotencyKey, recovered);
          return recovered;
        }
      }
      throw err;
    }

    const createdResponse: CachedCheckoutResponse = {
      orderNumber,
      razorpayOrderId: rz.id,
      keyId,
      amount: amountPaise,
      currency: 'INR',
      totals: { subtotal, shippingCost, discountAmount, tax, totalAmount },
      prefill: { name: address.name, email: address.email || user.email, contact: address.phone },
      createdAtMs: Date.now(),
    };
    recentPendingOrders.set(idempotencyKey, createdResponse);
    return createdResponse;
  })();

  inFlightCheckouts.set(idempotencyKey, checkoutPromise);

  try {
    const result = await checkoutPromise;
    return res.status(200).json({
      success: true,
      orderNumber: result.orderNumber,
      razorpayOrderId: result.razorpayOrderId,
      keyId: result.keyId,
      amount: result.amount,
      currency: result.currency,
      totals: result.totals,
      prefill: result.prefill,
    });
  } catch (err: any) {
    return handleOrderException(res, err);
  } finally {
    inFlightCheckouts.delete(idempotencyKey);
  }
}

class ClientOrderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function handleOrderException(res: any, err: any) {
  if (err instanceof ClientOrderError) {
    return bad(res, err.status, err.message);
  }

  if (err instanceof FirestoreError) {
    console.error('create-order error:', err.message);
    if (err.status === 429) {
      res.setHeader('Retry-After', err.isDailyQuotaExhausted ? '3600' : '30');
      return bad(
        res,
        429,
        'Our checkout service is experiencing high traffic right now. Your cart and delivery details are saved — please wait a moment and try again.',
        {
          code: err.isDailyQuotaExhausted ? 'FIRESTORE_DAILY_QUOTA_EXCEEDED' : 'FIRESTORE_RATE_LIMITED',
          retryable: true,
        }
      );
    }
    if (err.status === 502 || err.status === 503 || err.status === 504) {
      res.setHeader('Retry-After', '15');
      return bad(
        res,
        503,
        'The checkout service is temporarily busy. Your cart and delivery details are saved — please try again in a few seconds.',
        {
          code: 'SERVICE_UNAVAILABLE',
          retryable: true,
        }
      );
    }
  }

  console.error('create-order error:', err?.message || err);
  return bad(res, 500, 'Could not place your order right now. Your cart is saved — please try again in a moment.');
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

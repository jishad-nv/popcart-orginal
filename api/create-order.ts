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

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

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

/** ID token of the shop-server user, cached until shortly before it expires. */
async function getBotToken(): Promise<string> {
  if (botCache && botCache.expiresAt > Date.now() + 60_000) return botCache.token;

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

class FirestoreError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const fail = async (res: Response, what: string) => {
  const text = await res.text().catch(() => '');
  throw new FirestoreError(res.status, `${what} failed (${res.status}): ${text.slice(0, 200)}`);
};

/** Reads one document ("collection/id"). Returns null when it does not exist. */
async function fsGet(path: string, token?: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, `Read ${path}`);
  return docToObj(await res.json());
}

/** Lists up to `max` documents of a collection (ids included as `__id`). */
async function fsList(collection: string, token?: string, max = 500): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  let pageToken = '';
  while (out.length < max) {
    const url = `${DOCS}/${collection}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: headers(token) });
    if (res.status === 404) break;
    if (!res.ok) await fail(res, `List ${collection}`);
    const data: any = await res.json();
    for (const d of data.documents || []) {
      out.push({ __id: String(d.name).split('/').pop(), ...docToObj(d) });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

/** Creates a document; throws FirestoreError(409) when the id already exists. */
async function fsCreate(collection: string, id: string, obj: Record<string, any>, token: string) {
  const res = await fetch(`${DOCS}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ fields: objToFields(obj) }),
  });
  if (!res.ok) await fail(res, `Create ${collection}/${id}`);
}

/** Updates only the given top-level fields of an existing document. */
async function fsUpdate(path: string, obj: Record<string, any>, token: string) {
  const mask = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const res = await fetch(`${DOCS}/${path}?${mask}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ fields: objToFields(obj) }),
  });
  if (!res.ok) await fail(res, `Update ${path}`);
}

// Turns an unpaid "pendingOrders" document into a real, paid "orders" document.
// Used by both /api/verify-payment and /api/razorpay-webhook, so it must be safe to call twice.

const stamp = () =>
  new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

async function finalizePaidOrder(
  orderNumber: string,
  razorpayPaymentId: string,
  token: string
): Promise<Record<string, any>> {
  const existing = await fsGet(`orders/${orderNumber}`, token);
  if (existing) return existing;

  const pending = await fsGet(`pendingOrders/${orderNumber}`, token);
  if (!pending) throw new Error('Pending order not found');

  const now = new Date().toISOString();
  const { converted, ...rest } = pending;
  const order = {
    ...rest,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    orderStatus: 'placed',
    razorpayPaymentId,
    paidAt: now,
    updatedAt: now,
    statusHistory: [{ status: 'placed', timestamp: stamp(), note: 'Order placed and paid via UPI (Razorpay)' }],
  };

  try {
    await fsCreate('orders', orderNumber, order, token);
  } catch (err: any) {
    if (err instanceof FirestoreError && err.status === 409) {
      return (await fsGet(`orders/${orderNumber}`, token)) || order;
    }
    throw err;
  }
  try {
    await fsUpdate(`pendingOrders/${orderNumber}`, { converted: true, paidAt: now }, token);
  } catch {
    /* not critical */
  }
  return order;
}
// ---------------- end of shared helpers ----------------


const DEFAULT_SETTINGS = { freeShippingThreshold: 1999, standardShippingFee: 99, taxRate: 0.12 };

// Same coupons the storefront ships with. Coupons stored in Firestore (collection "coupons") win.
const DEFAULT_COUPONS: any[] = [
  { code: 'POPCART30', discountType: 'percentage', discountValue: 30, minSpend: 2500, expiryDate: '2026-12-31', isActive: true },
  { code: 'WELCOME20', discountType: 'percentage', discountValue: 20, minSpend: 1500, expiryDate: '2026-12-31', isActive: true },
  { code: 'FLAT500', discountType: 'fixed', discountValue: 500, minSpend: 2000, expiryDate: '2026-12-31', isActive: true },
];

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

const bad = (res: any, status: number, message: string) => res.status(status).json({ error: 'Order Error', message });

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

  const lines = new Map<string, { productId: string; quantity: number; color: string; size: string; variantTitle: string }>();
  for (const it of rawItems) {
    const productId = String(it?.productId || '');
    const quantity = Number(it?.quantity);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(productId)) return bad(res, 400, 'Invalid product in cart.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return bad(res, 400, 'Invalid quantity.');
    const existing = lines.get(productId);
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else {
      lines.set(productId, {
        productId,
        quantity,
        color: clean(it?.color, 40),
        size: clean(it?.size, 40),
        variantTitle: clean(it?.variantTitle, 80),
      });
    }
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

  try {
    const botToken = await getBotToken();

    // 3. Real prices from Firestore
    const productDocs = await Promise.all(
      [...lines.keys()].map((id) => fsGet(`products/${encodeURIComponent(id)}`, botToken))
    );
    let subtotal = 0;
    const orderItems: any[] = [];
    let index = 0;
    for (const line of lines.values()) {
      const p = productDocs[index++];
      if (!p) return bad(res, 409, 'A product in your cart is no longer available. Please refresh the page.');
      if (p.inStock === false || p.status === 'inactive') {
        return bad(res, 409, `"${clean(p.name, 60)}" is out of stock. Please remove it from your cart.`);
      }
      const price = Number(p.price);
      if (!Number.isFinite(price) || price <= 0) return bad(res, 409, 'A product has no valid price. Please try again later.');
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
    let stored: Record<string, any> = {};
    try {
      stored = (await fsGet('settings/store', botToken)) || {};
    } catch {
      stored = {}; // settings are optional, fall back to the defaults
    }
    const settings = {
      freeShippingThreshold: num(stored.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
      standardShippingFee: num(stored.standardShippingFee, DEFAULT_SETTINGS.standardShippingFee),
      taxRate: Math.min(1, num(stored.taxRate, DEFAULT_SETTINGS.taxRate)),
    };
    const shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;

    let discountAmount = 0;
    let couponCode = '';
    const wanted = clean(body.couponCode, 40).toUpperCase();
    if (wanted) {
      let pool: any[] = [];
      try {
        pool = (await fsList('coupons', botToken, 200)).filter((c) => c.code);
      } catch {
        pool = [];
      }
      if (pool.length === 0) pool = DEFAULT_COUPONS;
      const today = new Date().toISOString().slice(0, 10);
      const coupon = pool.find(
        (c) =>
          String(c.code).toUpperCase() === wanted &&
          c.isActive !== false &&
          (!c.expiryDate || String(c.expiryDate) >= today)
      );
      if (!coupon) return bad(res, 400, 'This coupon is invalid or expired.');
      if (subtotal < num(coupon.minSpend, 0)) {
        return bad(res, 400, `This coupon needs a minimum spend of ₹${num(coupon.minSpend, 0)}.`);
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
    if (amountPaise < 100) return bad(res, 400, 'The order total is too low to pay online.');

    // 5. Razorpay order for exactly that amount
    const orderNumber = `ORD-${crypto.randomInt(10000000, 99999999)}`;
    const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: orderNumber, notes: { orderNumber, uid: user.uid } }),
    });
    const rz: any = await rzRes.json().catch(() => ({}));
    if (!rzRes.ok || !rz.id) {
      console.error('Razorpay order failed', rzRes.status, JSON.stringify(rz).slice(0, 300));
      return bad(res, 502, 'Could not start the payment. Please try again.');
    }

    // 6. Save the UNPAID order. It moves to "orders" after the payment is verified.
    const nowIso = new Date().toISOString();
    await fsCreate(
      'pendingOrders',
      orderNumber,
      {
        id: orderNumber,
        orderNumber,
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
      },
      botToken
    );

    return res.status(200).json({
      success: true,
      orderNumber,
      razorpayOrderId: rz.id,
      keyId,
      amount: amountPaise,
      currency: 'INR',
      totals: { subtotal, shippingCost, discountAmount, tax, totalAmount },
      prefill: { name: address.name, email: address.email || user.email, contact: address.phone },
    });
  } catch (err: any) {
    console.error('create-order error:', err?.message || err);
    return bad(res, 500, 'Could not place your order right now. Please try again in a moment.');
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

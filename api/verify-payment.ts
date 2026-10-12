// Vercel serverless function: confirms a Razorpay payment and creates the real order.
// An order is only created when (1) Razorpay's signature is valid AND (2) Razorpay itself says the payment
// is captured for exactly the order amount.
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

/** ID token of the shop-server user, cached until shortly before it expires. */
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

class FirestoreError extends Error {
  status: number;
  googleStatus: string;
  googleMessage: string;
  isDailyQuotaExhausted: boolean;
  isTransientRetryable: boolean;
  operation: string;

  constructor(opts: {
    status: number;
    operation: string;
    googleStatus?: string;
    googleMessage?: string;
    rawText?: string;
  }) {
    const detailMsg = opts.googleMessage || (opts.rawText || '').slice(0, 300) || `HTTP ${opts.status}`;
    super(`${opts.operation} failed (${opts.status}): ${detailMsg}`);
    this.status = opts.status;
    this.operation = opts.operation;
    this.googleStatus = opts.googleStatus || '';
    this.googleMessage = opts.googleMessage || detailMsg;

    const lowerMsg = this.googleMessage.toLowerCase();
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
  try {
    const parsed = JSON.parse(text);
    const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    if (errObj && typeof errObj === 'object') {
      googleStatus = String(errObj.status || '');
      googleMessage = String(errObj.message || '');
    }
  } catch {}
  throw new FirestoreError({
    status: res.status,
    operation,
    googleStatus,
    googleMessage,
    rawText: text,
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withFirestoreRetry<T>( fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
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
              context: 'verify_payment_firestore_error',
              operation: err.operation,
              httpStatus: err.status,
              googleStatus: err.googleStatus,
              googleMessage: err.googleMessage,
              isDailyQuotaExhausted: err.isDailyQuotaExhausted,
              attempts: attempt,
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
  return withFirestoreRetry(async () => {
    const res = await fetch(`${DOCS}/${path}`, { headers: headers(token) });
    if (res.status === 404) return null;
    if (!res.ok) await parseFirestoreFailure(res, `Read ${path}`);
    return docToObj(await res.json());
  });
}

/** Batch reads multiple documents in a single round-trip. */
async function fsBatchGet(paths: string[], token?: string): Promise<Map<string, Record<string, any> | null>> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const result = new Map<string, Record<string, any> | null>();
  if (uniquePaths.length === 0) return result;
  if (uniquePaths.length === 1) {
    result.set(uniquePaths[0], await fsGet(uniquePaths[0], token));
    return result;
  }

  const fullDocPrefix = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/`;
  const fullNames = uniquePaths.map((p) => `${fullDocPrefix}${p}`);

  return withFirestoreRetry(async () => {
    const res = await fetch(`${BASE_DB_URL}/documents:batchGet`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ documents: fullNames }),
    });
    if (!res.ok) await parseFirestoreFailure(res, `Read ${uniquePaths[0]}`);
    const entries: any[] = await res.json();
    for (const p of uniquePaths) result.set(p, null);
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry?.found?.name) {
          const relPath = String(entry.found.name).startsWith(fullDocPrefix)
            ? String(entry.found.name).slice(fullDocPrefix.length)
            : String(entry.found.name).split('/documents/').pop() || '';
          if (relPath) result.set(relPath, docToObj(entry.found));
        }
      }
    }
    return result;
  });
}

/** Creates a document; throws FirestoreError(409) when the id already exists. */
async function fsCreate(collection: string, id: string, obj: Record<string, any>, token: string) {
  return withFirestoreRetry(async () => {
    const res = await fetch(`${DOCS}/${collection}?documentId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ fields: objToFields(obj) }),
    });
    if (!res.ok) await parseFirestoreFailure(res, `Create ${collection}/${id}`);
  });
}

/** Updates only the given top-level fields of an existing document. */
async function fsUpdate(path: string, obj: Record<string, any>, token: string) {
  return withFirestoreRetry(async () => {
    const mask = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');
    const res = await fetch(`${DOCS}/${path}?${mask}&currentDocument.exists=true`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ fields: objToFields(obj) }),
    });
    if (!res.ok) await parseFirestoreFailure(res, `Update ${path}`);
  });
}

// Turns an unpaid "pendingOrders" document into a real, paid "orders" document.
// Reuses the already-loaded `pending` document to avoid duplicate Firestore reads.

const stamp = () =>
  new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

async function finalizePaidOrder(
  orderNumber: string,
  razorpayPaymentId: string,
  token: string,
  alreadyLoadedPending?: Record<string, any> | null
): Promise<Record<string, any>> {
  let pending = alreadyLoadedPending;
  if (!pending) {
    const existing = await fsGet(`orders/${orderNumber}`, token);
    if (existing) return existing;
    pending = await fsGet(`pendingOrders/${orderNumber}`, token);
  }
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

const bad = (res: any, status: number, message: string) => res.status(status).json({ error: 'Payment Error', message });

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return bad(res, 503, 'Online payment is not available yet.');

  const authHeader: string = req.headers?.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = idToken ? await verifyIdToken(idToken) : null;
  if (!user) return bad(res, 401, 'Please sign in again.');

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const orderNumber = String(body.orderNumber || '');
  const rzOrderId = String(body.razorpay_order_id || '');
  const rzPaymentId = String(body.razorpay_payment_id || '');
  const signature = String(body.razorpay_signature || '');
  if (
    !/^ORD-\d{8}$/.test(orderNumber) ||
    !/^[A-Za-z0-9_]{5,60}$/.test(rzOrderId) ||
    !/^[A-Za-z0-9_]{5,60}$/.test(rzPaymentId) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return bad(res, 400, 'Invalid payment details.');
  }

  // 1. Verify HMAC-SHA256 signature BEFORE making any Firestore calls
  const expected = crypto.createHmac('sha256', keySecret).update(`${rzOrderId}|${rzPaymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return bad(res, 400, 'Payment could not be verified.');
  }

  try {
    const botToken = await getBotToken();

    // Batch-read both `orders/{orderNumber}` and `pendingOrders/{orderNumber}` in 1 HTTP call
    const orderDocs = await fsBatchGet([`orders/${orderNumber}`, `pendingOrders/${orderNumber}`], botToken);
    const done = orderDocs.get(`orders/${orderNumber}`);
    if (done) {
      if (done.userId !== user.uid) return bad(res, 404, 'Order not found.');
      return res.status(200).json({ success: true, order: done });
    }

    const pending = orderDocs.get(`pendingOrders/${orderNumber}`);
    if (!pending || pending.userId !== user.uid) return bad(res, 404, 'Order not found.');
    if (pending.razorpayOrderId !== rzOrderId) return bad(res, 400, 'Payment does not match this order.');

    // 2. Ask Razorpay directly about this payment
    const rzAuth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${rzPaymentId}`, { headers: { Authorization: rzAuth } });
    const pay: any = await payRes.json().catch(() => ({}));
    if (!payRes.ok || pay.order_id !== rzOrderId || pay.amount !== pending.amountPaise || pay.currency !== 'INR') {
      return bad(res, 400, 'Payment amount does not match the order.');
    }

    let status = pay.status;
    if (status === 'authorized') {
      const capRes = await fetch(`https://api.razorpay.com/v1/payments/${rzPaymentId}/capture`, {
        method: 'POST',
        headers: { Authorization: rzAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: pending.amountPaise, currency: 'INR' }),
      });
      status = capRes.ok ? 'captured' : status;
    }
    if (status !== 'captured') return bad(res, 402, 'Payment is not completed yet.');

    // 3. Create the real order reusing the already-fetched `pending` document
    const order = await finalizePaidOrder(orderNumber, rzPaymentId, botToken, pending);
    return res.status(200).json({ success: true, order });
  } catch (err: any) {
    console.error('verify-payment error:', err?.message || err);
    if (err instanceof FirestoreError && (err.status === 429 || err.status === 503)) {
      res.setHeader('Retry-After', '30');
      return bad(
        res,
        err.status,
        `Payment received for Order ${orderNumber}, but our order database is temporarily busy. Your order will be confirmed automatically via webhook.`
      );
    }
    return bad(
      res,
      500,
      'We could not confirm your payment automatically. If money was deducted, contact support with your order number.'
    );
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

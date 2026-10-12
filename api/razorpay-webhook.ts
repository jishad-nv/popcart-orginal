// Vercel serverless function: Razorpay webhook. It creates the paid order even when the customer closed the
// browser right after paying. Set it up in Razorpay: Settings > Webhooks, events "payment.captured" and "order.paid".
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
  const res = await fetch(`${BASE_DB_URL}/documents:batchGet`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ documents: fullNames }),
  });
  if (!res.ok) await fail(res, `Read ${uniquePaths[0]}`);
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

async function readRawBody(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  } catch {
    /* stream already consumed */
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw) return raw;
  return typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook not configured' });

  const raw = await readRawBody(req);
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid body' });
  }

  const type = String(event?.event || '');
  if (type !== 'payment.captured' && type !== 'order.paid') return res.status(200).json({ ok: true, ignored: type });

  const payment = event?.payload?.payment?.entity;
  const rzOrder = event?.payload?.order?.entity;
  const orderNumber = String(payment?.notes?.orderNumber || rzOrder?.notes?.orderNumber || rzOrder?.receipt || '');
  if (!/^ORD-\d{8}$/.test(orderNumber) || !payment?.id) return res.status(200).json({ ok: true, ignored: 'no order' });

  try {
    const botToken = await getBotToken();
    const orderDocs = await fsBatchGet([`orders/${orderNumber}`, `pendingOrders/${orderNumber}`], botToken);
    if (orderDocs.get(`orders/${orderNumber}`)) return res.status(200).json({ ok: true, already: true });

    const pending = orderDocs.get(`pendingOrders/${orderNumber}`);
    if (!pending) return res.status(200).json({ ok: true, ignored: 'unknown order' });

    if (payment.order_id !== pending.razorpayOrderId || payment.amount !== pending.amountPaise || payment.currency !== 'INR') {
      console.error('Webhook amount/order mismatch for', orderNumber);
      return res.status(200).json({ ok: true, ignored: 'mismatch' });
    }

    await finalizePaidOrder(orderNumber, payment.id, botToken, pending);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('razorpay-webhook error:', err?.message || err);
    return res.status(500).json({ error: 'Retry later' }); // Razorpay retries on non-200
  }
}

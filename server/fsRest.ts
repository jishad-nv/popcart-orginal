// Small Firestore + Firebase Auth REST helpers for Vercel serverless functions.
// No service-account key is needed: the server signs in as a dedicated "shop server" Firebase user
// (SHOP_BOT_EMAIL / SHOP_BOT_PASSWORD) and Firestore security rules decide what that user may do.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'elemental-bonito-9mn89';
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-auracartmodernec-0fd366e2-b474-47ee-ac89-22d3d6ddd38c';
// Public Firebase web key (not a secret).
export const WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBCEQY_CufBR1gR7I2KrgLs1-LN48ch_kc';

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

export interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
}

/** Checks a customer's Firebase ID token with Google and returns who they are (or null). */
export async function verifyIdToken(idToken: string): Promise<VerifiedUser | null> {
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
export async function getBotToken(): Promise<string> {
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
export const toFs = (v: any): any => {
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

export const fromFs = (v: any): any => {
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
export async function fsGet(path: string, token?: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, `Read ${path}`);
  return docToObj(await res.json());
}

/** Lists up to `max` documents of a collection (ids included as `__id`). */
export async function fsList(collection: string, token?: string, max = 500): Promise<Record<string, any>[]> {
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
export async function fsCreate(collection: string, id: string, obj: Record<string, any>, token: string) {
  const res = await fetch(`${DOCS}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ fields: objToFields(obj) }),
  });
  if (!res.ok) await fail(res, `Create ${collection}/${id}`);
}

/** Updates only the given top-level fields of an existing document. */
export async function fsUpdate(path: string, obj: Record<string, any>, token: string) {
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

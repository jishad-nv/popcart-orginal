// Vercel serverless function: owner-only proxy for the supplier's public Shopify products.json.
// The browser cannot call dropplier.in directly (CORS), so the owner's page calls this endpoint.

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBCEQY_CufBR1gR7I2KrgLs1-LN48ch_kc'; // public web key, not a secret
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'popcarty7@gmail.com').toLowerCase();
const SUPPLIER_HOST = 'dropplier.in';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Keep the response small (Vercel limits function responses to about 4.5 MB).
const slimProduct = (p: any) => ({
  id: p.id,
  title: p.title,
  handle: p.handle,
  vendor: p.vendor,
  product_type: p.product_type,
  tags: p.tags,
  body_html: typeof p.body_html === 'string' ? p.body_html.slice(0, 2000) : '',
  images: Array.isArray(p.images) ? p.images.slice(0, 3).map((i: any) => ({ src: i?.src })) : [],
  variants: Array.isArray(p.variants)
    ? p.variants.slice(0, 20).map((v: any) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        available: v.available,
      }))
    : [],
});

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Use POST.' });
  }

  // 1. Owner check (Firebase ID token verified against Google)
  const authHeader: string = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization header. Sign in as owner.' });
  }
  const idToken = authHeader.slice('Bearer '.length).trim();

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const verifyData: any = await verifyRes.json().catch(() => ({}));
    const user = verifyData?.users?.[0];
    if (!verifyRes.ok || !user || user.disabled) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired sign-in. Sign out and sign in again.' });
    }
    if (String(user.email || '').toLowerCase() !== OWNER_EMAIL) {
      return res.status(403).json({ error: 'Forbidden', message: 'Owner account required.' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token verification failed.' });
  }

  // 2. Input
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const collectionUrl = body.collectionUrl || body.sourceUrl;
  const page = Math.min(Math.max(parseInt(String(body.page || 1), 10) || 1, 1), 500);

  if (!collectionUrl || typeof collectionUrl !== 'string') {
    return res.status(400).json({ error: 'Validation Error', message: 'Collection URL is required.' });
  }

  let parsed: URL;
  try {
    parsed = new URL(collectionUrl);
  } catch {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid URL.' });
  }
  if (parsed.protocol !== 'https:' || (parsed.hostname !== SUPPLIER_HOST && parsed.hostname !== `www.${SUPPLIER_HOST}`)) {
    return res.status(403).json({ error: 'Forbidden', message: `Only ${SUPPLIER_HOST} is allowed.` });
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('collections');
  let handle = idx !== -1 && segments[idx + 1] ? segments[idx + 1] : 'all';
  handle = handle.replace(/\.json$/i, '');
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(handle)) {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid collection handle.' });
  }

  // 3. Fetch one page from the supplier
  const upstreamUrl = `https://${SUPPLIER_HOST}/collections/${handle}/products.json?limit=250&page=${page}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        error: 'Upstream Error',
        message: `Supplier returned HTTP ${upstream.status} for ${upstreamUrl}`,
        upstreamStatus: upstream.status,
        bodySnippet: text.slice(0, 200),
      });
    }

    const data: any = safeJson(text);
    if (!data || !Array.isArray(data.products)) {
      return res.status(502).json({
        error: 'Upstream Error',
        message: `Supplier response has no "products" list. Keys: ${Object.keys(data || {}).join(', ') || 'none'}`,
        bodySnippet: text.slice(0, 200),
      });
    }

    const products = data.products.map(slimProduct);
    return res.status(200).json({ success: true, page, count: products.length, products, sourceOrigin: SUPPLIER_HOST });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Supplier request timed out (20s).' : err?.message || 'Supplier fetch failed.';
    return res.status(504).json({ error: 'Upstream Error', message: msg });
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

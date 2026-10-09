export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.method === 'POST' ? req.body : req.query;
  const collectionUrl = body?.collectionUrl || body?.sourceUrl || req.query?.url;
  const page = Number(body?.page || req.query?.page || 1);

  if (!collectionUrl || typeof collectionUrl !== 'string') {
    return res.status(400).json({ error: 'Validation Error', message: 'Collection URL is required.' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(collectionUrl);
  } catch {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid URL format.' });
  }

  if (parsedUrl.hostname !== 'dropplier.in' && !parsedUrl.hostname.endsWith('.dropplier.in')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only dropplier.in domain is allowed.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header.' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  const apiKey = 'AIzaSyBCEQY_CufBR1gR7I2KrgLs1-LN48ch_kc';

  try {
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const verifyData: any = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired Firebase ID token.' });
    }

    const userEmail = verifyData.users[0].email?.toLowerCase();
    if (userEmail !== 'popcarty7@gmail.com') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Owner account required.' });
    }
  } catch (err: any) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Unauthorized', message: 'Token verification failed.' });
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  let handle = '';
  const collectionsIdx = segments.indexOf('collections');
  if (collectionsIdx !== -1 && segments[collectionsIdx + 1]) {
    handle = segments[collectionsIdx + 1].replace(/\.json$/i, '');
  } else if (segments.length > 0) {
    handle = segments[segments.length - 1].replace(/\.json$/i, '');
  }
  if (!handle) {
    handle = 'all';
  }

  const shopifyApiUrl = `https://dropplier.in/collections/${handle}/products.json?limit=250&page=${page}`;

  try {
    const shopifyRes = await fetch(shopifyApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    const responseText = await shopifyRes.text();
    let shopifyData: any = {};
    try {
      shopifyData = JSON.parse(responseText);
    } catch {
      shopifyData = { rawText: responseText };
    }

    if (!shopifyRes.ok) {
      return res.status(shopifyRes.status).json({
        error: 'Upstream Error',
        status: shopifyRes.status,
        url: shopifyApiUrl,
        message: `Failed to fetch from supplier: ${shopifyRes.statusText}`,
        bodySnippet: responseText.substring(0, 200),
        keys: Object.keys(shopifyData),
      });
    }

    const products = shopifyData.products || shopifyData.data?.products || [];

    return res.status(200).json({
      success: true,
      page,
      products,
      count: products.length,
      keys: Object.keys(shopifyData),
      bodySnippet: responseText.substring(0, 200),
    });
  } catch (err: any) {
    console.error('Shopify fetch error:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to fetch supplier collection.' });
  }
}

// Vercel serverless function: creates an order and a Razorpay payment for it.
// Prices, shipping, tax and coupons are ALL calculated here from Firestore. The browser only sends
// product ids, quantities, the address and a coupon code, so nobody can change what they pay.
import crypto from 'node:crypto';
import { verifyIdToken, getBotToken, fsGet, fsList, fsCreate } from '../server/fsRest';

const DEFAULT_SETTINGS = { freeShippingThreshold: 1999, standardShippingFee: 99, taxRate: 0.12 };

// Same coupons the storefront ships with. Coupons stored in Firestore (collection "coupons") win.
const DEFAULT_COUPONS: any[] = [
  { code: 'POPCART30', discountType: 'percentage', discountValue: 30, minSpend: 2500, expiryDate: '2026-12-31', isActive: true },
  { code: 'WELCOME20', discountType: 'percentage', discountValue: 20, minSpend: 1500, expiryDate: '2026-12-31', isActive: true },
  { code: 'FLAT500', discountType: 'fixed', discountValue: 500, minSpend: 2000, expiryDate: '2026-12-31', isActive: true },
];

const clean = (v: any, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: any, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);
const istTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

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

  const lines = new Map<string, { productId: string; quantity: number; color: string }>();
  for (const it of rawItems) {
    const productId = String(it?.productId || '');
    const quantity = Number(it?.quantity);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(productId)) return bad(res, 400, 'Invalid product in cart.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return bad(res, 400, 'Invalid quantity.');
    const existing = lines.get(productId);
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else lines.set(productId, { productId, quantity, color: clean(it?.color, 40) });
  }

  const a = body.shippingAddress || {};
  let phone = String(a.phone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);
  const address = {
    name: clean(a.name, 80),
    phone,
    street: clean(a.street, 200),
    landmark: clean(a.landmark, 100),
    city: clean(a.city, 80),
    state: clean(a.state, 80),
    zipCode: clean(a.zipCode, 10),
    country: 'India',
    lat: Number.isFinite(Number(a.lat)) && a.lat !== '' && a.lat != null ? Number(a.lat) : null,
    lng: Number.isFinite(Number(a.lng)) && a.lng !== '' && a.lng != null ? Number(a.lng) : null,
  };
  if (address.name.length < 2) return bad(res, 400, 'Please enter the receiver name.');
  if (!/^[6-9]\d{9}$/.test(address.phone)) return bad(res, 400, 'Please enter a valid 10-digit mobile number.');
  if (address.street.length < 5) return bad(res, 400, 'Please enter the full street address.');
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
        productName: clean(p.name, 200),
        productImage: Array.isArray(p.images) ? String(p.images[0] || '') : '',
        brand: clean(p.brand, 80),
        color: line.color || null,
        price,
        quantity: line.quantity,
        costPrice: Number.isFinite(Number(p.costPrice)) ? Number(p.costPrice) : null,
        sku: clean(p.sku, 80),
        supplierSku: clean(specs.supplierSku, 80),
        supplierHandle: clean(specs.supplierHandle, 160),
        supplierVariantId: clean(specs.supplierVariantId, 40),
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // 4. Shipping, coupon, tax (same formulas the storefront shows)
    const stored = (await fsGet('settings/store', botToken)) || {};
    const settings = {
      freeShippingThreshold: num(stored.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
      standardShippingFee: num(stored.standardShippingFee, DEFAULT_SETTINGS.standardShippingFee),
      taxRate: Math.min(1, num(stored.taxRate, DEFAULT_SETTINGS.taxRate)),
    };
    const shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;

    let discountAmount = 0;
    let couponCode: string | null = null;
    const wanted = clean(body.couponCode, 40).toUpperCase();
    if (wanted) {
      const fromDb = (await fsList('coupons', botToken, 200)).filter((c) => c.code);
      const pool = fromDb.length > 0 ? fromDb : DEFAULT_COUPONS;
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

    // 6. Save the order (unpaid) in Firestore
    const customerPhone = address.phone;
    await fsCreate(
      'orders',
      orderNumber,
      {
        id: orderNumber,
        orderNumber,
        userId: user.uid,
        customerName: address.name,
        customerEmail: user.email,
        customerPhone,
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
        paymentMethod: 'razorpay',
        paymentStatus: 'pending',
        razorpayOrderId: rz.id,
        orderStatus: 'placed',
        statusHistory: [{ status: 'placed', timestamp: istTime(), note: 'Order created, waiting for payment' }],
        createdAt: new Date().toISOString(),
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
      prefill: { name: address.name, email: user.email, contact: customerPhone },
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

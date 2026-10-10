// Vercel serverless function: confirms a Razorpay payment and marks the order as paid.
// An order is only "paid" when (1) Razorpay's signature is valid AND (2) Razorpay itself says the payment
// is captured for exactly the order amount.
import crypto from 'node:crypto';
import { verifyIdToken, getBotToken, fsGet, fsUpdate } from '../server/fsRest';

const bad = (res: any, status: number, message: string) => res.status(status).json({ error: 'Payment Error', message });
const istTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

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

  try {
    const botToken = await getBotToken();
    const order = await fsGet(`orders/${orderNumber}`, botToken);
    if (!order || order.userId !== user.uid) return bad(res, 404, 'Order not found.');
    if (order.razorpayOrderId !== rzOrderId) return bad(res, 400, 'Payment does not match this order.');
    if (order.paymentStatus === 'paid') return res.status(200).json({ success: true, order });

    // 1. Signature check
    const expected = crypto.createHmac('sha256', keySecret).update(`${rzOrderId}|${rzPaymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return bad(res, 400, 'Payment could not be verified.');
    }

    // 2. Ask Razorpay directly about this payment
    const rzAuth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${rzPaymentId}`, { headers: { Authorization: rzAuth } });
    const pay: any = await payRes.json().catch(() => ({}));
    if (!payRes.ok || pay.order_id !== rzOrderId || pay.amount !== order.amountPaise || pay.currency !== 'INR') {
      return bad(res, 400, 'Payment amount does not match the order.');
    }

    let status = pay.status;
    if (status === 'authorized') {
      const capRes = await fetch(`https://api.razorpay.com/v1/payments/${rzPaymentId}/capture`, {
        method: 'POST',
        headers: { Authorization: rzAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: order.amountPaise, currency: 'INR' }),
      });
      status = capRes.ok ? 'captured' : status;
    }
    if (status !== 'captured') return bad(res, 402, 'Payment is not completed yet.');

    // 3. Mark the order as paid
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const updates = {
      paymentStatus: 'paid',
      orderStatus: 'placed',
      razorpayPaymentId: rzPaymentId,
      paidAt: new Date().toISOString(),
      statusHistory: [...history, { status: 'placed', timestamp: istTime(), note: 'Payment received via Razorpay' }],
    };
    await fsUpdate(`orders/${orderNumber}`, updates, botToken);

    return res.status(200).json({ success: true, order: { ...order, ...updates } });
  } catch (err: any) {
    console.error('verify-payment error:', err?.message || err);
    return bad(res, 500, 'We could not confirm your payment automatically. If money was deducted, contact support with your order number.');
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

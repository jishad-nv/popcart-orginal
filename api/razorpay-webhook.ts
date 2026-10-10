// Vercel serverless function: Razorpay webhook. It marks an order as paid even when the customer closed the
// browser right after paying. Set it up in Razorpay: Settings > Webhooks, events "payment.captured" and "order.paid".
import crypto from 'node:crypto';
import { getBotToken, fsGet, fsUpdate } from '../server/fsRest';

const istTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

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
    const order = await fsGet(`orders/${orderNumber}`, botToken);
    if (!order) return res.status(200).json({ ok: true, ignored: 'unknown order' });
    if (order.paymentStatus === 'paid') return res.status(200).json({ ok: true, already: true });

    if (payment.order_id !== order.razorpayOrderId || payment.amount !== order.amountPaise || payment.currency !== 'INR') {
      console.error('Webhook amount/order mismatch for', orderNumber);
      return res.status(200).json({ ok: true, ignored: 'mismatch' });
    }

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    await fsUpdate(
      `orders/${orderNumber}`,
      {
        paymentStatus: 'paid',
        orderStatus: 'placed',
        razorpayPaymentId: payment.id,
        paidAt: new Date().toISOString(),
        statusHistory: [...history, { status: 'placed', timestamp: istTime(), note: 'Payment confirmed by Razorpay webhook' }],
      },
      botToken
    );
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('razorpay-webhook error:', err?.message || err);
    return res.status(500).json({ error: 'Retry later' }); // Razorpay retries on non-200
  }
}

// Browser side of the Razorpay (UPI only) payment flow.
// The server (api/create-order.ts) decides the price; this file only sends product ids and opens the payment window.
import { auth } from './firebase';
import { Address, Order } from '../types';

export interface CreateOrderInput {
  items: { productId: string; quantity: number; color?: string }[];
  shippingAddress: Address;
  couponCode?: string;
}

export interface CreatedOrder {
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number; // paise
  currency: string;
  totals: { subtotal: number; shippingCost: number; discountAmount: number; tax: number; totalAmount: number };
  prefill: { name: string; email: string; contact: string };
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const post = async (path: string, body: unknown) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to place your order.');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
};

export const createServerOrder = (input: CreateOrderInput): Promise<CreatedOrder> => post('/api/create-order', input);

export const verifyServerPayment = (body: { orderNumber: string } & RazorpayResult): Promise<{ order: Order }> =>
  post('/api/verify-payment', body);

let sdkPromise: Promise<void> | null = null;
const loadRazorpay = (): Promise<void> => {
  if ((window as any).Razorpay) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('Could not load the payment window. Please check your internet connection.'));
      };
      document.body.appendChild(script);
    });
  }
  return sdkPromise;
};

/** Opens the Razorpay window showing UPI only. Resolves with the signed payment result. */
export const openRazorpayCheckout = async (created: CreatedOrder): Promise<RazorpayResult> => {
  await loadRazorpay();
  return new Promise<RazorpayResult>((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: created.keyId,
      amount: created.amount,
      currency: created.currency,
      order_id: created.razorpayOrderId,
      name: 'Popcarty',
      description: `Order ${created.orderNumber}`,
      prefill: created.prefill,
      theme: { color: '#6d28d9' },
      // Show only UPI (also switch the other methods off in the Razorpay dashboard)
      config: {
        display: {
          blocks: { upi: { name: 'Pay with UPI', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: false },
        },
      },
      handler: (response: RazorpayResult) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment cancelled. You can try again.')) },
    });
    rzp.on('payment.failed', (r: any) => reject(new Error(r?.error?.description || 'Payment failed. Please try again.')));
    rzp.open();
  });
};

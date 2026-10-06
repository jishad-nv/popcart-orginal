import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Address, Order } from '../types';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Plus,
  QrCode,
  Smartphone,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    cartDiscount,
    cartShipping,
    cartTax,
    cartTotal,
    appliedCoupon,
    formatPrice,
    currentUser,
    addresses,
    createOrder,
    navigateTo,
    addToast,
  } = useStore();

  // Selected address state
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || 'new'
  );

  // New Address Form
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id' | 'userId'>>({
    name: currentUser?.name || '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    phone: currentUser?.phone || '',
    isDefault: false,
    label: 'Home',
  });

  // Shipping Method (Standard Ground)
  const shippingMethod: 'standard' = 'standard';

  // Online Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'upi'>('card');

  // Card details state
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8829');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('883');
  const [cardName, setCardName] = useState(currentUser?.name || 'POPCARTY USER');

  // Submission State
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Redirect if cart is empty and no completed order
  if (cart.length === 0 && !completedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Your bag is empty</h2>
        <p className="text-xs text-slate-500">Please add items to your cart before proceeding to checkout.</p>
        <button
          onClick={() => navigateTo('shop')}
          className="px-5 py-2.5 bg-violet-600 text-white text-xs font-bold rounded-xl"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  // Trigger celebration on order placement
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // safe fallback
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    let finalAddress: Address;
    if (selectedAddressId !== 'new') {
      const existing = addresses.find((a) => a.id === selectedAddressId);
      if (!existing) {
        addToast('Address Error', 'Please select a valid delivery address.', 'error');
        return;
      }
      finalAddress = existing;
    } else {
      if (!newAddress.street || !newAddress.city || !newAddress.zipCode) {
        addToast('Address Required', 'Please complete all address fields.', 'error');
        return;
      }
      finalAddress = {
        ...newAddress,
        id: `addr-${Date.now()}`,
        userId: currentUser?.id || 'guest',
      };
    }

    setIsProcessing(true);

    setTimeout(() => {
      const order = createOrder({
        shippingAddress: finalAddress,
        shippingMethod,
        paymentMethod,
      });

      setIsProcessing(false);
      setCompletedOrder(order);
      triggerConfetti();
      addToast('Order Placed!', `Your order #${order.orderNumber} was confirmed successfully.`, 'success');
    }, 1200);
  };

  // ORDER CONFIRMATION VIEW
  if (completedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Order Confirmed & Processing
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Thank you, {completedOrder.customerName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Order <strong className="text-slate-900 font-mono">#{completedOrder.orderNumber}</strong> has been received. A receipt has been dispatched to{' '}
            <span className="text-slate-800 font-medium">{completedOrder.customerEmail}</span>.
          </p>
        </div>

        {/* Tracking Stepper */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Progress</h3>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px] mb-1">
                ✓
              </div>
              <span className="font-bold text-slate-900">Placed</span>
              <span className="text-[10px] text-slate-400">Just now</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-[11px] mb-1 animate-pulse">
                2
              </div>
              <span className="font-bold text-violet-700">Confirmed</span>
              <span className="text-[10px] text-slate-400">Processing</span>
            </div>
            <div className="flex flex-col items-center opacity-40">
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] mb-1">
                3
              </div>
              <span className="font-medium text-slate-600">Shipped</span>
              <span className="text-[10px] text-slate-400">Pending</span>
            </div>
            <div className="flex flex-col items-center opacity-40">
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] mb-1">
                4
              </div>
              <span className="font-medium text-slate-600">Delivered</span>
              <span className="text-[10px] text-slate-400">2-4 days</span>
            </div>
          </div>
        </div>

        {/* Order Details Receipt Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <span className="text-xs text-slate-400 block">Order Number</span>
              <strong className="text-base font-mono font-bold text-slate-900">
                #{completedOrder.orderNumber}
              </strong>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block">Payment Method</span>
              <span className="text-xs font-bold text-slate-800 uppercase">
                {completedOrder.paymentMethod} · {completedOrder.paymentStatus}
              </span>
            </div>
          </div>

          {/* Purchased Items */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Items Purchased ({completedOrder.items.length})
            </h4>
            <div className="divide-y divide-slate-100">
              {completedOrder.items.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                    />
                    <div>
                      <strong className="text-slate-900 block font-semibold">{item.productName}</strong>
                      <span className="text-slate-500 text-[11px]">
                        {item.color ? `Color: ${item.color} · ` : ''}Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address Recap */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
            <h4 className="font-bold text-slate-900">Delivery Address</h4>
            <p className="text-slate-600">
              {completedOrder.shippingAddress.name} ({completedOrder.shippingAddress.phone})
            </p>
            <p className="text-slate-500">
              {completedOrder.shippingAddress.street}, {completedOrder.shippingAddress.city},{' '}
              {completedOrder.shippingAddress.state} - {completedOrder.shippingAddress.zipCode},{' '}
              {completedOrder.shippingAddress.country}
            </p>
          </div>

          {/* Price Breakdown */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums font-semibold text-slate-800">{formatPrice(completedOrder.subtotal)}</span>
            </div>
            {completedOrder.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Coupon Discount ({completedOrder.couponCode})</span>
                <span className="tabular-nums font-semibold">-{formatPrice(completedOrder.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping Fee ({completedOrder.shippingMethod})</span>
              <span className="tabular-nums font-semibold text-slate-800">
                {completedOrder.shippingCost === 0 ? 'FREE' : formatPrice(completedOrder.shippingCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax (GST 12%)</span>
              <span className="tabular-nums font-semibold text-slate-800">{formatPrice(completedOrder.tax)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-extrabold text-slate-900">
              <span>Total Paid</span>
              <span className="text-violet-700 tabular-nums">{formatPrice(completedOrder.totalAmount)}</span>
            </div>
          </div>

          {/* Post Order Actions */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigateTo('profile')}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors"
            >
              Track in My Orders
            </button>
            <button
              onClick={() => navigateTo('shop')}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN CHECKOUT FORM
  const calculatedShipping = cartShipping;
  const calculatedTotal = Math.max(0, cartSubtotal - cartDiscount + calculatedShipping + cartTax);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Express Checkout
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete your delivery details and choose your preferred payment method.
        </p>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Details, Shipping & Payment (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. SHIPPING ADDRESS */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">Delivery Address</h3>
              </div>
            </div>

            {/* Saved Address Selector */}
            {addresses.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">Select from Saved Addresses:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                        selectedAddressId === addr.id
                          ? 'border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] text-violet-600 bg-violet-100 px-1.5 py-0.2 rounded font-semibold">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 font-medium truncate">{addr.name}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">{addr.street}, {addr.city}</p>
                      <p className="text-slate-400 text-[11px] mt-1">{addr.phone}</p>
                    </div>
                  ))}

                  {/* Option to type new address */}
                  <div
                    onClick={() => setSelectedAddressId('new')}
                    className={`p-3.5 rounded-2xl border border-dashed text-xs cursor-pointer flex flex-col items-center justify-center text-center transition-all ${
                      selectedAddressId === 'new'
                        ? 'border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 text-violet-700'
                        : 'border-slate-300 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Plus className="w-5 h-5 mb-1" />
                    <span className="font-semibold">Add New Address</span>
                  </div>
                </div>
              </div>
            )}

            {/* New Address Fields */}
            {selectedAddressId === 'new' && (
              <div className="pt-2 space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAddress.name}
                      onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                      placeholder="Receiver's name"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={newAddress.street}
                    onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                    placeholder="House/Apartment #, Building, Street, Area"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      placeholder="State"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">PIN / Postal Code</label>
                    <input
                      type="text"
                      required
                      value={newAddress.zipCode}
                      onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                      placeholder="PIN Code"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. SHIPPING METHOD */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900">Shipping Speed</h3>
            </div>

            <div className="text-xs">
              <label className="p-4 rounded-2xl border border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 flex items-start gap-3 cursor-pointer transition-all">
                <input
                  type="radio"
                  name="shippingSpeed"
                  checked={true}
                  readOnly
                  className="mt-0.5 accent-violet-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Standard Ground</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">3-5 Business Days Delivery</span>
                  <span className="font-bold text-emerald-600 text-xs mt-1 block">
                    {cartShipping === 0 ? 'FREE' : formatPrice(cartShipping)}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. PAYMENT METHOD */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900">Payment Option</h3>
            </div>

            {/* Payment Selector Tabs (Online Payment Only) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-violet-600 bg-violet-50 text-violet-700 ring-2 ring-violet-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-violet-600 bg-violet-50 text-violet-700 ring-2 ring-violet-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span>UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('apple_pay')}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'apple_pay'
                    ? 'border-violet-600 bg-violet-50 text-violet-700 ring-2 ring-violet-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span>Instant Pay</span>
              </button>
            </div>

            {/* Simulated Card Fields */}
            {paymentMethod === 'card' && (
              <div className="pt-3 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in fade-in duration-200">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4532 •••• •••• ••••"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Expires (MM/YY)</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">CVV / CVC</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="•••"
                      maxLength={4}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl uppercase"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'upi' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-800">Scan & Pay via any UPI App</span>
                <p className="text-slate-500">Google Pay, PhonePe, Paytm, or BHIM. Instant verification.</p>
                <div className="p-3 bg-white border border-slate-200 rounded-xl inline-block">
                  <div className="w-24 h-24 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-mono">
                    [DEMO QR]
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sticky Order Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 sticky top-24">
            <h3 className="text-base font-bold text-slate-900">Order Summary ({cart.length})</h3>

            {/* Cart Preview Items */}
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto custom-scrollbar">
              {cart.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.product.images[0]}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 block truncate">{item.product.name}</span>
                      <span className="text-[11px] text-slate-400">
                        Qty: {item.quantity} {item.selectedColor ? `· ${item.selectedColor}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums shrink-0">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon Indicator */}
            {appliedCoupon && (
              <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                <span>Coupon: <strong>{appliedCoupon.code}</strong></span>
                <span>-{formatPrice(cartDiscount)}</span>
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartSubtotal)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-semibold tabular-nums">-{formatPrice(cartDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping (Standard)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {calculatedShipping === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(calculatedShipping)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tax (GST 12%)</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartTax)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-extrabold text-slate-900">
                <span>Grand Total</span>
                <span className="text-xl text-violet-700 tabular-nums">{formatPrice(calculatedTotal)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authorizing Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Place Order ({formatPrice(calculatedTotal)})</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Free returns within 7 days · Official 1-Year Guarantee</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

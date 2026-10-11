import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Address, Order, PaymentMethodType } from '../types';
import { AddressFormFields } from '../components/common/AddressFormFields';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Plus,
  QrCode,
  Smartphone,
  Banknote,
  UserCheck,
  MapPin,
} from 'lucide-react';

async function parseApiResponse(res: Response) {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Server Error (${res.status}): ${text.slice(0, 120) || res.statusText}`);
    }
    throw new Error(`Invalid response format from server (${res.status})`);
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    cartDiscount,
    cartShipping,
    cartTax,
    appliedCoupon,
    formatPrice,
    currentUser,
    addresses,
    addAddress,
    createOrder,
    navigateTo,
    setAuthModalOpen,
    addToast,
    settings,
    clearCart,
  } = useStore();

  // Selected address state
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || 'new'
  );

  // Sync default address when addresses list updates
  useEffect(() => {
    if (selectedAddressId === 'new' && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      if (def) setSelectedAddressId(def.id);
    }
  }, [addresses.length]);

  // New Address Form
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id' | 'userId'>>({
    name: currentUser?.name || '',
    fullName: currentUser?.name || '',
    phone: currentUser?.phone || '',
    alternatePhone: '',
    email: currentUser?.email || '',
    houseNo: '',
    street: '',
    area: '',
    landmark: '',
    city: '',
    district: '',
    state: '',
    zipCode: '',
    pincode: '',
    country: 'India',
    deliveryInstructions: '',
    isDefault: addresses.length === 0,
    label: 'Home',
  });

  useEffect(() => {
    if (currentUser) {
      setNewAddress((prev) => ({
        ...prev,
        name: prev.name || currentUser.name || '',
        fullName: prev.fullName || currentUser.name || '',
        phone: prev.phone || currentUser.phone || '',
        email: prev.email || currentUser.email || '',
      }));
    }
  }, [currentUser]);

  const [saveNewAddressToProfile, setSaveNewAddressToProfile] = useState(true);

  // Shipping Method (Standard Ground)
  const shippingMethod: 'standard' = 'standard';

  // Payment Method (UPI Only)
  const paymentMethod: PaymentMethodType = 'upi';

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
          className="px-5 py-2.5 bg-violet-600 text-white text-xs font-bold rounded-xl cursor-pointer"
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

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      addToast('Sign In Required', 'Please sign in or create an account to complete your order.', 'info');
      setAuthModalOpen(true);
      return;
    }

    let finalAddress: Address;
    if (selectedAddressId !== 'new') {
      const existing = addresses.find((a) => a.id === selectedAddressId);
      if (!existing) {
        addToast('Address Error', 'Please select a valid delivery address.', 'error');
        return;
      }
      finalAddress = existing;
    } else {
      const cleanPhone = (newAddress.phone || '').replace(/\D/g, '').slice(-10);
      const cleanPin = (newAddress.zipCode || newAddress.pincode || '').replace(/\D/g, '');

      if (!(newAddress.fullName || newAddress.name)?.trim()) {
        addToast('Name Required', 'Please enter the recipient full name.', 'error');
        return;
      }
      if (cleanPhone.length !== 10) {
        addToast('Valid Phone Required', 'Please enter a valid 10-digit mobile number.', 'error');
        return;
      }
      if (!newAddress.houseNo?.trim() && !newAddress.street?.trim()) {
        addToast('Address Required', 'Please enter your house/flat number and street.', 'error');
        return;
      }
      if (!newAddress.city?.trim() || !newAddress.state?.trim()) {
        addToast('City & State Required', 'Please enter your city and state.', 'error');
        return;
      }
      if (cleanPin.length !== 6) {
        addToast('Valid PIN Code Required', 'Please enter a valid 6-digit Indian PIN code.', 'error');
        return;
      }

      const normalizedNew: Omit<Address, 'id' | 'userId'> = {
        ...newAddress,
        name: (newAddress.fullName || newAddress.name).trim(),
        fullName: (newAddress.fullName || newAddress.name).trim(),
        phone: cleanPhone,
        zipCode: cleanPin,
        pincode: cleanPin,
      };

      if (saveNewAddressToProfile) {
        finalAddress = addAddress(normalizedNew);
      } else {
        finalAddress = {
          ...normalizedNew,
          id: `addr-${Date.now()}`,
          userId: currentUser.id,
        };
      }
    }

    setIsProcessing(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setIsProcessing(false);
        addToast('Gateway Error', 'Failed to load Razorpay SDK. Please check your internet connection.', 'error');
        return;
      }

      const token = localStorage.getItem('popcarty_auth_token_v1') || '';
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart,
          shippingAddress: finalAddress,
          shippingMethod: 'standard',
          couponCode: appliedCoupon?.code,
          customerName: finalAddress.fullName || finalAddress.name || currentUser.name,
          customerEmail: finalAddress.email || currentUser.email,
          customerPhone: finalAddress.phone || currentUser.phone,
        }),
      });

      const data = await parseApiResponse(res);

      const { razorpayOrderId, keyId, checkoutConfigId, amount, currency, orderNumber } = data;

      const options: any = {
        key: keyId,
        amount,
        currency,
        name: settings.storeName,
        description: `Order #${orderNumber}`,
        order_id: razorpayOrderId,
        ...(checkoutConfigId ? { checkout_config_id: checkoutConfigId } : {}),
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderNumber,
              }),
            });

            const verifyData = await parseApiResponse(verifyRes);
            setIsProcessing(false);
            setCompletedOrder(verifyData.order);
            triggerConfetti();
            clearCart();
            addToast('Payment Verified!', `Order #${orderNumber} placed and paid successfully.`, 'success');
          } catch (verifyErr: any) {
            setIsProcessing(false);
            addToast('Verification Error', verifyErr?.message || 'Could not verify payment.', 'error');
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            addToast('Payment Cancelled', 'You closed the payment window.', 'info');
          },
        },
        prefill: {
          name: finalAddress.fullName || finalAddress.name || currentUser.name,
          email: finalAddress.email || currentUser.email,
          contact: finalAddress.phone || currentUser.phone,
        },
        theme: {
          color: '#7c3aed',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
      };

      if (keyId === 'rzp_test_mockKeyId' || String(razorpayOrderId).startsWith('order_mock_') || !(window as any).Razorpay) {
        setTimeout(async () => {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 10)}`,
                razorpay_signature: 'mock_signature',
                orderNumber,
              }),
            });
            const verifyData = await parseApiResponse(verifyRes);
            setIsProcessing(false);
            setCompletedOrder(verifyData.order);
            triggerConfetti();
            clearCart();
            addToast('Payment Verified!', `Order #${orderNumber} placed and paid successfully via UPI.`, 'success');
          } catch (verifyErr: any) {
            setIsProcessing(false);
            addToast('Verification Error', verifyErr?.message || 'Could not verify payment.', 'error');
          }
        }, 1200);
      } else {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      setIsProcessing(false);
      addToast('Order Error', err?.message || 'Could not place order. Please try again.', 'error');
    }
  };

  // ORDER CONFIRMATION VIEW
  if (completedOrder) {
    const addr = completedOrder.shippingAddress;
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Order Confirmed & Saved
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Thank you, {completedOrder.customerName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Order <strong className="text-slate-900 font-mono">#{completedOrder.orderNumber}</strong> has been recorded. Updates will be sent to{' '}
            <span className="text-slate-800 font-medium">{completedOrder.customerEmail || completedOrder.customerPhone}</span>.
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
                {completedOrder.paymentMethod} · {completedOrder.paymentStatus.replace(/_/g, ' ')}
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
                        {item.color ? `Variant: ${item.color} · ` : ''}Qty: {item.quantity}
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
            <p className="text-slate-700 font-semibold">
              {addr.fullName || addr.name} · {addr.phone}
              {addr.alternatePhone ? ` / ${addr.alternatePhone}` : ''}
            </p>
            <p className="text-slate-600">
              {[addr.houseNo, addr.street, addr.area].filter(Boolean).join(', ')}
            </p>
            {addr.landmark && <p className="text-slate-500">Landmark: {addr.landmark}</p>}
            <p className="text-slate-600 font-medium">
              {[addr.city, addr.district, addr.state].filter(Boolean).join(', ')} - {addr.pincode || addr.zipCode},{' '}
              {addr.country}
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
              <span>Tax (GST)</span>
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
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Track in My Orders
            </button>
            <button
              onClick={() => navigateTo('shop')}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
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

      {/* Sign-In Notice Banner if Customer is Not Logged In */}
      {!currentUser && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Sign In Required to Place Order</h3>
              <p className="text-xs text-slate-600">
                Please sign in or register so your order is linked to your account for live tracking in "My Orders".
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      )}

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
                      <p className="text-slate-700 font-semibold truncate">{addr.fullName || addr.name}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">
                        {[addr.houseNo, addr.street, addr.area, addr.city, addr.state, addr.pincode || addr.zipCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-1 flex items-center justify-between">
                        <span>{addr.phone}</span>
                        {addr.latitude !== undefined && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> GPS
                          </span>
                        )}
                      </p>
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

            {/* Complete Indian Address Fields + Use Current Location */}
            {selectedAddressId === 'new' && (
              <div className="pt-2 space-y-3 animate-in fade-in duration-200">
                <AddressFormFields
                  value={newAddress}
                  onChange={setNewAddress}
                  onNotify={addToast}
                  showLabelSelector={true}
                />

                {currentUser && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveNewAddressToProfile}
                      onChange={(e) => setSaveNewAddressToProfile(e.target.checked)}
                      className="rounded accent-violet-600 w-3.5 h-3.5"
                    />
                    <span>Save this address to my address book for future orders</span>
                  </label>
                )}
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
                  <span className="font-bold text-slate-900 block">Standard Ground Delivery</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">3-5 Business Days Pan-India Delivery</span>
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

            <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-200 text-xs space-y-2">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-violet-700 shrink-0" />
                <div>
                  <strong className="text-violet-950 block font-bold text-sm">Secure UPI Payment via Razorpay</strong>
                  <p className="text-violet-800 text-[11px]">
                    Pay securely using Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
                  </p>
                </div>
              </div>
            </div>
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
                <span>Tax (GST)</span>
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
                  <span>Saving Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>
                    Pay Securely with UPI ({formatPrice(calculatedTotal)})
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Free returns within 7 days · Official Quality Guarantee</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

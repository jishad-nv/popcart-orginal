import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, ArrowLeft, Tag, Check, Truck, ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatWeightDisplay } from '../config/shipping';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    cartSubtotal,
    cartDiscount,
    cartBaseShipping,
    cartShippingDiscount,
    cartShipping,
    cartTotal,
    cartTotalWeight,
    isCartOverWeightLimit,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    formatPrice,
    settings,
    navigateTo,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponInput.trim()) return;
    const res = applyCoupon(couponInput.trim());
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponInput('');
    }
  };

  const subtotalAfterDiscounts = Math.max(0, cartSubtotal - cartDiscount);
  const amountNeededForDiscount50 = Math.max(0, 501 - subtotalAfterDiscounts);

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Your Shopping Cart is Empty</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Looks like you haven't added anything to your cart yet. Explore our curated gadgets and trending electronics!
        </p>
        <button
          onClick={() => navigateTo('shop')}
          className="mt-4 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-violet-500/25 transition-all inline-flex items-center gap-2"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Shopping Cart ({cart.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review your chosen items, adjust quantities, and enter promo coupons.
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors self-start sm:self-auto"
        >
          Clear All Items
        </button>
      </div>

      {/* Shipping Offers & Order Weight Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors ${
        isCartOverWeightLimit
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : subtotalAfterDiscounts > 500
          ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800'
          : 'bg-violet-50/70 border-violet-100 text-slate-700'
      }`}>
        {isCartOverWeightLimit ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
        ) : (
          <Truck className="w-5 h-5 text-violet-600 shrink-0" />
        )}
        <div className="text-xs">
          {isCartOverWeightLimit ? (
            <div>
              <strong className="block text-rose-900 font-bold text-sm">Order Weight Limit Exceeded (Maximum 10 kg)</strong>
              <span>
                Your current order weighs <strong>{formatWeightDisplay(cartTotalWeight)}</strong>, which exceeds our maximum order limit of 10 kg. Please reduce item quantities to proceed to checkout.
              </span>
            </div>
          ) : subtotalAfterDiscounts > 500 ? (
            <div>
              <span className="font-bold text-emerald-900">
                🎉 ₹50 Shipping Discount Applied!
              </span>{' '}
              Orders with a product subtotal over ₹500 automatically receive ₹50 off calculated weight-based shipping.
            </div>
          ) : (
            <div>
              Add <strong className="text-slate-900 font-bold">{formatPrice(amountNeededForDiscount50)}</strong> more to unlock{' '}
              <strong className="text-violet-700 font-bold">₹50 OFF Shipping</strong> on orders over ₹500!
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart Item Table / List (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {cart.map((item) => (
              <div
                key={`${item.productId}-${item.selectedColor}`}
                className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl bg-slate-50 border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                      {item.product.brand}
                    </span>
                    <h3
                      onClick={() => navigateTo('product-detail', { productId: item.productId })}
                      className="text-sm font-bold text-slate-900 hover:text-violet-700 transition-colors cursor-pointer truncate"
                    >
                      {item.product.name}
                    </h3>
                    {item.selectedColor && (
                      <p className="text-xs text-slate-500 mt-0.5">Color: {item.selectedColor}</p>
                    )}
                    <span className="text-xs font-semibold text-slate-700 sm:hidden block mt-1">
                      {formatPrice(item.product.price)} each
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Quantity controls */}
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity - 1, item.selectedColor)}
                      className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold tabular-nums text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity + 1, item.selectedColor)}
                      className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right">
                    <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums block">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:block">
                      {formatPrice(item.product.price)} / unit
                    </span>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeFromCart(item.productId, item.selectedColor)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => navigateTo('shop')}
              className="text-xs font-semibold text-slate-600 hover:text-violet-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>
          </div>
        </div>

        {/* Order Summary & Coupon (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Coupon Box */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Have a Discount Coupon?
            </h4>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    <strong>{appliedCoupon.code}</strong> (-{formatPrice(cartDiscount)})
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-emerald-700 hover:text-emerald-900 font-bold underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-1">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError('');
                      }}
                      placeholder="e.g. POPCART30"
                      className="w-full pl-9 pr-3 py-2 text-xs uppercase bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                  >
                    Apply
                  </button>
                </div>
                {couponError && <p className="text-[11px] text-rose-500">{couponError}</p>}
              </form>
            )}
          </div>

          {/* Breakdown Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Order Summary</h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartSubtotal)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon Discount</span>
                  <span className="font-semibold tabular-nums">-{formatPrice(cartDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Total Cart Weight</span>
                <span className={`font-semibold tabular-nums ${isCartOverWeightLimit ? 'text-rose-600 font-bold' : 'text-slate-900'}`}>
                  {formatWeightDisplay(cartTotalWeight)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Weight-Based Shipping</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartBaseShipping)}</span>
              </div>
              {cartShippingDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Shipping Discount (Orders &gt; ₹500)</span>
                  <span className="font-semibold tabular-nums">-{formatPrice(cartShippingDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Final Shipping Charge</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {cartShipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : formatPrice(cartShipping)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-extrabold text-slate-900">
                <span>Estimated Total</span>
                <span className="text-lg text-violet-700 tabular-nums">{formatPrice(cartTotal)}</span>
              </div>
            </div>

            {isCartOverWeightLimit && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Order weight exceeds maximum 10 kg limit. Reduce quantities to proceed.</span>
              </div>
            )}

            <button
              disabled={isCartOverWeightLimit}
              onClick={() => {
                if (isCartOverWeightLimit) return;
                navigateTo('checkout');
              }}
              className={`w-full py-3.5 px-4 ${
                isCartOverWeightLimit
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 cursor-pointer'
              } text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all`}
            >
              <span>{isCartOverWeightLimit ? 'Weight Limit Exceeded (Max 10 kg)' : 'Proceed to Checkout'}</span>
              {!isCartOverWeightLimit && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Safe & Secure 256-Bit SSL Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

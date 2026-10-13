import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Tag, Check, Truck, AlertTriangle } from 'lucide-react';
import { formatWeightDisplay } from '../../config/shipping';

export const CartDrawer: React.FC = () => {
  const {
    isCartDrawerOpen,
    setCartDrawerOpen,
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    cartTotalWeight,
    isCartOverWeightLimit,
    cartSubtotal,
    cartDiscount,
    cartBaseShipping,
    cartShippingDiscount,
    cartShipping,
    cartTotal,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    settings,
    formatPrice,
    navigateTo,
  } = useStore();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState('');

  if (!isCartDrawerOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCodeInput.trim()) return;
    const res = applyCoupon(couponCodeInput.trim());
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponCodeInput('');
    }
  };

  const subtotalAfterDiscounts = Math.max(0, cartSubtotal - cartDiscount);
  const amountNeededForDiscount50 = Math.max(0, 501 - subtotalAfterDiscounts);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-violet-600" />
              <h2 className="text-base font-bold text-slate-900">Your Shopping Cart</h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                {cart.length} items
              </span>
            </div>
            <button
              onClick={() => setCartDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shipping Offer & Weight Status Banner */}
          {cart.length > 0 && (
            <div className={`px-5 py-3 border-b transition-colors ${
              isCartOverWeightLimit
                ? 'bg-rose-50 border-rose-200'
                : subtotalAfterDiscounts > 500
                ? 'bg-emerald-50/80 border-emerald-100'
                : 'bg-violet-50/60 border-violet-100/50'
            }`}>
              <div className="flex items-center gap-2.5 text-xs">
                {isCartOverWeightLimit ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <Truck className="w-4 h-4 text-violet-600 shrink-0" />
                )}
                <div className="leading-tight">
                  {isCartOverWeightLimit ? (
                    <span className="text-rose-800 font-bold">
                      Order weight ({formatWeightDisplay(cartTotalWeight)}) exceeds maximum 10 kg limit!
                    </span>
                  ) : subtotalAfterDiscounts > 500 ? (
                    <span className="text-emerald-800">
                      <strong className="font-bold text-emerald-900">₹50 Shipping Discount Applied!</strong> (Orders &gt; ₹500)
                    </span>
                  ) : (
                    <span className="text-slate-700">
                      Add <strong className="text-slate-900 font-bold">{formatPrice(amountNeededForDiscount50)}</strong> more to unlock <strong className="text-violet-700 font-bold">₹50 OFF Shipping</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-slate-100 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Your bag is empty</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Discover trending electronics and modern accessories to add to your order.
                </p>
                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    navigateTo('shop');
                  }}
                  className="mt-5 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-violet-500/20 transition-colors"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={`${item.productId}-${item.selectedColor}`} className="pt-3 first:pt-0 flex gap-3.5">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-cover rounded-xl bg-slate-50 border border-slate-200 shrink-0"
                    />

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                              {item.product.brand}
                            </span>
                            <h4
                              onClick={() => {
                                setCartDrawerOpen(false);
                                navigateTo('product-detail', { productId: item.productId });
                              }}
                              className="text-xs font-bold text-slate-900 hover:text-violet-700 cursor-pointer line-clamp-1"
                            >
                              {item.product.name}
                            </h4>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId, item.selectedColor)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.selectedColor && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                            <span>Color:</span>
                            <span className="font-medium text-slate-700">{item.selectedColor}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity - 1, item.selectedColor)}
                            className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-semibold tabular-nums text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity + 1, item.selectedColor)}
                            className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Summary & Checkout */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
              {/* Coupon input */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-medium">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>
                      Coupon <strong>{appliedCoupon.code}</strong> applied (-{formatPrice(cartDiscount)})
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-emerald-700 hover:text-emerald-900 font-semibold underline text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          setCouponError('');
                        }}
                        placeholder="Discount code (e.g. POPCART30)"
                        className="w-full pl-8 pr-3 py-2 text-xs uppercase bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-[11px] text-rose-500">{couponError}</p>}
                </form>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartSubtotal)}</span>
                </div>
                {cartDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount Coupon</span>
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
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {cartBaseShipping > 0 ? formatPrice(cartBaseShipping) : '₹0'}
                  </span>
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
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span className="text-base text-violet-700 font-extrabold tabular-nums">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {isCartOverWeightLimit && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Weight limit exceeded (10 kg max). Reduce item quantities to proceed.</span>
                  </div>
                )}

                <button
                  disabled={isCartOverWeightLimit}
                  onClick={() => {
                    if (isCartOverWeightLimit) return;
                    setCartDrawerOpen(false);
                    navigateTo('checkout');
                  }}
                  className={`w-full py-3 px-4 ${
                    isCartOverWeightLimit
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 cursor-pointer'
                  } text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all`}
                >
                  <span>{isCartOverWeightLimit ? 'Weight Limit Exceeded (Max 10 kg)' : 'Proceed to Checkout'}</span>
                  {!isCartOverWeightLimit && <ArrowRight className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    navigateTo('cart');
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  View Full Cart & Summary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

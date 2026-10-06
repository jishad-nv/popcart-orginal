import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Tag, Check, Truck } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    isCartDrawerOpen,
    setCartDrawerOpen,
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    cartSubtotal,
    cartDiscount,
    cartShipping,
    cartTax,
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

  const amountNeededForFreeShipping = Math.max(0, settings.freeShippingThreshold - cartSubtotal);
  const freeShippingProgress = Math.min(100, Math.round((cartSubtotal / settings.freeShippingThreshold) * 100));

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

          {/* Free Shipping Progress Indicator */}
          <div className="px-5 py-3 bg-violet-50/60 border-b border-violet-100/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Truck className="w-3.5 h-3.5 text-violet-600" />
                {amountNeededForFreeShipping === 0 ? (
                  <span className="text-emerald-700 font-bold">You unlocked Free Express Delivery!</span>
                ) : (
                  <span>
                    Add <strong className="text-slate-900">{formatPrice(amountNeededForFreeShipping)}</strong> more for{' '}
                    <strong className="text-violet-700">Free Shipping</strong>
                  </span>
                )}
              </span>
              <span className="font-semibold text-violet-700 text-[11px]">{freeShippingProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-violet-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

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
                  <span>Estimated Shipping</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {cartShipping === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(cartShipping)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (GST 12%)</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(cartTax)}</span>
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
                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    navigateTo('checkout');
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
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

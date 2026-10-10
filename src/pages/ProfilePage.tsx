import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/product/ProductCard';
import { AddressFormFields } from '../components/common/AddressFormFields';
import { Address } from '../types';
import {
  User,
  Package,
  MapPin,
  Heart,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Truck,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const {
    currentUser,
    updateProfile,
    userOrders,
    addresses,
    addAddress,
    deleteAddress,
    setDefaultAddress,
    wishlistProducts,
    wishlistCount,
    logout,
    isLoggingOut,
    setAuthModalOpen,
    formatPrice,
    settings,
    updateSettings,
    navigateTo,
    addToast,
    isAdmin,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'details' | 'orders' | 'addresses' | 'wishlist' | 'settings'>('orders');

  // Profile details form state synced with currentUser
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setActiveTab('details');
    }
  }, [currentUser]);

  // Address add form modal state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState<Omit<Address, 'id' | 'userId'>>({
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
    addToast('Copied', 'Copied to clipboard.', 'info');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(name, email, phone);
  };

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = (newAddressForm.phone || '').replace(/\D/g, '').slice(-10);
    const cleanPin = (newAddressForm.zipCode || newAddressForm.pincode || '').replace(/\D/g, '');

    if (!(newAddressForm.fullName || newAddressForm.name)?.trim()) {
      addToast('Name Required', 'Please enter the recipient full name.', 'error');
      return;
    }
    if (cleanPhone.length !== 10) {
      addToast('Valid Phone Required', 'Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    if (!newAddressForm.houseNo?.trim() && !newAddressForm.street?.trim()) {
      addToast('Address Required', 'Please enter your house/flat number and street.', 'error');
      return;
    }
    if (!newAddressForm.city?.trim() || !newAddressForm.state?.trim()) {
      addToast('City & State Required', 'Please enter your city and state.', 'error');
      return;
    }
    if (cleanPin.length !== 6) {
      addToast('Valid PIN Code Required', 'Please enter a valid 6-digit PIN code.', 'error');
      return;
    }

    addAddress({
      ...newAddressForm,
      name: (newAddressForm.fullName || newAddressForm.name).trim(),
      fullName: (newAddressForm.fullName || newAddressForm.name).trim(),
      phone: cleanPhone,
      zipCode: cleanPin,
      pincode: cleanPin,
      isDefault: addresses.length === 0,
    });
    setIsAddingAddress(false);
    setNewAddressForm({
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
      isDefault: false,
      label: 'Home',
    });
  };

  // Strict Route / Auth Protection: Never expose private profile details when logged out
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-3xl flex items-center justify-center mx-auto border border-violet-200 shadow-sm">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Sign In to Your Account</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            You are currently signed out. Sign in to view your profile, track orders, and manage saved addresses.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-500/20 transition-all cursor-pointer"
          >
            Sign In to Account
          </button>
          <button
            onClick={() => navigateTo('home', { replace: true })}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  const ORDER_STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. TOP BRAND GRADIENT HEADER */}
      <div className="rounded-3xl bg-gradient-to-r from-[#2B1B54] via-[#1E1338] to-[#18112C] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-extrabold text-white shadow-inner">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'PO'}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider block">
                {settings.storeName} Member · Member since {currentUser?.memberSince || 'October 2026'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                {currentUser?.name || 'Popcarty User'}
              </h1>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span>{currentUser?.email}</span>
                {currentUser?.phone && (
                  <>
                    <span>·</span>
                    <span>{currentUser?.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('orders')}
              className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl px-4 py-2.5 text-center cursor-pointer transition-all"
            >
              <span className="text-lg font-bold block tabular-nums">{userOrders.length}</span>
              <span className="text-[10px] text-violet-200 uppercase tracking-wider">Orders</span>
            </div>

            <div
              onClick={() => setActiveTab('wishlist')}
              className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl px-4 py-2.5 text-center cursor-pointer transition-all"
            >
              <span className="text-lg font-bold block tabular-nums">{wishlistCount}</span>
              <span className="text-[10px] text-violet-200 uppercase tracking-wider">Wishlist</span>
            </div>

            <div
              onClick={() => setActiveTab('addresses')}
              className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl px-4 py-2.5 text-center cursor-pointer transition-all"
            >
              <span className="text-lg font-bold block tabular-nums">{addresses.length}</span>
              <span className="text-[10px] text-violet-200 uppercase tracking-wider">Addresses</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN DASHBOARD LAYOUT: Tabs Sidebar (Left) + Content (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar (4 Cols) */}
        <aside className="lg:col-span-4 bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4" />
              <span>My Orders ({userOrders.length})</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'addresses'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4" />
              <span>Saved Addresses ({addresses.length})</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'details'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <User className="w-4 h-4" />
              <span>Account Details</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'wishlist'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Heart className="w-4 h-4" />
              <span>Saved Wishlist ({wishlistCount})</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" />
              <span>Settings & Preferences</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <div className="pt-2 border-t border-slate-100">
            {isAdmin && (
              <button
                onClick={() => navigateTo('admin')}
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors text-left cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-violet-600" />
                <span>Admin Dashboard</span>
              </button>
            )}

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={async () => {
                await logout();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </aside>

        {/* Tab Content Panel (8 Cols) */}
        <main className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
          {/* TAB 1: ACCOUNT DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Account Details</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Update your contact details for 1-click checkout and dispatch tracking.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  className="py-3 px-6 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-500/20 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MY ORDERS (Live synced with Firestore) */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  My Orders ({userOrders.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Real-time order status, tracking numbers, and delivery receipts synced directly with Popcarty.
                </p>
              </div>

              {userOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold">No orders yet</p>
                  <p className="text-xs text-slate-400">Your placed orders will appear here for live tracking.</p>
                  <button
                    onClick={() => navigateTo('shop')}
                    className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {userOrders.map((ord) => {
                    const currentStepIdx = ORDER_STEPS.indexOf(
                      ord.orderStatus === 'processing' ? 'confirmed' : ord.orderStatus
                    );
                    const addr = ord.shippingAddress;

                    return (
                      <div
                        key={ord.orderNumber || ord.id}
                        className="p-5 rounded-2xl border border-slate-200 hover:border-violet-200 transition-all space-y-4 bg-slate-50/30"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-slate-900">
                                #{ord.orderNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(ord.orderNumber, `ord-${ord.orderNumber}`)}
                                className="text-slate-400 hover:text-violet-600 p-0.5 cursor-pointer"
                                title="Copy Order ID"
                              >
                                {copiedId === `ord-${ord.orderNumber}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  ord.orderStatus === 'delivered'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ord.orderStatus === 'cancelled' || ord.orderStatus === 'returned'
                                    ? 'bg-rose-100 text-rose-800'
                                    : ord.orderStatus === 'shipped' || ord.orderStatus === 'out_for_delivery'
                                    ? 'bg-violet-100 text-violet-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ord.orderStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Placed on{' '}
                              {new Date(ord.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                              {formatPrice(ord.totalAmount)}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'} ·{' '}
                              {ord.paymentMethod === 'cod' ? 'COD' : ord.paymentMethod.toUpperCase()} (
                              {ord.paymentStatus.replace(/_/g, ' ')})
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Bar (unless cancelled/returned) */}
                        {ord.orderStatus !== 'cancelled' && ord.orderStatus !== 'returned' && (
                          <div className="grid grid-cols-6 gap-1 pt-1">
                            {[
                              { id: 'placed', label: 'Placed' },
                              { id: 'confirmed', label: 'Confirmed' },
                              { id: 'packed', label: 'Packed' },
                              { id: 'shipped', label: 'Shipped' },
                              { id: 'out_for_delivery', label: 'Out for Delivery' },
                              { id: 'delivered', label: 'Delivered' },
                            ].map((st, idx) => {
                              const done = currentStepIdx >= idx;
                              return (
                                <div key={st.id} className="text-center space-y-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-colors ${
                                      done ? 'bg-violet-600' : 'bg-slate-200'
                                    }`}
                                  />
                                  <span
                                    className={`text-[10px] block leading-tight ${
                                      done ? 'font-bold text-violet-800' : 'text-slate-400'
                                    }`}
                                  >
                                    {st.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Courier & Tracking Info Banner if added by Admin */}
                        {(ord.trackingNumber || ord.courierName) && (
                          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-violet-600 shrink-0" />
                              <div>
                                <span className="font-bold text-violet-950">
                                  Courier: {ord.courierName || 'Standard Express'}
                                </span>
                                {ord.trackingNumber && (
                                  <span className="ml-2 font-mono text-violet-700 font-semibold">
                                    AWB / Tracking: {ord.trackingNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                            {ord.trackingNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(ord.trackingNumber!, `trk-${ord.orderNumber}`)}
                                className="px-2.5 py-1 bg-white hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Tracking #</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Items */}
                        <div className="space-y-2">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.productImage}
                                  alt=""
                                  className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                                <div>
                                  <span className="font-semibold text-slate-900 block">{item.productName}</span>
                                  <span className="text-[11px] text-slate-500">
                                    {item.color ? `Variant: ${item.color} · ` : ''}
                                    {item.size ? `Size: ${item.size} · ` : ''}
                                    Qty: {item.quantity} × {formatPrice(item.price)}
                                  </span>
                                </div>
                              </div>
                              <span className="font-bold text-slate-800 tabular-nums">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Delivery Address Snapshot */}
                        {addr && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-[11px] text-slate-600 space-y-0.5">
                            <span className="font-bold text-slate-800 block">
                              Delivery To: {addr.fullName || addr.name} ({addr.phone})
                            </span>
                            <span className="block">
                              {[addr.houseNo, addr.street, addr.area, addr.landmark ? `Near ${addr.landmark}` : '']
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                            <span className="block">
                              {[addr.city, addr.district, addr.state].filter(Boolean).join(', ')} -{' '}
                              {addr.pincode || addr.zipCode}
                            </span>
                          </div>
                        )}

                        {/* Tracking / Stepper History */}
                        {ord.statusHistory && ord.statusHistory.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700 block mb-1">Status Updates:</span>
                            <div className="space-y-1">
                              {ord.statusHistory.map((step, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                    <Truck className="w-3 h-3 text-violet-600 shrink-0" />
                                    {step.note}
                                  </span>
                                  <span className="text-slate-400">{step.timestamp}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Saved Addresses</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage delivery locations with GPS pin and PIN code autofill.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingAddress(true)}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New</span>
                </button>
              </div>

              {/* Add address form modal/collapse */}
              {isAddingAddress && (
                <form
                  onSubmit={handleCreateAddress}
                  className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase">New Delivery Address</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <AddressFormFields
                    value={newAddressForm}
                    onChange={setNewAddressForm}
                    onNotify={addToast}
                    showLabelSelector={true}
                  />

                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Save Address
                  </button>
                </form>
              )}

              {/* Address List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-2xl border text-xs flex flex-col justify-between space-y-3 transition-all ${
                      addr.isDefault ? 'border-violet-600 bg-violet-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] text-violet-700 bg-violet-100 font-bold px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 font-bold">{addr.fullName || addr.name}</p>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {[addr.houseNo, addr.street, addr.area].filter(Boolean).join(', ')}
                      </p>
                      {addr.landmark && <p className="text-slate-500 text-[11px]">Landmark: {addr.landmark}</p>}
                      <p className="text-slate-600 font-medium">
                        {[addr.city, addr.district, addr.state].filter(Boolean).join(', ')} -{' '}
                        {addr.pincode || addr.zipCode}
                      </p>
                      <p className="text-slate-500 mt-1">
                        Phone: {addr.phone}
                        {addr.alternatePhone ? ` / ${addr.alternatePhone}` : ''}
                      </p>
                      {addr.latitude !== undefined && addr.longitude !== undefined && (
                        <a
                          href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline font-semibold mt-1"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>
                            GPS: {addr.latitude}, {addr.longitude}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      {!addr.isDefault && (
                        <button
                          onClick={() => setDefaultAddress(addr.id)}
                          className="text-violet-600 hover:text-violet-800 font-semibold text-[11px] cursor-pointer"
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        onClick={() => deleteAddress(addr.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 ml-auto cursor-pointer"
                        title="Delete address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SAVED WISHLIST */}
          {activeTab === 'wishlist' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    My Wishlist ({wishlistProducts.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Products saved for future purchase or price-drop tracking.
                  </p>
                </div>
              </div>

              {wishlistProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <Heart className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold">Your wishlist is empty</p>
                  <p className="text-xs text-slate-400">Save items while browsing to find them here later.</p>
                  <button
                    onClick={() => navigateTo('shop')}
                    className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Browse Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlistProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS & PREFERENCES */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Settings & Preferences</h3>
                <p className="text-xs text-slate-500 mt-1">Configure currency, communications, and role access.</p>
              </div>

              <div className="space-y-4 max-w-md text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="block text-slate-900">Currency Display</strong>
                    <span className="text-slate-500">Toggle between Indian Rupee (₹) and US Dollar ($)</span>
                  </div>
                  <select
                    value={settings.currency}
                    onChange={(e) => updateSettings({ currency: e.target.value as any })}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold cursor-pointer"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="block text-slate-900">Email Notifications</strong>
                    <span className="text-slate-500">Receive order dispatch & invoice updates</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-600 cursor-pointer" />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="block text-slate-900">SMS Tracking Alerts</strong>
                    <span className="text-slate-500">Get text messages when delivery is out</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-600 cursor-pointer" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

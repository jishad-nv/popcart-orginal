import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/product/ProductCard';
import {
  User,
  Package,
  MapPin,
  Heart,
  Settings,
  LogOut,
  Check,
  Plus,
  Trash2,
  Edit2,
  Truck,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  ChevronRight,
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

  const [activeTab, setActiveTab] = useState<'details' | 'orders' | 'addresses' | 'wishlist' | 'settings'>('details');

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
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('');
  const [newAddrState, setNewAddrState] = useState('');
  const [newAddrZip, setNewAddrZip] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('');
  const [newAddrLabel, setNewAddrLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

  // Selected Order for Tracking Details Modal
  const [viewingOrderNumber, setViewingOrderNumber] = useState<string | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(name, email, phone);
  };

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrStreet || !newAddrCity || !newAddrZip) {
      addToast('Incomplete Address', 'Please fill all required address fields.', 'error');
      return;
    }
    addAddress({
      name: newAddrName || name,
      street: newAddrStreet,
      city: newAddrCity,
      state: newAddrState || 'State',
      zipCode: newAddrZip,
      country: 'India',
      phone: newAddrPhone || phone,
      isDefault: addresses.length === 0,
      label: newAddrLabel,
    });
    setIsAddingAddress(false);
    setNewAddrStreet('');
    setNewAddrCity('');
    setNewAddrZip('');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. TOP BRAND GRADIENT HEADER (As in Video 00:00 & 00:46) */}
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
                <span>·</span>
                <span>{currentUser?.phone}</span>
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
            onClick={() => setActiveTab('details')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left ${
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
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left ${
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
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left ${
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
            onClick={() => setActiveTab('wishlist')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left ${
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
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left ${
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
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors text-left"
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
          {/* TAB 1: ACCOUNT DETAILS (As in Video 00:00 & 00:46) */}
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

          {/* TAB 2: MY ORDERS (As in Video 00:38) */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  My Orders ({userOrders.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Track shipment progress, view purchase receipts, and reorder favourite items.
                </p>
              </div>

              {userOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold">No orders yet</p>
                  <p className="text-xs text-slate-400">Your placed orders will appear here for tracking.</p>
                  <button
                    onClick={() => navigateTo('shop')}
                    className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {userOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-5 rounded-2xl border border-slate-200 hover:border-violet-200 transition-all space-y-4 bg-slate-50/30"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              #{ord.orderNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ord.orderStatus === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.orderStatus === 'shipped'
                                  ? 'bg-violet-100 text-violet-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.orderStatus.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Placed on {new Date(ord.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                            {formatPrice(ord.totalAmount)}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {ord.items.length} items · {ord.paymentMethod.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.productImage}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <span className="font-semibold text-slate-900 block">{item.productName}</span>
                                <span className="text-[11px] text-slate-500">
                                  {item.color ? `Color: ${item.color} · ` : ''}Qty: {item.quantity}
                                </span>
                              </div>
                            </div>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Tracking / Stepper History */}
                      {ord.statusHistory && ord.statusHistory.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700 block mb-1">Tracking History:</span>
                          <div className="space-y-1">
                            {ord.statusHistory.map((step, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                  <Truck className="w-3 h-3 text-violet-600" />
                                  {step.note}
                                </span>
                                <span className="text-slate-400">{step.timestamp}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                  <p className="text-xs text-slate-500 mt-1">Manage delivery locations for quick ordering.</p>
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
                  className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase">New Address Details</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newAddrName}
                        onChange={(e) => setNewAddrName(e.target.value)}
                        placeholder="Recipient name"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Phone</label>
                      <input
                        type="tel"
                        required
                        value={newAddrPhone}
                        onChange={(e) => setNewAddrPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={newAddrStreet}
                      onChange={(e) => setNewAddrStreet(e.target.value)}
                      placeholder="Building, street, area"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={newAddrCity}
                        onChange={(e) => setNewAddrCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={newAddrState}
                        onChange={(e) => setNewAddrState(e.target.value)}
                        placeholder="State"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">PIN Code</label>
                      <input
                        type="text"
                        required
                        value={newAddrZip}
                        onChange={(e) => setNewAddrZip(e.target.value)}
                        placeholder="560038"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
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
                      <p className="text-slate-700 font-semibold">{addr.name}</p>
                      <p className="text-slate-500 mt-1 leading-relaxed">
                        {addr.street}, {addr.city}, {addr.state} - {addr.zipCode}
                      </p>
                      <p className="text-slate-400 mt-1">{addr.phone}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      {!addr.isDefault && (
                        <button
                          onClick={() => setDefaultAddress(addr.id)}
                          className="text-violet-600 hover:text-violet-800 font-semibold text-[11px]"
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        onClick={() => deleteAddress(addr.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 ml-auto"
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

          {/* TAB 4: SAVED WISHLIST (As in Video 00:40) */}
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
                    className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl"
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

import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PopcartyLogo } from './PopcartyLogo';
import { X, Lock, Mail, User, Phone, ShieldCheck, ArrowRight } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen, login, register, settings } = useStore();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'signin') {
      await login(email || 'popcarty@gmail.com', 'customer', password);
    } else {
      await register(name || 'New Shopper', email || 'shopper@example.com', phone || '+91 98765 43210', password);
    }
  };

  const handleDemoShopper = async () => {
    await login('popcarty@gmail.com', 'customer', 'customer123');
  };

  const handleDemoAdmin = async () => {
    await login('admin@popcarty.com', 'admin', 'admin123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <PopcartyLogo size="md" showSubtitle={true} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            {tab === 'signin' ? `Welcome Back to ${settings.storeName}` : `Create Your Account`}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {tab === 'signin'
              ? 'Sign in to access your orders, saved wishlist, and 1-click checkout'
              : 'Join Popcarty for order tracking, faster checkout, and member discounts'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
          <button
            onClick={() => setTab('signin')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'signin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Verma"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Number (for delivery SMS)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-500/25 transition-all mt-4 cursor-pointer"
          >
            {tab === 'signin' ? 'Sign In to Account' : 'Create Free Account'}
          </button>
        </form>

        {/* Demo Fast Logins */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] font-medium text-slate-500 mb-2.5">
            Or test instantly with one-click demo profiles:
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDemoShopper}
              className="flex-1 py-2 px-2 bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-violet-600" />
              <span>Demo Customer</span>
            </button>
            <button
              onClick={handleDemoAdmin}
              className="flex-1 py-2 px-2 bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Demo Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

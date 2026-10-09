import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { PopcartyLogo } from './PopcartyLogo';
import { X, Lock, Mail, User, Phone, AlertCircle, Loader2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen, login, register, settings } = useStore();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isAuthModalOpen, tab]);

  if (!isAuthModalOpen) return null;

  const validateClientForm = (): string | null => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (tab === 'register') {
      if (!name.trim()) {
        return 'Please enter your full name.';
      }
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return 'Please enter a valid email address.';
      }
      const digits = phone.replace(/\D/g, '');
      if (!phone.trim() || digits.length < 10 || digits.length > 15) {
        return 'Please enter a valid 10-digit mobile number.';
      }
      if (!password || password.length < 6) {
        return 'Password must be at least 6 characters long.';
      }
    } else {
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return 'Please enter a valid email address.';
      }
      if (!password) {
        return 'Please enter your password.';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    const validationErr = validateClientForm();
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'signin') {
        const ok = await login(email.trim(), 'customer', password);
        if (!ok) {
          setErrorMessage('Invalid email or password. Please verify your credentials or create an account.');
        } else {
          setEmail('');
          setPassword('');
        }
      } else {
        const ok = await register(name.trim(), email.trim(), phone.trim(), password);
        if (!ok) {
          setErrorMessage('Unable to create account. An account with this email may already exist.');
        } else {
          setName('');
          setEmail('');
          setPhone('');
          setPassword('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
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
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Inline Error Message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {tab === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Alex Verma"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-60"
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
                disabled={isSubmitting}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-60"
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
                  required
                  disabled={isSubmitting}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-60"
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
                disabled={isSubmitting}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-violet-500/25 transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{tab === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{tab === 'signin' ? 'Sign In to Account' : 'Create Free Account'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

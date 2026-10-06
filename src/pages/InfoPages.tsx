import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  HelpCircle,
  Truck,
  RefreshCw,
  Shield,
  FileText,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  CheckCircle2,
  Send,
} from 'lucide-react';

export const InfoPages: React.FC = () => {
  const { currentPage, settings, addToast, navigateTo } = useStore();

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('Order Tracking Inquiry');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.includes('@') || !contactMessage.trim()) {
      addToast('Incomplete Form', 'Please provide a valid email and inquiry message.', 'error');
      return;
    }
    setContactSent(true);
    addToast('Message Sent', 'Support team will reply within 24 business hours.', 'success');
  };

  const faqs = [
    {
      q: 'How fast is express delivery dispatched?',
      a: 'All orders placed with Express Shipping before 3:00 PM IST are packaged and handed over to courier dispatch on the same business day. Delivery across major metro locations takes 24 to 48 hours.',
    },
    {
      q: 'What is covered under the 1-Year Official Warranty?',
      a: 'Our 1-Year Comprehensive Warranty covers any manufacturing defect, driver imbalance, hardware failure, battery degradation over 25%, and internal circuitry faults. Accidental physical drops or water immersion beyond rated IPX standards are excluded.',
    },
    {
      q: 'How does the 7-day hassle-free replacement work?',
      a: 'If you receive an item with any defect or if it does not fit your ergonomic requirements, you can initiate a return or replacement ticket from your Account > My Orders page. Our courier will pick up the item and dispatch a replacement or full refund.',
    },
    {
      q: 'Are the products authentic and original?',
      a: '100% yes. We partner directly with verified electronics manufacturers and maintain strict quality inspection benchmarks at our fulfillment hubs before shipment.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* ABOUT US */}
      {currentPage === 'about' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">About {settings.storeName}</h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Curating elevated tech, acoustic purity, and daily carry hardware for those who demand excellence.
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-600 space-y-4 leading-relaxed bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Our Founding Mission</h3>
            <p>
              Founded in 2026, {settings.storeName} was built to bridge the gap between industrial minimalism and accessible high-performance consumer technology. We believe everyday gadgets—from noise-cancelling headphones to wireless power banks—should look architectural, perform relentlessly, and last for years.
            </p>

            <h3 className="text-base font-bold text-slate-900 pt-2">Direct-from-Lab Craftsmanship</h3>
            <p>
              Every audio driver, titanium casing, and braided aramid fiber weave in our catalog is engineered to military-spec drop standards and certified for lossless acoustics. By cutting unnecessary distributor markups, we deliver flagship tier build quality directly to your doorstep.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 not-prose">
              <div className="p-4 rounded-2xl bg-violet-50 text-center">
                <strong className="text-2xl font-extrabold text-violet-700 block">120K+</strong>
                <span className="text-xs text-slate-600">Active Customers</span>
              </div>
              <div className="p-4 rounded-2xl bg-violet-50 text-center">
                <strong className="text-2xl font-extrabold text-violet-700 block">99.4%</strong>
                <span className="text-xs text-slate-600">On-Time Dispatch</span>
              </div>
              <div className="p-4 rounded-2xl bg-violet-50 text-center">
                <strong className="text-2xl font-extrabold text-violet-700 block">4.8★</strong>
                <span className="text-xs text-slate-600">Verified Rating</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT US */}
      {currentPage === 'contact' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Contact Customer Care</h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Have questions about your order, tracking status, or product specifications? We're here 24/7.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 bg-slate-900 text-white p-6 sm:p-8 rounded-3xl space-y-6">
              <h3 className="text-base font-bold">Support Channels</h3>
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white">Email Care Desk</strong>
                    <span className="text-slate-300">support@popcarty.com</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white">Toll-Free Phone</strong>
                    <span className="text-slate-300">+91 (800) 987-6543 (9 AM - 9 PM)</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white">Fulfillment Hub</strong>
                    <span className="text-slate-300">
                      Highline Skyline Center, Indiranagar, Bengaluru, KA 560038
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
              {contactSent ? (
                <div className="py-12 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-bold text-slate-900">Message Dispatched</h3>
                  <p className="text-xs text-slate-500">
                    A representative has received your ticket and will respond via email.
                  </p>
                  <button
                    onClick={() => setContactSent(false)}
                    className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Alex Verma"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Inquiry Subject</label>
                    <select
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option>Order Tracking Inquiry</option>
                      <option>Product Technical Question</option>
                      <option>Warranty Claim or Replacement</option>
                      <option>Wholesale & Corporate Gifting</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Message</label>
                    <textarea
                      required
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Include your order number (if applicable) and question details..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Inquiry</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAQ */}
      {currentPage === 'faq' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Frequently Asked Questions</h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Find quick answers regarding delivery timelines, warranty coverage, and returns.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 p-6 sm:p-8">
            {faqs.map((faq, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-slate-900 text-sm gap-4 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-violet-600' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed animate-in fade-in duration-150">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHIPPING POLICY */}
      {currentPage === 'shipping-policy' && (
        <div className="space-y-6 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-xs sm:text-sm text-slate-600 leading-relaxed animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <Truck className="w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-900">Shipping & Delivery Policy</h1>
          </div>
          <p>
            At {settings.storeName}, we ensure swift, insured, and tracked dispatch across all domestic and international destinations.
          </p>
          <h3 className="text-sm font-bold text-slate-900 pt-2">1. Free Shipping Eligibility</h3>
          <p>
            All orders with an item total exceeding <strong>{settings.currency === 'INR' ? '₹1,999' : '$50'}</strong> qualify for complimentary Standard Ground Shipping.
          </p>
          <h3 className="text-sm font-bold text-slate-900 pt-2">2. Package Tracking</h3>
          <p>
            As soon as your shipment is picked up by the logistics carrier, an SMS and email with live GPS tracking details will be dispatched.
          </p>
        </div>
      )}

      {/* RETURN & REFUND POLICY */}
      {currentPage === 'refund-policy' && (
        <div className="space-y-6 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-xs sm:text-sm text-slate-600 leading-relaxed animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <RefreshCw className="w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-900">7-Day Return & Refund Policy</h1>
          </div>
          <p>
            We stand behind every piece of hardware we build. If you are not completely satisfied with your purchase, you may initiate a return within 7 calendar days of delivery.
          </p>
          <h3 className="text-sm font-bold text-slate-900 pt-2">1. Return Guidelines</h3>
          <p>
            Products must be returned in original condition with included accessories, packaging, and warranty cards.
          </p>
          <h3 className="text-sm font-bold text-slate-900 pt-2">2. Instant Refund Timelines</h3>
          <p>
            Once our inspection team verifies the return at the hub, refunds are credited back to the original payment method (Cards/UPI) within 24 to 72 business hours.
          </p>
        </div>
      )}

      {/* PRIVACY POLICY */}
      {currentPage === 'privacy' && (
        <div className="space-y-6 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-xs sm:text-sm text-slate-600 leading-relaxed animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <Shield className="w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-900">Privacy & Data Governance</h1>
          </div>
          <p>
            Your privacy is paramount. We do not sell, rent, or lease your personal identifying data to third-party advertisers. All checkout transactions use end-to-end 256-bit encryption.
          </p>
        </div>
      )}

      {/* TERMS OF SERVICE */}
      {currentPage === 'terms' && (
        <div className="space-y-6 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-xs sm:text-sm text-slate-600 leading-relaxed animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <FileText className="w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-900">Terms of Service</h1>
          </div>
          <p>
            By accessing or ordering from {settings.storeName}, you agree to our standard terms of e-commerce sale, dispute resolution terms, and manufacturer warranty parameters.
          </p>
        </div>
      )}
    </div>
  );
};

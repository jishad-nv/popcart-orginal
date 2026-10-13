import React, { useState } from 'react';

export const WHATSAPP_PHONE_NUMBER = '+91 98479 05548';
export const WHATSAPP_CLEAN_NUMBER = '919847905548';
export const WHATSAPP_DEFAULT_MESSAGE = 'Hello Popcarty! I have a question about your products. Could you please help me?';
export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_CLEAN_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;

/**
 * Floating WhatsApp chat button for Popcarty customer support.
 * - Official WhatsApp green color scheme (#25D366).
 * - Fixed bottom-right positioning, responsive for mobile & desktop.
 * - Positioned safely above mobile bottom navigation bar and respects safe areas.
 * - Gentle attention-grabbing pulse effect and desktop tooltip.
 * - Opens chat directly with prefilled editable message.
 */
export const WhatsAppButton: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside
      aria-label="WhatsApp Support"
      className="fixed z-40 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-4 sm:right-6 md:right-8 flex items-center group pointer-events-auto"
    >
      {/* Desktop Tooltip */}
      <div
        className={`hidden md:flex items-center gap-2 bg-slate-900/95 backdrop-blur-sm text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg mr-3 transition-all duration-200 pointer-events-none select-none border border-slate-700/50 ${
          isHovered
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-2'
        }`}
        role="tooltip"
        id="whatsapp-tooltip"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Chat with us on WhatsApp</span>
        {/* Tooltip caret */}
        <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-t border-r border-slate-700/50" />
      </div>

      {/* Floating WhatsApp Action Button */}
      <a
        href={WHATSAPP_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        aria-describedby="whatsapp-tooltip"
        title="Chat with us on WhatsApp"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-2xl shadow-[#25D366]/40 hover:bg-[#20ba59] transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
      >
        {/* Subtle breathing ring animation */}
        <span
          className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none"
          style={{ animationDuration: '3s' }}
          aria-hidden="true"
        />

        {/* Online Status Pill Badge */}
        <span
          className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-300 border-2 border-white rounded-full shadow-sm"
          title="Online"
          aria-hidden="true"
        />

        {/* Official WhatsApp SVG Logo */}
        <svg
          className="w-7 h-7 sm:w-8 sm:h-8 fill-current drop-shadow-sm relative z-10"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M17.507 14.307l-.009.075c-.301-.15-1.78-.879-2.056-.979-.275-.101-.476-.15-.677.15-.2.301-.776.979-.952 1.18-.175.201-.351.226-.652.075-.301-.151-1.272-.469-2.423-1.496-.895-.798-1.5-1.784-1.675-2.085-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.175.201-.301.301-.502.1-.2.05-.376-.025-.527-.075-.15-.677-1.631-.928-2.234-.245-.588-.493-.508-.677-.518-.175-.009-.376-.011-.577-.011s-.527.075-.803.376c-.276.301-1.054 1.03-1.054 2.511s1.079 2.913 1.23 3.114c.15.201 2.124 3.243 5.145 4.548.718.311 1.279.497 1.716.636.721.23 1.377.197 1.896.12.577-.086 1.78-.727 2.031-1.43.251-.703.251-1.305.176-1.43-.075-.125-.276-.201-.577-.351zm-5.467 7.693c-2.015 0-3.89-.523-5.52-1.436L2 22l1.472-4.393a10.016 10.016 0 0 1-1.55-5.385C1.922 6.645 6.568 2 12.04 2c2.695 0 5.228 1.05 7.134 2.955a10.038 10.038 0 0 1 2.946 7.123c0 5.578-4.646 10.222-10.08 10.222zm0-18.422C7.625 3.578 4.025 7.178 4.025 11.593c0 1.542.438 3.012 1.242 4.283l-.865 2.585 2.668-.847a7.994 7.994 0 0 0 4.01 1.058c4.493 0 8.093-3.6 8.093-8.015 0-2.14-.834-4.153-2.348-5.666A7.986 7.986 0 0 0 12.04 3.578z" />
        </svg>
      </a>
    </aside>
  );
};

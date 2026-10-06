import React from 'react';
import { useStore } from '../../context/StoreContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed z-50 pointer-events-none flex flex-col items-center gap-2 transition-all duration-300 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[420px] bottom-[76px] sm:bottom-[80px] md:bottom-6"
      style={{
        bottom: 'max(76px, calc(60px + env(safe-area-inset-bottom, 0px) + 14px))',
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto w-full flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-800/80 animate-in fade-in slide-in-from-bottom-3 duration-250 ease-out"
          >
            {/* Status Icon */}
            <div className="shrink-0 flex items-center justify-center">
              {isSuccess && (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {isError && (
                <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              {isInfo && (
                <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug break-words">
                  {toast.message}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

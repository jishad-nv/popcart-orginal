import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React application error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] px-4 py-12 text-slate-900">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold tracking-tight">Something went wrong</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                We encountered an unexpected error while rendering this page. Your cart and order details are safe.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-rose-600 text-left overflow-x-auto max-h-24 custom-scrollbar">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('popcart_current_page');
                  window.location.href = '/';
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

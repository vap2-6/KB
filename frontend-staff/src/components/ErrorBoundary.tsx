import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto shadow-sm">
              <span className="text-rose-500 font-extrabold text-2xl">✕</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight font-display">
                Portal Interface Exception
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[300px] mx-auto">
                The Mid-Day Meal Staff Portal encountered an interface render error. Technical diagnostic logs are captured below.
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-left font-mono text-[10px] text-slate-700 max-h-48 overflow-y-auto break-all whitespace-pre-wrap leading-relaxed">
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#FF9933] hover:bg-[#e68a2e] text-white text-xs font-bold py-3 px-4 rounded-xl border border-[#FF9933] transition-all cursor-pointer shadow-md shadow-[#FF9933]/15 text-center uppercase tracking-wider font-display"
            >
              Restart Portal Instance
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from 'react';
import { Coffee, Utensils, QrCode, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export type TokenStatus = 'none' | 'active' | 'expired' | 'redeemed';

interface MealTokenProps {
  mealType: 'Breakfast' | 'Lunch';
  status: TokenStatus;
  timeLeftSeconds: number;
  qrCodeUrl: string | null;
  theme: 'white' | 'black';
  onOpenQr?: () => void;
}

export default function MealToken({ mealType, status, timeLeftSeconds, qrCodeUrl, theme, onOpenQr }: MealTokenProps) {
  const isDark = theme === 'black';

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s left`;
  };

  const startTime = mealType === 'Breakfast' ? '08:00 AM' : '12:00 PM';
  const endTime = mealType === 'Breakfast' ? '09:00 AM' : '01:00 PM';

  const fallbackBgClass = mealType === 'Breakfast'
    ? (isDark ? 'bg-gradient-to-br from-zinc-900 to-amber-950/40' : 'bg-gradient-to-br from-white to-amber-50/50')
    : (isDark ? 'bg-gradient-to-br from-zinc-900 to-emerald-950/40' : 'bg-gradient-to-br from-white to-emerald-50/50');

  const borderClass = isDark ? 'border-zinc-800' : 'border-zinc-200/80';

  // Status-dependent rendering
  const renderStatusBadge = () => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-emerald-600 transition-all">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Active — {formatTimeLeft(timeLeftSeconds)}</span>
          </div>
        );
      case 'expired':
        return (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-red-500 transition-all">
            <XCircle className="w-3.5 h-3.5" />
            <span>Expired</span>
          </div>
        );
      case 'redeemed':
        return (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-blue-600 transition-all">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Claimed ✓</span>
          </div>
        );
      default:
        return (
          <p className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 transition-colors duration-300 ${
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}></span>
            Pending Approval
          </p>
        );
    }
  };

  const renderActionArea = () => {
    if (status === 'active' && qrCodeUrl) {
      return (
        <div className="mt-5 pt-4 border-t border-dashed border-zinc-200/50">
          <button 
            id={`open-${mealType.toLowerCase()}-qr-btn`}
            onClick={onOpenQr}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] ${
              mealType === 'Breakfast'
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>OPEN QR CODE</span>
          </button>
        </div>
      );
    }

    let buttonLabel = 'Pending Approval';
    let buttonIcon = <Clock className="w-4 h-4" />;
    
    if (status === 'expired') {
      buttonLabel = 'Token Expired';
      buttonIcon = <XCircle className="w-4 h-4" />;
    } else if (status === 'redeemed') {
      buttonLabel = 'Meal Claimed ✓';
      buttonIcon = <CheckCircle className="w-4 h-4" />;
    }

    return (
      <div className="mt-5 pt-4 border-t border-dashed border-zinc-200/50">
        <button 
          id={`generate-${mealType.toLowerCase()}-btn`}
          disabled
          className={`w-full py-3.5 px-5 rounded-2xl font-semibold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-not-allowed opacity-60 ${
            isDark 
              ? 'bg-zinc-850 text-zinc-400 border border-zinc-700' 
              : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
          }`}
        >
          {buttonIcon}
          <span>{buttonLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <div id={`${mealType.toLowerCase()}-token-card`} className={`relative w-full rounded-3xl overflow-visible border ${borderClass} ${fallbackBgClass} p-5 flex flex-col justify-between shadow-xs group transition-all duration-300`}>
      
      {/* 1. Validity Badge (Top Right) */}
      <div id={`${mealType.toLowerCase()}-validity-badge`} className={`absolute -top-2.5 right-6 z-10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs border transition-colors duration-300 ${
        isDark 
          ? 'bg-zinc-950 border-zinc-800 text-amber-500' 
          : 'bg-white border-zinc-200 text-zinc-700'
      }`}>
        Token valid: {startTime} – {endTime}
      </div>

      {/* Background Image Container */}
      <div className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden z-0 select-none pointer-events-none">
        <img 
          src={mealType === 'Breakfast' ? '/src/assets/images/breakfast_token_bg.png' : '/src/assets/images/lunch_token_bg.png'} 
          alt={`${mealType} Token Background`}
          className="w-full h-full object-cover opacity-95 transition-opacity duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0';
          }}
        />
        <div className={`absolute inset-0 ${isDark ? 'bg-zinc-950/20' : 'bg-white/10'}`} />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col justify-between h-full flex-grow">
        <div className="flex items-start gap-4">
          
          {/* Left: Icon */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-transparent select-none">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ${
              isDark 
                ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400' 
                : 'bg-zinc-100/50 border-zinc-250/30 text-zinc-500'
            }`}>
              {mealType === 'Breakfast' ? (
                <Coffee className={`w-5.5 h-5.5 ${isDark ? 'text-amber-500' : 'text-amber-600'}`} />
              ) : (
                <Utensils className={`w-5.5 h-5.5 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`} />
              )}
            </div>
          </div>

          {/* Right: Title + Status */}
          <div className="flex-grow pt-1 text-left">
            <h3 className={`text-lg sm:text-xl font-bold font-display tracking-tight transition-colors duration-300 ${
              isDark ? 'text-zinc-100' : 'text-zinc-900'
            }`}>
              {mealType === 'Breakfast' ? 'Breakfast Token' : 'Lunch Token'}
            </h3>
            {renderStatusBadge()}
          </div>
        </div>

        {/* Action Area: QR Code or Disabled Button */}
        {renderActionArea()}
      </div>
    </div>
  );
}

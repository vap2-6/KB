import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Download, ExternalLink } from 'lucide-react';

export interface LightboxMediaItem {
  id: string;
  title: string;
  type: 'image' | 'pdf';
  src: string;
  fallbackText?: string;
}

interface MediaLightboxProps {
  mediaList: LightboxMediaItem[];
  initialIndex?: number;
  onClose: () => void;
  studentName?: string;
}

export default function MediaLightbox({ mediaList, initialIndex = 0, onClose, studentName }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const activeItem = mediaList[currentIndex] || mediaList[0];

  const handleNext = () => {
    if (mediaList.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handlePrev = () => {
    if (mediaList.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  // Keyboard navigation for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();

      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaList.length]);

  // Touch swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (diffX > 40) {
      handleNext(); // Swipe Left -> Next
    } else if (diffX < -40) {
      handlePrev(); // Swipe Right -> Prev
    }
    setTouchStartX(null);
  };

  if (!activeItem) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between animate-fade-in select-none cursor-pointer"
    >
      
      {/* Header Bar */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0 cursor-default"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-saffron-500/20 border border-saffron-500/30 flex items-center justify-center text-saffron-400">
            {activeItem.type === 'pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {activeItem.title}
            </h3>
            {studentName && (
              <p className="text-[11px] text-slate-400 font-medium">{studentName}</p>
            )}
          </div>
          <span className="ml-3 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold">
            {currentIndex + 1} of {mediaList.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeItem.src && (
            <a
              href={activeItem.src}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Open full size in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Display Area (Touch Swipe Zone) */}
      <div 
        className="flex-1 relative flex items-center justify-center p-4 md:p-8 overflow-hidden cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={onClose}
      >
        {/* Desktop Left Arrow */}
        {mediaList.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/70 hover:bg-saffron-600 text-white rounded-full border border-slate-700 hover:border-saffron-500 transition-all shadow-lg z-10 hidden sm:flex items-center justify-center cursor-pointer"
            title="Previous Asset (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Active Asset Viewer Container */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="max-w-4xl max-h-[78vh] w-full flex items-center justify-center cursor-default"
        >
          {activeItem.type === 'pdf' ? (
            <iframe
              src={activeItem.src}
              title={activeItem.title}
              className="w-full h-[70vh] rounded-xl border border-slate-700 bg-white shadow-2xl"
            />
          ) : (
            <img
              src={activeItem.src}
              alt={activeItem.title}
              className="max-h-[75vh] max-w-full object-contain rounded-xl border border-slate-800 shadow-2xl bg-slate-900/50"
            />
          )}
        </div>

        {/* Desktop Right Arrow */}
        {mediaList.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/70 hover:bg-saffron-600 text-white rounded-full border border-slate-700 hover:border-saffron-500 transition-all shadow-lg z-10 hidden sm:flex items-center justify-center cursor-pointer"
            title="Next Asset (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Navigation Bar / Thumbnails */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 cursor-default"
      >
        <p className="text-[11px] text-slate-400 font-medium text-center sm:text-left">
          <span className="hidden sm:inline">Use Left/Right arrow keys or click arrows. </span>
          <span className="sm:hidden">Swipe left/right to navigate between assets.</span>
        </p>

        {/* Thumbnail Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
          {mediaList.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => setCurrentIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                currentIndex === idx
                  ? 'bg-saffron-600 text-white shadow-md ring-2 ring-saffron-400/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {item.type === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

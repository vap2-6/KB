import { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/55 dark:text-emerald-300 dark:border-emerald-800/60',
    error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/55 dark:text-rose-300 dark:border-rose-800/60',
    info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/55 dark:text-blue-300 dark:border-blue-800/60',
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    error: <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
    info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center p-4 rounded-xl border shadow-lg max-w-sm gap-3 animate-slide-in backdrop-blur-md ${bgColors[type]}`}>
      {icons[type]}
      <p className="text-sm font-medium pr-4">{message}</p>
      <button onClick={onClose} className="hover:opacity-75 focus:outline-none ml-auto">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

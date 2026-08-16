import { Database, ShieldAlert, Cpu, Menu } from 'lucide-react';
import RegistrationRequests from './RegistrationRequests';
import { ToastType } from './Toast';

interface HeaderProps {
  currentTab: string;
  systemStatus: any;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  onPendingCountChange?: (count: number) => void;
}

export default function Header({ currentTab, systemStatus, sidebarOpen, setSidebarOpen, showToast, onPendingCountChange }: HeaderProps) {
  const titles: Record<string, string> = {
    dashboard: 'RKMVC Student Dining Dashboard',
    requests: 'Registration Requests',
    'student-details': 'RKMVC Student Details & Roster Management',
    database: 'RKMVC Hostel & Student Roster',
    'meal-windows': 'Meal Windows Management',
    'token-monitor': 'Token Monitoring & Distribution',
    import: 'Import RKMVC Meal Rosters',
    export: 'Export RKMVC Distribution Logs',
    convert: 'Data Format Converter',
    communications: 'Student Communications',
    logs: 'Dining Audit Trails',
  };

  const isConnected = systemStatus === null || systemStatus?.status === 'ONLINE' || systemStatus?.status === 'CONNECTED' || systemStatus?.online || systemStatus?.connected || !!systemStatus?.databaseEngine;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 transition-colors duration-200">
      
      {/* Title / Breadcrumbs & Sidebar Toggle */}
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-600 hover:text-saffron-600 rounded-xl border border-slate-200 bg-white hover:bg-saffron-50 cursor-pointer transition-all shadow-2xs"
          title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-slate-400 hidden sm:inline">RKMVC Portal</span>
        <span className="text-slate-300 hidden sm:inline">/</span>
        <span className="text-slate-900 font-semibold text-base">
          {titles[currentTab] || 'RKMVC Meal Portal'}
        </span>
      </div>

      {/* Action Tray */}
      <div className="flex items-center gap-6">

        <RegistrationRequests showToast={showToast} onCountChange={onPendingCountChange} />

        {/* System Status Indicators */}
        <div className="hidden md:flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse' : 'bg-rose-500 ring-4 ring-rose-500/20'}`}></span>
            <span className="text-slate-500">
              Database Engine: <span className="text-slate-900 font-semibold">{systemStatus?.databaseEngine || 'Loading...'}</span>
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-200" />

          {/* Connection Status Badge */}
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${isConnected ? 'bg-emerald-50 border border-emerald-200/60' : 'bg-saffron-50 border border-saffron-200/60'}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isConnected ? 'text-emerald-700' : 'text-saffron-700'}`}>
              {isConnected ? 'System Live' : 'Offline Mode'}
            </span>
          </div>
        </div>

      </div>

    </header>
  );
}

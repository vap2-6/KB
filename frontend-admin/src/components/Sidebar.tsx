import { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  FileUp, 
  FileDown, 
  RefreshCw, 
  FileSpreadsheet, 
  LogOut, 
  ShieldCheck,
  Bell,
  X,
  Clock,
  Activity,
  Calendar,
  Send,
  Settings,
  ChevronDown,
  Users,
  Users2,
  ChefHat
} from 'lucide-react';
// @ts-ignore
import rkmLogo from '../assets/images/rkm_logo.png';
// const rkmLogo = null;

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  pendingRequestsCount?: number;
}

export default function Sidebar({ currentTab, setCurrentTab, user, onLogout, isOpen, setIsOpen, pendingRequestsCount = 0 }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Meal Dashboard', icon: LayoutDashboard },
    { id: 'requests', label: 'Registration Requests', icon: Bell, badge: pendingRequestsCount },
    { id: 'student-details', label: 'Student Details', icon: Users },
    { id: 'token-monitor', label: 'Token & Distribution', icon: Activity },
    { id: 'communications', label: 'Communications', icon: Send },
  ];

  const settingsItems = [
    { id: 'meal-windows', label: 'Meal Windows', icon: Clock },
    { id: 'dining-verification', label: 'Dining Verification', icon: ChefHat },
    { id: 'user-management', label: 'Staff & Admin Accounts', icon: Users2 },
    { id: 'import', label: 'Data Tools', icon: FileUp },
    { id: 'export', label: 'Export Meal Logs', icon: FileDown },
    { id: 'logs', label: 'Audit Logs', icon: FileSpreadsheet },
    { id: 'database', label: 'Students & Rosters', icon: Database },
  ];

  const isSettingsActive = settingsItems.some((item) => item.id === currentTab);
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    // Auto-close sidebar on mobile view only
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay Mask */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 bg-white flex flex-col h-full shrink-0 border-r border-saffron-100/70 shadow-sm transition-all duration-300 md:static ${
        isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden border-r-0'
      }`}>
        
        {/* Brand Header */}
        <div className="p-6 border-b border-saffron-100/50 flex items-center justify-between gap-3 min-w-[256px]">
          <div className="flex items-center gap-3">
            {rkmLogo ? (
              <img 
                src={rkmLogo} 
                alt="Ramakrishna Mission Logo" 
                className="w-10 h-10 shrink-0 object-contain"
              />
            ) : (
              <div className="w-10 h-10 shrink-0 bg-saffron-100 rounded-full flex items-center justify-center text-saffron-700 font-bold">R</div>
            )}
            <div>
              <h1 className="font-bold text-sm text-slate-900 tracking-tight leading-none">
                RKMVC Meal
              </h1>
              <span className="text-[10px] text-saffron-600 font-extrabold block mt-1 uppercase tracking-wider">
               Dining Portal
              </span>
            </div>
          </div>
        </div>

      {/* Navigation Links */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
                isActive 
                  ? 'bg-saffron-50 text-saffron-700 shadow-sm shadow-saffron-500/5 border-l-4 border-saffron-500' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-saffron-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {!!item.badge && item.badge > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Settings Group */}
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
            isSettingsActive
              ? 'text-saffron-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Settings className={`h-4.5 w-4.5 ${isSettingsActive ? 'text-saffron-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>

        {settingsOpen && (
          <div className="pl-4 space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? 'bg-saffron-50 text-saffron-700 shadow-sm shadow-saffron-500/5 border-l-4 border-saffron-500' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-saffron-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-saffron-100/50 bg-slate-50/50">
        <div className="bg-white rounded-2xl p-3.5 flex flex-col gap-3.5 border border-saffron-100/50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-saffron-500 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 shadow-sm">
              {user?.username?.substring(0, 2) || 'US'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">
                {user?.username}
              </span>
              <span className="text-[9px] text-slate-400 block truncate uppercase tracking-wider font-extrabold mt-0.5">
                {user?.role || 'User'}
              </span>
            </div>
            {user?.role === 'admin' && (
              <span className="text-emerald-600 shrink-0" title="Admin Access Verified">
                <ShieldCheck className="h-4 w-4" />
              </span>
            )}
          </div>
          
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/70 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

    </aside>
    </>
  );
}

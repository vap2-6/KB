import { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, Search, Calendar, CheckCircle, XCircle, Loader, Sun, Moon, Filter, Download, ChevronDown, FileText, Printer } from 'lucide-react';
import api from '../lib/api';

interface TokenRecord {
  id: string;
  token_code?: string;
  token_uid?: string;
  student_id?: string;
  student_name?: string;
  session_type?: string;
  meal_type?: string;
  status?: string;
  issued_at?: string;
  created_at?: string;
  generated_at?: string;
  approved_at?: string;
  redeemed_at?: string;
  scanned_by?: string;
  approved_by?: string;
  redeemed_by?: string;
}

interface TokenMonitorProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const statusStyles: Record<string, string> = {
  redeemed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  approved: 'bg-blue-50 text-blue-600 border-blue-200',
  token_issued: 'bg-amber-50 text-amber-600 border-amber-200',
  awaiting_scan: 'bg-purple-50 text-purple-600 border-purple-200',
  staff_verified: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  expired: 'bg-rose-50 text-rose-600 border-rose-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

const statusLabels: Record<string, string> = {
  redeemed: 'Redeemed',
  approved: 'Generated',
  token_issued: 'Generated',
  awaiting_scan: 'Pending',
  staff_verified: 'Verified',
  expired: 'Expired',
  rejected: 'Rejected',
};

export default function TokenMonitor({ showToast }: TokenMonitorProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [mealFilter, setMealFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({ limit: '50', date_from: dateFrom, date_to: dateTo });
      if (mealFilter) params.set('meal_type', mealFilter);
      if (statusFilter && statusFilter !== 'approved') params.set('status', statusFilter);
      const res = await api.get(`/tokens?${params}`);
      setTokens(res.data?.tokens || res.data || []);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [dateFrom, dateTo, mealFilter, statusFilter]);

  const filteredTokens = tokens.filter(t =>
    (t.token_code || t.token_uid || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.student_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.student_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const generatedCount = filteredTokens.length;
  const redeemedCount = filteredTokens.filter(t => t.status && t.status.toLowerCase() === 'redeemed').length;
  const expiredCount = filteredTokens.filter(t => t.status && ['expired', 'rejected'].includes(t.status.toLowerCase())).length;

  // Generic client-side CSV builder + downloader (mirrors Dashboard's report downloads)
  const downloadCSV = (filename: string, rows: any[], columns?: string[]) => {
    if (!rows || rows.length === 0) {
      showToast('No records available to export for the current filters.', 'info');
      return;
    }
    const cols = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = cols.join(',');
    const body = rows.map(row => cols.map(c => escapeCell(row[c])).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportTokens = () => {
    const rows = filteredTokens.map(t => ({
      token: t.token_code || t.token_uid || t.id,
      student_id: t.student_id || '',
      student_name: t.student_name || '',
      meal: t.session_type || t.meal_type || '',
      status: statusLabels[(t.status || '').toLowerCase()] || t.status || '',
      generated_at: t.created_at || t.issued_at || t.generated_at || '',
      redeemed_at: t.redeemed_at || ''
    }));
    downloadCSV(`token_activity_${dateFrom}_to_${dateTo}.csv`, rows);
    showToast('Token activity exported!', 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-saffron-500" />
              Token Monitoring & Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-1">Live token activity and monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Auto-refresh every 10s
            </span>
            <button onClick={handleExportTokens}
              className="flex items-center gap-1.5 px-3 py-2 bg-saffron-500 hover:bg-saffron-600 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95" title="Export token activity as CSV">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Card 1: Tokens Generated */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'approved' ? '' : 'approved')}
            className={`rounded-2xl p-5 shadow-sm text-left cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-95 border ${
              (statusFilter === 'approved' || statusFilter === '')
                ? 'ring-2 ring-saffron-500 bg-saffron-50/60 border-saffron-300'
                : 'bg-white border-saffron-100 hover:border-saffron-300'
            }`}
            title="Click to filter Generated tokens"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-display">Tokens Generated</span>
              {(statusFilter === 'approved' || statusFilter === '') && <span className="text-[9px] font-black uppercase bg-saffron-200 text-saffron-900 px-2 py-0.5 rounded-md">FILTER ACTIVE</span>}
            </div>
            <span className="text-2xl font-extrabold text-saffron-600 mt-1 block font-mono">{generatedCount}</span>
          </button>

          {/* Card 2: Tokens Redeemed */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'redeemed' ? '' : 'redeemed')}
            className={`rounded-2xl p-5 shadow-sm text-left cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-95 border ${
              statusFilter === 'redeemed'
                ? 'ring-2 ring-emerald-500 bg-emerald-50/60 border-emerald-300'
                : 'bg-white border-saffron-100 hover:border-emerald-300'
            }`}
            title="Click to filter Redeemed tokens"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-display">Tokens Redeemed</span>
              {statusFilter === 'redeemed' && <span className="text-[9px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">FILTER ACTIVE</span>}
            </div>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block font-mono">{redeemedCount}</span>
          </button>

          {/* Card 3: Expired / Rejected */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'expired' ? '' : 'expired')}
            className={`rounded-2xl p-5 shadow-sm text-left cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-95 border ${
              (statusFilter === 'expired' || statusFilter === 'rejected')
                ? 'ring-2 ring-rose-500 bg-rose-50/60 border-rose-300'
                : 'bg-white border-saffron-100 hover:border-rose-300'
            }`}
            title="Click to filter Expired / Rejected tokens"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-display">Expired / Rejected</span>
              {(statusFilter === 'expired' || statusFilter === 'rejected') && <span className="text-[9px] font-black uppercase bg-rose-200 text-rose-900 px-2 py-0.5 rounded-md">FILTER ACTIVE</span>}
            </div>
            <span className="text-2xl font-extrabold text-rose-500 mt-1 block font-mono">{expiredCount}</span>
          </button>
        </div>

        {/* Search & Date Filter Bar */}
        <div className="bg-white border border-saffron-100 rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Token Code, Student ID, or Name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-saffron-500"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-saffron-500"
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              <select
                value={mealFilter}
                onChange={e => setMealFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-saffron-500"
              >
                <option value="">All Meals</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-saffron-500 text-slate-500"
            >
              <option value="">All Statuses</option>
              <option value="approved">Generated</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </select>

            <button onClick={fetchData} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Token Activity Table */}
        <div className="bg-white border border-saffron-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Live Token Activity Stream</h3>
            <span className="text-xs text-slate-400">{filteredTokens.length} record(s)</span>
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className="h-4 w-4 border-2 border-saffron-400 border-t-transparent rounded-full animate-spin" />
              Loading token stream...
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No token activity found matching current filters.
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Token Code</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Meal</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Generated At</th>
                    <th className="py-3.5 px-4">Redeemed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTokens.map((t) => {
                    const st = (t.status || '').toLowerCase();
                    const stClass = statusStyles[st] || 'bg-gray-50 text-gray-600 border-gray-200';
                    const stLabel = statusLabels[st] || t.status || 'Active';
                    const code = t.token_code || t.token_uid || t.id;
                    const meal = t.session_type || t.meal_type || 'Standard';

                    return (
                      <tr key={t.id} className="hover:bg-gray-50/40 text-gray-600 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-800">{code}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-gray-800">{t.student_name || t.student_id}</span>
                          {t.student_name && <span className="text-[10px] text-gray-400 block font-mono">{t.student_id}</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                            {meal.toLowerCase().includes('break') || meal.toLowerCase().includes('forenoon') ? (
                              <Sun className="h-3 w-3 text-amber-500" />
                            ) : (
                              <Moon className="h-3 w-3 text-indigo-500" />
                            )}
                            {meal}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${stClass}`}>
                            {st === 'redeemed' ? <CheckCircle className="h-3 w-3" /> : null}
                            {stLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400">{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                        <td className="py-3.5 px-4 text-gray-400">{t.redeemed_at ? new Date(t.redeemed_at).toLocaleString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

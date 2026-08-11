import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import api from '../lib/api';

interface DistributionRow {
  session_type?: string;
  count?: number;
  student_id?: string;
  status?: string;
  timestamp?: string;
}

interface MealDistributionProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MealDistribution({ showToast }: MealDistributionProps) {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/meal-distribution', { params: { date_from: dateFrom, date_to: dateTo } });
      setData(res.data?.distribution || res.data?.rows || res.data || []);
    } catch {
      showToast('Failed to load distribution data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  const totalRedeemed = data.reduce((sum, r) => sum + (r.count || (r.status === 'redeemed' || r.status === 'REDEEMED' ? 1 : 0)), 0);
  const fnCount = data.filter(r => r.session_type?.toLowerCase().includes('forenoon') || r.session_type?.toLowerCase().includes('fn')).reduce((s, r) => s + (r.count || 1), 0);
  const anCount = data.filter(r => r.session_type?.toLowerCase().includes('afternoon') || r.session_type?.toLowerCase().includes('an')).reduce((s, r) => s + (r.count || 1), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-saffron-500" />
              Meal Distribution Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">View redeemed tokens grouped by date and session</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-saffron-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Redeemed</span>
            <span className="text-2xl font-extrabold text-saffron-600 mt-1 block">{totalRedeemed}</span>
          </div>
          <div className="bg-white border border-saffron-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Forenoon</span>
            <span className="text-2xl font-extrabold text-saffron-500 mt-1 block">{fnCount}</span>
          </div>
          <div className="bg-white border border-saffron-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Afternoon</span>
            <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{anCount}</span>
          </div>
        </div>

        <div className="bg-white border border-saffron-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading...</div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">No distribution records for this date.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Session</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Count</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/40 text-gray-600">
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{r.student_id || '-'}</td>
                    <td className="py-3.5 px-4">{r.session_type || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600">{r.status || 'Redeemed'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">{r.count ?? 1}</td>
                    <td className="py-3.5 px-4 text-right text-gray-400">{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

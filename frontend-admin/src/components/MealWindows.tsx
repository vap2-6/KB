import { useState, useEffect } from 'react';
import { Calendar, Clock, Save, Sun, Moon } from 'lucide-react';
import api from '../lib/api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface MealConfig {
  days: number[];
  forenoon: { start: string; end: string; expiry: number };
  afternoon: { start: string; end: string; expiry: number };
}

const DEFAULT_MEAL_CONFIG: MealConfig = {
  days: [0, 1, 2, 3, 4, 5, 6],
  forenoon: { start: '07:30', end: '10:00', expiry: 15 },
  afternoon: { start: '12:00', end: '14:30', expiry: 15 }
};

interface MealWindowsProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MealWindows({ showToast }: MealWindowsProps) {
  const [config, setConfig] = useState<MealConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const formatHHMM = (val?: string, fallback: string = '07:30') => {
    if (!val) return fallback;
    const parts = val.trim().split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${h}:${m}`;
    }
    return fallback;
  };

  useEffect(() => {
    (async () => {
      try {
        // Use /meal-config which is backed by app_state + meal_windows table
        const res = await api.get('/meal-config');
        const data = res.data || {};
        const fn = data.forenoon || {};
        const an = data.afternoon || {};

        setConfig({
          days: data.days ?? DEFAULT_MEAL_CONFIG.days,
          forenoon: {
            start: formatHHMM(fn.start, '07:30'),
            end: formatHHMM(fn.end, '10:00'),
            expiry: fn.expiry ?? 15
          },
          afternoon: {
            start: formatHHMM(an.start, '11:30'),
            end: formatHHMM(an.end, '19:30'),
            expiry: an.expiry ?? 15
          }
        });
      } catch {
        // Fallback to default configuration if API request fails
        setConfig(DEFAULT_MEAL_CONFIG);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleDay = (dow: number) => {
    if (!config) return;
    const days = config.days.includes(dow)
      ? config.days.filter(d => d !== dow)
      : [...config.days, dow].sort();
    setConfig({ ...config, days });
  };

  const handleSave = async () => {
    if (!config) return;
    if (config.days.length === 0) {
      showToast('Select at least one serving day', 'error');
      return;
    }
    if (!config.forenoon.start || !config.forenoon.end) {
      showToast('Please set both Start and End times for Forenoon (Breakfast)', 'error');
      return;
    }
    if (!config.afternoon.start || !config.afternoon.end) {
      showToast('Please set both Start and End times for Afternoon (Lunch)', 'error');
      return;
    }

    setSaving(true);
    try {
      // PUT /meal-config syncs both app_state and the meal_windows table
      await api.put('/meal-config', {
        forenoon: { start: config.forenoon.start, end: config.forenoon.end, expiry: config.forenoon.expiry },
        afternoon: { start: config.afternoon.start, end: config.afternoon.end, expiry: config.afternoon.expiry },
        days: config.days
      });
      showToast('Meal schedule saved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8">
        <div className="max-w-3xl mx-auto py-16 text-center text-xs text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-saffron-500" />
              Meal Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-1">Set serving days, time windows, and token expiry time</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="bg-saffron-500 hover:bg-saffron-600 disabled:bg-saffron-300 text-white font-semibold text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-md cursor-pointer">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="bg-white border border-saffron-100 rounded-2xl shadow-sm p-6 space-y-8">
          {/* Serving Days */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-saffron-500" />
              Serving Days
            </h3>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((name, i) => {
                const active = config?.days.includes(i) ?? false;
                return (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${active
                      ? 'bg-saffron-500 text-white border-saffron-500 shadow-md shadow-saffron-500/20'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}>
                    {name}
                  </button>
                );
              })}
            </div>
            {config && config.days.length === 0 && (
              <p className="text-[10px] text-rose-500 mt-2">Select at least one serving day.</p>
            )}
          </div>

          {/* Time Windows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Forenoon */}
            <div className="border border-saffron-100 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Forenoon (Breakfast)
              </h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Time</label>
                <input type="time" value={config?.forenoon.start || '07:30'}
                  onChange={e => setConfig(prev => prev ? { ...prev, forenoon: { ...prev.forenoon, start: e.target.value } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Time</label>
                <input type="time" value={config?.forenoon.end || '10:00'}
                  onChange={e => setConfig(prev => prev ? { ...prev, forenoon: { ...prev.forenoon, end: e.target.value } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Token Expiry Time (minutes after end)
                </label>
                <input type="number" min="0" max="120" value={config?.forenoon.expiry ?? 15}
                  onChange={e => setConfig(prev => prev ? { ...prev, forenoon: { ...prev.forenoon, expiry: parseInt(e.target.value) || 0 } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tokens issued during this window expire {config?.forenoon.expiry ?? 15} min after the End Time.
                </p>
              </div>
            </div>

            {/* Afternoon */}
            <div className="border border-saffron-100 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Afternoon (Lunch)
              </h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Time</label>
                <input type="time" value={config?.afternoon.start || '12:00'}
                  onChange={e => setConfig(prev => prev ? { ...prev, afternoon: { ...prev.afternoon, start: e.target.value } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Time</label>
                <input type="time" value={config?.afternoon.end || '14:30'}
                  onChange={e => setConfig(prev => prev ? { ...prev, afternoon: { ...prev.afternoon, end: e.target.value } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Token Expiry Time (minutes after end)
                </label>
                <input type="number" min="0" max="120" value={config?.afternoon.expiry ?? 15}
                  onChange={e => setConfig(prev => prev ? { ...prev, afternoon: { ...prev.afternoon, expiry: parseInt(e.target.value) || 0 } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tokens issued during this window expire {config?.afternoon.expiry ?? 15} min after the End Time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

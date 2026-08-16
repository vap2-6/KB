import { useState, useEffect } from 'react';
import { Calendar, Save, Sun, Moon, GraduationCap, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import api from '../lib/api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface MealConfig {
  days: number[];
  forenoon: { start: string; end: string; expiry: number };
  afternoon: { start: string; end: string; expiry: number };
  year_migration_date?: string;
}

const DEFAULT_MEAL_CONFIG: MealConfig = {
  days: [0, 1, 2, 3, 4, 5, 6],
  forenoon: { start: '07:30', end: '10:00', expiry: 30 },
  afternoon: { start: '12:00', end: '14:30', expiry: 30 },
  year_migration_date: ''
};

interface MealWindowsProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MealWindows({ showToast }: MealWindowsProps) {
  const [config, setConfig] = useState<MealConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [migDate, setMigDate] = useState('');
  const [migTime, setMigTime] = useState('');
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      setCurrentDateTime(new Date().toLocaleString());
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const parseYearMigrationStr = (rawStr?: string) => {
    if (!rawStr) return { date: '', time: '' };
    const cleanStr = rawStr.trim();
    if (!cleanStr) return { date: '', time: '' };
    const parts = cleanStr.includes('T') ? cleanStr.split('T') : cleanStr.split(' ');
    let rawDate = parts[0] || '';
    const t = parts[1] ? parts[1].substring(0, 5) : '00:00';

    let normalizedDate = rawDate;
    if (rawDate.includes('-')) {
      const dp = rawDate.split('-');
      if (dp.length === 3 && dp[0].length === 2 && dp[2].length === 4) {
        normalizedDate = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
      }
    } else if (rawDate.includes('/')) {
      const dp = rawDate.split('/');
      if (dp.length === 3) {
        if (dp[2].length === 4) {
          normalizedDate = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
        } else if (dp[0].length === 4) {
          normalizedDate = `${dp[0]}-${dp[1].padStart(2, '0')}-${dp[2].padStart(2, '0')}`;
        }
      }
    }

    return { date: normalizedDate, time: t };
  };

  useEffect(() => {
    (async () => {
      try {
        // Use /meal-config which is backed by app_state + meal_windows table
        const res = await api.get('/meal-config');
        const data = res.data || {};
        const fn = data.forenoon || {};
        const an = data.afternoon || {};
        const yearMigStr = data.year_migration_date || '';

        setConfig({
          days: data.days ?? DEFAULT_MEAL_CONFIG.days,
          forenoon: {
            start: formatHHMM(fn.start, '07:30'),
            end: formatHHMM(fn.end, '10:00'),
            expiry: fn.expiry ?? 30
          },
          afternoon: {
            start: formatHHMM(an.start, '11:30'),
            end: formatHHMM(an.end, '19:30'),
            expiry: an.expiry ?? 30
          },
          year_migration_date: yearMigStr
        });

        const parsed = parseYearMigrationStr(yearMigStr);
        const draftDate = localStorage.getItem('draft_year_migration_date') || '';
        const draftTime = localStorage.getItem('draft_year_migration_time') || '';

        // Prefer server date over draft if server date exists
        const finalDate = parsed.date ? parsed.date : draftDate;
        const finalTime = parsed.time ? parsed.time : draftTime;

        setMigDate(finalDate);
        setMigTime(finalTime);
      } catch {
        // Fallback to default configuration if API request fails
        setConfig(DEFAULT_MEAL_CONFIG);
        const draftDate = localStorage.getItem('draft_year_migration_date') || '';
        const draftTime = localStorage.getItem('draft_year_migration_time') || '';
        setMigDate(draftDate);
        setMigTime(draftTime);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleMigDateChange = (val: string) => {
    setMigDate(val);
    localStorage.setItem('draft_year_migration_date', val);
  };

  const handleMigTimeChange = (val: string) => {
    setMigTime(val);
    localStorage.setItem('draft_year_migration_time', val);
  };

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

    let combinedMigrationDate = '';
    if (migDate) {
      const timePart = migTime ? migTime : '00:00';
      combinedMigrationDate = `${migDate}T${timePart}`;
    }

    setSaving(true);
    try {
      // PUT /meal-config syncs app_state, meal_windows table, and runs/updates year migration schedule
      const res = await api.put('/meal-config', {
        forenoon: { start: config.forenoon.start, end: config.forenoon.end, expiry: config.forenoon.expiry },
        afternoon: { start: config.afternoon.start, end: config.afternoon.end, expiry: config.afternoon.expiry },
        days: config.days,
        year_migration_date: combinedMigrationDate
      });

      const updated = res.data || {};
      const updatedYearMigStr = updated.year_migration_date || combinedMigrationDate;
      
      setConfig({
        days: updated.days ?? config.days,
        forenoon: updated.forenoon || config.forenoon,
        afternoon: updated.afternoon || config.afternoon,
        year_migration_date: updatedYearMigStr
      });

      const parsed = parseYearMigrationStr(updatedYearMigStr);
      const savedDate = parsed.date || (combinedMigrationDate ? combinedMigrationDate.split('T')[0] : '');
      const savedTime = parsed.time || (combinedMigrationDate ? (combinedMigrationDate.split('T')[1] || '00:00') : '');

      setMigDate(savedDate);
      setMigTime(savedTime);

      localStorage.removeItem('draft_year_migration_date');
      localStorage.removeItem('draft_year_migration_time');

      showToast('Meal schedule and Year Migration Date saved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokePromotion = async () => {
    setRevoking(true);
    try {
      const res = await api.post('/students/revoke-academic-year');
      showToast(res.data?.message || 'Academic year promotion revoked by 1 step successfully', 'success');
      setIsRevokeModalOpen(false);

      const cfgRes = await api.get('/meal-config');
      const data = cfgRes.data || {};
      const yearMigStr = data.year_migration_date || '';
      setConfig(prev => prev ? { ...prev, year_migration_date: yearMigStr } : prev);
      const parsed = parseYearMigrationStr(yearMigStr);
      setMigDate(parsed.date);
      setMigTime(parsed.time);
      localStorage.setItem('draft_year_migration_date', parsed.date);
      localStorage.setItem('draft_year_migration_time', parsed.time);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to revoke promotion', 'error');
    } finally {
      setRevoking(false);
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
            <p className="text-xs text-slate-500 mt-1">Set serving days, time windows, token expiry, and automated year migration date</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="bg-saffron-500 hover:bg-saffron-600 disabled:bg-saffron-300 text-white font-semibold text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-md cursor-pointer">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="bg-white border border-saffron-100 rounded-2xl shadow-sm p-6 space-y-8">
          {/* Serving Days */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-saffron-500" />
                Serving Days
              </h3>
              {currentDateTime && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-saffron-50/80 border border-saffron-200/70 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
                  <Clock className="h-3.5 w-3.5 text-saffron-600 animate-pulse flex-shrink-0" />
                  <span><strong className="text-slate-900 font-bold">{currentDateTime}</strong></span>
                </div>
              )}
            </div>
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
                  Token Expiry Duration (minutes)
                </label>
                <input type="number" min="0" max="120" value={config?.forenoon.expiry ?? 30}
                  onChange={e => setConfig(prev => prev ? { ...prev, forenoon: { ...prev.forenoon, expiry: parseInt(e.target.value) || 0 } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tokens issued during this window expire {config?.forenoon.expiry ?? 30} min after issuance.
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
                  Token Expiry Duration (minutes)
                </label>
                <input type="number" min="0" max="120" value={config?.afternoon.expiry ?? 30}
                  onChange={e => setConfig(prev => prev ? { ...prev, afternoon: { ...prev.afternoon, expiry: parseInt(e.target.value) || 0 } } : prev)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tokens issued during this window expire {config?.afternoon.expiry ?? 30} min after issuance.
                </p>
              </div>
            </div>
          </div>

          {/* Automated Year Migration Card */}
          <div className="border border-saffron-100 rounded-xl p-5 space-y-4 bg-amber-50/20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-saffron-600" />
                Automated Student Year Migration
              </h3>
              <span className="text-[10px] bg-saffron-100 text-saffron-800 px-2 py-0.5 rounded-full font-semibold">
                Annual Auto-Promote
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Set the date and time for automatic student academic year migration (1st &rarr; 2nd &rarr; 3rd &rarr; Graduated). When migration occurs, the scheduled date automatically advances to the exact same day next year. If the date and time are set in the past, migration happens immediately upon saving.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Year Migration Date
                </label>
                <input
                  type="date"
                  min={new Date().toLocaleDateString('sv')}
                  value={migDate}
                  onChange={e => handleMigDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Year Migration Time
                </label>
                <input
                  type="time"
                  value={migTime}
                  onChange={e => handleMigTimeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500"
                />
              </div>
            </div>
            {config?.year_migration_date && (
              <div className="text-[11px] text-slate-600 bg-white border border-saffron-200/60 rounded-lg p-2.5 flex items-center gap-2">
                <span>Next scheduled migration: <strong>{new Date(config.year_migration_date).toLocaleString()}</strong></span>
              </div>
            )}

            <div className="pt-3 border-t border-saffron-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                  Revoke Accidental Promotion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(true)}
                disabled={revoking}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Revoke Accidental Promotion
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Promotion Confirmation Modal */}
      {isRevokeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Revoke Accidental Promotion?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action will reverse all student academic years by <strong>1 step</strong>:
            </p>
            <ul className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200/60 font-medium">
              <li>• <strong>Graduated</strong> &rarr; <strong>3rd Year</strong> (restores meal eligibility)</li>
              <li>• <strong>3rd Year</strong> &rarr; <strong>2nd Year</strong></li>
              <li>• <strong>2nd Year</strong> &rarr; <strong>1st Year</strong></li>
            </ul>
            <p className="text-[11px] text-slate-500">
              Are you sure you want to proceed with reversing student academic progression?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                disabled={revoking}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokePromotion}
                disabled={revoking}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {revoking ? 'Revoking...' : 'Yes, Revoke Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MealReportScheduler
 * ──────────────────────────────────────────────────────────────────────────
 * Invisible background component. Mounts once inside App.tsx (admin only).
 * Every minute it checks whether a meal window (forenoon / afternoon) has
 * JUST ended (within the last 2 minutes). If so, it hits the backend's
 * /api/meal-report/generate endpoint, receives the PDF blob, and triggers
 * an automatic browser download — exactly once per meal session per day.
 *
 * State is persisted in localStorage so page reloads don't re-trigger
 * reports that were already downloaded in the same session.
 */

import { useEffect, useRef } from 'react';
import api from '../lib/api';

interface MealReportSchedulerProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/** Key: `meal_report_generated_<date>_<mealType>` → "1" when done */
const storageKey = (date: string, mealType: string) =>
  `meal_report_generated_${date}_${mealType}`;

/** Parse "HH:MM" string to today's Date object */
const todayAt = (hhmm: string): Date => {
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
};

/** Check if `target` is within the window [target, target + windowMs] */
const justPassed = (target: Date, windowMs = 2 * 60 * 1000): boolean => {
  const now = Date.now();
  return now >= target.getTime() && now <= target.getTime() + windowMs;
};

async function triggerReport(
  mealType: 'forenoon' | 'afternoon',
  date: string,
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  const key = storageKey(date, mealType);
  if (localStorage.getItem(key)) return; // already generated today

  // Mark immediately to prevent double-triggers during slow network
  localStorage.setItem(key, '1');

  const label = mealType === 'forenoon' ? 'Morning (Forenoon)' : 'Afternoon';

  try {
    showToast(`Generating ${label} meal report…`, 'info');

    const response = await api.post(
      '/meal-report/generate',
      { meal_type: mealType, date },
      { responseType: 'blob' }
    );

    // Build a download link and click it
    const url = URL.createObjectURL(
      new Blob([response.data], { type: 'application/pdf' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal_report_${mealType}_${date}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast(`✅ ${label} meal report downloaded successfully`, 'success');
  } catch (err: any) {
    // Roll back the mark so it can retry on next tick
    localStorage.removeItem(key);
    const msg =
      err?.response?.data?.error ||
      err?.message ||
      'Unknown error generating report';
    showToast(`❌ Failed to generate ${label} report: ${msg}`, 'error');
    console.error('[MealReportScheduler] Error:', err);
  }
}

export default function MealReportScheduler({ showToast }: MealReportSchedulerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      // 1. Fetch the current meal config from backend
      let forenoonEnd = '10:00';
      let afternoonEnd = '14:30';

      try {
        const res = await api.get('/meal-config');
        const cfg = res.data;
        if (cfg?.forenoon?.end) forenoonEnd = cfg.forenoon.end;
        if (cfg?.afternoon?.end) afternoonEnd = cfg.afternoon.end;
      } catch {
        // Fall back to defaults if config is unreachable
      }

      const today = new Date().toISOString().split('T')[0];
      const fnEnd = todayAt(forenoonEnd);
      const anEnd = todayAt(afternoonEnd);

      if (justPassed(fnEnd)) {
        await triggerReport('forenoon', today, showToast);
      }
      if (justPassed(anEnd)) {
        await triggerReport('afternoon', today, showToast);
      }
    };

    // Run once immediately, then every 60 seconds
    check();
    intervalRef.current = setInterval(check, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Invisible — renders nothing
  return null;
}

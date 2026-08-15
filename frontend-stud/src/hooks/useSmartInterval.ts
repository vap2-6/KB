import { useEffect, useRef } from 'react';

/**
 * Custom React hook for Smart Polling using the browser's Page Visibility API.
 * - Pauses polling timers immediately when the document/tab is hidden or backgrounded.
 * - Triggers an immediate callback fetch and resumes polling when the document becomes visible.
 *
 * @param callback Function to invoke on interval tick & tab focus
 * @param delay Interval duration in milliseconds (or null to disable)
 * @param enabled Optional boolean flag to enable/disable polling
 */
export function useSmartInterval(
  callback: () => void,
  delay: number | null,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || !enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    const startInterval = () => {
      if (!intervalId && document.visibilityState === 'visible') {
        intervalId = setInterval(tick, delay);
      }
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (document.visibilityState === 'visible') {
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay, enabled]);
}

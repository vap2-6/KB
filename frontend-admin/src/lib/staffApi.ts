import type { User, Student, MealWindow, Token } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5050/api/admin';

function getToken(): string | null {
  try { return localStorage.getItem('token'); } catch { return null; }
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  if (path.startsWith('/api/admin')) return `http://127.0.0.1:5050${path}`;
  if (path.startsWith('/api')) return `http://127.0.0.1:5050${path}`;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const jwt = getToken();
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': '69420'
  };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  if (options?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(resolveUrl(path), { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data as T;
}

export const staffApi = {
  getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  scanStudent(scanned_payload: string, scanner_id: string) {
    return request<{ status: string; token: Token; student: Student; active_window: MealWindow }>(
      '/api/tokens/scan-student',
      { method: 'POST', body: JSON.stringify({ scanned_payload, scanner_id }) }
    );
  },

  approveToken(tokenUid: string) {
    return request<{ status: string; token: Token; qr_data: string; student: Student }>(
      `/api/tokens/${tokenUid}/approve`,
      { method: 'POST' }
    );
  },

  rejectToken(tokenUid: string, reason: string) {
    return request<{ status: string; token: Token }>(
      `/api/tokens/${tokenUid}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) }
    );
  },

  redeemToken(scanned_payload: string, scanner_id: string) {
    return request<{ status: string; token_uid: string; student: Student; meal_type: string; redeemed_at: string }>(
      '/api/tokens/redeem',
      { method: 'POST', body: JSON.stringify({ scanned_payload, scanner_id }) }
    );
  },

  getActiveWindows() {
    return request<MealWindow[]>('/api/meal-windows/active');
  },

  getTokens(limit = 50) {
    return request<Token[]>(`/api/tokens?limit=${limit}`);
  },

  getStudents() {
    return request<Student[]>('/api/students');
  },
};

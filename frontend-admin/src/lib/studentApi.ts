import type { Token, MealWindow } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function resolveUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (BASE_URL) {
    const clean = BASE_URL.replace(/\/+$/, '');
    if (url.startsWith('/api')) return `${clean}${url}`;
    return `${clean}/api/admin${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(resolveUrl(url), { ...options, headers });
}

export async function getStudentQrImageBlob(): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '69420' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(resolveUrl('/api/student/qr-image'), { headers });
  if (!res.ok) throw new Error('Failed to fetch QR image');
  return res.blob();
}

export async function getActiveTokens(): Promise<{ tokens: Token[]; student: any }> {
  const res = await authFetch('/api/tokens/student/active');
  if (!res.ok) throw new Error('Failed to fetch tokens');
  return res.json();
}

export async function getMealWindows(): Promise<MealWindow[]> {
  const res = await authFetch('/api/meal-windows/active');
  if (!res.ok) throw new Error('Failed to fetch meal windows');
  return res.json();
}

export async function getTokenQrImageBlob(tokenUid: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '69420' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(resolveUrl(`/api/tokens/${tokenUid}/qr-image`), { headers });
  if (!res.ok) throw new Error('Failed to fetch token QR');
  return res.blob();
}

import axios from 'axios';

const getAdminBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return '/api/admin';
  const clean = envUrl.replace(/\/+$/, '');
  if (clean.endsWith('/api/admin')) return clean;
  return `${clean}/api/admin`;
};

export const api = axios.create({
  baseURL: getAdminBaseUrl(), 
  headers: {
    'Content-Type': 'application/json',
  }
});

// Automatically inject JWT token from localStorage & handle FormData (GAP 6)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['ngrok-skip-browser-warning'] = '69420';
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle expired tokens, unauthorized access (401), or rate limiting (429) globally
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  const status = error.response?.status;
  const requestUrl = error.config?.url || '';
  // Don't redirect for /auth/me — let App.tsx checkAuthAndLoad handle that gracefully.
  // Only redirect for genuine 401s on data endpoints (not the auth-check itself).
  if (status === 401 && !requestUrl.includes('/auth/me') && !requestUrl.includes('/auth/login')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Use replace so we don't create back-button loops
    if (!window.location.pathname.includes('admin-login')) {
      window.location.replace('/admin-login/');
    }
  }
  return Promise.reject(error);
});

export default api;

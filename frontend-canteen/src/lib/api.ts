import axios from 'axios';

const getStaffBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return '/api/staff';
  const clean = envUrl.replace(/\/+$/, '');
  if (clean.endsWith('/api/staff')) return clean;
  return `${clean}/api/staff`;
};

export const staffApi = axios.create({
  baseURL: getStaffBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  }
});

// Automatically inject JWT token from localStorage if present & bypass Ngrok warning page
staffApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['ngrok-skip-browser-warning'] = '69420';
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default staffApi;

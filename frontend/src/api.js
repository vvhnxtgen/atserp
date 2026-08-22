import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('ats_token');
  if (t) cfg.headers.Authorization = `Token ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ats_token');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => {
  const d = e.response?.data;
  if (!d) return e.message;
  if (typeof d === 'string') return d.slice(0, 200);
  if (d.detail) return d.detail;
  return Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' · ');
};

export const fileUrl = (u) => (!u ? '' : u.startsWith('http') ? u : API_BASE + u);

export default api;

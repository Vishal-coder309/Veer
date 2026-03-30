import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('veer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('veer_token');
      localStorage.removeItem('veer_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Sessions
export const sessionsAPI = {
  start: (data) => api.post('/sessions', data),
  stop: (id, data) => api.put(`/sessions/${id}/stop`, data),
  pause: (id) => api.put(`/sessions/${id}/pause`),
  resume: (id) => api.put(`/sessions/${id}/resume`),
  getToday: () => api.get('/sessions/today'),
  getAll: (params) => api.get('/sessions', { params }),
  getWeeklyStats: () => api.get('/sessions/weekly-stats'),
  getMonthlyStats: (year, month) => api.get('/sessions/monthly-stats', { params: { year, month } }),
};

// Topics
export const topicsAPI = {
  getAll: (subject) => api.get('/topics', { params: subject ? { subject } : {} }),
  update: (data) => api.put('/topics', data),
  getSummary: () => api.get('/topics/summary'),
};

// Tests
export const testsAPI = {
  add: (data) => api.post('/tests', data),
  getAll: (params) => api.get('/tests', { params }),
  getAnalytics: () => api.get('/tests/analytics'),
  delete: (id) => api.delete(`/tests/${id}`),
};

// Dashboard
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};

// Daily Commitment
export const dailyAPI = {
  getToday: () => api.get('/daily/today'),
  commit: () => api.post('/daily/commit'),
  skip: () => api.post('/daily/skip'),
  update: (data) => api.put('/daily/update', data),
  getHistory: () => api.get('/daily/history'),
};

export default api;
import axios from 'axios';

const API_BASE_URL = "https://studiovyn-leads-genrator.onrender.com/api";

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) => api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    jobTitle?: string;
  }) => api.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
};

// Leads API
export const leadsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    source?: string;
    assignedTo?: string;
    tags?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => api.get('/leads', { params }),

  getById: (id: string) => api.get(`/leads/${id}`),

  create: (data: any) => api.post('/leads', data),

  update: (id: string, data: any) => api.put(`/leads/${id}`, data),

  delete: (id: string) => api.delete(`/leads/${id}`),

  bulkUpdate: (leadIds: string[], updates: any) =>
    api.put('/leads/bulk', { leadIds, updates }),

  bulkDelete: (leadIds: string[]) =>
    api.delete('/leads/bulk', { data: { leadIds } }),

  addNote: (id: string, content: string) =>
    api.post(`/leads/${id}/notes`, { content }),

  addActivity: (id: string, data: { type: string; description: string; outcome?: string }) =>
    api.post(`/leads/${id}/activities`, data),

  getTimeline: (id: string) => api.get(`/leads/${id}/timeline`),

  move: (id: string, status: string) =>
    api.post(`/leads/${id}/move`, { status }),

  merge: (id: string, duplicateIds: string[]) =>
    api.post(`/leads/${id}/merge`, { duplicateIds }),

  getPipeline: () => api.get('/leads/pipeline'),
};

// Analytics API
export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview'),

  getLeadAnalytics: (period?: string) =>
    api.get('/analytics/leads', { params: { period } }),

  getSourceAnalytics: () => api.get('/analytics/sources'),

  getTeamPerformance: () => api.get('/analytics/team'),

  getGrowthTrends: () => api.get('/analytics/trends'),
};

// Import API
export const importApi = {
  importFile: (file: File, options?: { skipDuplicates?: boolean; defaultStatus?: string; tags?: string[]; campaign?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
    }
    return api.post('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  exportLeads: (params?: { status?: string; source?: string; startDate?: string; endDate?: string; format?: string }) =>
    api.get('/import/export', { params, responseType: 'blob' }),

  getTemplate: (format?: string) =>
    api.get('/import/template', { params: { format }, responseType: 'blob' }),
};

// Scraper API
export const scraperApi = {
  getTemplates: () => api.get('/scraper/templates'),

  getJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/scraper/jobs', { params }),

  getJob: (id: string) => api.get(`/scraper/jobs/${id}`),

  createJob: (data: { type: string; name?: string; config: { query: string; location?: string; limit?: number } }) =>
    api.post('/scraper/jobs', data),

  cancelJob: (id: string) => api.delete(`/scraper/jobs/${id}`),
};

export default api;

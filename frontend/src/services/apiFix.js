// Updated API service with proper error handling and debugging
import axios from 'axios';

const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add comprehensive request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🔍 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`🔑 Token attached: ${token.substring(0, 20)}...`);
    } else {
      console.warn('⚠️ No token found in localStorage');
    }
    
    // Log request details
    console.log('📋 Request headers:', config.headers);
    if (config.params) console.log('📋 Query params:', config.params);
    if (config.data) console.log('📋 Request data:', config.data);
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add comprehensive response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    console.log('📊 Response data:', response.data);
    return response;
  },
  (error) => {
    console.error(`❌ API Error: ${error.response?.status || 'No status'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    
    if (error.response) {
      // Server responded with error status
      console.error('📊 Error response:', error.response.data);
      console.error('📋 Error headers:', error.response.headers);
      console.error('📍 Request config:', {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        params: error.config.params,
        data: error.config.data
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('📡 No response received:', error.request);
    } else {
      // Request setup error
      console.error('🔧 Request setup error:', error.message);
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.warn('🔐 Authentication failed - clearing localStorage');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Export specific API functions for common operations
export const examAPI = {
  // Get exams with detailed error handling
  getExams: async (filters = {}, pagination = { current: 1, limit: 10 }) => {
    try {
      console.log('📚 examAPI.getExams called with:', { filters, pagination });
      
      // Validate inputs
      const page = Math.max(1, parseInt(pagination.current) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(pagination.limit) || 10));
      
      // Build query parameters
      const params = {
        page,
        limit
      };
      
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      
      if (filters.course && filters.course.trim()) {
        params.course = filters.course.trim();
      }
      
      if (filters.search && filters.search.trim()) {
        params.search = filters.search.trim();
      }
      
      console.log('🔍 Final query params:', params);
      
      const response = await api.get('/exams', { params });
      
      return {
        success: true,
        exams: response.data.data || [],
        pagination: response.data.pagination || { current: page, pages: 1, total: 0, limit }
      };
      
    } catch (error) {
      console.error('❌ examAPI.getExams error:', error);
      
      // Return structured error response
      return {
        success: false,
        error: {
          status: error.response?.status || 0,
          message: error.response?.data?.message || error.message,
          details: error.response?.data
        },
        exams: [],
        pagination: { current: 1, pages: 1, total: 0, limit: 10 }
      };
    }
  },

  // Test connection to exams endpoint
  testConnection: async () => {
    try {
      console.log('🧪 Testing exams API connection...');
      const response = await api.get('/exams/debug/auth-test');
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 0,
        error: error.response?.data || error.message
      };
    }
  }
};

// Auth API functions
export const authAPI = {
  login: async (credentials) => {
    try {
      console.log('🔐 Attempting login for:', credentials.email);
      const response = await api.post('/auth/login', credentials);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ Login successful, token stored');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  },

  logout: () => {
    console.log('👋 Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (!token || !userStr) {
        return null;
      }
      
      return JSON.parse(userStr);
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      return null;
    }
  },

  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }
};
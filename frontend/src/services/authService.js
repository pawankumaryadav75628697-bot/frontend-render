import api from './api';

export const authService = {
  // Student registration
  registerStudent: async (studentData) => {
    const response = await api.post('/auth/register/student', studentData);
    return response.data;
  },

  // Admin registration
  registerAdmin: async (adminData) => {
    const response = await api.post('/auth/register/admin', adminData);
    return response.data;
  },

  // Login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Store user data in localStorage
  setUserData: (data) => {
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  },

  // Remove user data from localStorage
  removeUserData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get stored user data
  getStoredUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  }
};
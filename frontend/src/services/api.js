import axios from 'axios';
import mockApi from './apiMock.js';

// Use mock API for now since backend isn't deployed
const USE_MOCK_API = true;

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-service-name.onrender.com/api/v1'  // Replace with actual backend URL
  : '/api/v1';

const realApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = USE_MOCK_API ? mockApi : realApi;

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
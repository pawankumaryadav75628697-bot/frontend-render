import { authService } from './authService';

class ExamService {
  constructor() {
    this.baseURL = '/api/v1/exams';
  }

  // Get authentication headers
  getHeaders() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Authentication token not found. Please login again.');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Get all exams with filters and pagination
  async getExams(filters = {}, pagination = { current: 1, limit: 10 }) {
    try {
      // Validate parameters
      const page = parseInt(pagination.current) || 1;
      const limit = parseInt(pagination.limit) || 10;

      if (page < 1 || page > 1000) {
        throw new Error(`Invalid page parameter: ${page}. Must be between 1 and 1000.`);
      }

      if (limit < 1 || limit > 100) {
        throw new Error(`Invalid limit parameter: ${limit}. Must be between 1 and 100.`);
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      // Add optional filters
      if (filters.status && filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }

      if (filters.course && filters.course.trim() !== '') {
        queryParams.append('course', filters.course.trim());
      }

      if (filters.search && filters.search.trim() !== '') {
        queryParams.append('search', filters.search.trim());
      }

      const response = await fetch(`${this.baseURL}?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(response.status, data.message || 'Failed to fetch exams', data);
      }

      if (!data.success) {
        throw new Error(data.message || 'API returned unsuccessful response');
      }

      // Validate response structure
      if (!Array.isArray(data.data)) {
        throw new Error('Invalid response structure: expected array of exams');
      }

      return {
        exams: data.data,
        pagination: data.pagination || { current: 1, pages: 1, total: 0, limit: 10 },
        success: true
      };

    } catch (error) {
      console.error('❌ ExamService.getExams error:', error);

      if (error instanceof APIError) {
        throw error;
      }

      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new APIError(0, 'Unable to connect to server. Please check your internet connection.');
      }

      throw new APIError(500, error.message || 'An unexpected error occurred');
    }
  }

  // Update exam status
  async updateExamStatus(examId, newStatus) {
    try {
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      if (!newStatus) {
        throw new Error('New status is required');
      }

      const response = await fetch(`${this.baseURL}/${examId}/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(response.status, data.message || 'Failed to update exam status', data);
      }

      return data;

    } catch (error) {
      console.error('❌ ExamService.updateExamStatus error:', error);

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(500, error.message || 'Failed to update exam status');
    }
  }

  // Delete exam
  async deleteExam(examId) {
    try {
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      const response = await fetch(`${this.baseURL}/${examId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(response.status, data.message || 'Failed to delete exam', data);
      }

      return data;

    } catch (error) {
      console.error('❌ ExamService.deleteExam error:', error);

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(500, error.message || 'Failed to delete exam');
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/debug/exam-list-test?page=1&limit=10`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      return {
        status: response.status,
        success: response.ok,
        data
      };

    } catch (error) {
      console.error('❌ ExamService.testConnection error:', error);
      return {
        status: 0,
        success: false,
        error: error.message
      };
    }
  }
}

// Custom API Error class
class APIError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }

  isAuthenticationError() {
    return this.status === 401;
  }

  isAuthorizationError() {
    return this.status === 403;
  }

  isBadRequestError() {
    return this.status === 400;
  }

  isServerError() {
    return this.status >= 500;
  }

  getErrorMessage() {
    switch (this.status) {
      case 400:
        return `Bad Request: ${this.message}`;
      case 401:
        return 'Authentication required. Please login again.';
      case 403:
        return 'Access denied. You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return this.message || `Request failed with status ${this.status}`;
    }
  }
}

export const examService = new ExamService();
export { APIError };
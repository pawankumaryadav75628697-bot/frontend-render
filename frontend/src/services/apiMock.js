// Temporary mock API for frontend testing
const mockResponses = {
  '/api/v1/auth/login': {
    success: true,
    message: 'Login successful (Mock)',
    token: 'mock-token-123',
    user: {
      _id: 'mock-user-id',
      fullName: 'Test User',
      email: 'test@example.com',
      userType: 'admin'
    }
  },
  '/api/v1/auth/me': {
    success: true,
    user: {
      _id: 'mock-user-id',
      fullName: 'Test User',
      email: 'test@example.com',
      userType: 'admin'
    }
  }
};

// Dynamic mock responses for other endpoints
const generateMockResponse = (url, data) => {
  console.log('Mock API call:', url, data);
  
  // Handle different endpoints
  if (url.includes('/auth/login')) {
    return mockResponses['/api/v1/auth/login'];
  }
  
  if (url.includes('/auth/me')) {
    return mockResponses['/api/v1/auth/me'];
  }
  
  // Exams endpoints
  if (url.includes('/exams/stats')) {
    return {
      success: true,
      data: {
        totalExams: 15,
        activeExams: 3,
        completedExams: 12,
        upcomingExams: 2
      }
    };
  }
  
  if (url.includes('/exams')) {
    if (url.includes('status=active')) {
      return {
        success: true,
        data: {
          exams: [
            { _id: '1', title: 'Math Exam', status: 'active', students: 25 },
            { _id: '2', title: 'Science Exam', status: 'active', students: 30 }
          ],
          pagination: { page: 1, limit: 10, total: 2 }
        }
      };
    }
    if (url.includes('status=published')) {
      return {
        success: true,
        data: {
          exams: [
            { _id: '3', title: 'History Exam', status: 'published', date: '2026-02-10' }
          ],
          pagination: { page: 1, limit: 5, total: 1 }
        }
      };
    }
  }
  
  // Admin students endpoints
  if (url.includes('/admin/students/stats')) {
    return {
      success: true,
      data: {
        totalStudents: 150,
        activeStudents: 120,
        newStudentsThisMonth: 15
      }
    };
  }
  
  if (url.includes('/admin/students')) {
    return {
      success: true,
      data: {
        students: [
          { _id: '1', name: 'John Doe', email: 'john@example.com', status: 'active' },
          { _id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'active' }
        ],
        pagination: { page: 1, limit: 10, total: 150 }
      }
    };
  }
  
  // Health endpoint
  if (url.includes('/health')) {
    return {
      success: true,
      message: 'Service is healthy',
      timestamp: new Date().toISOString()
    };
  }
  
  // Default response for unimplemented endpoints
  return {
    success: true,
    message: `Mock API: Endpoint ${url} handled successfully`,
    data: {}
  };
};

const mockApi = {
  post: async (url, data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: generateMockResponse(url, data) };
  },
  
  get: async (url) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { data: generateMockResponse(url) };
  },
  
  // Add missing axios methods to prevent undefined errors
  interceptors: {
    request: {
      use: () => {},
    },
    response: {
      use: () => {}
    }
  }
};

export default mockApi;

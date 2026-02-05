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

const mockApi = {
  post: async (url, data) => {
    console.log('Mock API call:', url, data);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    
    if (url.includes('/auth/login')) {
      const response = mockResponses['/api/v1/auth/login'];
      return { data: response };
    }
    return { data: { success: false, message: 'Mock API: Endpoint not implemented' } };
  },
  
  get: async (url) => {
    console.log('Mock API call:', url);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (url.includes('/auth/me')) {
      const response = mockResponses['/api/v1/auth/me'];
      return { data: response };
    }
    return { data: { success: false, message: 'Mock API: Endpoint not implemented' } };
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

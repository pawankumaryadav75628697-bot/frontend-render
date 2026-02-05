// Global fetch override to intercept all API calls
import finalMockApi from './apiFinal.js';

const originalFetch = window.fetch;

// Override global fetch to use mock API
window.fetch = async (url, options = {}) => {
  console.log('🔥 GLOBAL FETCH OVERRIDE:', url, options);
  
  // Only intercept API calls
  if (url.includes('/api/')) {
    console.log('🔥 Intercepting API call:', url);
    
    // Extract method from options
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    
    // Route to mock API
    if (method === 'GET') {
      return finalMockApi.get(url);
    } else if (method === 'POST') {
      return finalMockApi.post(url, body);
    } else if (method === 'PUT') {
      return finalMockApi.put(url, body);
    } else if (method === 'DELETE') {
      return finalMockApi.delete(url);
    }
  }
  
  // For non-API calls, use original fetch
  return originalFetch(url, options);
};

console.log('🔥 GLOBAL FETCH OVERRIDE INSTALLED - All API calls will be intercepted');

export default window.fetch;

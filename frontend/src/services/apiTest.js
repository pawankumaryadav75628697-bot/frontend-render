// Test API connectivity
export const testBackendConnection = async () => {
  try {
    console.log('🔍 Testing backend connection...');
    
    // Test health endpoint
    const healthResponse = await fetch('https://frontend-render-lbix.onrender.com/api/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test auth endpoint
    const authResponse = await fetch('https://frontend-render-lbix.onrender.com/api/v1/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.pkthenexgenexam.xyz'
      }
    });
    const authData = await authResponse.json();
    console.log('Auth test:', authData);
    
    return {
      health: healthData,
      auth: authData
    };
  } catch (error) {
    console.error('Backend test failed:', error);
    return {
      error: error.message
    };
  }
};

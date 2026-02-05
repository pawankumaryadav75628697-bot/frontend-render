// Debug file to check what API is being used
console.log('=== API Debug Info ===');
console.log('USE_MOCK_API:', true);
console.log('Current API:', typeof window.api !== 'undefined' ? 'window.api' : 'Not set');

// Force mock API to be global
window.api = require('./api.js').default;

export default window.api;

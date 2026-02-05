const https = require('http');

// Test the exam list API to reproduce the 400 error
const testExamAPI = () => {
  const data = JSON.stringify({});
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/exams?page=1&limit=10&status=all',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to replace this
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      console.log('Response Body:', body);
      
      if (res.statusCode === 400) {
        console.log('🔴 Found the 400 error! Response:', JSON.parse(body));
      } else {
        console.log('✅ Request successful');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(data);
  req.end();
};

// Test without token to see auth behavior
const testWithoutToken = () => {
  console.log('\n🧪 Testing without authorization token...');
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/exams?page=1&limit=10&status=all',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', JSON.parse(body));
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
};

console.log('🧪 Testing exam list API...');
console.log('Make sure the backend is running on port 5001');
console.log('');

// Test without token first
testWithoutToken();

// Instructions for manual testing
console.log('');
console.log('📝 To test with a real token:');
console.log('1. Go to your browser and log in as an admin');
console.log('2. Open browser dev tools -> Application -> Local Storage');
console.log('3. Find the token and replace YOUR_TOKEN_HERE in this script');
console.log('4. Uncomment the testExamAPI() call below');
console.log('');

// Uncomment this line after adding a real token:
// testExamAPI();
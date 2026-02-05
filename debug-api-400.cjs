#!/usr/bin/env node

/**
 * Debug script for API 400 error
 * This script helps identify the cause of the 400 Bad Request error
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testEndpoints() {
  log('🔍 Testing API endpoints to debug 400 error...', 'bold');
  
  const baseUrl = 'http://localhost:5001';
  
  // Test 1: Health check
  log('\n📋 Test 1: Health Check', 'blue');
  try {
    const health = await makeRequest(`${baseUrl}/api/health`);
    if (health.status === 200) {
      log('✅ Server is running', 'green');
    } else {
      log(`❌ Health check failed with status: ${health.status}`, 'red');
      console.log(health.data);
    }
  } catch (error) {
    log(`❌ Cannot connect to server: ${error.message}`, 'red');
    log('Make sure the backend server is running on port 5001', 'yellow');
    return;
  }

  // Test 2: Auth endpoint without token
  log('\n📋 Test 2: Auth Test (No Token)', 'blue');
  try {
    const authTest = await makeRequest(`${baseUrl}/api/v1/exams/debug/auth-test`);
    log(`Status: ${authTest.status}`, authTest.status === 401 ? 'yellow' : 'red');
    if (authTest.data) {
      console.log('Response:', JSON.stringify(authTest.data, null, 2));
    }
  } catch (error) {
    log(`❌ Request failed: ${error.message}`, 'red');
  }

  // Test 3: Exams endpoint without token
  log('\n📋 Test 3: Exams Endpoint (No Token)', 'blue');
  try {
    const examsTest = await makeRequest(`${baseUrl}/api/v1/exams`);
    log(`Status: ${examsTest.status}`, examsTest.status === 401 ? 'yellow' : 'red');
    if (examsTest.data) {
      console.log('Response:', JSON.stringify(examsTest.data, null, 2));
    }
  } catch (error) {
    log(`❌ Request failed: ${error.message}`, 'red');
  }

  // Test 4: Check if it's a CORS issue
  log('\n📋 Test 4: CORS Check', 'blue');
  try {
    const corsTest = await makeRequest(`${baseUrl}/api/v1/exams`, {
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      },
      method: 'OPTIONS'
    });
    log(`CORS Preflight Status: ${corsTest.status}`, corsTest.status === 200 ? 'green' : 'red');
    if (corsTest.headers) {
      console.log('CORS Headers:', corsTest.headers['access-control-allow-origin']);
    }
  } catch (error) {
    log(`❌ CORS test failed: ${error.message}`, 'red');
  }

  // Test 5: Check with invalid auth header
  log('\n📋 Test 5: Invalid Auth Header', 'blue');
  try {
    const invalidAuth = await makeRequest(`${baseUrl}/api/v1/exams`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    log(`Status with invalid token: ${invalidAuth.status}`, 'yellow');
    if (invalidAuth.data) {
      console.log('Response:', JSON.stringify(invalidAuth.data, null, 2));
    }
  } catch (error) {
    log(`❌ Request failed: ${error.message}`, 'red');
  }
}

function provideDebuggingTips() {
  log('\n🔧 Common Causes of 400 Bad Request:', 'bold');
  log('', 'reset');
  log('1. 🔑 Authentication Issues:', 'blue');
  log('   - Missing or invalid JWT token', 'yellow');
  log('   - Expired token requiring refresh', 'yellow');
  log('   - Token not being sent from frontend', 'yellow');
  log('', 'reset');
  log('2. 📝 Request Validation Issues:', 'blue');
  log('   - Invalid query parameters (page, limit, etc.)', 'yellow');
  log('   - Missing required headers', 'yellow');
  log('   - Invalid request format', 'yellow');
  log('', 'reset');
  log('3. 🗄️ Database Issues:', 'blue');
  log('   - Database connection problems', 'yellow');
  log('   - User not found in database', 'yellow');
  log('   - Invalid user permissions', 'yellow');
  log('', 'reset');
  log('4. 🔧 Server Configuration:', 'blue');
  log('   - Middleware ordering problems', 'yellow');
  log('   - Route conflicts', 'yellow');
  log('   - CORS configuration issues', 'yellow');
  log('', 'reset');
  log('🎯 Next Steps to Debug:', 'bold');
  log('1. Check the backend server console for detailed error logs', 'blue');
  log('2. Verify your login token is valid and not expired', 'blue');
  log('3. Test the debug endpoints: /api/v1/exams/debug/auth-test', 'blue');
  log('4. Check browser network tab for request headers', 'blue');
  log('5. Ensure you are logged in as admin or teacher', 'blue');
}

// Run the tests
testEndpoints()
  .then(() => {
    provideDebuggingTips();
  })
  .catch(error => {
    log(`❌ Test suite failed: ${error.message}`, 'red');
    provideDebuggingTips();
  });
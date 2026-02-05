const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

async function testAPI() {
  try {
    console.log('🚀 Starting API Test...\n');

    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL.replace('/v1', '')}/health`);
    console.log('✅ Health check successful:', healthResponse.data.message);
    console.log('');

    // Test 2: Register admin user
    console.log('2. Registering admin user...');
    const adminData = {
      fullName: 'Test Admin',
      email: 'admin@test.com',
      password: 'admin123',
      confirmPassword: 'admin123',
      institution: 'Test University',
      department: 'Computer Science',
      employeeId: 'EMP001'
    };

    let adminResponse;
    try {
      adminResponse = await axios.post(`${BASE_URL}/auth/register/admin`, adminData);
      console.log('✅ Admin registered successfully:', adminResponse.data.user.fullName);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️ Admin user already exists, proceeding to login...');
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 3: Login
    console.log('3. Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    console.log('User:', loginResponse.data.user.fullName, `(${loginResponse.data.user.userType})`);
    console.log('');

    // Test 4: Test auth middleware
    console.log('4. Testing auth middleware...');
    const authTestResponse = await axios.get(`${BASE_URL}/exams/debug/auth-test`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Auth test successful:', authTestResponse.data.message);
    console.log('User from auth:', authTestResponse.data.user.fullName, `(${authTestResponse.data.user.userType})`);
    console.log('');

    // Test 5: Test admin authorization
    console.log('5. Testing admin authorization...');
    const adminTestResponse = await axios.get(`${BASE_URL}/exams/debug/admin-test`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Admin test successful:', adminTestResponse.data.message);
    console.log('');

    // Test 6: Get exams (the failing endpoint)
    console.log('6. Testing GET /api/v1/exams (the problematic endpoint)...');
    const examsResponse = await axios.get(`${BASE_URL}/exams?page=1&limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Exams retrieved successfully!');
    console.log('Response:', examsResponse.data);
    console.log('');

    console.log('🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API Test Failed:');
    console.error('Status:', error.response?.status || 'No status');
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Details:', error.response?.data || 'No details');
    
    if (error.response?.status === 400) {
      console.error('\n🔍 400 Error Details:');
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Request Headers:', error.config?.headers);
      console.error('Request Data:', error.config?.data);
    }
  }
}

testAPI();
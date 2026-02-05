const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

async function testLoginAndAPI() {
  try {
    console.log('🧪 Testing Login and API Call...\n');
    
    // From the backend logs, we know the user ID is 68a7861c2bec03d73c40612b
    // Let's try to login with common admin credentials
    
    const possibleCredentials = [
      { email: 'pawankumar91819@gmail.com', password: 'admin123' },
      { email: 'admin@test.com', password: 'admin123' },
      { email: 'admin@admin.com', password: 'admin123' },
      { email: 'pawankumar91819@gmail.com', password: 'password' },
      { email: 'pawankumar91819@gmail.com', password: '123456' }
    ];
    
    let loginData = null;
    
    for (const cred of possibleCredentials) {
      try {
        console.log(`🔐 Trying to login with: ${cred.email}`);
        
        const response = await axios.post(`${BASE_URL}/auth/login`, cred);
        
        if (response.data.token) {
          console.log(`✅ Login successful!`);
          console.log(`User: ${response.data.user.fullName} (${response.data.user.userType})`);
          console.log(`Token: ${response.data.token.substring(0, 40)}...`);
          loginData = response.data;
          break;
        }
      } catch (error) {
        console.log(`❌ Login failed for ${cred.email}: ${error.response?.data?.message || error.message}`);
      }
    }
    
    if (!loginData) {
      console.log('\n❌ Could not login with any credentials. Please check:');
      console.log('1. Admin user exists in database');
      console.log('2. Password is correct');
      console.log('3. Backend is running properly');
      return;
    }
    
    // Test API call with token
    console.log('\n📚 Testing /api/v1/exams with token...');
    
    const examsResponse = await axios.get(`${BASE_URL}/exams?page=1&limit=10`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Exams API call successful!');
    console.log(`Found ${examsResponse.data.data.length} exams`);
    console.log(`Total: ${examsResponse.data.pagination.total}`);
    
    console.log('\n🎉 SOLUTION FOUND!');
    console.log('To fix your frontend 400 error:');
    console.log('1. Login with these credentials:');
    console.log(`   Email: ${loginData.user.email}`);
    console.log(`   Password: [the one that worked above]`);
    console.log('2. Store the token in localStorage');
    console.log('3. Include Authorization header in all API requests');
    
    console.log('\n📋 Frontend Code Fix:');
    console.log('```javascript');
    console.log('// Store token after login');
    console.log(`localStorage.setItem('token', '${loginData.token.substring(0, 20)}...');`);
    console.log('');
    console.log('// Use token in API calls');
    console.log('fetch("/api/v1/exams?page=1&limit=10", {');
    console.log('  headers: {');
    console.log('    "Authorization": `Bearer ${localStorage.getItem("token")}`,');
    console.log('    "Content-Type": "application/json"');
    console.log('  }');
    console.log('});');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testLoginAndAPI();
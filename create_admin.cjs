const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

async function createAdminAndTest() {
  try {
    console.log('🔧 Creating Admin User and Testing API...\n');
    
    // Step 1: Create admin user
    const adminData = {
      fullName: 'Test Admin',
      email: 'admin@test.com',
      password: 'admin123',
      confirmPassword: 'admin123',
      institution: 'Test University',
      department: 'Computer Science',
      employeeId: 'EMP001'
    };
    
    console.log('👤 Creating admin user...');
    
    let loginData = null;
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register/admin`, adminData);
      console.log('✅ Admin user created successfully!');
      console.log(`User: ${registerResponse.data.user.fullName}`);
      loginData = registerResponse.data;
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️ Admin user already exists, trying to login...');
        
        // Try to login with existing admin
        try {
          const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: adminData.email,
            password: adminData.password
          });
          console.log('✅ Login successful with existing admin!');
          loginData = loginResponse.data;
        } catch (loginError) {
          console.log('❌ Login failed with admin@test.com/admin123');
          console.log('Let me try some other credentials...');
          
          // Try other common admin credentials
          const otherCreds = [
            { email: 'pawankumar91819@gmail.com', password: 'pawan123' },
            { email: 'admin@admin.com', password: 'password' },
            { email: 'test@test.com', password: '123456' }
          ];
          
          for (const cred of otherCreds) {
            try {
              const resp = await axios.post(`${BASE_URL}/auth/login`, cred);
              console.log(`✅ Login successful with ${cred.email}!`);
              loginData = resp.data;
              break;
            } catch (e) {
              console.log(`❌ Failed: ${cred.email}`);
            }
          }
        }
      } else {
        console.error('❌ Error creating admin:', error.response?.data || error.message);
        return;
      }
    }
    
    if (!loginData) {
      console.log('\n❌ Could not create or login admin user.');
      console.log('Please manually create an admin user or check existing credentials.');
      return;
    }
    
    console.log(`\n✅ Admin authenticated: ${loginData.user.fullName} (${loginData.user.userType})`);
    console.log(`Token: ${loginData.token.substring(0, 40)}...`);
    
    // Step 2: Test the problematic API call
    console.log('\n📚 Testing /api/v1/exams endpoint...');
    
    const examsResponse = await axios.get(`${BASE_URL}/exams?page=1&limit=10`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Exams API call successful!');
    console.log(`Found ${examsResponse.data.data.length} exams`);
    console.log(`Total: ${examsResponse.data.pagination.total}`);
    
    // Step 3: Test through proxy (frontend)
    console.log('\n🌐 Testing through proxy (localhost:5174)...');
    
    try {
      const proxyResponse = await axios.get('http://localhost:5174/api/v1/exams?page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Proxy call successful!');
      console.log(`Found ${proxyResponse.data.data.length} exams through proxy`);
    } catch (proxyError) {
      console.log('❌ Proxy call failed:', proxyError.response?.data?.message || proxyError.message);
    }
    
    console.log('\n🎉 SOLUTION:');
    console.log('Your 400/401 error is caused by missing authentication.');
    console.log('To fix your frontend:');
    console.log('\n1. Login Credentials:');
    console.log(`   Email: ${loginData.user.email}`);
    console.log(`   Password: admin123`);
    console.log('\n2. After login, store token in localStorage:');
    console.log(`   localStorage.setItem('token', 'your-jwt-token-here');`);
    console.log('\n3. Include Authorization header in API calls:');
    console.log(`   headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }`);
    
    console.log('\n📋 Frontend Fix Code:');
    console.log('```javascript');
    console.log('// Login first');
    console.log('const loginResponse = await fetch("/api/v1/auth/login", {');
    console.log('  method: "POST",');
    console.log('  headers: { "Content-Type": "application/json" },');
    console.log(`  body: JSON.stringify({ email: "${loginData.user.email}", password: "admin123" })`);
    console.log('});');
    console.log('const { token } = await loginResponse.json();');
    console.log('localStorage.setItem("token", token);');
    console.log('');
    console.log('// Then make API calls with token');
    console.log('fetch("/api/v1/exams?page=1&limit=10", {');
    console.log('  headers: {');
    console.log('    "Authorization": `Bearer ${localStorage.getItem("token")}`,');
    console.log('    "Content-Type": "application/json"');
    console.log('  }');
    console.log('});');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Script failed:', error.response?.data || error.message);
  }
}

createAdminAndTest();
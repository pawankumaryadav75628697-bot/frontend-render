#!/usr/bin/env node

/**
 * Student Management Debug Utility
 * 
 * This script helps you test and debug the student management functionality
 * by making direct API calls to verify backend behavior.
 */

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODMyM2M5MGJhMTU4Njk5NGVhZjk2MyIsImlhdCI6MTc3MDIwMjE3NiwiZXhwIjoxNzcwODA2OTc2fQ.nEH8VNObHoPT1weLhgqmA03AllgcB9XDFor-bHKBtSc';
const baseURL = 'http://localhost:5001/api/v1/admin';

async function makeRequest(method, endpoint, data = null) {
  const url = `${baseURL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    console.log(`\n🔄 ${method} ${url}`);
    if (data) {
      console.log('📤 Request Data:', JSON.stringify(data, null, 2));
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response Data:', JSON.stringify(responseData, null, 2));

    return { response, data: responseData };
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { error };
  }
}

async function testGetStudents() {
  console.log('\n🧪 Testing GET /students');
  return await makeRequest('GET', '/students?page=1&limit=5');
}

async function testAddStudent() {
  console.log('\n🧪 Testing POST /students (Add Student)');
  
  const testStudent = {
    fullName: 'Debug Test Student',
    email: `debug-test-${Date.now()}@example.com`,
    phoneNumber: '9876543210',
    course: 'Debug Testing',
    semester: 2,
    batch: '2024',
    rollNumber: `DBG${Date.now()}`
  };

  return await makeRequest('POST', '/students', testStudent);
}

async function testSystemStatus() {
  console.log('\n🧪 Testing GET /system/status');
  return await makeRequest('GET', '/system/status');
}

async function runAllTests() {
  console.log('🚀 Starting Student Management Debug Tests');
  console.log('=' .repeat(60));

  // Test 1: System Status
  await testSystemStatus();

  // Test 2: Get Students
  const getResult = await testGetStudents();

  // Test 3: Add Student
  await testAddStudent();

  // Test 4: Get Students Again (to verify add worked)
  console.log('\n🧪 Re-testing GET /students (after add)');
  await testGetStudents();

  console.log('\n' + '=' .repeat(60));
  console.log('🎉 Debug tests completed!');
  
  if (getResult && getResult.data) {
    console.log('\n📊 Analysis:');
    console.log(`- Total students in database: ${getResult.data.data?.pagination?.total || 'Unknown'}`);
    console.log(`- Data structure is ${getResult.data.data?.students ? '✅ Correct' : '❌ Incorrect'}`);
    console.log(`- Pagination structure is ${getResult.data.data?.pagination ? '✅ Correct' : '❌ Incorrect'}`);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or you need to install node-fetch');
  console.log('💡 Install with: npm install node-fetch');
  process.exit(1);
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testGetStudents, testAddStudent, testSystemStatus };
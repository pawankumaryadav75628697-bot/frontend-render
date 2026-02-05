// Paste this script in your browser console while on localhost:5174 to debug the issue

console.log('🔧 Starting Frontend API Debug...');

// Step 1: Check current localStorage status
function checkLocalStorage() {
  console.log('📊 Current localStorage status:');
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('Token:', token ? `${token.substring(0, 30)}...` : 'NOT FOUND');
  console.log('User:', user || 'NOT FOUND');
  
  if (user) {
    try {
      const userObj = JSON.parse(user);
      console.log('User Details:', userObj);
    } catch (e) {
      console.error('User data is corrupted:', e);
    }
  }
}

// Step 2: Login function (if needed)
async function loginAsAdmin() {
  try {
    console.log('🔐 Attempting to login as admin...');
    
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'pawankumar91819@gmail.com', // Use the actual admin email from logs
        password: 'admin123' // Replace with actual password
      }),
    });

    const data = await response.json();
    console.log('Login response:', data);
    
    if (response.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('✅ Login successful! Token stored.');
      return data.token;
    } else {
      console.error('❌ Login failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    return null;
  }
}

// Step 3: Test the problematic API call
async function testExamsAPI() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.log('❌ No token found. Run loginAsAdmin() first.');
    return;
  }

  try {
    console.log('🧪 Testing /api/v1/exams endpoint...');
    console.log('Using token:', token.substring(0, 30) + '...');
    
    const response = await fetch('/api/v1/exams?page=1&limit=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data:', data);
    
    if (response.ok) {
      console.log('✅ SUCCESS! API call worked.');
      console.log('Found', data.data?.length || 0, 'exams');
    } else {
      console.log('❌ FAILED! Status:', response.status);
      console.log('Error message:', data.message);
    }
  } catch (error) {
    console.error('❌ API call error:', error);
  }
}

// Step 4: All-in-one debug function
async function debugAPI() {
  console.log('🚀 Running complete API debug...');
  
  checkLocalStorage();
  
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No token found, attempting login...');
    await loginAsAdmin();
  }
  
  await testExamsAPI();
}

// Auto-run the debug
checkLocalStorage();

console.log(`
🔧 Debug Functions Available:
• checkLocalStorage() - Check current localStorage
• loginAsAdmin() - Login as admin user  
• testExamsAPI() - Test the problematic API call
• debugAPI() - Run complete debug sequence

Run debugAPI() to automatically fix the issue, or run individual functions as needed.
`);

// If no token found, provide instructions
if (!localStorage.getItem('token')) {
  console.log(`
⚠️ NO TOKEN FOUND! 
To fix the 400 error, run: debugAPI()
`);
} else {
  console.log('✅ Token found. Testing API call...');
  testExamsAPI();
}
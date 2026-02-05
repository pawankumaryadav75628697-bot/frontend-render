# 🔧 Frontend Authentication Fix Guide

## Issue Analysis
The API is returning **400 Bad Request** errors, but our tests show the backend is actually working correctly. The issue is likely one of these:

1. **JWT Token Issues** - Token expired, missing, or malformed
2. **Frontend Request Issues** - Auth header not being sent properly
3. **User Session Issues** - Need to refresh login

## 🎯 Quick Fixes

### Option 1: Clear Storage and Re-login
```javascript
// Open browser console and run:
localStorage.clear();
sessionStorage.clear();

// Then refresh the page and login again
```

### Option 2: Check Token in Browser Console
```javascript
// Check if token exists
console.log('Token:', localStorage.getItem('token'));

// Check if token is expired
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token expires:', new Date(payload.exp * 1000));
  console.log('Current time:', new Date());
  console.log('Token expired:', payload.exp * 1000 < Date.now());
}
```

### Option 3: Check Network Tab
1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Try to load the problematic page
4. Look for the failed request to `/api/v1/exams`
5. Check if `Authorization: Bearer <token>` header is present

### Option 4: Backend Verification
Test these debug endpoints in your browser (after logging in):
- `http://localhost:5001/api/v1/exams/debug/auth-test`
- `http://localhost:5001/api/v1/exams/debug/admin-test`

## 🔍 Most Likely Solutions

### Solution 1: Token Expired
If your JWT token has expired, you need to:
1. Logout and login again
2. OR implement automatic token refresh in your frontend

### Solution 2: User Type Issues  
Make sure your user account has the correct permissions:
- **Admin** users can access all exam routes
- **Teacher** users can also access exam routes (updated in our fix)
- **Student** users cannot access admin exam routes

### Solution 3: Frontend Auth Context Issues
Check your `AuthContext.jsx` to ensure:
1. Token is being stored correctly
2. Auth headers are being sent with requests
3. Token refresh logic is working

## 🛠️ Frontend Code Fixes

### Fix 1: Enhanced Error Handling
Add this to your API request interceptor:

```javascript
// In your API utility file or AuthContext
const api = axios.create({
  baseURL: 'http://localhost:5001/api/v1',
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor  
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Fix 2: Token Validation
Add token validation to your AuthContext:

```javascript
const validateToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// In your AuthContext Provider
useEffect(() => {
  const token = localStorage.getItem('token');
  if (token && validateToken(token)) {
    setUser(/* decode user info */);
  } else {
    localStorage.removeItem('token');
  }
}, []);
```

## ✅ Verification Steps

After applying fixes:

1. **Clear browser storage** completely
2. **Login again** with admin/teacher account
3. **Check network requests** show Authorization header
4. **Test exam pages** - should load without 400 errors
5. **Check server logs** for any remaining issues

## 🚨 Emergency Fix

If nothing else works, try this temporary workaround:

```javascript
// In browser console, set a test token (replace with your actual token)
const testToken = 'your-actual-jwt-token-here';
localStorage.setItem('token', testToken);

// Then refresh the page
location.reload();
```

---

The backend is working correctly - the issue is frontend authentication. Follow these steps to resolve the 400 errors.
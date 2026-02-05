# 🚀 Development Setup Guide

This guide will help you resolve the rate limiting (429 errors) and other development issues.

## 🛠️ Quick Fix for Rate Limiting Issues

### Option 1: Use the Auto-Restart Script
```bash
# Run this from the project root directory
node restart-dev-server.js
```

### Option 2: Manual Setup
1. **Stop the current backend server** (Ctrl+C if running)

2. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

3. **Set development environment variable:**
   ```bash
   # Windows (PowerShell)
   $env:NODE_ENV="development"
   $env:DISABLE_RATE_LIMIT="true"
   
   # Windows (Command Prompt)
   set NODE_ENV=development
   set DISABLE_RATE_LIMIT=true
   
   # macOS/Linux
   export NODE_ENV=development
   export DISABLE_RATE_LIMIT=true
   ```

4. **Start the server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

## 📋 Issues Fixed

### ✅ Rate Limiting (429 Errors)
- **Problem:** Frontend was getting blocked by rate limiting
- **Solution:** Rate limiting is now completely disabled in development mode
- **Verification:** You should see `🔓 Rate limiting DISABLED for development` in server logs

### ✅ Missing API Endpoints
- **Problem:** Some proctoring endpoints were missing
- **Solution:** Added missing `/exam/:examId/students` and `/exam/:examId/stats` endpoints
- **Verification:** API calls to proctoring endpoints should now work

### ✅ Enhanced Logging
- **Problem:** Hard to debug API issues
- **Solution:** Added detailed request/response logging in development
- **Verification:** All API calls are now logged with query params and error responses

## 🔍 Troubleshooting

### If you still see 429 errors:
1. **Clear browser cache** - Rate limit info might be cached
2. **Restart your browser** - Clear any pending requests
3. **Check server logs** - Look for the "Rate limiting DISABLED" message
4. **Verify environment** - Make sure `NODE_ENV=development`

### If you see 400 errors:
1. **Check the server logs** - The detailed logging will show the exact error
2. **Verify authentication** - Make sure you're logged in
3. **Check request parameters** - Some endpoints require specific query parameters

### React DevTools Warning:
The warning about React DevTools is just informational. You can:
1. **Install React DevTools browser extension** from the Chrome/Firefox store
2. **Or ignore it** - it doesn't affect functionality

## 🌟 Development Features Enabled

- ✅ **No Rate Limiting** - Unlimited API requests
- ✅ **Detailed Logging** - All requests/responses logged
- ✅ **CORS Enabled** - Frontend can call backend
- ✅ **Hot Reload** - Server restarts automatically on changes
- ✅ **Error Details** - Full error messages in development

## 📱 Testing the Original Issues

### Email Notifications:
1. Create an exam as admin
2. Publish the exam
3. Check server logs for email sending confirmation

### Camera/Microphone Detection:
1. Start an exam as a student
2. The system should prompt for camera/microphone permissions
3. Deny permissions to test violation alerts

### Session Locking:
1. During an exam, deny camera access
2. The session should show critical alerts and potentially lock

### Result Display:
1. Complete an exam
2. Results should display immediately with detailed information

## 🔧 Server Status Endpoints

- **Health Check:** http://localhost:5001/api/health
- **System Status:** http://localhost:5001/api/v1/admin/system/status
- **Test Endpoint:** http://localhost:5001/api/v1/test

## 📞 Need Help?

If you're still experiencing issues:
1. Check the server console for detailed error logs
2. Verify all environment variables are set correctly
3. Make sure MongoDB is running
4. Try restarting both frontend and backend servers

---

*This setup guide was created to resolve the 429 rate limiting errors and improve the development experience.*
# Development Troubleshooting Guide

## Common Issues and Solutions

### 1. Port Already in Use Error

**Error**: `Error: listen EADDRINUSE: address already in use :::5001`

**Solutions**:

#### Option A: Use the Port Management Script
```powershell
# Check which process is using the port
.\scripts\manage-port.ps1 check

# Kill the process using the port
.\scripts\manage-port.ps1 kill

# Start dev server (auto-kills conflicting processes)
.\scripts\manage-port.ps1 start
```

#### Option B: Manual Process Management
```powershell
# Find the process using port 5001
netstat -ano | findstr :5001

# Kill the process (replace XXXX with actual PID)
taskkill /PID XXXX /F

# Start the dev server
npm run dev
```

#### Option C: Change Port
Edit `.env` file or set environment variable:
```bash
PORT=5002 npm run dev
```

### 2. Rate Limiting Issues

**Error**: `429 Too Many Requests`

**Solutions**:
- Wait 1 minute (development) or 15 minutes (production)
- Use the dev reset endpoint: `POST /api/dev/reset-rate-limit`
- Check your `NODE_ENV` is set to development
- Review rate limiting configuration in `server.js`

### 3. Database Connection Issues

**Error**: Various MongoDB connection errors

**Solutions**:
- Ensure MongoDB is running locally
- Check connection string in `.env`
- Verify database credentials
- Check network connectivity

### 4. Module Not Found Errors

**Error**: `Cannot find module 'xyz'`

**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or just reinstall specific package
npm install xyz
```

### 5. Express Rate Limit Deprecation Warnings

The application has been updated to use modern express-rate-limit configuration:
- Uses `limit` instead of `max`
- Uses `standardHeaders: 'draft-7'` instead of `standardHeaders: true`
- Removed deprecated `onLimitReached` handler

If you see deprecation warnings, ensure you're using the latest version of the code.

## Development Scripts

### Port Management
- `.\scripts\manage-port.ps1 check` - Check port usage
- `.\scripts\manage-port.ps1 kill` - Free the port
- `.\scripts\manage-port.ps1 start` - Start dev server with auto-cleanup

### Server Management
- `npm run dev` - Start with nodemon (auto-restart)
- `npm start` - Start in production mode
- `npm test` - Run tests

## Environment Setup

### Required Environment Variables
```bash
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/exam-monitoring
JWT_SECRET=your-super-secret-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone
EMAIL_HOST=your-email-host
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASS=your-email-password
```

### Development vs Production
- Development: Very permissive rate limiting, detailed logging
- Production: Strict rate limiting, minimal logging

## Getting Help

1. Check the console output for detailed error messages
2. Review the logs in `logs/` directory
3. Use the port management script for port conflicts
4. Ensure all environment variables are set correctly
5. Verify MongoDB is running and accessible
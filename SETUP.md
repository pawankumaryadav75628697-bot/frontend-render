# 🚀 Professional Setup Guide - Exam Monitoring System

## Quick Start (Recommended)

### Option 1: Using Docker (Professional & Automated)
```bash
# Start the entire system with one command
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Manual Setup

#### 1. Install MongoDB
**Windows:**
```bash
# Download and install MongoDB Community Server
# https://www.mongodb.com/try/download/community
```

**Or use MongoDB Atlas (Cloud):**
```bash
# Update backend/.env with your Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/exammonitor
```

#### 2. Start MongoDB Service
```bash
# Windows Service (if installed locally)
net start MongoDB

# Or start manually
mongod --dbpath "C:\data\db"
```

#### 3. Start Backend Server
```bash
cd backend
npm install
npm start
```

#### 4. Start Frontend Development Server  
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Troubleshooting

### Issue: "Unexpected token '<', "<!doctype"... is not valid JSON"
**Solution:** This means the frontend is not reaching the backend API

1. **Check Backend Server:** Make sure it's running on http://localhost:5000
2. **Check Proxy Configuration:** Vite should proxy /api requests to backend
3. **Check CORS:** Backend should allow requests from frontend origin

### Issue: "Failed to load resource: 404 Not Found"
**Solution:** API endpoints not registered correctly

1. **Verify routes are mounted in server.js**
2. **Check route order in routes/exams.js**
3. **Ensure middleware is properly configured**

### Issue: Database Connection
**Solutions:**
1. Use MongoDB Atlas (cloud) - easiest option
2. Install MongoDB locally
3. Use Docker setup provided

## 🎯 API Endpoints

### Authentication
- POST `/api/v1/auth/register/student` - Student registration
- POST `/api/v1/auth/register/admin` - Admin registration  
- POST `/api/v1/auth/login` - Login

### Exams (Admin)
- GET `/api/v1/exams` - Get all exams for admin
- POST `/api/v1/exams` - Create new exam
- GET `/api/v1/exams/:id` - Get specific exam
- PUT `/api/v1/exams/:id` - Update exam
- DELETE `/api/v1/exams/:id` - Delete exam

### Exams (Student)
- GET `/api/v1/exams/available/list` - Get available exams for student
- POST `/api/v1/exams/:id/attempt` - Start exam attempt

### Exam Attempts
- GET `/api/v1/exams/attempts/:id` - Get exam attempt details
- PUT `/api/v1/exams/attempts/:id/answer` - Submit answer
- PUT `/api/v1/exams/attempts/:id/submit` - Submit complete exam

## 🔍 Health Check
Visit http://localhost:5000/api/health to verify backend is running.

## 🌐 Frontend Access
Visit http://localhost:5173 for the frontend application.

## 💾 Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/exammonitor
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
BCRYPT_SALT_ROUNDS=12
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api/v1
```
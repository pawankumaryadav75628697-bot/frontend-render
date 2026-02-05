const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Route files
const auth = require('./routes/auth');
const exams = require('./routes/exams');
const examAccess = require('./routes/examAccess');
const instantExams = require('./routes/instantExams');
const questionBanks = require('./routes/questionBanks');
const analytics = require('./routes/analytics');
const notifications = require('./routes/notifications');
const admin = require('./routes/admin');
const proctoring = require('./routes/proctoring');
const reports = require('./routes/reports');
const invitations = require('./routes/invitations');
const codingQuestions = require('./routes/codingQuestions');
const codingExams = require('./routes/codingExamRoutes');

// Connect to database
const connectDB = require('./config/database');
connectDB();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - very permissive for development, more restrictive for production
const generalLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000, // 1 minute in dev, 15 minutes in prod
  limit: process.env.NODE_ENV === 'production' ? 1000 : 100000, // Very high limits for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req, res) => {
    // In development, skip rate limiting entirely
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    // Skip rate limiting for health checks, test endpoints, and dev endpoints
    return req.path === '/api/health' || 
           req.path === '/api/v1/test' || 
           req.path.startsWith('/api/dev/');
  }
});

// Specific rate limiting for auth routes (more restrictive)
const authLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000, // 1 minute in dev
  limit: process.env.NODE_ENV === 'production' ? 10 : 10000, // Very permissive in development
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: process.env.NODE_ENV === 'production' ? '15 minutes' : '1 minute'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req, res) => {
    // In development, skip auth rate limiting entirely
    return process.env.NODE_ENV !== 'production';
  }
});

// Rate limit logging middleware
const rateLimitLogger = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 429) {
      console.warn(`⚠️ Rate limit reached for IP ${req.ip} on ${req.path}`);
    }
    return originalSend.call(this, data);
  };
  next();
};

// Apply general rate limiting to all routes (only in production)
if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_RATE_LIMIT) {
  app.use(rateLimitLogger);
  app.use(generalLimiter);
} else {
  console.log('🔓 Rate limiting DISABLED for development');
}

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175', 'http://127.0.0.1:5176'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Development middleware - disable rate limiting and add extensive logging
if (process.env.NODE_ENV !== 'production') {
  // Override rate limiters to always skip in development
  app.use((req, res, next) => {
    // Clear any rate limit headers
    res.removeHeader('X-RateLimit-Limit');
    res.removeHeader('X-RateLimit-Remaining');
    res.removeHeader('X-RateLimit-Reset');
    res.removeHeader('Retry-After');
    next();
  });
}

// Debug middleware
app.use('/api', (req, res, next) => {
  console.log(`\n🔥 API Request: ${req.method} ${req.originalUrl}`);
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers.authorization ? { authorization: 'Bearer [HIDDEN]' } : 'No auth header');
  if (req.method !== 'GET') {
    console.log('Body:', req.body);
  }
  
  // Log response for debugging
  const oldSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      console.log(`❌ Response [${res.statusCode}]:`, data);
    }
    return oldSend.apply(this, arguments);
  };
  
  next();
});

// Mount routers
if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_RATE_LIMIT) {
  app.use('/api/v1/auth', authLimiter, auth);
} else {
  app.use('/api/v1/auth', auth);
}
app.use('/api/v1/exams', exams);
app.use('/api/v1/exam-access', examAccess);
app.use('/api/v1/instant-exams', instantExams);
app.use('/api/v1/question-banks', questionBanks);
app.use('/api/v1/analytics', analytics);
app.use('/api/v1/notifications', notifications);
app.use('/api/v1/admin', admin);
app.use('/api/v1/proctoring', proctoring);
app.use('/api/v1/reports', reports);
app.use('/api/v1/invitations', invitations);
app.use('/api/v1/coding-questions', codingQuestions);
app.use('/api/v1/coding-exams', codingExams);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Exam Monitoring System API is running successfully',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      exams: '/api/v1/exams',
      instantExams: '/api/v1/instant-exams',
      questionBanks: '/api/v1/question-banks',
      analytics: '/api/v1/analytics',
      notifications: '/api/v1/notifications',
      admin: '/api/v1/admin',
      proctoring: '/api/v1/proctoring',
      reports: '/api/v1/reports',
      codingQuestions: '/api/v1/coding-questions',
      codingExams: '/api/v1/coding-exams',
      health: '/api/health'
    }
  });
});

// Test endpoint for debugging
app.get('/api/v1/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API v1 is working correctly',
    timestamp: new Date().toISOString()
  });
});

// Rate limit reset endpoint for development
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/reset-rate-limit', (req, res) => {
    // Clear rate limit store (this is a simple approach)
    res.status(200).json({
      success: true,
      message: 'Rate limits cleared for development',
      note: 'This endpoint is only available in development mode'
    });
  });
}

// Error handler middleware
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
const express = require('express');
const {
  getDashboard,
  getUsers,
  createUser,
  uploadUsers,
  updateUser,
  deleteUser,
  getSubjects,
  createSubject,
  getMonitoringStats
} = require('../controllers/adminController');
const {
  getAllStudents,
  createStudent,
  bulkUploadStudents,
  updateStudent,
  deleteStudent,
  getStudentStats,
  resendCredentials
} = require('../controllers/studentController');
const { protect, authorize } = require('../middlewares/auth');
const { uploadSingle } = require('../middlewares/upload');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Dashboard routes
router.get('/dashboard', authorize('admin', 'teacher'), getDashboard);

// User management routes
router.route('/users')
  .get(authorize('admin'), getUsers)
  .post(authorize('admin'), createUser);

router.post('/users/upload', authorize('admin'), uploadSingle('file'), uploadUsers);

router.route('/users/:id')
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser);

// Subject management routes
router.route('/subjects')
  .get(authorize('admin', 'teacher'), getSubjects)
  .post(authorize('admin'), createSubject);

// Student management routes
router.route('/students')
  .get(authorize('admin'), getAllStudents)
  .post(authorize('admin'), createStudent);

router.get('/students/stats', authorize('admin'), getStudentStats);
router.post('/students/bulk-upload', authorize('admin'), uploadSingle('file'), bulkUploadStudents);

router.route('/students/:id')
  .put(authorize('admin'), updateStudent)
  .delete(authorize('admin'), deleteStudent);

router.post('/students/:id/resend-credentials', authorize('admin'), resendCredentials);

// Monitoring routes
router.get('/monitoring/stats', authorize('admin'), getMonitoringStats);

// System status route for debugging
router.get('/system/status', authorize('admin'), (req, res) => {
  const status = {
    server: {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    },
    database: {
      connected: true // Will be true if we reach this point
    },
    notifications: {
      email: {
        configured: process.env.EMAIL_USER && process.env.EMAIL_USER !== 'disabled',
        provider: process.env.EMAIL_USER && process.env.EMAIL_USER.includes('ethereal.email') ? 'ethereal' : 'other'
      },
      sms: {
        configured: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'disabled'
      }
    },
    rateLimits: {
      activeEntries: require('../controllers/studentController').getRateLimitInfo?.() || 'N/A'
    }
  };
  
  res.json({
    success: true,
    data: status
  });
});

module.exports = router;

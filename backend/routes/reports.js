const express = require('express');
const {
  generateExamReport,
  generateStudentReport,
  generateAnalyticsReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Report routes
router.get('/exam/:examId', authorize('admin', 'teacher'), generateExamReport);
router.get('/student/:studentId', authorize('admin', 'teacher', 'student'), generateStudentReport);
router.get('/analytics', authorize('admin'), generateAnalyticsReport);

module.exports = router;
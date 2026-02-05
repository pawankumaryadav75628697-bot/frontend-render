const express = require('express');
const {
  getDashboardAnalytics,
  getExamPerformanceAnalytics,
  getStudentPerformanceAnalytics,
  getComparativeAnalytics
} = require('../controllers/analyticsController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Dashboard analytics (admin/teacher only)
router.get('/dashboard', protect, authorize(['admin', 'teacher']), getDashboardAnalytics);

// Exam performance analytics (admin/teacher only)
router.get('/exam-performance', protect, authorize(['admin', 'teacher']), getExamPerformanceAnalytics);

// Student performance analytics (admin/teacher/own student data)
router.get('/student-performance/:studentId', protect, getStudentPerformanceAnalytics);

// Comparative analytics (admin/teacher only)
router.get('/comparative', protect, authorize(['admin', 'teacher']), getComparativeAnalytics);

module.exports = router;
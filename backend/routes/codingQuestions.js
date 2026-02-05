const express = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
  createCodingQuestion,
  getCodingQuestions,
  getCodingQuestion,
  updateCodingQuestion,
  deleteCodingQuestion,
  testCode,
  executeCode,
  getCodingQuestionStats,
  getEnvironmentStatus,
  publishCodingQuestion
} = require('../controllers/codingQuestionController');

const router = express.Router();

// Protect all routes
router.use(protect);

// Environment status (admin/teacher only)
router.get('/environment', authorize('admin', 'teacher'), getEnvironmentStatus);

// Execute arbitrary code (all authenticated users)
router.post('/execute', executeCode);

// Get all coding questions
router.get('/', getCodingQuestions);

// Create new coding question (admin/teacher only)
router.post('/', authorize('admin', 'teacher'), createCodingQuestion);

// Get single coding question
router.get('/:id', getCodingQuestion);

// Update coding question (admin/teacher only)
router.put('/:id', authorize('admin', 'teacher'), updateCodingQuestion);

// Delete coding question (admin/teacher only)
router.delete('/:id', authorize('admin', 'teacher'), deleteCodingQuestion);

// Test code against question test cases
router.post('/:id/test', testCode);

// Publish coding question (send notifications)
router.post('/:id/publish', authorize('admin', 'teacher'), publishCodingQuestion);

// Get coding question statistics (admin/teacher only)
router.get('/:id/stats', authorize('admin', 'teacher'), getCodingQuestionStats);

module.exports = router;
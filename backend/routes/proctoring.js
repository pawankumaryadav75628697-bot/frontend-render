const express = require('express');
const {
  initializeProctoringSession,
  analyzeVideoFrame,
  recordViolation,
  getSessionStatus,
  terminateProctoringSession,
  getAllProctoringSessions,
  getActiveSessions,
  installPythonDependencies,
  testAIService
} = require('../controllers/proctoringController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Student proctoring routes
router.post('/initialize', authorize('student'), initializeProctoringSession);
router.post('/analyze-frame', authorize('student'), analyzeVideoFrame);
router.post('/violation', authorize('student'), recordViolation);
router.post('/terminate', authorize('student'), terminateProctoringSession);
router.get('/session/:sessionId', getSessionStatus);

// Admin proctoring routes
router.get('/sessions', authorize('admin'), getAllProctoringSessions);
router.get('/active-sessions', authorize('admin'), getActiveSessions);
router.post('/install-dependencies', authorize('admin'), installPythonDependencies);
router.post('/test-ai', authorize('admin'), testAIService);

module.exports = router;
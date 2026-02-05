const express = require('express');
const {
  verifyExamKey,
  previewExam,
  submitExam,
  checkResults
} = require('../controllers/examAccessController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Public routes for exam access
router.get('/preview/:examKey', previewExam);
router.post('/verify-key', verifyExamKey);
router.post('/results', checkResults);

// Protected route for exam submission (requires exam access token)
router.post('/submit', protect, submitExam);

module.exports = router;
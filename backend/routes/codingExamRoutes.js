const express = require('express');
const {
  createCodingExam,
  publishCodingExam,
  getCodingExams,
  getCodingExam,
  startCodingExamAttempt,
  getCodingExamAttempt,
  updateAttemptCode,
  testAttemptCode,
  submitCodingExamAttempt,
  recordViolation,
  terminateExamAttempt
} = require('../controllers/codingExamController');

const { protect, authorize } = require('../middlewares/auth');
const router = express.Router();

// Coding Exam Management Routes
router.route('/')
  .get(protect, getCodingExams)
  .post(protect, authorize('admin', 'teacher'), createCodingExam);

router.route('/:id')
  .get(protect, getCodingExam);

router.route('/:id/publish')
  .put(protect, authorize('admin', 'teacher'), publishCodingExam);

// Student Exam Attempt Routes
router.route('/:id/start')
  .post(protect, authorize('student'), startCodingExamAttempt);

// Coding Exam Attempt Management Routes
router.route('/attempts/:id')
  .get(protect, getCodingExamAttempt);

router.route('/attempts/:id/code')
  .put(protect, authorize('student'), updateAttemptCode);

router.route('/attempts/:id/test')
  .post(protect, authorize('student'), testAttemptCode);

router.route('/attempts/:id/submit')
  .post(protect, authorize('student'), submitCodingExamAttempt);

// Proctoring Routes
router.route('/attempts/:id/violations')
  .post(protect, authorize('student'), recordViolation);

router.route('/attempts/:id/terminate')
  .post(protect, authorize('student'), terminateExamAttempt);

module.exports = router;
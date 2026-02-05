const express = require('express');
const { body } = require('express-validator');
const {
  createInstantExam,
  getInstantExams,
  getInstantExamById,
  getInstantExamByAccessCode,
  startInstantExamAttempt,
  submitInstantExamAnswer,
  submitInstantExam,
  getInstantExamSession,
  updateInstantExam,
  deleteInstantExam,
  regenerateAccessCode
} = require('../controllers/instantExamController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Validation rules for instant exam creation
const instantExamValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('examType')
    .isIn(['instant', 'adaptive', 'practice', 'mock', 'assessment'])
    .withMessage('Invalid exam type'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters'),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard', 'mixed', 'adaptive'])
    .withMessage('Invalid difficulty level'),
  
  body('questionCount')
    .isInt({ min: 1, max: 100 })
    .withMessage('Question count must be between 1 and 100'),
  
  body('duration')
    .isInt({ min: 1, max: 300 })
    .withMessage('Duration must be between 1 and 300 minutes'),
  
  body('generationRules.questionBankIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one question bank must be selected'),
  
  body('generationRules.difficultyDistribution.easy')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Easy difficulty percentage must be between 0 and 100'),
  
  body('generationRules.difficultyDistribution.medium')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Medium difficulty percentage must be between 0 and 100'),
  
  body('generationRules.difficultyDistribution.hard')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Hard difficulty percentage must be between 0 and 100'),
];

// Answer submission validation
const answerValidation = [
  body('questionId')
    .notEmpty()
    .withMessage('Question ID is required')
    .isMongoId()
    .withMessage('Invalid question ID'),
  
  body('selectedOption')
    .optional()
    .isMongoId()
    .withMessage('Invalid option ID'),
  
  body('textAnswer')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Text answer must not exceed 2000 characters'),
  
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive integer')
];

// Public routes
router.get('/access/:code', getInstantExamByAccessCode);

// Student routes
router.get('/available', protect, authorize('student'), getInstantExams);
router.post('/:id/start', protect, authorize('student'), startInstantExamAttempt);
router.put('/sessions/:sessionId/answer', protect, authorize('student'), answerValidation, submitInstantExamAnswer);
router.put('/sessions/:sessionId/submit', protect, authorize('student'), submitInstantExam);
router.get('/sessions/:sessionId', protect, getInstantExamSession);

// Admin/Teacher routes
router.post('/', protect, authorize(['admin', 'teacher']), instantExamValidation, createInstantExam);
router.get('/', protect, authorize(['admin', 'teacher']), getInstantExams);
router.get('/:id', protect, getInstantExamById);
router.put('/:id', protect, authorize(['admin', 'teacher']), updateInstantExam);
router.delete('/:id', protect, authorize(['admin', 'teacher']), deleteInstantExam);
router.post('/:id/regenerate-code', protect, authorize(['admin', 'teacher']), regenerateAccessCode);

module.exports = router;
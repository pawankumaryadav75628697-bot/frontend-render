const express = require('express');
const { body } = require('express-validator');
const {
  createQuestionBank,
  getQuestionBanks,
  getQuestionBankById,
  updateQuestionBank,
  deleteQuestionBank,
  getRandomQuestions,
  importQuestions,
  exportQuestions,
  getQuestionBankStats,
  searchQuestions
} = require('../controllers/questionBankController');

const { protect, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// Validation rules for question bank creation
const questionBankValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('category')
    .isIn([
      'Mathematics', 'Science', 'English', 'Computer Science', 
      'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 
      'General Knowledge', 'Aptitude', 'Reasoning', 'Other'
    ])
    .withMessage('Invalid category'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters'),
  
  body('subjectCode')
    .trim()
    .notEmpty()
    .withMessage('Subject code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Subject code must be between 2 and 20 characters'),
  
  body('difficulty')
    .isIn(['easy', 'medium', 'hard', 'expert'])
    .withMessage('Invalid difficulty level'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('questions')
    .optional()
    .isArray()
    .withMessage('Questions must be an array'),
  
  body('questions.*.questionText')
    .if(body('questions').exists())
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ min: 5 })
    .withMessage('Question text must be at least 5 characters'),
  
  body('questions.*.questionType')
    .if(body('questions').exists())
    .isIn(['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-in-blank', 'matching'])
    .withMessage('Invalid question type'),
  
  body('questions.*.points')
    .if(body('questions').exists())
    .isInt({ min: 1 })
    .withMessage('Question points must be a positive integer'),
  
  body('questions.*.difficulty')
    .if(body('questions').exists())
    .optional()
    .isIn(['easy', 'medium', 'hard', 'expert'])
    .withMessage('Invalid question difficulty'),
  
  body('questions.*.bloomsTaxonomy')
    .if(body('questions').exists())
    .optional()
    .isIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
    .withMessage('Invalid Bloom\'s taxonomy level')
];

// Routes
router.post('/', protect, authorize(['admin', 'teacher']), questionBankValidation, createQuestionBank);
router.get('/', protect, getQuestionBanks);
router.get('/:id', protect, getQuestionBankById);
router.put('/:id', protect, authorize(['admin', 'teacher']), updateQuestionBank);
router.delete('/:id', protect, authorize(['admin', 'teacher']), deleteQuestionBank);

// Question bank specific operations
router.get('/:id/random', protect, getRandomQuestions);
router.get('/:id/stats', protect, getQuestionBankStats);
router.get('/:id/search', protect, searchQuestions);
router.get('/:id/export', protect, exportQuestions);

// File operations
router.post('/:id/import', 
  protect, 
  authorize(['admin', 'teacher']), 
  upload.single('file'), 
  importQuestions
);

module.exports = router;
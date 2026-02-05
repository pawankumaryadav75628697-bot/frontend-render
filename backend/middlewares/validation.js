const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
const emailValidation = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email');

const passwordValidation = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters long');

const nameValidation = body('fullName')
  .trim()
  .isLength({ min: 2 })
  .withMessage('Name must be at least 2 characters long');

// Student registration validation
const validateStudentRegistration = [
  nameValidation,
  emailValidation,
  passwordValidation,
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required'),
  body('course')
    .notEmpty()
    .withMessage('Course is required'),
  body('semester')
    .notEmpty()
    .withMessage('Semester is required'),
  handleValidationErrors
];

// Admin registration validation
const validateAdminRegistration = [
  nameValidation,
  emailValidation,
  passwordValidation,
  body('institution')
    .notEmpty()
    .withMessage('Institution is required'),
  body('department')
    .notEmpty()
    .withMessage('Department is required'),
  body('employeeId')
    .notEmpty()
    .withMessage('Employee ID is required'),
  handleValidationErrors
];

// Login validation
const validateLogin = [
  emailValidation,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

module.exports = {
  validateStudentRegistration,
  validateAdminRegistration,
  validateLogin
};
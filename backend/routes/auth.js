const express = require('express');
const router = express.Router();
const {
  registerStudent,
  registerAdmin,
  login,
  getMe
} = require('../controllers/authController');
const {
  validateStudentRegistration,
  validateAdminRegistration,
  validateLogin
} = require('../middlewares/validation');
const { protect } = require('../middlewares/auth');

// Public routes
router.post('/register/student', validateStudentRegistration, registerStudent);
router.post('/register/admin', validateAdminRegistration, registerAdmin);
router.post('/login', validateLogin, login);

// Protected route
router.get('/me', protect, getMe);

module.exports = router;
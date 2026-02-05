const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Register student
const registerStudent = async (req, res, next) => {
  try {
    const { fullName, email, password, studentId, course, semester } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { studentId }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or student ID'
      });
    }

    // Create user
    const user = await User.create({
      userType: 'student',
      fullName,
      email,
      password,
      studentId,
      course,
      semester
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      token,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Register admin
const registerAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, institution, department, employeeId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { employeeId }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or employee ID'
      });
    }

    // Create user
    const user = await User.create({
      userType: 'admin',
      fullName,
      email,
      password,
      institution,
      department,
      employeeId
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      token,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists (include password field)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerStudent,
  registerAdmin,
  login,
  getMe
};
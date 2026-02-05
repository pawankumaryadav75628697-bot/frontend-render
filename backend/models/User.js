const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    required: true,
    enum: ['student', 'teacher', 'admin']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  // Student specific fields
  studentId: {
    type: String,
    sparse: true,
    unique: true
  },
  rollNumber: {
    type: String,
    sparse: true
  },
  course: {
    type: String,
    sparse: true
  },
  semester: {
    type: Number,
    sparse: true,
    min: 1,
    max: 8
  },
  batch: {
    type: String,
    sparse: true
  },
  // Teacher/Admin specific fields
  institution: {
    type: String,
    sparse: true
  },
  college: {
    type: String,
    sparse: true
  },
  department: {
    type: String,
    sparse: true
  },
  employeeId: {
    type: String,
    sparse: true
  },
  designation: {
    type: String,
    sparse: true
  },
  // Common fields
  phoneNumber: {
    type: String,
    sparse: true,
    match: [/^\d{10}$/, 'Please add a valid 10-digit phone number']
  },
  profilePicture: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  examAttempts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt'
  }],
  createdExams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerificationExpire: Date
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });

// Generate unique student ID for new students
userSchema.pre('save', function(next) {
  if (this.userType === 'student' && this.isNew && !this.studentId) {
    this.studentId = `STU${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ 
    id: this._id, 
    userType: this.userType,
    email: this.email 
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Generate unique exam access token for student
userSchema.methods.generateExamAccessToken = function(examId) {
  const payload = {
    userId: this._id,
    examId: examId,
    userType: this.userType,
    timestamp: Date.now()
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Generate reset password token
userSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpire;
  return user;
};

module.exports = mongoose.model('User', userSchema);
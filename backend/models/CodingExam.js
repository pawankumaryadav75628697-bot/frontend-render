const mongoose = require('mongoose');

const codingExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  examKey: {
    type: String,
    unique: true,
    uppercase: true,
    minlength: 6,
    maxlength: 8,
    sparse: true
  },
  course: {
    type: String,
    required: true,
    trim: true
  },
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Coding-specific fields
  codingQuestion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingQuestion',
    required: true
  },
  
  settings: {
    duration: {
      type: Number, // Duration in minutes
      required: true,
      min: 1,
      default: 60
    },
    totalPoints: {
      type: Number,
      min: 1,
      default: 100
    },
    passingScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 60
    },
    allowedLanguages: [{
      type: String,
      enum: ['c', 'cpp', 'python', 'java']
    }],
    showResultsImmediately: {
      type: Boolean,
      default: false
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: 1
    },
    autoSubmit: {
      type: Boolean,
      default: true
    }
  },
  
  scheduling: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    timeZone: {
      type: String,
      default: 'UTC'
    }
  },
  
  eligibleStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  status: {
    type: String,
    enum: ['draft', 'published', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  proctoring: {
    enabled: {
      type: Boolean,
      default: true
    },
    cameraRequired: {
      type: Boolean,
      default: true
    },
    microphoneRequired: {
      type: Boolean,
      default: false
    },
    screenRecording: {
      type: Boolean,
      default: true
    },
    lockdownBrowser: {
      type: Boolean,
      default: false
    }
  },
  
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    completedAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    },
    averageTime: {
      type: Number, // in minutes
      default: 0
    },
    languageUsage: [{
      language: String,
      count: Number
    }]
  },
  
  // Auto-generated fields
  examType: {
    type: String,
    default: 'coding',
    immutable: true
  }
  
}, {
  timestamps: true
});

// Indexes for better query performance
codingExamSchema.index({ instructor: 1, status: 1 });
codingExamSchema.index({ status: 1, 'scheduling.startDate': 1 });
codingExamSchema.index({ examKey: 1 });
codingExamSchema.index({ eligibleStudents: 1, status: 1 });

// Pre-save middleware to generate exam key
codingExamSchema.pre('save', function(next) {
  if (!this.examKey) {
    // Generate a unique exam key
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    this.examKey = result;
  }
  next();
});

// Virtual to check if exam is currently active
codingExamSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.scheduling.startDate && 
         now <= this.scheduling.endDate;
});

// Virtual to check if exam is upcoming
codingExamSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  return this.status === 'published' && now < this.scheduling.startDate;
});

// Virtual to check if exam has ended
codingExamSchema.virtual('hasEnded').get(function() {
  const now = new Date();
  return now > this.scheduling.endDate;
});

// Method to check if student is eligible
codingExamSchema.methods.isStudentEligible = function(studentId) {
  return this.eligibleStudents.includes(studentId) || this.eligibleStudents.length === 0;
};

// Method to update analytics
codingExamSchema.methods.updateAnalytics = async function() {
  const CodingExamAttempt = mongoose.model('CodingExamAttempt');
  
  const attempts = await CodingExamAttempt.find({ 
    codingExam: this._id,
    status: { $in: ['completed', 'submitted'] }
  });
  
  if (attempts.length > 0) {
    this.analytics.completedAttempts = attempts.length;
    this.analytics.averageScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length;
    this.analytics.passRate = (attempts.filter(attempt => 
      (attempt.score / this.settings.totalPoints) * 100 >= this.settings.passingScore
    ).length / attempts.length) * 100;
    this.analytics.averageTime = attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0) / attempts.length / 60;
    
    // Language usage statistics
    const languageStats = {};
    attempts.forEach(attempt => {
      if (attempt.programmingLanguage) {
        languageStats[attempt.programmingLanguage] = (languageStats[attempt.programmingLanguage] || 0) + 1;
      }
    });
    
    this.analytics.languageUsage = Object.entries(languageStats).map(([language, count]) => ({
      language,
      count
    }));
  }
  
  await this.save();
};

// Static method to get active coding exams for a student
codingExamSchema.statics.getActiveExamsForStudent = function(studentId) {
  const now = new Date();
  return this.find({
    status: { $in: ['active', 'published'] },
    'scheduling.startDate': { $lte: now },
    'scheduling.endDate': { $gte: now },
    $or: [
      { eligibleStudents: studentId },
      { eligibleStudents: { $size: 0 } }
    ]
  }).populate('codingQuestion', 'title difficulty category totalPoints')
   .populate('instructor', 'fullName');
};

// Static method to get upcoming coding exams for a student
codingExamSchema.statics.getUpcomingExamsForStudent = function(studentId) {
  const now = new Date();
  return this.find({
    status: 'published',
    'scheduling.startDate': { $gt: now },
    $or: [
      { eligibleStudents: studentId },
      { eligibleStudents: { $size: 0 } }
    ]
  }).populate('codingQuestion', 'title difficulty category totalPoints')
   .populate('instructor', 'fullName')
   .sort({ 'scheduling.startDate': 1 });
};

module.exports = mongoose.model('CodingExam', codingExamSchema);
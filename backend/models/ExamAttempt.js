const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  selectedOption: {
    type: mongoose.Schema.Types.ObjectId, // For multiple choice questions
  },
  textAnswer: {
    type: String, // For short answer questions
    trim: true
  },
  codeAnswer: {
    type: String, // For coding questions
    trim: true
  },
  programmingLanguage: {
    type: String, // Programming language used for coding questions
    enum: ['c', 'cpp', 'python', 'java'],
    trim: true
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  pointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  timeSpent: {
    type: Number, // Time spent on this question in seconds
    default: 0,
    min: 0
  },
  flagged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const proctorEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: [
      'tab_switch',
      'window_blur',
      'copy_paste',
      'right_click',
      'full_screen_exit',
      'camera_disabled',
      'microphone_disabled',
      'multiple_faces',
      'no_face_detected',
      'suspicious_noise',
      'screen_share_detected'
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
});

const examAttemptSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'submitted', 'timed_out', 'cancelled', 'under_review'],
    default: 'in_progress'
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  timeSpent: {
    type: Number, // Total time spent in seconds
    default: 0
  },
  answers: [answerSchema],
  score: {
    raw: {
      type: Number,
      default: 0,
      min: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'],
      default: 'F'
    }
  },
  passed: {
    type: Boolean,
    default: false
  },
  // Proctoring data
  proctoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    events: [proctorEventSchema],
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    flaggedForReview: {
      type: Boolean,
      default: false
    },
    reviewNotes: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    }
  },
  // Browser and system information
  systemInfo: {
    browser: {
      name: String,
      version: String
    },
    os: {
      name: String,
      version: String
    },
    screenResolution: {
      width: Number,
      height: Number
    },
    ipAddress: String,
    userAgent: String
  },
  // Auto-save data
  autoSaveData: {
    lastSaved: {
      type: Date,
      default: Date.now
    },
    saveCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
examAttemptSchema.index({ exam: 1, student: 1 });
examAttemptSchema.index({ student: 1, status: 1 });
examAttemptSchema.index({ exam: 1, status: 1 });
examAttemptSchema.index({ startTime: 1 });
examAttemptSchema.index({ 'proctoring.flaggedForReview': 1 });

// Calculate score before saving
examAttemptSchema.pre('save', function(next) {
  if (this.answers && this.answers.length > 0) {
    // Calculate raw score
    this.score.raw = this.answers.reduce((total, answer) => total + answer.pointsEarned, 0);
    
    // Calculate percentage (will need total points from exam)
    // This will be calculated properly in the controller when we have exam data
  }
  next();
});

// Method to calculate percentage score
examAttemptSchema.methods.calculatePercentageScore = function(totalPoints) {
  if (totalPoints > 0) {
    this.score.percentage = Math.round((this.score.raw / totalPoints) * 100);
  } else {
    this.score.percentage = 0;
  }
};

// Method to assign grade based on percentage
examAttemptSchema.methods.assignGrade = function() {
  const percentage = this.score.percentage;
  
  if (percentage >= 97) this.score.grade = 'A+';
  else if (percentage >= 93) this.score.grade = 'A';
  else if (percentage >= 90) this.score.grade = 'A-';
  else if (percentage >= 87) this.score.grade = 'B+';
  else if (percentage >= 83) this.score.grade = 'B';
  else if (percentage >= 80) this.score.grade = 'B-';
  else if (percentage >= 77) this.score.grade = 'C+';
  else if (percentage >= 73) this.score.grade = 'C';
  else if (percentage >= 70) this.score.grade = 'C-';
  else if (percentage >= 67) this.score.grade = 'D+';
  else if (percentage >= 60) this.score.grade = 'D';
  else this.score.grade = 'F';
};

// Method to check if attempt passed
examAttemptSchema.methods.checkPassed = function(passingScore) {
  this.passed = this.score.percentage >= passingScore;
};

// Method to calculate risk score based on proctoring events
examAttemptSchema.methods.calculateRiskScore = function() {
  if (!this.proctoring.enabled || this.proctoring.events.length === 0) {
    this.proctoring.riskScore = 0;
    return;
  }

  let totalRisk = 0;
  const eventWeights = {
    'tab_switch': 10,
    'window_blur': 8,
    'copy_paste': 15,
    'right_click': 5,
    'full_screen_exit': 12,
    'camera_disabled': 20,
    'microphone_disabled': 15,
    'multiple_faces': 18,
    'no_face_detected': 16,
    'suspicious_noise': 10,
    'screen_share_detected': 25
  };

  this.proctoring.events.forEach(event => {
    const weight = eventWeights[event.eventType] || 5;
    totalRisk += weight;
  });

  // Cap at 100 and normalize based on exam duration
  this.proctoring.riskScore = Math.min(100, totalRisk);
  
  // Flag for review if risk score is high
  if (this.proctoring.riskScore >= 50) {
    this.proctoring.flaggedForReview = true;
  }
};

// Virtual to get formatted time spent
examAttemptSchema.virtual('formattedTimeSpent').get(function() {
  const hours = Math.floor(this.timeSpent / 3600);
  const minutes = Math.floor((this.timeSpent % 3600) / 60);
  const seconds = this.timeSpent % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Static method to get attempt summary for a student
examAttemptSchema.statics.getStudentSummary = function(studentId, examId = null) {
  const match = { student: studentId };
  if (examId) match.exam = examId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$student',
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        averageScore: { $avg: '$score.percentage' },
        highestScore: { $max: '$score.percentage' },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);
};

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
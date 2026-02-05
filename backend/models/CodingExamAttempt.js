const mongoose = require('mongoose');

const codingExamAttemptSchema = new mongoose.Schema({
  codingExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingExam',
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
  
  // Code submission
  submittedCode: {
    type: String,
    required: true
  },
  programmingLanguage: {
    type: String,
    required: true,
    enum: ['c', 'cpp', 'python', 'java']
  },
  
  // Test results
  testResults: {
    totalTests: {
      type: Number,
      default: 0
    },
    passedTests: {
      type: Number,
      default: 0
    },
    failedTests: {
      type: Number,
      default: 0
    },
    testCases: [{
      input: String,
      expectedOutput: String,
      actualOutput: String,
      passed: Boolean,
      executionTime: Number, // in milliseconds
      memoryUsage: Number, // in MB
      error: String
    }],
    compilationError: {
      type: String,
      default: null
    },
    runtimeErrors: [String]
  },
  
  // Scoring
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Timing
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  timeSpent: {
    type: Number, // Total time spent in seconds
    default: 0
  },
  timeLimit: {
    type: Number, // Time limit in minutes
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'submitted', 'timed_out', 'cancelled'],
    default: 'in_progress'
  },
  
  // Code execution metrics
  executionMetrics: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    averageExecutionTime: {
      type: Number,
      default: 0
    },
    peakMemoryUsage: {
      type: Number,
      default: 0
    }
  },
  
  // Proctoring data (if enabled)
  proctoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    violations: [{
      type: String,
      timestamp: Date,
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      }
    }],
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
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
  
  // Additional metadata
  metadata: {
    codeChanges: {
      type: Number,
      default: 0
    },
    lastSaved: {
      type: Date,
      default: Date.now
    },
    saveCount: {
      type: Number,
      default: 0
    },
    languageChanged: {
      type: Boolean,
      default: false
    }
  }
  
}, {
  timestamps: true
});

// Indexes for better query performance
codingExamAttemptSchema.index({ codingExam: 1, student: 1 });
codingExamAttemptSchema.index({ student: 1, status: 1 });
codingExamAttemptSchema.index({ codingExam: 1, status: 1 });
codingExamAttemptSchema.index({ startedAt: 1 });
codingExamAttemptSchema.index({ submittedAt: 1 });

// Pre-save middleware to calculate percentage and time spent
codingExamAttemptSchema.pre('save', function(next) {
  // Calculate percentage
  if (this.maxScore > 0) {
    this.percentage = Math.round((this.score / this.maxScore) * 100);
  }
  
  // Calculate time spent if ended
  if (this.endedAt && this.startedAt) {
    this.timeSpent = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  
  next();
});

// Virtual to get formatted time spent
codingExamAttemptSchema.virtual('formattedTimeSpent').get(function() {
  const totalSeconds = this.timeSpent;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual to check if attempt is overdue
codingExamAttemptSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'in_progress') return false;
  
  const now = new Date();
  const timeLimit = this.timeLimit * 60 * 1000; // Convert to milliseconds
  const deadline = new Date(this.startedAt.getTime() + timeLimit);
  
  return now > deadline;
});

// Method to calculate score based on test results
codingExamAttemptSchema.methods.calculateScore = function() {
  if (!this.testResults || this.testResults.totalTests === 0) {
    this.score = 0;
    return;
  }
  
  const passRate = this.testResults.passedTests / this.testResults.totalTests;
  this.score = Math.round(this.maxScore * passRate);
  
  // Bonus for clean compilation (no warnings)
  if (!this.testResults.compilationError && this.testResults.runtimeErrors.length === 0) {
    this.score = Math.min(this.maxScore, this.score + Math.round(this.maxScore * 0.05)); // 5% bonus
  }
};

// Method to submit attempt
codingExamAttemptSchema.methods.submit = function() {
  this.status = 'submitted';
  this.submittedAt = new Date();
  this.endedAt = new Date();
  
  // Calculate final score
  this.calculateScore();
  
  return this.save();
};

// Method to auto-submit on timeout
codingExamAttemptSchema.methods.autoSubmit = function() {
  this.status = 'timed_out';
  this.submittedAt = new Date();
  this.endedAt = new Date();
  
  // Calculate score with penalty for timeout
  this.calculateScore();
  this.score = Math.round(this.score * 0.9); // 10% penalty for timeout
  
  return this.save();
};

// Method to update execution metrics
codingExamAttemptSchema.methods.updateExecutionMetrics = function(executionTime, memoryUsage, success = true) {
  this.executionMetrics.totalExecutions += 1;
  
  if (success) {
    this.executionMetrics.successfulExecutions += 1;
  }
  
  // Update average execution time
  const totalTime = this.executionMetrics.averageExecutionTime * (this.executionMetrics.totalExecutions - 1) + executionTime;
  this.executionMetrics.averageExecutionTime = totalTime / this.executionMetrics.totalExecutions;
  
  // Update peak memory usage
  if (memoryUsage > this.executionMetrics.peakMemoryUsage) {
    this.executionMetrics.peakMemoryUsage = memoryUsage;
  }
};

// Static method to get student's attempt for a coding exam
codingExamAttemptSchema.statics.getStudentAttempt = function(studentId, codingExamId) {
  return this.findOne({
    student: studentId,
    codingExam: codingExamId,
    status: 'in_progress'
  }).populate('codingExam', 'title settings scheduling')
   .populate('student', 'fullName studentId');
};

// Static method to get completed attempts for analytics
codingExamAttemptSchema.statics.getCompletedAttempts = function(codingExamId) {
  return this.find({
    codingExam: codingExamId,
    status: { $in: ['completed', 'submitted', 'timed_out'] }
  }).populate('student', 'fullName studentId')
   .sort({ submittedAt: -1 });
};

module.exports = mongoose.model('CodingExamAttempt', codingExamAttemptSchema);
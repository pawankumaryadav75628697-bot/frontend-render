const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'examType'
  },
  examType: {
    type: String,
    required: true,
    enum: ['Exam', 'InstantExam']
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  status: {
    type: String,
    enum: ['started', 'in-progress', 'paused', 'submitted', 'terminated', 'expired'],
    default: 'started'
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  timeElapsed: {
    type: Number, // in seconds
    default: 0
  },
  remainingTime: {
    type: Number, // in seconds
    required: true
  },
  // Student's answers
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    questionType: {
      type: String,
      required: true,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-in-blank', 'matching']
    },
    selectedOption: {
      type: mongoose.Schema.Types.ObjectId
    },
    textAnswer: {
      type: String,
      trim: true
    },
    isCorrect: {
      type: Boolean
    },
    points: {
      type: Number,
      default: 0
    },
    timeSpent: {
      type: Number, // in seconds
      default: 0
    },
    answeredAt: {
      type: Date,
      default: Date.now
    },
    isReviewed: {
      type: Boolean,
      default: false
    },
    changeHistory: [{
      previousAnswer: {
        selectedOption: mongoose.Schema.Types.ObjectId,
        textAnswer: String
      },
      newAnswer: {
        selectedOption: mongoose.Schema.Types.ObjectId,
        textAnswer: String
      },
      changedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  // Current question tracking
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  questionsAttempted: {
    type: Number,
    default: 0
  },
  questionsCorrect: {
    type: Number,
    default: 0
  },
  // Proctoring and monitoring data
  proctoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    violations: [{
      type: {
        type: String,
        enum: [
          'tab_switch', 'window_blur', 'copy_paste', 'right_click', 
          'full_screen_exit', 'multiple_faces', 'no_face_detected',
          'suspicious_movement', 'unauthorized_device', 'browser_dev_tools',
          'screenshot_attempt', 'recording_software_detected'
        ]
      },
      description: {
        type: String,
        required: true
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      evidence: {
        screenshot: String, // Base64 or URL
        additionalData: mongoose.Schema.Types.Mixed
      },
      autoDetected: {
        type: Boolean,
        default: true
      }
    }],
    totalViolations: {
      type: Number,
      default: 0
    },
    maxViolationsAllowed: {
      type: Number,
      default: 5
    },
    isTerminatedDueToViolations: {
      type: Boolean,
      default: false
    }
  },
  // Browser and device information
  deviceInfo: {
    userAgent: String,
    browserName: String,
    browserVersion: String,
    operatingSystem: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'laptop', 'tablet', 'mobile']
    },
    screenResolution: {
      width: Number,
      height: Number
    },
    ipAddress: String,
    fingerprint: String, // Device fingerprint
    timezone: String,
    language: String
  },
  // Face recognition data
  faceRecognition: {
    enabled: {
      type: Boolean,
      default: false
    },
    referenceImage: String, // Base64 encoded reference image
    snapshots: [{
      image: String, // Base64 encoded snapshot
      timestamp: {
        type: Date,
        default: Date.now
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      facesDetected: {
        type: Number,
        default: 1
      },
      isMatch: {
        type: Boolean,
        default: true
      }
    }],
    totalSnapshots: {
      type: Number,
      default: 0
    },
    failedMatches: {
      type: Number,
      default: 0
    }
  },
  // Audio/Video monitoring
  audioVideo: {
    cameraEnabled: {
      type: Boolean,
      default: false
    },
    microphoneEnabled: {
      type: Boolean,
      default: false
    },
    recordingUrl: String, // URL to recorded session
    audioAnalysis: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      soundLevel: Number, // dB level
      speechDetected: Boolean,
      anomalyScore: Number // AI-based anomaly detection score
    }]
  },
  // Performance metrics
  performance: {
    averageAnswerTime: {
      type: Number,
      default: 0 // in seconds
    },
    questionTimeBreakdown: [{
      questionId: mongoose.Schema.Types.ObjectId,
      timeSpent: Number, // in seconds
      difficulty: String
    }],
    patternAnalysis: {
      rapidAnswering: {
        detected: Boolean,
        threshold: Number, // seconds
        instances: Number
      },
      unusualPatterns: [{
        type: String,
        description: String,
        severity: String,
        timestamp: Date
      }]
    }
  },
  // Adaptive exam specific data
  adaptiveData: {
    currentAbilityEstimate: {
      type: Number,
      default: 0
    },
    standardError: {
      type: Number,
      default: 1
    },
    questionHistory: [{
      questionId: mongoose.Schema.Types.ObjectId,
      difficulty: Number, // IRT difficulty parameter
      discrimination: Number, // IRT discrimination parameter
      isCorrect: Boolean,
      abilityBeforeQuestion: Number,
      abilityAfterQuestion: Number,
      standardErrorAfterQuestion: Number
    }],
    terminationReason: {
      type: String,
      enum: ['max_questions', 'standard_error', 'confidence_level', 'time_limit']
    },
    finalAbilityEstimate: Number,
    finalStandardError: Number
  },
  // Scoring and results
  scoring: {
    totalPoints: {
      type: Number,
      default: 0
    },
    maxPossiblePoints: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
    },
    isPassed: {
      type: Boolean,
      default: false
    },
    negativeMarking: {
      enabled: Boolean,
      penalty: Number,
      pointsDeducted: Number
    }
  },
  // Security measures
  security: {
    encryptedData: String, // Encrypted session data
    checksum: String, // Data integrity check
    lastSecurityCheck: {
      type: Date,
      default: Date.now
    },
    suspiciousActivity: [{
      type: String,
      description: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }]
  },
  // Analytics data
  analytics: {
    clickStream: [{
      element: String,
      action: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      coordinates: {
        x: Number,
        y: Number
      }
    }],
    keystrokes: [{
      key: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      context: String // which input field
    }],
    scrollBehavior: [{
      direction: String,
      distance: Number,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    focusEvents: [{
      event: {
        type: String,
        enum: ['focus', 'blur']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      duration: Number // for blur events
    }]
  },
  // Feedback and notes
  feedback: {
    studentFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String,
      technicalIssues: String,
      suggestions: String
    },
    proctorNotes: [{
      note: String,
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      category: {
        type: String,
        enum: ['violation', 'technical', 'observation', 'other']
      }
    }],
    autoGeneratedInsights: [{
      insight: String,
      confidence: Number,
      category: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  }
}, {
  timestamps: true
});

// Indexes for better performance
examSessionSchema.index({ examId: 1, studentId: 1 });
examSessionSchema.index({ sessionId: 1 });
examSessionSchema.index({ status: 1 });
examSessionSchema.index({ startTime: 1 });
examSessionSchema.index({ 'deviceInfo.ipAddress': 1 });

// Update last activity on save
examSessionSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  
  // Calculate time elapsed
  if (this.startTime) {
    this.timeElapsed = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
  
  // Calculate remaining time
  if (this.examType === 'Exam' || this.examType === 'InstantExam') {
    // This would need to be populated from the actual exam duration
    // this.remainingTime = examDuration - this.timeElapsed;
  }
  
  next();
});

// Method to add a violation
examSessionSchema.methods.addViolation = function(type, description, severity = 'medium', evidence = null) {
  const violation = {
    type,
    description,
    severity,
    timestamp: new Date(),
    evidence,
    autoDetected: true
  };
  
  this.proctoring.violations.push(violation);
  this.proctoring.totalViolations += 1;
  
  // Check if session should be terminated due to violations
  if (this.proctoring.totalViolations >= this.proctoring.maxViolationsAllowed) {
    this.status = 'terminated';
    this.proctoring.isTerminatedDueToViolations = true;
    this.endTime = new Date();
  }
  
  return this.save();
};

// Method to submit an answer
examSessionSchema.methods.submitAnswer = function(questionId, answer, questionType) {
  const existingAnswerIndex = this.answers.findIndex(a => a.questionId.toString() === questionId.toString());
  
  const answerData = {
    questionId,
    questionType,
    answeredAt: new Date()
  };
  
  if (questionType === 'multiple-choice' || questionType === 'true-false') {
    answerData.selectedOption = answer.selectedOption;
  } else {
    answerData.textAnswer = answer.textAnswer;
  }
  
  if (existingAnswerIndex >= 0) {
    // Update existing answer and track changes
    const existingAnswer = this.answers[existingAnswerIndex];
    existingAnswer.changeHistory.push({
      previousAnswer: {
        selectedOption: existingAnswer.selectedOption,
        textAnswer: existingAnswer.textAnswer
      },
      newAnswer: {
        selectedOption: answerData.selectedOption,
        textAnswer: answerData.textAnswer
      },
      changedAt: new Date()
    });
    
    // Update the answer
    Object.assign(existingAnswer, answerData);
  } else {
    // New answer
    this.answers.push(answerData);
    this.questionsAttempted += 1;
  }
  
  return this.save();
};

// Method to calculate final score
examSessionSchema.methods.calculateScore = async function() {
  // This would need access to the exam questions to calculate scoring
  // Implementation would depend on exam type (regular vs instant vs adaptive)
  let totalPoints = 0;
  let maxPoints = 0;
  let correctAnswers = 0;
  
  // Calculate based on answers
  this.answers.forEach(answer => {
    if (answer.isCorrect) {
      totalPoints += answer.points || 0;
      correctAnswers += 1;
    }
    maxPoints += answer.points || 0;
  });
  
  // Apply negative marking if enabled
  if (this.scoring.negativeMarking?.enabled) {
    const incorrectAnswers = this.answers.length - correctAnswers;
    const penalty = incorrectAnswers * (this.scoring.negativeMarking.penalty || 0);
    totalPoints = Math.max(0, totalPoints - penalty);
    this.scoring.negativeMarking.pointsDeducted = penalty;
  }
  
  this.scoring.totalPoints = totalPoints;
  this.scoring.maxPossiblePoints = maxPoints;
  this.scoring.percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
  this.questionsCorrect = correctAnswers;
  
  // Determine grade and pass/fail
  const percentage = this.scoring.percentage;
  if (percentage >= 95) this.scoring.grade = 'A+';
  else if (percentage >= 90) this.scoring.grade = 'A';
  else if (percentage >= 85) this.scoring.grade = 'B+';
  else if (percentage >= 80) this.scoring.grade = 'B';
  else if (percentage >= 75) this.scoring.grade = 'C+';
  else if (percentage >= 70) this.scoring.grade = 'C';
  else if (percentage >= 60) this.scoring.grade = 'D';
  else this.scoring.grade = 'F';
  
  // This would need to check against exam passing criteria
  this.scoring.isPassed = percentage >= 60; // Default passing score
  
  return this.save();
};

// Method to detect suspicious patterns
examSessionSchema.methods.analyzePatterns = function() {
  const insights = [];
  
  // Analyze answer timing patterns
  const answerTimes = this.answers.map(a => a.timeSpent).filter(t => t > 0);
  if (answerTimes.length > 3) {
    const avgTime = answerTimes.reduce((sum, time) => sum + time, 0) / answerTimes.length;
    const rapidAnswers = answerTimes.filter(time => time < avgTime * 0.3).length;
    
    if (rapidAnswers > answerTimes.length * 0.4) {
      insights.push({
        insight: 'Potential rapid answering pattern detected',
        confidence: 0.8,
        category: 'behavior',
        timestamp: new Date()
      });
    }
  }
  
  // Analyze violation patterns
  if (this.proctoring.violations.length > 0) {
    const violationTypes = {};
    this.proctoring.violations.forEach(v => {
      violationTypes[v.type] = (violationTypes[v.type] || 0) + 1;
    });
    
    Object.keys(violationTypes).forEach(type => {
      if (violationTypes[type] > 2) {
        insights.push({
          insight: `Repeated ${type.replace('_', ' ')} violations detected`,
          confidence: 0.9,
          category: 'security',
          timestamp: new Date()
        });
      }
    });
  }
  
  this.feedback.autoGeneratedInsights = insights;
  return this.save();
};

// Virtual for session duration
examSessionSchema.virtual('duration').get(function() {
  if (this.endTime && this.startTime) {
    return Math.floor((this.endTime - this.startTime) / 1000); // in seconds
  }
  return 0;
});

// Virtual for completion percentage
examSessionSchema.virtual('completionPercentage').get(function() {
  if (!this.maxQuestions) return 0;
  return Math.round((this.questionsAttempted / this.maxQuestions) * 100);
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
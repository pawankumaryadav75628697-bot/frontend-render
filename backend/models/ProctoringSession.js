const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'face_not_detected',
      'multiple_faces',
      'looking_away',
      'suspicious_eye_movement',
      'tab_switch',
      'window_focus_lost',
      'full_screen_exit',
      'unauthorized_device',
      'audio_detection',
      'screen_share_detected'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  metadata: {
    faceBounds: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    eyePositions: {
      leftEye: { x: Number, y: Number },
      rightEye: { x: Number, y: Number }
    },
    gazeDirection: {
      x: Number,
      y: Number,
      z: Number
    },
    additionalData: mongoose.Schema.Types.Mixed
  },
  warningIssued: {
    type: Boolean,
    default: false
  },
  warningNumber: {
    type: Number,
    min: 0,
    max: 4
  }
}, {
  timestamps: true
});

const proctoringSessionSchema = new mongoose.Schema({
  // Basic session info
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  codingExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingExam'
  },
  examAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt'
  },
  codingExamAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingExamAttempt'
  },

  // Session status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'terminated', 'failed'],
    default: 'active'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },

  // Proctoring settings
  settings: {
    faceDetectionEnabled: {
      type: Boolean,
      default: true
    },
    eyeTrackingEnabled: {
      type: Boolean,
      default: true
    },
    tabSwitchMonitoring: {
      type: Boolean,
      default: true
    },
    audioMonitoring: {
      type: Boolean,
      default: false
    },
    screenRecording: {
      type: Boolean,
      default: false
    },
    strictMode: {
      type: Boolean,
      default: true
    }
  },

  // Violation tracking
  violations: [violationSchema],
  warningCount: {
    type: Number,
    default: 0,
    max: 3
  },
  terminated: {
    type: Boolean,
    default: false
  },
  terminationReason: {
    type: String
  },
  terminationTime: {
    type: Date
  },

  // AI Analysis results
  aiAnalysis: {
    faceDetectionAccuracy: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    averageEyeGazeScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    suspiciousActivityScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    overallTrustScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    totalFramesAnalyzed: {
      type: Number,
      default: 0
    },
    validFrames: {
      type: Number,
      default: 0
    }
  },

  // System information
  systemInfo: {
    browser: String,
    os: String,
    screenResolution: {
      width: Number,
      height: Number
    },
    cameraResolution: {
      width: Number,
      height: Number
    },
    ipAddress: String,
    userAgent: String
  },

  // Technical data
  technicalMetrics: {
    frameRate: {
      type: Number,
      default: 0
    },
    averageProcessingTime: {
      type: Number,
      default: 0
    },
    networkLatency: {
      type: Number,
      default: 0
    },
    errors: [{
      timestamp: Date,
      error: String,
      context: String
    }]
  }
}, {
  timestamps: true
});

// Indexes for better query performance
proctoringSessionSchema.index({ student: 1, status: 1 });
proctoringSessionSchema.index({ exam: 1, codingExam: 1 });
proctoringSessionSchema.index({ startTime: -1 });
proctoringSessionSchema.index({ 'violations.type': 1, 'violations.timestamp': -1 });

// Middleware to calculate duration on save
proctoringSessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Method to add violation
proctoringSessionSchema.methods.addViolation = function(violationData) {
  const violation = {
    ...violationData,
    timestamp: new Date()
  };
  
  this.violations.push(violation);
  
  // Check if warning should be issued
  const highSeverityCount = this.violations.filter(v => 
    ['high', 'critical'].includes(v.severity)
  ).length;
  
  const mediumSeverityCount = this.violations.filter(v => 
    v.severity === 'medium'
  ).length;
  
  const shouldWarn = highSeverityCount >= 1 || mediumSeverityCount >= 2;
  
  if (shouldWarn && this.warningCount < 3) {
    this.warningCount += 1;
    violation.warningIssued = true;
    violation.warningNumber = this.warningCount;
  }
  
  // Terminate if 4th violation (3 warnings + 1 more violation)
  if (this.warningCount >= 3 && this.violations.length > this.warningCount) {
    this.terminated = true;
    this.status = 'terminated';
    this.terminationTime = new Date();
    this.terminationReason = `Exam terminated due to ${this.warningCount} warnings and continued violations`;
  }
  
  return this.save();
};

// Method to get current trust score
proctoringSessionSchema.methods.getCurrentTrustScore = function() {
  const recentViolations = this.violations.filter(v => 
    new Date() - v.timestamp < 300000 // Last 5 minutes
  );
  
  let score = 1.0;
  recentViolations.forEach(violation => {
    switch(violation.severity) {
      case 'low': score -= 0.05; break;
      case 'medium': score -= 0.1; break;
      case 'high': score -= 0.2; break;
      case 'critical': score -= 0.3; break;
    }
  });
  
  return Math.max(0, Math.min(1, score));
};

// Virtual for session duration in minutes
proctoringSessionSchema.virtual('durationMinutes').get(function() {
  return Math.floor(this.duration / 60);
});

// Method to end session
proctoringSessionSchema.methods.endSession = function(reason = 'completed') {
  this.endTime = new Date();
  this.status = reason === 'completed' ? 'completed' : 'terminated';
  if (reason !== 'completed') {
    this.terminationReason = reason;
    this.terminationTime = this.endTime;
  }
  return this.save();
};

module.exports = mongoose.model('ProctoringSession', proctoringSessionSchema);
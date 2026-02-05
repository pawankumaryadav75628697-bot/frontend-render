const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  questionType: {
    type: String,
    required: true,
    enum: ['multiple-choice', 'true-false', 'short-answer', 'coding'],
    default: 'multiple-choice'
  },
  options: [{
    text: {
      type: String,
      required: function() {
        return this.parent().questionType === 'multiple-choice' || this.parent().questionType === 'true-false';
      },
      trim: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  correctAnswer: {
    type: String, // For short-answer questions
    trim: true
  },
  points: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  explanation: {
    type: String,
    trim: true
  },
  // Coding question specific fields
  codingQuestion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodingQuestion',
    required: function() {
      return this.questionType === 'coding';
    }
  },
  supportedLanguages: [{
    type: String,
    enum: ['c', 'cpp', 'python', 'java']
  }],
  timeLimit: {
    type: Number, // milliseconds
    default: 5000
  }
}, {
  timestamps: true
});

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  examType: {
    type: String,
    enum: ['regular', 'coding', 'mixed'],
    default: 'regular'
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
    sparse: true // Allow null values for unique constraint
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
  questions: [questionSchema],
  settings: {
    duration: {
      type: Number, // Duration in minutes
      required: true,
      min: 1
    },
    totalPoints: {
      type: Number,
      min: 1,
      default: 0
    },
    passingScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: false
    },
    allowBackTracking: {
      type: Boolean,
      default: true
    },
    showResultsImmediately: {
      type: Boolean,
      default: false
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: 1
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
      default: true
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
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
examSchema.index({ instructor: 1 });
examSchema.index({ status: 1 });
examSchema.index({ 'scheduling.startDate': 1, 'scheduling.endDate': 1 });
examSchema.index({ course: 1 });
examSchema.index({ examKey: 1 });

// Generate unique exam key
const generateExamKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate unique exam key before saving
examSchema.pre('save', async function(next) {
  if (this.isNew && !this.examKey) {
    let isUnique = false;
    while (!isUnique) {
      this.examKey = generateExamKey();
      const existingExam = await mongoose.model('Exam').findOne({ examKey: this.examKey });
      if (!existingExam) {
        isUnique = true;
      }
    }
  }
  next();
});

// Calculate total points automatically
examSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.settings.totalPoints = this.questions.reduce((total, question) => total + question.points, 0);
  }
  next();
});

// Virtual for exam duration in a readable format
examSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.settings.duration / 60);
  const minutes = this.settings.duration % 60;
  
  if (hours === 0) {
    return `${minutes} minutes`;
  } else if (minutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }
});

// Virtual to check if exam is currently active
examSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.scheduling.startDate && 
         now <= this.scheduling.endDate;
});

// Method to check if a student is eligible for this exam
examSchema.methods.isStudentEligible = function(studentId) {
  return this.eligibleStudents.length === 0 || 
         this.eligibleStudents.some(id => id.toString() === studentId.toString());
};

// Method to get exam without answers (for students)
examSchema.methods.getStudentVersion = function() {
  const examObject = this.toObject();
  
  // Remove correct answers and explanations from questions
  examObject.questions = examObject.questions.map(question => {
    const studentQuestion = {
      _id: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points
    };
    
    if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
      studentQuestion.options = question.options.map(option => ({
        _id: option._id,
        text: option.text
      }));
    }
    
    return studentQuestion;
  });
  
  // Remove sensitive information
  delete examObject.analytics;
  
  return examObject;
};

module.exports = mongoose.model('Exam', examSchema);
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const instantExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: function() {
      return `Quick Exam - ${new Date().toLocaleDateString()}`;
    }
  },
  examType: {
    type: String,
    required: true,
    enum: ['instant', 'adaptive', 'practice', 'mock', 'assessment'],
    default: 'instant'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed', 'adaptive'],
    default: 'mixed'
  },
  questionCount: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
    default: 10
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 1,
    default: 30
  },
  categories: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // For adaptive exams
  adaptiveSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    initialDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    maxQuestions: {
      type: Number,
      default: 50
    },
    minQuestions: {
      type: Number,
      default: 5
    },
    terminationCriteria: {
      type: String,
      enum: ['standard_error', 'max_questions', 'confidence_level'],
      default: 'max_questions'
    },
    targetAccuracy: {
      type: Number,
      min: 0.5,
      max: 1.0,
      default: 0.8
    }
  },
  // AI-generated questions settings
  aiSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    generationPrompt: {
      type: String,
      trim: true
    },
    bloomsLevels: [{
      type: String,
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
    }],
    focusAreas: [{
      type: String,
      trim: true
    }]
  },
  // Generated questions from question banks
  generatedQuestions: [{
    questionBankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank'
    },
    originalQuestionId: {
      type: mongoose.Schema.Types.ObjectId
    },
    questionText: {
      type: String,
      required: true,
      trim: true
    },
    questionType: {
      type: String,
      required: true,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-in-blank', 'matching']
    },
    options: [{
      text: {
        type: String,
        trim: true
      },
      isCorrect: {
        type: Boolean,
        default: false
      }
    }],
    correctAnswer: {
      type: String,
      trim: true
    },
    points: {
      type: Number,
      required: true,
      default: 1
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'medium'
    },
    estimatedTime: {
      type: Number, // in seconds
      default: 60
    },
    explanation: {
      type: String,
      trim: true
    },
    bloomsLevel: {
      type: String,
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
      default: 'understand'
    }
  }],
  // Exam settings
  settings: {
    shuffleQuestions: {
      type: Boolean,
      default: true
    },
    shuffleOptions: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: false
    },
    showResults: {
      type: Boolean,
      default: true
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false
    },
    allowRetake: {
      type: Boolean,
      default: true
    },
    maxRetakes: {
      type: Number,
      default: 3
    },
    timePerQuestion: {
      type: Number, // in seconds, 0 means no limit
      default: 0
    },
    negativeMarking: {
      enabled: {
        type: Boolean,
        default: false
      },
      penalty: {
        type: Number,
        default: 0.25 // 25% penalty
      }
    }
  },
  // Proctoring settings for instant exams
  proctoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    tabSwitchDetection: {
      type: Boolean,
      default: true
    },
    copyPasteDetection: {
      type: Boolean,
      default: true
    },
    fullScreenMode: {
      type: Boolean,
      default: false
    },
    cameraMonitoring: {
      type: Boolean,
      default: false
    },
    maxViolations: {
      type: Number,
      default: 3
    }
  },
  // Auto-generation rules
  generationRules: {
    questionBankIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank'
    }],
    difficultyDistribution: {
      easy: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      medium: {
        type: Number,
        default: 60,
        min: 0,
        max: 100
      },
      hard: {
        type: Number,
        default: 40,
        min: 0,
        max: 100
      }
    },
    bloomsDistribution: {
      remember: { type: Number, default: 20, min: 0, max: 100 },
      understand: { type: Number, default: 30, min: 0, max: 100 },
      apply: { type: Number, default: 25, min: 0, max: 100 },
      analyze: { type: Number, default: 15, min: 0, max: 100 },
      evaluate: { type: Number, default: 7, min: 0, max: 100 },
      create: { type: Number, default: 3, min: 0, max: 100 }
    }
  },
  // Exam statistics
  stats: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    averageTime: {
      type: Number,
      default: 0 // in minutes
    },
    completionRate: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['generating', 'ready', 'active', 'paused', 'completed'],
    default: 'generating'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessCode: {
    type: String,
    unique: true,
    sparse: true
  },
  validUntil: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 7); // Valid for 7 days by default
      return date;
    }
  }
}, {
  timestamps: true
});

// Indexes
instantExamSchema.index({ createdBy: 1 });
instantExamSchema.index({ status: 1 });
instantExamSchema.index({ subject: 1 });
instantExamSchema.index({ examType: 1 });
instantExamSchema.index({ accessCode: 1 });
instantExamSchema.index({ validUntil: 1 });

// Generate access code before saving
instantExamSchema.pre('save', function(next) {
  if (this.isNew && !this.accessCode) {
    this.accessCode = this.generateAccessCode();
  }
  next();
});

// Method to generate unique access code
instantExamSchema.methods.generateAccessCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Method to check if exam is valid
instantExamSchema.methods.isValid = function() {
  return this.status === 'ready' && new Date() <= this.validUntil;
};

// Method to generate questions from question banks
instantExamSchema.methods.generateQuestions = async function() {
  const QuestionBank = mongoose.model('QuestionBank');
  
  if (this.generationRules.questionBankIds.length === 0) {
    throw new Error('No question banks specified for question generation');
  }
  
  const questionBanks = await QuestionBank.find({
    _id: { $in: this.generationRules.questionBankIds },
    isActive: true
  });
  
  if (questionBanks.length === 0) {
    throw new Error('No active question banks found');
  }
  
  let allQuestions = [];
  questionBanks.forEach(bank => {
    bank.questions.forEach(question => {
      if (question.isActive !== false) {
        allQuestions.push({
          questionBankId: bank._id,
          originalQuestionId: question._id,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: question.correctAnswer,
          points: question.points,
          difficulty: question.difficulty,
          estimatedTime: question.estimatedTime,
          explanation: question.explanation,
          bloomsLevel: question.bloomsTaxonomy
        });
      }
    });
  });
  
  // Apply filtering based on generation rules
  if (this.categories && this.categories.length > 0) {
    // Filter by categories if specified
    // This would require category information in questions
  }
  
  // Apply difficulty distribution
  const { difficultyDistribution } = this.generationRules;
  const easyCount = Math.floor((difficultyDistribution.easy / 100) * this.questionCount);
  const hardCount = Math.floor((difficultyDistribution.hard / 100) * this.questionCount);
  const mediumCount = this.questionCount - easyCount - hardCount;
  
  const easyQuestions = allQuestions.filter(q => q.difficulty === 'easy').slice(0, easyCount);
  const mediumQuestions = allQuestions.filter(q => q.difficulty === 'medium').slice(0, mediumCount);
  const hardQuestions = allQuestions.filter(q => q.difficulty === 'hard').slice(0, hardCount);
  
  this.generatedQuestions = [...easyQuestions, ...mediumQuestions, ...hardQuestions];
  
  // Shuffle if enabled
  if (this.settings.shuffleQuestions) {
    this.generatedQuestions.sort(() => 0.5 - Math.random());
  }
  
  this.status = 'ready';
  return this.save();
};

// Method to get exam for student (without answers)
instantExamSchema.methods.getStudentVersion = function() {
  const examObject = this.toObject();
  
  // Remove correct answers from questions
  examObject.generatedQuestions = examObject.generatedQuestions.map(question => {
    const studentQuestion = {
      _id: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points,
      estimatedTime: question.estimatedTime
    };
    
    if (['multiple-choice', 'true-false', 'matching'].includes(question.questionType)) {
      studentQuestion.options = question.options.map(option => ({
        _id: option._id,
        text: option.text
      }));
    }
    
    return studentQuestion;
  });
  
  // Remove sensitive information
  delete examObject.generationRules;
  delete examObject.stats;
  
  return examObject;
};

// Add pagination plugin
instantExamSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('InstantExam', instantExamSchema);

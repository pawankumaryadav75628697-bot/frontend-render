const mongoose = require('mongoose');

const questionBankSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    trim: true,
    enum: ['Mathematics', 'Science', 'English', 'Computer Science', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'General Knowledge', 'Aptitude', 'Reasoning', 'Other']
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  subjectCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  questions: [{
    questionText: {
      type: String,
      required: true,
      trim: true
    },
    questionType: {
      type: String,
      required: true,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-in-blank', 'matching'],
      default: 'multiple-choice'
    },
    options: [{
      text: {
        type: String,
        required: function() {
          return ['multiple-choice', 'true-false', 'matching'].includes(this.parent().questionType);
        },
        trim: true
      },
      isCorrect: {
        type: Boolean,
        default: false
      }
    }],
    correctAnswer: {
      type: String, // For short-answer, fill-in-blank, essay
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
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'medium'
    },
    estimatedTime: {
      type: Number, // in seconds
      default: 60
    },
    imageUrl: {
      type: String,
      trim: true
    },
    hints: [{
      type: String,
      trim: true
    }],
    usageCount: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    bloomsTaxonomy: {
      type: String,
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
      default: 'understand'
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  averageDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  usageStats: {
    totalUsage: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    },
    averagePerformance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
questionBankSchema.index({ category: 1, difficulty: 1 });
questionBankSchema.index({ subject: 1 });
questionBankSchema.index({ tags: 1 });
questionBankSchema.index({ createdBy: 1 });
questionBankSchema.index({ isPublic: 1, isActive: 1 });

// Pre-save middleware to calculate total questions and average difficulty
questionBankSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalQuestions = this.questions.length;
    
    // Calculate average difficulty
    const difficultyMap = { easy: 1, medium: 2, hard: 3, expert: 4 };
    const averageDifficultyValue = this.questions.reduce((sum, q) => 
      sum + difficultyMap[q.difficulty], 0) / this.questions.length;
    
    if (averageDifficultyValue <= 1.5) this.averageDifficulty = 'easy';
    else if (averageDifficultyValue <= 2.5) this.averageDifficulty = 'medium';
    else if (averageDifficultyValue <= 3.5) this.averageDifficulty = 'hard';
    else this.averageDifficulty = 'expert';
  }
  next();
});

// Method to get random questions from the bank
questionBankSchema.methods.getRandomQuestions = function(count, difficulty = null) {
  let questions = this.questions.filter(q => q.isActive !== false);
  
  if (difficulty) {
    questions = questions.filter(q => q.difficulty === difficulty);
  }
  
  // Shuffle and return requested count
  const shuffled = questions.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Method to get questions by Bloom's taxonomy level
questionBankSchema.methods.getQuestionsByBloomsLevel = function(level, count = null) {
  const questions = this.questions.filter(q => q.bloomsTaxonomy === level);
  
  if (count) {
    return questions.slice(0, count);
  }
  return questions;
};

// Virtual for difficulty distribution
questionBankSchema.virtual('difficultyDistribution').get(function() {
  const distribution = { easy: 0, medium: 0, hard: 0, expert: 0 };
  
  this.questions.forEach(q => {
    distribution[q.difficulty]++;
  });
  
  return distribution;
});

module.exports = mongoose.model('QuestionBank', questionBankSchema);
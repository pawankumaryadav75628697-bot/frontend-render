const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true,
    trim: true
  },
  expectedOutput: {
    type: String,
    required: true,
    trim: true
  },
  isHidden: {
    type: Boolean,
    default: false // False means visible to students, true means hidden test case
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const codingQuestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    enum: ['Programming', 'Data Structures', 'Algorithms', 'Database', 'Web Development', 'Other']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Programming languages supported for this question
  supportedLanguages: [{
    type: String,
    enum: ['c', 'cpp', 'python', 'java'],
    required: true
  }],
  // Default starter code for each language
  starterCode: {
    c: {
      type: String,
      default: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}'
    },
    cpp: {
      type: String,
      default: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}'
    },
    python: {
      type: String,
      default: '# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()'
    },
    java: {
      type: String,
      default: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}'
    }
  },
  // Solution code (for admin reference)
  solutionCode: {
    c: String,
    cpp: String,
    python: String,
    java: String
  },
  // Test cases for validation
  testCases: [testCaseSchema],
  // Constraints and specifications
  constraints: {
    timeLimit: {
      type: Number,
      default: 2000, // milliseconds
      min: 100,
      max: 10000
    },
    memoryLimit: {
      type: Number,
      default: 256, // MB
      min: 64,
      max: 512
    },
    inputFormat: {
      type: String,
      trim: true
    },
    outputFormat: {
      type: String,
      trim: true
    }
  },
  // Scoring
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
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
  // Success rate across all attempts
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for better query performance
codingQuestionSchema.index({ category: 1, difficulty: 1 });
codingQuestionSchema.index({ tags: 1 });
codingQuestionSchema.index({ createdBy: 1 });
codingQuestionSchema.index({ supportedLanguages: 1 });

// Calculate total points from test cases
codingQuestionSchema.pre('save', function(next) {
  if (this.testCases && this.testCases.length > 0) {
    this.totalPoints = this.testCases.reduce((total, testCase) => total + testCase.points, 0);
  }
  next();
});

// Method to get question for student (without solution)
codingQuestionSchema.methods.getStudentVersion = function() {
  const questionObject = this.toObject();
  
  // Remove solution code
  delete questionObject.solutionCode;
  
  // Only show visible test cases to students
  questionObject.testCases = questionObject.testCases.filter(testCase => !testCase.isHidden);
  
  return questionObject;
};

// Method to validate code against test cases
codingQuestionSchema.methods.validateTestCase = function(testCase, actualOutput) {
  const expectedOutput = testCase.expectedOutput.trim();
  const actualOutputTrimmed = actualOutput.trim();
  
  return expectedOutput === actualOutputTrimmed;
};

// Method to get starter code for a specific language
codingQuestionSchema.methods.getStarterCode = function(language) {
  if (this.supportedLanguages.includes(language)) {
    return this.starterCode[language] || '';
  }
  return '';
};

// Virtual for difficulty color coding
codingQuestionSchema.virtual('difficultyColor').get(function() {
  const colors = {
    easy: '#22c55e',
    medium: '#f59e0b', 
    hard: '#ef4444',
    expert: '#8b5cf6'
  };
  return colors[this.difficulty] || '#64748b';
});

// Method to increment usage count
codingQuestionSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
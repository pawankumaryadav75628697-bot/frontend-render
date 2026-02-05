const CodingQuestion = require('../models/CodingQuestion');
const User = require('../models/User');
const codeExecutionService = require('../utils/codeExecutionService');
const notificationService = require('../utils/notificationService');

// @desc    Create new coding question
// @route   POST /api/v1/coding-questions
// @access  Private (Admin/Teacher)
exports.createCodingQuestion = async (req, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      category,
      tags,
      supportedLanguages,
      starterCode,
      solutionCode,
      testCases,
      constraints
    } = req.body;

    // Validate test cases
    if (!testCases || testCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one test case is required'
      });
    }

    // Create coding question
    const codingQuestion = await CodingQuestion.create({
      title,
      description,
      difficulty,
      category,
      tags,
      supportedLanguages,
      starterCode,
      solutionCode,
      testCases,
      constraints,
      createdBy: req.user.id
    });

    await codingQuestion.populate('createdBy', 'fullName email');

    // Optionally send notifications about new coding question (non-blocking)
    if (req.body.notifyStudents) {
      try {
        // Fire-and-forget to avoid blocking create response
        setImmediate(async () => {
          await sendNewQuestionNotifications(codingQuestion);
        });
      } catch (notifyErr) {
        console.error('Error scheduling notifications for new coding question:', notifyErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Coding question created successfully',
      data: codingQuestion
    });
  } catch (error) {
    console.error('Create coding question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating coding question',
      error: error.message
    });
  }
};

// @desc    Publish existing coding question (send notifications)
// @route   POST /api/v1/coding-questions/:id/publish
// @access  Private (Admin/Teacher)
exports.publishCodingQuestion = async (req, res) => {
  try {
    const codingQuestion = await CodingQuestion.findById(req.params.id);

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Only creator or admin can publish
    if (codingQuestion.createdBy.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this question'
      });
    }

    // Send notifications now
    let resultsSummary = { studentsNotified: 0 };
    try {
      await sendNewQuestionNotifications(codingQuestion);
      // We don't compute exact stats here; notificationService may log details
      resultsSummary = { studentsNotified: undefined };
    } catch (err) {
      console.error('Error publishing coding question:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to publish coding question',
        error: err.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coding question published successfully',
      data: { notifications: resultsSummary }
    });
  } catch (error) {
    console.error('Publish coding question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing coding question',
      error: error.message
    });
  }
};

// @desc    Get all coding questions with filtering
// @route   GET /api/v1/coding-questions
// @access  Private (Admin/Teacher/Student)
exports.getCodingQuestions = async (req, res) => {
  try {
    // Validate user authentication first
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Test database connection first
    try {
      await CodingQuestion.findOne().limit(1);
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: dbError.message
      });
    }

    const {
      page = 1,
      limit = 10,
      difficulty,
      category,
      language,
      tags,
      search,
      createdBy
    } = req.query;

    // Build filter object - make isActive optional to handle missing field
    let filter = {};
    if (req.query.includeInactive !== 'true') {
      filter.isActive = { $ne: false }; // Include documents where isActive is not explicitly false
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (language) {
      filter.supportedLanguages = { $in: [language] };
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      filter.tags = { $in: tagArray };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    // If user is student, only return student version (no solution)
    const populateFields = req.user.userType === 'student' ? 'createdBy' : 'createdBy';
    const selectFields = req.user.userType === 'student' ? '-solutionCode' : '';

    console.log('Executing query with filter:', JSON.stringify(filter, null, 2));
    
    const codingQuestions = await CodingQuestion.find(filter)
      .select(selectFields)
      .populate(populateFields, 'fullName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 10)
      .skip((parseInt(page) - 1) * (parseInt(limit) || 10));
    
    console.log('Query executed successfully, found:', codingQuestions.length, 'questions');

    const totalQuestions = await CodingQuestion.countDocuments(filter);

    // If student, filter out hidden test cases
    let processedQuestions = codingQuestions;
    if (req.user.userType === 'student') {
      processedQuestions = codingQuestions.map(question => {
        try {
          return question.getStudentVersion();
        } catch (err) {
          console.warn('Error processing student version for question:', question._id, err.message);
          return question;
        }
      });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    res.status(200).json({
      success: true,
      data: processedQuestions,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalQuestions / limitNum),
        totalQuestions,
        hasMore: pageNum * limitNum < totalQuestions
      }
    });
  } catch (error) {
    console.error('Get coding questions error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request details:', {
      user: req.user ? { id: req.user.id, userType: req.user.userType } : 'No user',
      query: req.query,
      url: req.url,
      method: req.method
    });
    res.status(500).json({
      success: false,
      message: 'Error fetching coding questions',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single coding question by ID
// @route   GET /api/v1/coding-questions/:id
// @access  Private (Admin/Teacher/Student)
exports.getCodingQuestion = async (req, res) => {
  try {
    const codingQuestion = await CodingQuestion.findById(req.params.id)
      .populate('createdBy', 'fullName email');

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // If user is student, return student version
    const responseData = req.user.userType === 'student' 
      ? codingQuestion.getStudentVersion()
      : codingQuestion;

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get coding question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching coding question',
      error: error.message
    });
  }
};

// @desc    Update coding question
// @route   PUT /api/v1/coding-questions/:id
// @access  Private (Admin/Teacher - own questions)
exports.updateCodingQuestion = async (req, res) => {
  try {
    const codingQuestion = await CodingQuestion.findById(req.params.id);

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Check if user owns this question or is admin
    if (codingQuestion.createdBy.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this question'
      });
    }

    const updatedQuestion = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Coding question updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    console.error('Update coding question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating coding question',
      error: error.message
    });
  }
};

// @desc    Delete coding question
// @route   DELETE /api/v1/coding-questions/:id
// @access  Private (Admin/Teacher - own questions)
exports.deleteCodingQuestion = async (req, res) => {
  try {
    const codingQuestion = await CodingQuestion.findById(req.params.id);

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Check if user owns this question or is admin
    if (codingQuestion.createdBy.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this question'
      });
    }

    await CodingQuestion.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Coding question deleted successfully'
    });
  } catch (error) {
    console.error('Delete coding question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting coding question',
      error: error.message
    });
  }
};

// @desc    Test code against question test cases
// @route   POST /api/v1/coding-questions/:id/test
// @access  Private (Admin/Teacher/Student)
exports.testCode = async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    const codingQuestion = await CodingQuestion.findById(req.params.id);

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Check if language is supported
    if (!codingQuestion.supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Language ${language} is not supported for this question`
      });
    }

    // Validate code syntax
    const syntaxValidation = codeExecutionService.validateCodeSyntax(code, language);
    if (!syntaxValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Code syntax validation failed',
        errors: syntaxValidation.errors
      });
    }

    // Get test cases (students only see visible test cases)
    let testCases = codingQuestion.testCases;
    if (req.user.userType === 'student') {
      testCases = testCases.filter(testCase => !testCase.isHidden);
    }

    // Execute code against test cases
    const results = await codeExecutionService.testCode(
      code,
      language,
      testCases,
      codingQuestion.constraints.timeLimit
    );

    // Increment usage count
    await codingQuestion.incrementUsage();

    res.status(200).json({
      success: true,
      data: {
        results: results.results,
        summary: results.summary,
        question: {
          title: codingQuestion.title,
          totalPoints: codingQuestion.totalPoints,
          timeLimit: codingQuestion.constraints.timeLimit
        }
      }
    });
  } catch (error) {
    console.error('Test code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing code',
      error: error.message
    });
  }
};

// @desc    Execute code with custom input (for testing)
// @route   POST /api/v1/coding-questions/execute
// @access  Private (All users)
exports.executeCode = async (req, res) => {
  try {
    const { code, language, input } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    // Allow all users to execute code (including students)
    // Removed the authorization restriction to fix student dashboard code compiler

    // Validate code syntax
    const syntaxValidation = codeExecutionService.validateCodeSyntax(code, language);
    if (!syntaxValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Code syntax validation failed',
        errors: syntaxValidation.errors
      });
    }

    // Execute code
    const result = await codeExecutionService.executeCode(code, language, input || '', 10000);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Execute code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing code',
      error: error.message
    });
  }
};

// @desc    Get coding question statistics
// @route   GET /api/v1/coding-questions/:id/stats
// @access  Private (Admin/Teacher)
exports.getCodingQuestionStats = async (req, res) => {
  try {
    const codingQuestion = await CodingQuestion.findById(req.params.id);

    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Get additional statistics (this would be expanded with exam attempts data)
    const stats = {
      basicInfo: {
        title: codingQuestion.title,
        difficulty: codingQuestion.difficulty,
        category: codingQuestion.category,
        totalPoints: codingQuestion.totalPoints,
        createdAt: codingQuestion.createdAt
      },
      usage: {
        usageCount: codingQuestion.usageCount,
        averageScore: codingQuestion.averageScore,
        successRate: codingQuestion.successRate
      },
      testCases: {
        total: codingQuestion.testCases.length,
        visible: codingQuestion.testCases.filter(tc => !tc.isHidden).length,
        hidden: codingQuestion.testCases.filter(tc => tc.isHidden).length
      },
      languages: codingQuestion.supportedLanguages,
      constraints: codingQuestion.constraints
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get coding question stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching question statistics',
      error: error.message
    });
  }
};

// @desc    Get coding environment status
// @route   GET /api/v1/coding-questions/environment
// @access  Private (Admin/Teacher)
exports.getEnvironmentStatus = async (req, res) => {
  try {
    const availability = await codeExecutionService.checkEnvironment();
    
    res.status(200).json({
      success: true,
      data: {
        environment: availability,
        message: 'Code execution environment status'
      }
    });
  } catch (error) {
    console.error('Environment check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking environment',
      error: error.message
    });
  }
};

// Helper function to send notifications about new coding questions
async function sendNewQuestionNotifications(codingQuestion) {
  try {
    // Get all active students
    const students = await User.find({ 
      userType: 'student', 
      isActive: { $ne: false } 
    }).select('fullName email phoneNumber');

    console.log(`Sending new coding question notifications to ${students.length} students`);

    // Send notifications to each student
    const notificationPromises = students.map(async (student) => {
      console.log(`Processing student: ${student.fullName}, Email: ${student.email}, Phone: ${student.phoneNumber}`);
      if (student.email || student.phoneNumber) {
        console.log(`Sending notification to: ${student.fullName}`);
        const result = await notificationService.sendCodingQuestionNotification(student, codingQuestion);
        console.log(`Notification result for ${student.fullName}:`, result);
        return result;
      } else {
        console.log(`Skipping ${student.fullName} - no email or phone`);
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    console.log('New coding question notifications completed. Results:', results.length);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      }
    });
  } catch (error) {
    console.error('Error sending new question notifications:', error);
  }
}

module.exports = exports;
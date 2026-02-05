const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const User = require('../models/User');
const notificationService = require('../utils/notificationService');
const { validationResult } = require('express-validator');

// @desc    Create a new exam
// @route   POST /api/v1/exams
// @access  Private/Admin
const createExam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Clean and validate exam data
    const examData = {
      ...req.body,
      instructor: req.user.id
    };
    
    // Ensure all questions have valid options for multiple choice questions
    if (examData.questions) {
      examData.questions = examData.questions.map(question => {
        if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
          // Filter out empty options
          question.options = question.options.filter(opt => opt.text && opt.text.trim() !== '');
          
          // Ensure at least 2 options for multiple choice
          if (question.options.length < 2) {
            throw new Error(`Question "${question.questionText}" must have at least 2 valid options`);
          }
          
          // Remove correctAnswer for multiple choice questions
          delete question.correctAnswer;
        } else if (question.questionType === 'short-answer') {
          // For short answer, remove options array and ensure correctAnswer exists
          question.options = [];
          if (!question.correctAnswer || question.correctAnswer.trim() === '') {
            throw new Error(`Question "${question.questionText}" must have a correct answer`);
          }
        }
        return question;
      });
    }
    
    // Calculate total points if not provided
    if (!examData.settings.totalPoints || examData.settings.totalPoints === 0) {
      examData.settings.totalPoints = examData.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    }

    const exam = await Exam.create(examData);
    
    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam
    });
  } catch (error) {
    console.error('Create exam error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Exam validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all exams for admin
// @route   GET /api/v1/exams
// @access  Private/Admin
const getAdminExams = async (req, res) => {
  try {
    console.log('📋 getAdminExams called with query params:', req.query);
    console.log('🔐 User:', { id: req.user?.id, userType: req.user?.userType, fullName: req.user?.fullName });
    
    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.log('❌ User authentication failed - no user found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login again.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    // Validate user type
    if (req.user.userType !== 'admin' && req.user.userType !== 'teacher') {
      console.log('❌ User authorization failed - insufficient permissions');
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Admin or teacher access required.',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const course = req.query.course;
    const search = req.query.search;

    // Basic validation with detailed logging
    if (isNaN(page) || page < 1 || page > 1000) {
      console.log('❌ Invalid page parameter:', page);
      return res.status(400).json({
        success: false,
        message: `Invalid page parameter: ${page}. Must be a number between 1 and 1000`
      });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      console.log('❌ Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: `Invalid limit parameter: ${limit}. Must be a number between 1 and 100`
      });
    }

    // Build query with safety check
    const userId = req.user.id;
    if (!userId) {
      console.log('❌ Cannot build query - missing user ID');
      return res.status(400).json({
        success: false,
        message: 'Invalid user session. Please login again.',
        error: 'INVALID_USER_SESSION'
      });
    }
    
    let query = { instructor: userId };
    
    console.log('🔍 Base query:', query);
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (course && course.trim() !== '') {
      query.course = { $regex: course.trim(), $options: 'i' };
    }
    
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { course: { $regex: searchTerm, $options: 'i' } },
        { courseCode: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    console.log('📋 Pagination:', { page, limit, skip: (page - 1) * limit });

    const skip = (page - 1) * limit;

    console.log('📊 Executing database query...');
    
    const exams = await Exam.find(query)
      .populate('instructor', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Exam.countDocuments(query);
    
    console.log('✅ Successfully retrieved', exams.length, 'exams out of', total, 'total');

    res.status(200).json({
      success: true,
      message: 'Exams retrieved successfully',
      data: exams,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('❌ Get admin exams error:', error);
    console.error('Error stack:', error.stack);
    console.error('User context:', {
      id: req.user?.id,
      userType: req.user?.userType,
      fullName: req.user?.fullName
    });
    console.error('Request query:', req.query);
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving exams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get available exams for student
// @route   GET /api/v1/exams/available/list
// @access  Private/Student
const getAvailableExams = async (req, res) => {
  try {
    console.log('📚 getAvailableExams called by student:', {
      userId: req.user?.id,
      userType: req.user?.userType,
      fullName: req.user?.fullName
    });

    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.log('❌ User authentication failed in getAvailableExams');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login again.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Validate user type
    if (req.user.userType !== 'student') {
      console.log('❌ User authorization failed - not a student');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Student access required.',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const studentId = req.user.id;
    const now = new Date();
    
    console.log('🔍 Building exam query for student:', studentId);

    // Find exams that are published/active - made more permissive for development
    const query = {
      status: { $in: ['published', 'active', 'draft'] }, // Added draft for development
      $or: [
        // No specific students (open to all)
        { eligibleStudents: { $exists: false } },
        { eligibleStudents: { $size: 0 } },
        // Student specifically eligible  
        { eligibleStudents: studentId },
        // No scheduling restrictions for development
        { 'scheduling.startDate': { $exists: false } }
      ]
    };

    // Only apply scheduling filters if they exist
    if (process.env.NODE_ENV === 'production') {
      query['scheduling.startDate'] = { $lte: now };
      query['scheduling.endDate'] = { $gte: now };
    }

    console.log('🔍 Final query:', JSON.stringify(query, null, 2));

    const exams = await Exam.find(query)
      .populate('instructor', 'fullName')
      .select('-questions.options.isCorrect -questions.correctAnswer -questions.explanation')
      .sort({ createdAt: -1 })
      .limit(50); // Limit for performance

    console.log('✅ Found', exams.length, 'exams for student');

    // Check attempts for each exam with error handling
    const examsWithAttempts = await Promise.all(
      exams.map(async (exam) => {
        try {
          const attempts = await ExamAttempt.find({
            exam: exam._id,
            student: studentId
          }).sort({ attemptNumber: -1 });

          const examObj = exam.toObject();
          examObj.studentAttempts = attempts.length;
          examObj.canAttempt = attempts.length < (exam.settings?.maxAttempts || 3);
          examObj.lastAttempt = attempts[0] || null;
          
          return examObj;
        } catch (attemptError) {
          console.warn('Error processing attempts for exam', exam._id, ':', attemptError.message);
          const examObj = exam.toObject();
          examObj.studentAttempts = 0;
          examObj.canAttempt = true;
          examObj.lastAttempt = null;
          return examObj;
        }
      })
    );

    console.log('✅ Successfully processed exam attempts data');

    res.status(200).json({
      success: true,
      message: 'Available exams retrieved successfully',
      data: examsWithAttempts,
      count: examsWithAttempts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get available exams error:', error);
    console.error('Error stack:', error.stack);
    console.error('User context:', {
      id: req.user?.id,
      userType: req.user?.userType,
      fullName: req.user?.fullName
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving available exams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

// @desc    Get single exam by ID
// @route   GET /api/v1/exams/:id
// @access  Private
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('instructor', 'fullName email')
      .populate('eligibleStudents', 'fullName email studentId');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // If user is student, return student version without answers
    if (req.user.userType === 'student') {
      // Check if student is eligible
      if (!exam.isStudentEligible(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'You are not eligible for this exam'
        });
      }

      const studentExam = exam.getStudentVersion();
      
      // Add attempt information
      const attempts = await ExamAttempt.find({
        exam: exam._id,
        student: req.user.id
      }).sort({ attemptNumber: -1 });

      studentExam.studentAttempts = attempts.length;
      studentExam.canAttempt = attempts.length < exam.settings.maxAttempts;
      studentExam.lastAttempt = attempts[0] || null;

      return res.status(200).json({
        success: true,
        message: 'Exam retrieved successfully',
        data: studentExam
      });
    }

    // Admin can see full exam
    res.status(200).json({
      success: true,
      message: 'Exam retrieved successfully',
      data: exam
    });
  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving exam',
      error: error.message
    });
  }
};

// @desc    Update exam
// @route   PUT /api/v1/exams/:id
// @access  Private/Admin
const updateExam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Make sure user owns the exam
    if (exam.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this exam'
      });
    }

    exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: exam
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating exam',
      error: error.message
    });
  }
};

// @desc    Update exam status (publish, activate, cancel, etc.)
// @route   PUT /api/v1/exams/:id/status
// @access  Private/Admin
const updateExamStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['draft', 'published', 'active', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }
    
    // Check if user owns the exam
    if (exam.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this exam'
      });
    }
    
    // Validate status transition
    const validTransitions = {
      'draft': ['published', 'cancelled'],
      'published': ['active', 'cancelled'],
      'active': ['completed', 'cancelled'],
      'completed': [], // Final state
      'cancelled': [] // Final state
    };
    
    if (!validTransitions[exam.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from '${exam.status}' to '${status}'`
      });
    }
    
    // Additional validations for specific status changes
    if (status === 'published') {
      // Validate exam is ready for publishing
      if (!exam.questions || exam.questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish exam without questions'
        });
      }
      
      if (!exam.scheduling.startDate || !exam.scheduling.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish exam without scheduling dates'
        });
      }
      
      // Check if start date is in the future (allow some buffer)
      const now = new Date();
      const startDate = new Date(exam.scheduling.startDate);
      if (startDate < now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish exam with start date in the past'
        });
      }
    }
    
    if (status === 'active') {
      // Check if exam can be activated
      const now = new Date();
      const startDate = new Date(exam.scheduling.startDate);
      const endDate = new Date(exam.scheduling.endDate);
      
      if (now < startDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate exam before start date'
        });
      }
      
      if (now > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate exam after end date'
        });
      }
    }
    
    // Store the old status for logging
    const oldStatus = exam.status;
    
    // Update status
    exam.status = status;
    
    // Update timestamps based on status
    if (status === 'published') {
      exam.publishedAt = new Date();
    } else if (status === 'active') {
      exam.activatedAt = new Date();
    } else if (status === 'completed') {
      exam.completedAt = new Date();
    } else if (status === 'cancelled') {
      exam.cancelledAt = new Date();
    }
    
    await exam.save();
    
    console.log(`✅ Exam "${exam.title}" status changed from "${oldStatus}" to "${status}" by ${req.user.fullName}`);
    
    // Send exam invitations when exam is published
    if (status === 'published') {
      try {
        // Get eligible students
        let eligibleStudents = [];
        
        if (exam.eligibleStudents && exam.eligibleStudents.length > 0) {
          // Specific students assigned to exam
          eligibleStudents = await User.find({
            _id: { $in: exam.eligibleStudents },
            userType: 'student',
            isActive: true
          }).select('fullName email phoneNumber studentId');
        } else {
          // All students in the same course if no specific students assigned
          eligibleStudents = await User.find({
            userType: 'student',
            isActive: true
          }).select('fullName email phoneNumber studentId');
        }
        
        console.log(`📤 Sending exam invitations to ${eligibleStudents.length} students for exam: ${exam.title}`);
        
        if (eligibleStudents.length > 0) {
          // Use the notification controller to send invitations
          const notificationController = require('./notificationController');
          
          // Prepare request-like object for the notification controller
          const mockReq = {
            body: {
              examId: exam._id,
              examType: 'Exam',
              studentIds: eligibleStudents.map(s => s._id),
              customMessage: `The exam "${exam.title}" has been published and is now available. Please prepare for the exam scheduled on ${new Date(exam.scheduling.startDate).toLocaleString()}.`
            },
            user: req.user
          };
          
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                if (code === 200) {
                  console.log(`✅ Email invitations sent successfully: ${data.data?.sent || 0} emails sent, ${data.data?.failed || 0} failed`);
                } else {
                  console.error(`❌ Email invitation failed with status ${code}:`, data.message);
                }
              }
            })
          };
          
          // Call the notification controller function directly
          await notificationController.sendExamInvitation(mockReq, mockRes);
          
        } else {
          console.log('⚠️ No eligible students found for exam invitations');
        }
        
      } catch (notificationError) {
        console.error('❌ Error sending exam invitations:', notificationError.message);
        // Don't fail the status update if notifications fail
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Exam status updated to '${status}' successfully`,
      data: exam
    });
    
  } catch (error) {
    console.error('Update exam status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating exam status',
      error: error.message
    });
  }
};

// @desc    Delete exam
// @route   DELETE /api/v1/exams/:id
// @access  Private/Admin
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Make sure user owns the exam
    if (exam.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this exam'
      });
    }

    // Check if there are any attempts
    const attempts = await ExamAttempt.find({ exam: exam._id });
    if (attempts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete exam with existing attempts'
      });
    }

    await exam.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting exam',
      error: error.message
    });
  }
};

// @desc    Start exam attempt
// @route   POST /api/v1/exams/:id/attempt
// @access  Private/Student
const startExamAttempt = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Check if exam is active and within schedule
    const now = new Date();
    if (exam.status !== 'active' && exam.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Exam is not available'
      });
    }

    if (now < exam.scheduling.startDate || now > exam.scheduling.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Exam is not within the scheduled time'
      });
    }

    // Check if student is eligible
    if (!exam.isStudentEligible(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible for this exam'
      });
    }

    // Check previous attempts
    const previousAttempts = await ExamAttempt.find({
      exam: exam._id,
      student: req.user.id
    }).sort({ attemptNumber: -1 });

    if (previousAttempts.length >= exam.settings.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: 'Maximum attempts reached'
      });
    }

    // Check if there's an active attempt
    const activeAttempt = previousAttempts.find(attempt => 
      attempt.status === 'in_progress'
    );

    if (activeAttempt) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active attempt',
        data: { attemptId: activeAttempt._id }
      });
    }

    // Create new attempt
    const attemptData = {
      exam: exam._id,
      student: req.user.id,
      attemptNumber: previousAttempts.length + 1,
      startTime: now,
      proctoring: {
        enabled: exam.proctoring.enabled
      },
      systemInfo: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        ...(req.body.systemInfo || {})
      }
    };

    const attempt = await ExamAttempt.create(attemptData);

    // Update exam analytics
    exam.analytics.totalAttempts += 1;
    await exam.save();

    res.status(201).json({
      success: true,
      message: 'Exam attempt started successfully',
      data: {
        attemptId: attempt._id,
        exam: exam.getStudentVersion()
      }
    });
  } catch (error) {
    console.error('Start exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting exam attempt',
      error: error.message
    });
  }
};

// @desc    Get exam attempt
// @route   GET /api/v1/attempts/:id
// @access  Private
const getExamAttempt = async (req, res) => {
  try {
    let attempt = await ExamAttempt.findById(req.params.id)
      .populate('exam')
      .populate('student', 'fullName email studentId');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
    }

    // Check authorization
    if (req.user.userType === 'student' && attempt.student._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attempt'
      });
    }

    if (req.user.userType === 'admin' && attempt.exam.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attempt'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Exam attempt retrieved successfully',
      data: attempt
    });
  } catch (error) {
    console.error('Get exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving exam attempt',
      error: error.message
    });
  }
};

// @desc    Submit answer to exam attempt
// @route   PUT /api/v1/attempts/:id/answer
// @access  Private/Student
const submitAnswer = async (req, res) => {
  try {
    const { questionId, selectedOption, textAnswer } = req.body;

    const attempt = await ExamAttempt.findById(req.params.id).populate('exam');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
    }

    // Check authorization
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this attempt'
      });
    }

    // Check if attempt is still active
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Exam attempt is no longer active'
      });
    }

    // Check time limit
    const timeElapsed = (new Date() - attempt.startTime) / 1000 / 60; // in minutes
    if (timeElapsed > attempt.exam.settings.duration) {
      attempt.status = 'timed_out';
      attempt.endTime = new Date();
      await attempt.save();
      
      return res.status(400).json({
        success: false,
        message: 'Time limit exceeded'
      });
    }

    // Find the question
    const question = attempt.exam.questions.id(questionId);
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID'
      });
    }

    // Check if answer already exists for this question
    const existingAnswerIndex = attempt.answers.findIndex(
      answer => answer.questionId.toString() === questionId
    );

    let isCorrect = false;
    let pointsEarned = 0;

    // Determine if answer is correct and calculate points
    if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
      if (selectedOption) {
        const selectedOptionObj = question.options.id(selectedOption);
        if (selectedOptionObj && selectedOptionObj.isCorrect) {
          isCorrect = true;
          pointsEarned = question.points;
        }
      }
    } else if (question.questionType === 'short-answer') {
      if (textAnswer && question.correctAnswer) {
        // Simple case-insensitive comparison for now
        isCorrect = textAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        if (isCorrect) {
          pointsEarned = question.points;
        }
      }
    }

    const answerData = {
      questionId,
      selectedOption: selectedOption || null,
      textAnswer: textAnswer || null,
      isCorrect,
      pointsEarned,
      timeSpent: 0 // This would be tracked on frontend
    };

    // Update or add answer
    if (existingAnswerIndex >= 0) {
      attempt.answers[existingAnswerIndex] = answerData;
    } else {
      attempt.answers.push(answerData);
    }

    // Auto-save
    attempt.autoSaveData.lastSaved = new Date();
    attempt.autoSaveData.saveCount += 1;

    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        answerId: existingAnswerIndex >= 0 ? attempt.answers[existingAnswerIndex]._id : attempt.answers[attempt.answers.length - 1]._id,
        isCorrect,
        pointsEarned
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting answer',
      error: error.message
    });
  }
};

// @desc    Submit exam attempt
// @route   PUT /api/v1/attempts/:id/submit
// @access  Private/Student
const submitExamAttempt = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.id).populate('exam');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
    }

    // Check authorization
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this attempt'
      });
    }

    // Check if attempt is still in progress
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Exam attempt is not in progress'
      });
    }

    // Process bulk answers if provided in request body
    if (req.body.answers && Array.isArray(req.body.answers)) {
      console.log(`Processing ${req.body.answers.length} answers for attempt ${attempt._id}`);
      
      // Clear existing answers to avoid duplicates
      attempt.answers = [];
      
      // Process each answer
      for (const answerData of req.body.answers) {
        const { questionId, selectedOption, textAnswer } = answerData;
        
        // Find the question in the exam
        const question = attempt.exam.questions.id(questionId);
        if (!question) {
          console.warn(`Question ${questionId} not found in exam`);
          continue;
        }
        
        let isCorrect = false;
        let pointsEarned = 0;
        
        // Determine if answer is correct and calculate points
        if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
          if (selectedOption) {
            const selectedOptionObj = question.options.id(selectedOption);
            if (selectedOptionObj && selectedOptionObj.isCorrect) {
              isCorrect = true;
              pointsEarned = question.points || 1;
            }
          }
        } else if (question.questionType === 'short-answer') {
          if (textAnswer && question.correctAnswer) {
            // Simple case-insensitive comparison
            isCorrect = textAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
            if (isCorrect) {
              pointsEarned = question.points || 1;
            }
          }
        }
        
        // Add the processed answer
        attempt.answers.push({
          questionId,
          selectedOption: selectedOption || null,
          textAnswer: textAnswer || null,
          isCorrect,
          pointsEarned,
          timeSpent: answerData.timeSpent || 0
        });
      }
    }

    // Calculate final scores
    const now = new Date();
    attempt.endTime = now;
    attempt.submittedAt = now;
    attempt.timeSpent = Math.floor((now - attempt.startTime) / 1000); // in seconds
    attempt.status = 'completed';

    // Calculate percentage and assign grade
    attempt.calculatePercentageScore(attempt.exam.settings.totalPoints);
    attempt.assignGrade();
    attempt.checkPassed(attempt.exam.settings.passingScore);

    // Calculate risk score if proctoring was enabled
    if (attempt.proctoring.enabled) {
      attempt.calculateRiskScore();
    }

    await attempt.save();

    // Update exam analytics
    const exam = attempt.exam;
    exam.analytics.completedAttempts += 1;
    
    // Recalculate average score
    const allAttempts = await ExamAttempt.find({ 
      exam: exam._id, 
      status: 'completed' 
    });
    
    if (allAttempts.length > 0) {
      exam.analytics.averageScore = allAttempts.reduce((sum, att) => sum + att.score.percentage, 0) / allAttempts.length;
      exam.analytics.passRate = (allAttempts.filter(att => att.passed).length / allAttempts.length) * 100;
    }
    
    await exam.save();

    // Send completion notification email
    try {
      const notificationController = require('./notificationController');
      const mockReq = {
        body: {
          sessionId: attempt._id,
          score: attempt.score.percentage,
          passed: attempt.passed
        },
        user: { _id: attempt.student }
      };
      const mockRes = {
        status: () => ({ json: () => {} })
      };
      await notificationController.sendExamCompletionNotification(mockReq, mockRes);
    } catch (notificationError) {
      console.warn('Failed to send completion notification:', notificationError.message);
    }

    // Prepare detailed result data
    const resultData = {
      attemptId: attempt._id,
      examTitle: exam.title,
      score: {
        points: attempt.score.points,
        percentage: attempt.score.percentage,
        totalPoints: exam.settings.totalPoints,
        grade: attempt.score.grade
      },
      passed: attempt.passed,
      passingScore: exam.settings.passingScore,
      timeSpent: attempt.formattedTimeSpent,
      totalDuration: exam.settings.duration,
      submittedAt: attempt.submittedAt,
      questionsAnswered: attempt.answers.length,
      totalQuestions: exam.questions.length,
      showResults: exam.settings.showResultsImmediately || true,
      showDetailedResults: exam.settings.showDetailedResults || false,
      riskScore: attempt.proctoring?.riskScore || 0,
      flaggedForReview: attempt.proctoring?.flaggedForReview || false
    };

    // Include detailed answers if allowed
    if (exam.settings.showDetailedResults) {
      resultData.answers = attempt.answers.map(answer => ({
        questionId: answer.questionId,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        timeSpent: answer.timeSpent || 0
      }));
    }

    res.status(200).json({
      success: true,
      message: 'Exam submitted successfully',
      data: resultData
    });
  } catch (error) {
    console.error('Submit exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting exam',
      error: error.message
    });
  }
};

// @desc    Get exam statistics
// @route   GET /api/v1/exams/stats
// @access  Private/Admin
const getExamStats = async (req, res) => {
  try {
    // Get total exams count
    const totalExams = await Exam.countDocuments({ instructor: req.user.id });
    
    // Get active exams count
    const now = new Date();
    const activeExams = await Exam.countDocuments({
      instructor: req.user.id,
      status: { $in: ['active', 'published'] },
      'scheduling.startDate': { $lte: now },
      'scheduling.endDate': { $gte: now }
    });
    
    // Get completed attempts count
    const completedAttempts = await ExamAttempt.countDocuments({
      status: 'completed'
    });
    
    // Get flagged incidents count (high risk attempts)
    const flaggedIncidents = await ExamAttempt.countDocuments({
      'riskAssessment.riskScore': { $gte: 70 }
    });
    
    // Get recent exams (created in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentExams = await Exam.countDocuments({
      instructor: req.user.id,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    // Get exam analytics aggregation
    const examAnalytics = await Exam.aggregate([
      { $match: { instructor: req.user.id } },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$settings.totalPoints' },
          averageDuration: { $avg: '$settings.duration' },
          totalQuestions: { $sum: { $size: '$questions' } }
        }
      }
    ]);
    
    const analytics = examAnalytics[0] || {
      totalPoints: 0,
      averageDuration: 0,
      totalQuestions: 0
    };
    
    res.status(200).json({
      success: true,
      data: {
        totalExams,
        activeExams,
        completedAttempts,
        flaggedIncidents,
        recentExams,
        analytics: {
          totalPoints: analytics.totalPoints || 0,
          averageDuration: Math.round(analytics.averageDuration || 0),
          totalQuestions: analytics.totalQuestions || 0,
          averageQuestionsPerExam: totalExams > 0 ? Math.round((analytics.totalQuestions || 0) / totalExams) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get exam stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving exam statistics',
      error: error.message
    });
  }
};

module.exports = {
  createExam,
  getAdminExams,
  getAvailableExams,
  getExamById,
  updateExam,
  updateExamStatus,
  deleteExam,
  startExamAttempt,
  getExamAttempt,
  submitAnswer,
  submitExamAttempt,
  getExamStats
};

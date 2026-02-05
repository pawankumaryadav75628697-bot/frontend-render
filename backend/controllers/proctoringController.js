const aiProctoringService = require('../services/aiProctoringService');
const ProctoringSession = require('../models/ProctoringSession');
const Exam = require('../models/Exam');
const CodingExam = require('../models/CodingExam');
const ExamAttempt = require('../models/ExamAttempt');
const CodingExamAttempt = require('../models/CodingExamAttempt');

// @desc    Initialize proctoring session
// @route   POST /api/v1/proctoring/initialize
// @access  Private (Student)
exports.initializeProctoringSession = async (req, res) => {
  try {
    const {
      examId,
      codingExamId,
      examAttemptId,
      codingExamAttemptId,
      systemInfo
    } = req.body;

    // Verify exam exists and user has access
    let exam = null;
    let attempt = null;

    if (examId && examAttemptId) {
      exam = await Exam.findById(examId);
      attempt = await ExamAttempt.findById(examAttemptId)
        .populate('student');
      
      if (!exam || !attempt || attempt.student._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this exam'
        });
      }
    } else if (codingExamId && codingExamAttemptId) {
      exam = await CodingExam.findById(codingExamId);
      attempt = await CodingExamAttempt.findById(codingExamAttemptId)
        .populate('student');
      
      if (!exam || !attempt || attempt.student._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this exam'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either exam or coding exam information is required'
      });
    }

    // Check if exam requires proctoring
    if (!exam.proctoring?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Proctoring is not enabled for this exam'
      });
    }

    // Initialize proctoring session
    const sessionData = {
      studentId: req.user.id,
      examId: examId || null,
      codingExamId: codingExamId || null,
      examAttemptId: examAttemptId || null,
      codingExamAttemptId: codingExamAttemptId || null,
      strictMode: exam.proctoring?.lockdownBrowser || false,
      browser: systemInfo?.browser || 'Unknown',
      os: systemInfo?.os || 'Unknown',
      screenResolution: systemInfo?.screenResolution || {},
      cameraResolution: systemInfo?.cameraResolution || {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    const session = await aiProctoringService.initializeSession(sessionData);

    res.status(201).json({
      success: true,
      message: 'Proctoring session initialized successfully',
      data: {
        sessionId: session._id,
        settings: session.settings,
        requirements: {
          cameraRequired: exam.proctoring.cameraRequired,
          microphoneRequired: exam.proctoring.microphoneRequired,
          fullScreenRequired: true,
          lockdownMode: exam.proctoring.lockdownBrowser
        }
      }
    });

  } catch (error) {
    console.error('Initialize proctoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing proctoring session',
      error: error.message
    });
  }
};

// @desc    Analyze video frame
// @route   POST /api/v1/proctoring/analyze-frame
// @access  Private (Student)
exports.analyzeVideoFrame = async (req, res) => {
  try {
    const { sessionId, frameData } = req.body;

    if (!sessionId || !frameData) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and frame data are required'
      });
    }

    // Verify session belongs to user
    const session = await ProctoringSession.findById(sessionId);
    if (!session || session.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session'
      });
    }

    // Analyze frame using AI service
    const analysisResult = await aiProctoringService.analyzeFrame(sessionId, frameData);
    
    // Check for violations and warnings
    if (analysisResult.violations && analysisResult.violations.length > 0) {
      const violationResponse = await aiProctoringService.processViolations(
        sessionId, 
        analysisResult.violations,
        analysisResult.metadata
      );

      // Handle termination
      if (violationResponse.action === 'terminate') {
        return res.status(200).json({
          success: true,
          action: 'terminate',
          message: 'Exam has been terminated due to repeated violations',
          data: {
            reason: violationResponse.reason,
            warningCount: violationResponse.warningCount,
            terminated: true
          }
        });
      }

      // Handle warning
      if (violationResponse.action === 'warning') {
        return res.status(200).json({
          success: true,
          action: 'warning',
          message: violationResponse.message,
          data: {
            warningNumber: violationResponse.warningNumber,
            warningCount: violationResponse.warningCount,
            analysis: analysisResult
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      action: 'continue',
      data: {
        analysis: analysisResult,
        trustScore: analysisResult.trust_score || 1.0
      }
    });

  } catch (error) {
    console.error('Analyze video frame error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing video frame',
      error: error.message
    });
  }
};

// @desc    Record violation
// @route   POST /api/v1/proctoring/violation
// @access  Private (Student)
exports.recordViolation = async (req, res) => {
  try {
    const { sessionId, violationType, metadata } = req.body;

    if (!sessionId || !violationType) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and violation type are required'
      });
    }

    // Verify session belongs to user
    const session = await ProctoringSession.findById(sessionId);
    if (!session || session.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session'
      });
    }

    // Record violation
    const violationResponse = await aiProctoringService.recordViolation(
      sessionId, 
      violationType, 
      metadata || {}
    );

    // Handle termination
    if (violationResponse.action === 'terminate') {
      return res.status(200).json({
        success: true,
        action: 'terminate',
        message: 'Exam has been terminated due to repeated violations',
        data: {
          reason: violationResponse.reason,
          warningCount: violationResponse.warningCount,
          terminated: true
        }
      });
    }

    // Handle warning
    if (violationResponse.action === 'warning') {
      return res.status(200).json({
        success: true,
        action: 'warning',
        message: violationResponse.message,
        data: {
          warningNumber: violationResponse.warningNumber,
          warningCount: violationResponse.warningCount
        }
      });
    }

    res.status(200).json({
      success: true,
      action: 'continue',
      message: 'Violation recorded successfully'
    });

  } catch (error) {
    console.error('Record violation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording violation',
      error: error.message
    });
  }
};

// @desc    Get session status
// @route   GET /api/v1/proctoring/session/:sessionId
// @access  Private (Student/Admin)
exports.getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session access
    const session = await ProctoringSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check authorization
    const isOwner = session.student.toString() === req.user.id;
    const isAdmin = req.user.userType === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session'
      });
    }

    // Get session statistics
    const sessionStats = await aiProctoringService.getSessionStats(sessionId);

    res.status(200).json({
      success: true,
      data: sessionStats
    });

  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session status',
      error: error.message
    });
  }
};

// @desc    Terminate proctoring session
// @route   POST /api/v1/proctoring/terminate
// @access  Private (Student)
exports.terminateProctoringSession = async (req, res) => {
  try {
    const { sessionId, reason } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Verify session belongs to user
    const session = await ProctoringSession.findById(sessionId);
    if (!session || session.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session'
      });
    }

    // Terminate session
    const result = await aiProctoringService.terminateSession(sessionId, reason || 'completed');

    res.status(200).json({
      success: true,
      message: 'Proctoring session terminated successfully',
      data: result
    });

  } catch (error) {
    console.error('Terminate proctoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error terminating proctoring session',
      error: error.message
    });
  }
};

// @desc    Get all proctoring sessions (Admin only)
// @route   GET /api/v1/proctoring/sessions
// @access  Private (Admin)
exports.getAllProctoringSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, studentId, examId } = req.query;

    let filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (studentId) {
      filter.student = studentId;
    }
    
    if (examId) {
      filter.$or = [
        { exam: examId },
        { codingExam: examId }
      ];
    }

    const sessions = await ProctoringSession.find(filter)
      .populate('student', 'fullName email studentId')
      .populate('exam', 'title course')
      .populate('codingExam', 'title course')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProctoringSession.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSessions: total,
        hasMore: page * limit < total
      }
    });

  } catch (error) {
    console.error('Get all proctoring sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving proctoring sessions',
      error: error.message
    });
  }
};

// @desc    Get active proctoring sessions (Admin only)
// @route   GET /api/v1/proctoring/active-sessions
// @access  Private (Admin)
exports.getActiveSessions = async (req, res) => {
  try {
    const activeSessions = aiProctoringService.getActiveSessions();
    
    // Get detailed information for each active session
    const detailedSessions = await Promise.all(
      activeSessions.map(async (sessionInfo) => {
        const session = await ProctoringSession.findById(sessionInfo.sessionId)
          .populate('student', 'fullName email studentId')
          .populate('exam', 'title course')
          .populate('codingExam', 'title course');
        
        return {
          ...sessionInfo,
          sessionDetails: session
        };
      })
    );

    res.status(200).json({
      success: true,
      data: detailedSessions,
      count: detailedSessions.length
    });

  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving active sessions',
      error: error.message
    });
  }
};

// @desc    Install Python dependencies
// @route   POST /api/v1/proctoring/install-dependencies
// @access  Private (Admin)
exports.installPythonDependencies = async (req, res) => {
  try {
    const result = await aiProctoringService.installPythonDependencies();
    
    res.status(200).json({
      success: true,
      message: 'Python dependencies installed successfully',
      data: result
    });

  } catch (error) {
    console.error('Install Python dependencies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error installing Python dependencies',
      error: error.message
    });
  }
};

// @desc    Test AI service
// @route   POST /api/v1/proctoring/test-ai
// @access  Private (Admin)
exports.testAIService = async (req, res) => {
  try {
    const { testFrameData } = req.body;
    
    if (!testFrameData) {
      return res.status(400).json({
        success: false,
        message: 'Test frame data is required'
      });
    }

    // Create a temporary session for testing
    const testSession = await ProctoringSession.create({
      student: req.user.id,
      settings: {
        faceDetectionEnabled: true,
        eyeTrackingEnabled: true,
        tabSwitchMonitoring: false,
        strictMode: false
      },
      systemInfo: {
        browser: 'Test',
        os: 'Test'
      }
    });

    // Test AI analysis
    const result = await aiProctoringService.analyzeFrame(testSession._id, testFrameData);
    
    // Clean up test session
    await ProctoringSession.findByIdAndDelete(testSession._id);

    res.status(200).json({
      success: true,
      message: 'AI service test completed',
      data: result
    });

  } catch (error) {
    console.error('Test AI service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing AI service',
      error: error.message
    });
  }
};
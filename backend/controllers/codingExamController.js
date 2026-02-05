const CodingExam = require('../models/CodingExam');
const CodingExamAttempt = require('../models/CodingExamAttempt');
const CodingQuestion = require('../models/CodingQuestion');
const User = require('../models/User');
const codeExecutionService = require('../utils/codeExecutionService');
const notificationService = require('../utils/notificationService');

// @desc    Create coding exam from existing coding question
// @route   POST /api/v1/coding-exams
// @access  Private (Admin/Teacher)
exports.createCodingExam = async (req, res) => {
  try {
    const {
      title,
      description,
      codingQuestionId,
      course,
      courseCode,
      settings,
      scheduling,
      eligibleStudents,
      proctoring,
      notifyStudents = false
    } = req.body;

    // Validate coding question exists
    const codingQuestion = await CodingQuestion.findById(codingQuestionId);
    if (!codingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Coding question not found'
      });
    }

    // Set default allowed languages from coding question if not provided
    const allowedLanguages = settings?.allowedLanguages || codingQuestion.supportedLanguages;
    const totalPoints = settings?.totalPoints || codingQuestion.totalPoints;

    // Create coding exam
    const codingExam = await CodingExam.create({
      title,
      description,
      codingQuestion: codingQuestionId,
      course,
      courseCode,
      instructor: req.user.id,
      settings: {
        ...settings,
        allowedLanguages,
        totalPoints
      },
      scheduling,
      eligibleStudents: eligibleStudents || [],
      proctoring: proctoring || {}
    });

    await codingExam.populate([
      { path: 'codingQuestion', select: 'title difficulty category totalPoints' },
      { path: 'instructor', select: 'fullName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Coding exam created successfully',
      data: codingExam
    });

  } catch (error) {
    console.error('Create coding exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating coding exam',
      error: error.message
    });
  }
};

// @desc    Publish coding exam
// @route   PUT /api/v1/coding-exams/:id/publish
// @access  Private (Admin/Teacher)
exports.publishCodingExam = async (req, res) => {
  try {
    const codingExam = await CodingExam.findById(req.params.id)
      .populate('codingQuestion')
      .populate('eligibleStudents', 'fullName email phoneNumber');

    if (!codingExam) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam not found'
      });
    }

    // Check authorization
    if (codingExam.instructor.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this exam'
      });
    }

    // Update status to published
    codingExam.status = 'published';
    
    // Set to active if start date is now or in the past
    const now = new Date();
    if (now >= codingExam.scheduling.startDate) {
      codingExam.status = 'active';
    }

    await codingExam.save();

    // Send notifications to eligible students
    if (req.body.notifyStudents !== false) {
      await sendCodingExamNotifications(codingExam);
    }

    res.status(200).json({
      success: true,
      message: 'Coding exam published successfully',
      data: codingExam
    });

  } catch (error) {
    console.error('Publish coding exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing coding exam',
      error: error.message
    });
  }
};

// @desc    Get all coding exams
// @route   GET /api/v1/coding-exams
// @access  Private (Admin/Teacher/Student)
exports.getCodingExams = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, course } = req.query;
    
    let filter = {};
    
    // For students, only show published/active exams they're eligible for
    if (req.user.userType === 'student') {
      const now = new Date();
      filter = {
        status: { $in: ['published', 'active'] },
        'scheduling.endDate': { $gte: now },
        $or: [
          { eligibleStudents: req.user.id },
          { eligibleStudents: { $size: 0 } }
        ]
      };
    } else {
      // For admin/teacher, show exams they created (unless admin)
      if (req.user.userType !== 'admin') {
        filter.instructor = req.user.id;
      }
      
      if (status) {
        filter.status = status;
      }
    }

    if (course) {
      filter.course = new RegExp(course, 'i');
    }

    const codingExams = await CodingExam.find(filter)
      .populate('codingQuestion', 'title difficulty category totalPoints')
      .populate('instructor', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CodingExam.countDocuments(filter);

    // For students, add attempt information
    let processedExams = codingExams;
    if (req.user.userType === 'student') {
      processedExams = await Promise.all(codingExams.map(async (exam) => {
        const attempt = await CodingExamAttempt.findOne({
          student: req.user.id,
          codingExam: exam._id,
          status: { $in: ['in_progress', 'completed', 'submitted'] }
        });

        const examObj = exam.toObject();
        const nowTs = new Date();
        const hasScheduling = !!exam.scheduling && !!exam.scheduling.startDate && !!exam.scheduling.endDate;
        const startTs = hasScheduling ? new Date(exam.scheduling.startDate) : null;
        const endTs = hasScheduling ? new Date(exam.scheduling.endDate) : null;
        const withinWindow = hasScheduling ? (nowTs >= startTs && nowTs <= endTs) : false;
        const statusAllowsStart = exam.status === 'active' || (exam.status === 'published' && withinWindow);
        const durationMin = Number.isFinite(exam.settings?.duration) ? exam.settings.duration : 60;
        examObj.studentStatus = {
          hasAttempted: !!attempt,
          attemptStatus: attempt?.status || null,
          canStart: !attempt && statusAllowsStart,
          timeRemaining: attempt?.status === 'in_progress' && attempt.startedAt ? 
            Math.max(0, durationMin * 60 - Math.floor((new Date() - new Date(attempt.startedAt)) / 1000)) : null
        };

        return examObj;
      }));
    }

    res.status(200).json({
      success: true,
      data: processedExams,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalExams: total,
        hasMore: page * limit < total
      }
    });

  } catch (error) {
    console.error('Get coding exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching coding exams',
      error: error.message
    });
  }
};

// @desc    Get single coding exam
// @route   GET /api/v1/coding-exams/:id
// @access  Private (Admin/Teacher/Student)
exports.getCodingExam = async (req, res) => {
  try {
    const codingExam = await CodingExam.findById(req.params.id)
      .populate('codingQuestion')
      .populate('instructor', 'fullName email')
      .populate('eligibleStudents', 'fullName studentId');

    if (!codingExam) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam not found'
      });
    }

    // Check access for students
    if (req.user.userType === 'student') {
      if (!codingExam.isStudentEligible(req.user.id) && codingExam.eligibleStudents.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'You are not eligible for this exam'
        });
      }

      // Don't show solution code to students
      if (codingExam.codingQuestion.solutionCode) {
        codingExam.codingQuestion.solutionCode = undefined;
      }

      // Filter test cases for students
      codingExam.codingQuestion = codingExam.codingQuestion.getStudentVersion();
    }

    res.status(200).json({
      success: true,
      data: codingExam
    });

  } catch (error) {
    console.error('Get coding exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching coding exam',
      error: error.message
    });
  }
};

// @desc    Start coding exam attempt
// @route   POST /api/v1/coding-exams/:id/start
// @access  Private (Student)
exports.startCodingExamAttempt = async (req, res) => {
  try {
    const codingExam = await CodingExam.findById(req.params.id)
      .populate('codingQuestion');

    if (!codingExam) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam not found'
      });
    }

    // Check if student is eligible
    if (!codingExam.isStudentEligible(req.user.id) && codingExam.eligibleStudents.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible for this exam'
      });
    }

    // Check if exam is available (active or published and within window)
    const now = new Date();
    const hasScheduling = !!codingExam.scheduling && !!codingExam.scheduling.startDate && !!codingExam.scheduling.endDate;
    const withinWindow = hasScheduling ? (now >= codingExam.scheduling.startDate && now <= codingExam.scheduling.endDate) : false;
    const statusAllowsStart = codingExam.status === 'active' || (codingExam.status === 'published' && withinWindow);
    if (!statusAllowsStart) {
      return res.status(400).json({
        success: false,
        message: 'Exam is not currently active'
      });
    }

    // Check for existing attempts
    const existingAttempt = await CodingExamAttempt.findOne({
      student: req.user.id,
      codingExam: codingExam._id,
      status: 'in_progress'
    });

    if (existingAttempt) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active attempt for this exam',
        attemptId: existingAttempt._id
      });
    }

    // Count previous attempts
    const attemptCount = await CodingExamAttempt.countDocuments({
      student: req.user.id,
      codingExam: codingExam._id
    });

    if (attemptCount >= codingExam.settings.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: 'Maximum number of attempts reached'
      });
    }

    // Create new attempt
    const attempt = await CodingExamAttempt.create({
      codingExam: codingExam._id,
      student: req.user.id,
      attemptNumber: attemptCount + 1,
      submittedCode: codingExam.codingQuestion.starterCode?.c || codingExam.codingQuestion.starterCode?.python || '',
      programmingLanguage: (codingExam.settings?.allowedLanguages && codingExam.settings.allowedLanguages[0]) || codingExam.codingQuestion.supportedLanguages?.[0] || 'python',
      maxScore: Number.isFinite(codingExam.settings?.totalPoints) ? codingExam.settings.totalPoints : (codingExam.codingQuestion?.totalPoints || 100),
      timeLimit: Number.isFinite(codingExam.settings?.duration) ? codingExam.settings.duration : 60,
      systemInfo: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Update analytics
    codingExam.analytics.totalAttempts += 1;
    await codingExam.save();

    await attempt.populate([
      { path: 'codingExam', select: 'title settings scheduling' },
      { path: 'student', select: 'fullName studentId' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Coding exam attempt started successfully',
      data: attempt
    });

  } catch (error) {
    console.error('Start coding exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting coding exam attempt',
      error: error.message
    });
  }
};

// @desc    Get coding exam attempt
// @route   GET /api/v1/coding-exam-attempts/:id
// @access  Private (Student - own attempt, Admin/Teacher)
exports.getCodingExamAttempt = async (req, res) => {
  try {
    const attempt = await CodingExamAttempt.findById(req.params.id)
      .populate({
        path: 'codingExam',
        populate: {
          path: 'codingQuestion',
          select: req.user.userType === 'student' ? '-solutionCode' : ''
        }
      })
      .populate('student', 'fullName studentId');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam attempt not found'
      });
    }

    // Check authorization
    if (req.user.userType === 'student' && attempt.student._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attempt'
      });
    }

    // Auto-submit if overdue
    if (attempt.isOverdue && attempt.status === 'in_progress') {
      await attempt.autoSubmit();
    }

    res.status(200).json({
      success: true,
      data: attempt
    });

  } catch (error) {
    console.error('Get coding exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching coding exam attempt',
      error: error.message
    });
  }
};

// @desc    Update code in attempt (auto-save)
// @route   PUT /api/v1/coding-exam-attempts/:id/code
// @access  Private (Student - own attempt)
exports.updateAttemptCode = async (req, res) => {
  try {
    const { code, programmingLanguage } = req.body;

    const attempt = await CodingExamAttempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam attempt not found'
      });
    }

    // Check authorization
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this attempt'
      });
    }

    // Check if attempt is still active
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Attempt is no longer active'
      });
    }

    // Auto-submit if overdue
    if (attempt.isOverdue) {
      await attempt.autoSubmit();
      return res.status(400).json({
        success: false,
        message: 'Time limit exceeded. Attempt has been auto-submitted.'
      });
    }

    // Update code and language
    if (code !== undefined) {
      attempt.submittedCode = code;
      attempt.metadata.codeChanges += 1;
    }

    if (programmingLanguage && programmingLanguage !== attempt.programmingLanguage) {
      attempt.programmingLanguage = programmingLanguage;
      attempt.metadata.languageChanged = true;
    }

    // Update save metadata
    attempt.metadata.lastSaved = new Date();
    attempt.metadata.saveCount += 1;

    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Code saved successfully',
      data: {
        lastSaved: attempt.metadata.lastSaved,
        saveCount: attempt.metadata.saveCount
      }
    });

  } catch (error) {
    console.error('Update attempt code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating code',
      error: error.message
    });
  }
};

// @desc    Test code in attempt
// @route   POST /api/v1/coding-exam-attempts/:id/test
// @access  Private (Student - own attempt)
exports.testAttemptCode = async (req, res) => {
  try {
    const { code, programmingLanguage, customInput } = req.body;

    const attempt = await CodingExamAttempt.findById(req.params.id)
      .populate({
        path: 'codingExam',
        populate: { path: 'codingQuestion' }
      });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam attempt not found'
      });
    }

    // Check authorization
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to test this attempt'
      });
    }

    // Check if attempt is still active
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Attempt is no longer active'
      });
    }

    const codingQuestion = attempt.codingExam.codingQuestion;
    const testCode = code || attempt.submittedCode;
    const language = programmingLanguage || attempt.programmingLanguage;

    // For custom input testing
    if (customInput !== undefined) {
      const result = await codeExecutionService.executeCode(testCode, language, customInput, 10000);
      return res.status(200).json({
        success: true,
        data: {
          type: 'custom',
          result
        }
      });
    }

    // Test against visible test cases only
    const visibleTestCases = codingQuestion.testCases.filter(tc => !tc.isHidden);
    
    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No test cases available for testing'
      });
    }

    // Execute code against test cases
    const results = await codeExecutionService.testCode(
      testCode,
      language,
      visibleTestCases,
      codingQuestion.constraints.timeLimit
    );

    // Update execution metrics
    const executionTime = results.summary.averageExecutionTime || 0;
    const memoryUsage = results.summary.peakMemoryUsage || 0;
    const success = results.summary.passedTests > 0;
    
    attempt.updateExecutionMetrics(executionTime, memoryUsage, success);
    await attempt.save();

    res.status(200).json({
      success: true,
      data: {
        type: 'testCases',
        results: results.results.map(result => ({
          input: result.input,
          expectedOutput: result.expectedOutput,
          actualOutput: result.actualOutput,
          passed: result.passed,
          executionTime: result.executionTime,
          error: result.error
        })),
        summary: {
          totalTests: results.summary.totalTests,
          passedTests: results.summary.passedTests,
          failedTests: results.summary.failedTests,
          passRate: results.summary.passRate
        }
      }
    });

  } catch (error) {
    console.error('Test attempt code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing code',
      error: error.message
    });
  }
};

// @desc    Submit coding exam attempt
// @route   POST /api/v1/coding-exam-attempts/:id/submit
// @access  Private (Student - own attempt)
exports.submitCodingExamAttempt = async (req, res) => {
  try {
    const attempt = await CodingExamAttempt.findById(req.params.id)
      .populate({
        path: 'codingExam',
        populate: { path: 'codingQuestion' }
      });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Coding exam attempt not found'
      });
    }

    // Check authorization
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this attempt'
      });
    }

    // Check if attempt is still active
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Attempt has already been submitted'
      });
    }

    const codingQuestion = attempt.codingExam.codingQuestion;

    // Test code against all test cases for final scoring
    const allTestCases = codingQuestion.testCases;
    const results = await codeExecutionService.testCode(
      attempt.submittedCode,
      attempt.programmingLanguage,
      allTestCases,
      codingQuestion.constraints.timeLimit
    );

    // Store test results
    attempt.testResults = {
      totalTests: results.summary.totalTests,
      passedTests: results.summary.passedTests,
      failedTests: results.summary.failedTests,
      testCases: results.results,
      compilationError: results.compilationError || null,
      runtimeErrors: results.runtimeErrors || []
    };

    // Submit attempt (this will calculate final score)
    await attempt.submit();

    // Update exam analytics
    await attempt.codingExam.updateAnalytics();

    res.status(200).json({
      success: true,
      message: 'Coding exam attempt submitted successfully',
      data: {
        attemptId: attempt._id,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        testResults: {
          passedTests: attempt.testResults.passedTests,
          totalTests: attempt.testResults.totalTests,
          passRate: Math.round((attempt.testResults.passedTests / attempt.testResults.totalTests) * 100)
        },
        submittedAt: attempt.submittedAt,
        timeSpent: attempt.formattedTimeSpent
      }
    });

  } catch (error) {
    console.error('Submit coding exam attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting attempt',
      error: error.message
    });
  }
};

// @desc    Record proctoring violation
// @route   POST /api/v1/coding-exams/attempts/:id/violations
// @access  Private (Student)
exports.recordViolation = async (req, res) => {
  try {
    const attempt = await CodingExamAttempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
    }

    // Verify student owns this attempt
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this attempt'
      });
    }

    // Add violation to attempt
    const violation = {
      type: req.body.type,
      timestamp: req.body.timestamp || new Date(),
      metadata: req.body.metadata || {}
    };

    if (!attempt.proctoring) {
      attempt.proctoring = { violations: [] };
    }
    if (!attempt.proctoring.violations) {
      attempt.proctoring.violations = [];
    }

    attempt.proctoring.violations.push(violation);
    await attempt.save();

    console.log(`Violation recorded for attempt ${attempt._id}:`, violation.type);

    res.status(200).json({
      success: true,
      message: 'Violation recorded',
      data: {
        violationCount: attempt.proctoring.violations.length,
        violation
      }
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

// @desc    Terminate exam attempt due to violations
// @route   POST /api/v1/coding-exams/attempts/:id/terminate
// @access  Private (Student)
exports.terminateExamAttempt = async (req, res) => {
  try {
    const attempt = await CodingExamAttempt.findById(req.params.id)
      .populate('codingExam')
      .populate('codingQuestion');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
    }

    // Verify student owns this attempt
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this attempt'
      });
    }

    // Mark attempt as terminated
    attempt.status = 'terminated';
    attempt.submittedAt = new Date();
    attempt.terminationReason = req.body.reason || 'Maximum violations exceeded';
    
    // Store termination details
    if (!attempt.proctoring) {
      attempt.proctoring = {};
    }
    attempt.proctoring.terminated = true;
    attempt.proctoring.terminationTime = new Date();
    attempt.proctoring.terminationReason = req.body.reason;
    attempt.proctoring.totalViolations = req.body.totalViolations || 0;

    // Calculate score (0 for terminated attempts, or partial credit)
    attempt.score = {
      totalPoints: 0,
      earnedPoints: 0,
      percentage: 0
    };

    await attempt.save();

    console.log(`Exam attempt ${attempt._id} terminated due to violations`);

    res.status(200).json({
      success: true,
      message: 'Exam terminated due to violations',
      data: {
        attemptId: attempt._id,
        status: attempt.status,
        terminationReason: attempt.terminationReason,
        violationCount: attempt.proctoring.violations?.length || 0
      }
    });

  } catch (error) {
    console.error('Terminate exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error terminating exam',
      error: error.message
    });
  }
};

// Helper function to send coding exam notifications
async function sendCodingExamNotifications(codingExam) {
  try {
    // Get eligible students
    let students = [];
    
    if (codingExam.eligibleStudents.length > 0) {
      // Specific students
      students = codingExam.eligibleStudents;
    } else {
      // All active students
      students = await User.find({ 
        userType: 'student', 
        isActive: { $ne: false } 
      }).select('fullName email phoneNumber');
    }

    console.log(`Sending coding exam notifications to ${students.length} students`);

    // Send notifications
    const notificationPromises = students.map(async (student) => {
      if (student.email || student.phoneNumber) {
        return await notificationService.sendExamInvitation(student, {
          title: codingExam.title,
          examKey: codingExam.examKey,
          duration: codingExam.settings.duration,
          startTime: codingExam.scheduling.startDate,
          description: `Coding Challenge: ${codingExam.codingQuestion.title}`
        });
      }
    });

    await Promise.allSettled(notificationPromises);
    console.log('Coding exam notifications sent successfully');

  } catch (error) {
    console.error('Error sending coding exam notifications:', error);
  }
}

module.exports = {
  createCodingExam: exports.createCodingExam,
  publishCodingExam: exports.publishCodingExam,
  getCodingExams: exports.getCodingExams,
  getCodingExam: exports.getCodingExam,
  startCodingExamAttempt: exports.startCodingExamAttempt,
  getCodingExamAttempt: exports.getCodingExamAttempt,
  updateAttemptCode: exports.updateAttemptCode,
  testAttemptCode: exports.testAttemptCode,
  submitCodingExamAttempt: exports.submitCodingExamAttempt,
  recordViolation: exports.recordViolation,
  terminateExamAttempt: exports.terminateExamAttempt
};

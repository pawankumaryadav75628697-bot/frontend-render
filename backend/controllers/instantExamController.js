const InstantExam = require('../models/InstantExam');
const QuestionBank = require('../models/QuestionBank');
const ExamSession = require('../models/ExamSession');
const asyncHandler = require('express-async-handler');

// @desc    Create instant exam
// @route   POST /api/v1/instant-exams
// @access  Private (admin/teacher)
const createInstantExam = asyncHandler(async (req, res) => {
  const {
    title,
    examType,
    subject,
    difficulty,
    questionCount,
    duration,
    categories,
    tags,
    adaptiveSettings,
    aiSettings,
    settings,
    proctoring,
    generationRules
  } = req.body;

  // Validate question banks exist
  if (generationRules?.questionBankIds?.length > 0) {
    const questionBanks = await QuestionBank.find({
      _id: { $in: generationRules.questionBankIds },
      isActive: true
    });

    if (questionBanks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid question banks found for exam generation'
      });
    }
  }

  const instantExam = await InstantExam.create({
    title,
    examType,
    createdBy: req.user._id,
    subject,
    difficulty,
    questionCount,
    duration,
    categories,
    tags,
    adaptiveSettings,
    aiSettings,
    settings,
    proctoring,
    generationRules
  });

  // Generate questions automatically
  try {
    await instantExam.generateQuestions();
    
    res.status(201).json({
      success: true,
      message: 'Instant exam created and questions generated successfully',
      data: {
        exam: instantExam,
        accessCode: instantExam.accessCode,
        questionCount: instantExam.generatedQuestions.length
      }
    });
  } catch (error) {
    // If question generation fails, delete the exam
    await InstantExam.findByIdAndDelete(instantExam._id);
    
    res.status(400).json({
      success: false,
      message: 'Failed to generate questions for instant exam',
      error: error.message
    });
  }
});

// @desc    Get all instant exams for admin/teacher
// @route   GET /api/v1/instant-exams
// @access  Private (admin/teacher)
const getInstantExams = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, subject, examType, difficulty } = req.query;
  
  const query = { createdBy: req.user._id };
  
  if (status) query.status = status;
  if (subject) query.subject = new RegExp(subject, 'i');
  if (examType) query.examType = examType;
  if (difficulty) query.difficulty = difficulty;

  const exams = await InstantExam.find(query)
    .populate('createdBy', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await InstantExam.countDocuments(query);

  res.status(200).json({
    success: true,
    count: exams.length,
    pagination: {
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    },
    data: exams
  });
});

// @desc    Get instant exam by ID
// @route   GET /api/v1/instant-exams/:id
// @access  Private
const getInstantExamById = asyncHandler(async (req, res) => {
  const exam = await InstantExam.findById(req.params.id)
    .populate('createdBy', 'fullName email')
    .populate('generationRules.questionBankIds', 'title subject category');

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Instant exam not found'
    });
  }

  // Check access permissions
  if (req.user.userType === 'student') {
    // Return student version without answers
    const studentExam = exam.getStudentVersion();
    return res.status(200).json({
      success: true,
      data: studentExam
    });
  }

  res.status(200).json({
    success: true,
    data: exam
  });
});

// @desc    Get instant exam by access code
// @route   GET /api/v1/instant-exams/access/:code
// @access  Public
const getInstantExamByAccessCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const exam = await InstantExam.findOne({
    accessCode: code.toUpperCase(),
    status: 'ready',
    validUntil: { $gte: new Date() }
  });

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired access code'
    });
  }

  // Check if exam is still valid
  if (!exam.isValid()) {
    return res.status(400).json({
      success: false,
      message: 'Exam is no longer available'
    });
  }

  // Return basic exam info for students
  const examInfo = {
    _id: exam._id,
    title: exam.title,
    subject: exam.subject,
    duration: exam.duration,
    questionCount: exam.questionCount,
    difficulty: exam.difficulty,
    examType: exam.examType,
    settings: {
      shuffleQuestions: exam.settings.shuffleQuestions,
      allowReview: exam.settings.allowReview,
      showResults: exam.settings.showResults,
      maxRetakes: exam.settings.maxRetakes,
      negativeMarking: exam.settings.negativeMarking
    },
    proctoring: exam.proctoring,
    validUntil: exam.validUntil
  };

  res.status(200).json({
    success: true,
    data: examInfo
  });
});

// @desc    Start instant exam attempt
// @route   POST /api/v1/instant-exams/:id/start
// @access  Private (student)
const startInstantExamAttempt = asyncHandler(async (req, res) => {
  const { deviceInfo, faceRecognition } = req.body;

  const exam = await InstantExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Instant exam not found'
    });
  }

  if (!exam.isValid()) {
    return res.status(400).json({
      success: false,
      message: 'Exam is no longer available'
    });
  }

  // Check if student has exceeded retry attempts
  const existingAttempts = await ExamSession.countDocuments({
    examId: exam._id,
    examType: 'InstantExam',
    studentId: req.user._id,
    status: { $in: ['completed', 'submitted'] }
  });

  if (existingAttempts >= exam.settings.maxRetakes) {
    return res.status(400).json({
      success: false,
      message: 'Maximum retry attempts exceeded'
    });
  }

  // Check for active session
  const activeSession = await ExamSession.findOne({
    examId: exam._id,
    examType: 'InstantExam',
    studentId: req.user._id,
    status: { $in: ['started', 'in-progress', 'paused'] }
  });

  if (activeSession) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active session for this exam',
      data: {
        sessionId: activeSession.sessionId,
        remainingTime: activeSession.remainingTime
      }
    });
  }

  // Create new exam session
  const session = await ExamSession.create({
    examId: exam._id,
    examType: 'InstantExam',
    studentId: req.user._id,
    remainingTime: exam.duration * 60, // Convert minutes to seconds
    deviceInfo,
    faceRecognition: {
      enabled: exam.proctoring.cameraMonitoring,
      referenceImage: faceRecognition?.referenceImage
    },
    proctoring: {
      enabled: exam.proctoring.enabled,
      maxViolationsAllowed: exam.proctoring.maxViolations
    },
    status: 'in-progress'
  });

  // Update exam stats
  exam.stats.totalAttempts += 1;
  await exam.save();

  // Return exam questions for student
  const studentExam = exam.getStudentVersion();

  res.status(201).json({
    success: true,
    message: 'Exam session started successfully',
    data: {
      session: {
        sessionId: session.sessionId,
        remainingTime: session.remainingTime,
        startTime: session.startTime
      },
      exam: studentExam
    }
  });
});

// @desc    Submit answer for instant exam
// @route   PUT /api/v1/instant-exams/sessions/:sessionId/answer
// @access  Private (student)
const submitInstantExamAnswer = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { questionId, selectedOption, textAnswer, timeSpent } = req.body;

  const session = await ExamSession.findOne({
    sessionId,
    studentId: req.user._id,
    status: { $in: ['started', 'in-progress'] }
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Active exam session not found'
    });
  }

  // Get the exam to validate the answer
  const exam = await InstantExam.findById(session.examId);
  const question = exam.generatedQuestions.id(questionId);

  if (!question) {
    return res.status(404).json({
      success: false,
      message: 'Question not found'
    });
  }

  // Validate and score the answer
  let isCorrect = false;
  let points = 0;

  if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
    const correctOption = question.options.find(opt => opt.isCorrect);
    isCorrect = correctOption && correctOption._id.toString() === selectedOption;
  } else if (question.questionType === 'short-answer') {
    // Simple text matching (could be enhanced with fuzzy matching)
    isCorrect = question.correctAnswer && 
                question.correctAnswer.toLowerCase().trim() === textAnswer.toLowerCase().trim();
  }

  if (isCorrect) {
    points = question.points;
  } else if (exam.settings.negativeMarking.enabled) {
    points = -(question.points * exam.settings.negativeMarking.penalty);
  }

  // Submit answer to session
  const answer = {
    selectedOption,
    textAnswer
  };

  await session.submitAnswer(questionId, answer, question.questionType);

  // Update answer with scoring information
  const answerIndex = session.answers.findIndex(a => a.questionId.toString() === questionId);
  if (answerIndex >= 0) {
    session.answers[answerIndex].isCorrect = isCorrect;
    session.answers[answerIndex].points = points;
    session.answers[answerIndex].timeSpent = timeSpent;
    await session.save();
  }

  res.status(200).json({
    success: true,
    message: 'Answer submitted successfully',
    data: {
      isCorrect,
      points,
      explanation: exam.settings.showCorrectAnswers ? question.explanation : undefined
    }
  });
});

// @desc    Submit instant exam
// @route   PUT /api/v1/instant-exams/sessions/:sessionId/submit
// @access  Private (student)
const submitInstantExam = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { feedback } = req.body;

  const session = await ExamSession.findOne({
    sessionId,
    studentId: req.user._id,
    status: { $in: ['started', 'in-progress', 'paused'] }
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Active exam session not found'
    });
  }

  // Mark session as completed
  session.status = 'submitted';
  session.endTime = new Date();

  // Add student feedback if provided
  if (feedback) {
    session.feedback.studentFeedback = feedback;
  }

  // Calculate final score
  await session.calculateScore();

  // Analyze patterns for potential cheating
  await session.analyzePatterns();

  // Update exam statistics
  const exam = await InstantExam.findById(session.examId);
  exam.stats.completedAttempts += 1;
  
  // Update average score
  const totalScore = (exam.stats.averageScore * (exam.stats.completedAttempts - 1)) + session.scoring.percentage;
  exam.stats.averageScore = Math.round(totalScore / exam.stats.completedAttempts);
  
  // Update completion rate
  exam.stats.completionRate = Math.round((exam.stats.completedAttempts / exam.stats.totalAttempts) * 100);
  
  // Update average time
  const sessionDuration = session.duration / 60; // Convert to minutes
  const totalTime = (exam.stats.averageTime * (exam.stats.completedAttempts - 1)) + sessionDuration;
  exam.stats.averageTime = Math.round(totalTime / exam.stats.completedAttempts);

  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Exam submitted successfully',
    data: {
      score: session.scoring.percentage,
      grade: session.scoring.grade,
      isPassed: session.scoring.isPassed,
      totalPoints: session.scoring.totalPoints,
      maxPossiblePoints: session.scoring.maxPossiblePoints,
      questionsCorrect: session.questionsCorrect,
      questionsAttempted: session.questionsAttempted,
      timeTaken: session.duration,
      violations: session.proctoring.totalViolations,
      showResults: exam.settings.showResults,
      showCorrectAnswers: exam.settings.showCorrectAnswers
    }
  });
});

// @desc    Get instant exam session
// @route   GET /api/v1/instant-exams/sessions/:sessionId
// @access  Private
const getInstantExamSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await ExamSession.findOne({ sessionId })
    .populate('studentId', 'fullName email studentId')
    .populate('examId');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Exam session not found'
    });
  }

  // Check access permissions
  if (req.user.userType === 'student' && session.studentId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    Update instant exam
// @route   PUT /api/v1/instant-exams/:id
// @access  Private (admin/teacher)
const updateInstantExam = asyncHandler(async (req, res) => {
  const exam = await InstantExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Instant exam not found'
    });
  }

  // Check if user owns this exam
  if (exam.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this exam'
    });
  }

  // Don't allow updates if exam has active sessions
  const activeSessions = await ExamSession.countDocuments({
    examId: exam._id,
    status: { $in: ['started', 'in-progress', 'paused'] }
  });

  if (activeSessions > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot update exam with active sessions'
    });
  }

  const updatedExam = await InstantExam.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  // Regenerate questions if generation rules changed
  if (req.body.generationRules || req.body.questionCount) {
    await updatedExam.generateQuestions();
  }

  res.status(200).json({
    success: true,
    message: 'Instant exam updated successfully',
    data: updatedExam
  });
});

// @desc    Delete instant exam
// @route   DELETE /api/v1/instant-exams/:id
// @access  Private (admin/teacher)
const deleteInstantExam = asyncHandler(async (req, res) => {
  const exam = await InstantExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Instant exam not found'
    });
  }

  // Check if user owns this exam
  if (exam.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this exam'
    });
  }

  // Don't allow deletion if exam has sessions
  const sessionCount = await ExamSession.countDocuments({
    examId: exam._id
  });

  if (sessionCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete exam with existing sessions'
    });
  }

  await exam.remove();

  res.status(200).json({
    success: true,
    message: 'Instant exam deleted successfully'
  });
});

// @desc    Generate new access code
// @route   POST /api/v1/instant-exams/:id/regenerate-code
// @access  Private (admin/teacher)
const regenerateAccessCode = asyncHandler(async (req, res) => {
  const exam = await InstantExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Instant exam not found'
    });
  }

  // Check if user owns this exam
  if (exam.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to modify this exam'
    });
  }

  exam.accessCode = exam.generateAccessCode();
  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Access code regenerated successfully',
    data: {
      accessCode: exam.accessCode
    }
  });
});

module.exports = {
  createInstantExam,
  getInstantExams,
  getInstantExamById,
  getInstantExamByAccessCode,
  startInstantExamAttempt,
  submitInstantExamAnswer,
  submitInstantExam,
  getInstantExamSession,
  updateInstantExam,
  deleteInstantExam,
  regenerateAccessCode
};
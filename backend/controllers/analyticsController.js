const Exam = require('../models/Exam');
const InstantExam = require('../models/InstantExam');
const ExamSession = require('../models/ExamSession');
const ExamAttempt = require('../models/ExamAttempt');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// @desc    Get dashboard analytics
// @route   GET /api/v1/analytics/dashboard
// @access  Private (admin/teacher)
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;
  
  // Calculate date range
  let startDate = new Date();
  switch (timeframe) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Get user-specific data based on role
  const isAdmin = req.user.userType === 'admin';
  const creatorFilter = isAdmin ? {} : { createdBy: req.user._id };
  const instructorFilter = isAdmin ? {} : { instructor: req.user._id };

  // Basic counts
  const [
    totalExams,
    totalInstantExams,
    totalStudents,
    totalSessions,
    recentSessions,
    examAttempts
  ] = await Promise.all([
    Exam.countDocuments(instructorFilter),
    InstantExam.countDocuments(creatorFilter),
    User.countDocuments({ userType: 'student' }),
    ExamSession.countDocuments({ 
      createdAt: { $gte: startDate },
      ...(isAdmin ? {} : { 
        $or: [
          { examId: { $in: await Exam.find(instructorFilter).distinct('_id') } },
          { examId: { $in: await InstantExam.find(creatorFilter).distinct('_id') } }
        ]
      })
    }),
    ExamSession.find({ 
      createdAt: { $gte: startDate },
      status: { $in: ['submitted', 'completed'] }
    }).limit(10).sort({ createdAt: -1 }),
    ExamAttempt.countDocuments({ 
      createdAt: { $gte: startDate },
      ...(isAdmin ? {} : { examId: { $in: await Exam.find(instructorFilter).distinct('_id') } })
    })
  ]);

  // Performance metrics
  const completedSessions = await ExamSession.find({
    status: 'submitted',
    createdAt: { $gte: startDate }
  });

  const averageScore = completedSessions.length > 0 
    ? completedSessions.reduce((sum, session) => sum + session.scoring.percentage, 0) / completedSessions.length
    : 0;

  const passRate = completedSessions.length > 0
    ? (completedSessions.filter(session => session.scoring.isPassed).length / completedSessions.length) * 100
    : 0;

  // Violation statistics
  const violationsData = await ExamSession.aggregate([
    {
      $match: {
        'proctoring.violations.0': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $unwind: '$proctoring.violations'
    },
    {
      $group: {
        _id: '$proctoring.violations.type',
        count: { $sum: 1 },
        severity: { $push: '$proctoring.violations.severity' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Time-based analytics
  const dailyStats = await ExamSession.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        sessions: { $sum: 1 },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0]
          }
        },
        averageScore: {
          $avg: '$scoring.percentage'
        },
        violations: { $sum: '$proctoring.totalViolations' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalExams,
        totalInstantExams,
        totalStudents,
        totalSessions,
        totalAttempts: examAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100
      },
      recentActivity: recentSessions.map(session => ({
        id: session._id,
        studentName: session.studentId?.fullName || 'Unknown',
        examType: session.examType,
        score: session.scoring.percentage,
        status: session.status,
        violations: session.proctoring.totalViolations,
        createdAt: session.createdAt
      })),
      violations: violationsData,
      trends: dailyStats.map(stat => ({
        date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
        sessions: stat.sessions,
        completed: stat.completed,
        averageScore: Math.round(stat.averageScore * 100) / 100,
        violations: stat.violations
      }))
    }
  });
});

// @desc    Get exam performance analytics
// @route   GET /api/v1/analytics/exam-performance
// @access  Private (admin/teacher)
const getExamPerformanceAnalytics = asyncHandler(async (req, res) => {
  const { examId, examType = 'Exam' } = req.query;

  if (!examId) {
    return res.status(400).json({
      success: false,
      message: 'Exam ID is required'
    });
  }

  // Verify exam exists and user has access
  const ExamModel = examType === 'InstantExam' ? InstantExam : Exam;
  const exam = await ExamModel.findById(examId);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Check access permissions
  const hasAccess = req.user.userType === 'admin' ||
                   (examType === 'InstantExam' && exam.createdBy.toString() === req.user._id.toString()) ||
                   (examType === 'Exam' && exam.instructor.toString() === req.user._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get all sessions for this exam
  const sessions = await ExamSession.find({
    examId,
    examType,
    status: 'submitted'
  }).populate('studentId', 'fullName email studentId');

  if (sessions.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No completed attempts found',
      data: {
        exam: {
          id: exam._id,
          title: exam.title,
          totalQuestions: examType === 'InstantExam' ? exam.questionCount : exam.questions.length
        },
        stats: {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          averageTime: 0
        },
        distribution: [],
        studentPerformance: [],
        questionAnalysis: []
      }
    });
  }

  // Calculate basic statistics
  const totalAttempts = sessions.length;
  const averageScore = sessions.reduce((sum, s) => sum + s.scoring.percentage, 0) / totalAttempts;
  const passRate = (sessions.filter(s => s.scoring.isPassed).length / totalAttempts) * 100;
  const averageTime = sessions.reduce((sum, s) => sum + s.duration, 0) / totalAttempts;

  // Score distribution
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 }
  ];

  const distribution = scoreRanges.map(range => ({
    range: range.range,
    count: sessions.filter(s => s.scoring.percentage >= range.min && s.scoring.percentage <= range.max).length,
    percentage: Math.round((sessions.filter(s => s.scoring.percentage >= range.min && s.scoring.percentage <= range.max).length / totalAttempts) * 100)
  }));

  // Student performance details
  const studentPerformance = sessions.map(session => ({
    student: {
      id: session.studentId._id,
      name: session.studentId.fullName,
      email: session.studentId.email,
      studentId: session.studentId.studentId
    },
    score: session.scoring.percentage,
    grade: session.scoring.grade,
    timeTaken: Math.round(session.duration / 60), // Convert to minutes
    violations: session.proctoring.totalViolations,
    questionsCorrect: session.questionsCorrect,
    questionsAttempted: session.questionsAttempted,
    submittedAt: session.endTime
  }));

  // Question-wise analysis for regular exams
  let questionAnalysis = [];
  if (examType === 'Exam' && exam.questions.length > 0) {
    questionAnalysis = exam.questions.map((question, index) => {
      const questionAttempts = sessions.map(session => 
        session.answers.find(answer => answer.questionId.toString() === question._id.toString())
      ).filter(Boolean);

      const correctAnswers = questionAttempts.filter(attempt => attempt.isCorrect).length;
      const totalAttempts = questionAttempts.length;
      const accuracy = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;
      const averageTime = questionAttempts.length > 0 
        ? questionAttempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0) / questionAttempts.length 
        : 0;

      return {
        questionNumber: index + 1,
        questionId: question._id,
        questionText: question.questionText.substring(0, 100) + '...',
        difficulty: question.difficulty || 'medium',
        points: question.points,
        totalAttempts,
        correctAnswers,
        accuracy: Math.round(accuracy * 100) / 100,
        averageTime: Math.round(averageTime),
        discriminationIndex: calculateDiscriminationIndex(questionAttempts, sessions)
      };
    });
  }

  res.status(200).json({
    success: true,
    data: {
      exam: {
        id: exam._id,
        title: exam.title,
        type: examType,
        totalQuestions: examType === 'InstantExam' ? exam.questionCount : exam.questions.length,
        duration: examType === 'InstantExam' ? exam.duration : exam.settings.duration
      },
      stats: {
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        averageTime: Math.round(averageTime / 60) // Convert to minutes
      },
      distribution,
      studentPerformance,
      questionAnalysis
    }
  });
});

// Helper function to calculate discrimination index
const calculateDiscriminationIndex = (questionAttempts, allSessions) => {
  if (questionAttempts.length < 10) return 0; // Not enough data

  // Sort sessions by total score
  const sortedSessions = allSessions.sort((a, b) => b.scoring.percentage - a.scoring.percentage);
  const upperGroup = sortedSessions.slice(0, Math.floor(sortedSessions.length * 0.27));
  const lowerGroup = sortedSessions.slice(-Math.floor(sortedSessions.length * 0.27));

  const upperCorrect = upperGroup.filter(session => {
    const attempt = questionAttempts.find(qa => qa.questionId && session._id.toString() === session._id.toString());
    return attempt && attempt.isCorrect;
  }).length;

  const lowerCorrect = lowerGroup.filter(session => {
    const attempt = questionAttempts.find(qa => qa.questionId && session._id.toString() === session._id.toString());
    return attempt && attempt.isCorrect;
  }).length;

  const discrimination = (upperCorrect - lowerCorrect) / Math.floor(sortedSessions.length * 0.27);
  return Math.round(discrimination * 100) / 100;
};

// @desc    Get student performance analytics
// @route   GET /api/v1/analytics/student-performance/:studentId
// @access  Private (admin/teacher/student)
const getStudentPerformanceAnalytics = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { timeframe = '30d' } = req.query;

  // Check if user can access this student's data
  if (req.user.userType === 'student' && req.user._id.toString() !== studentId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const student = await User.findById(studentId);
  if (!student || student.userType !== 'student') {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Calculate date range
  let startDate = new Date();
  switch (timeframe) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  // Get student's exam sessions
  const sessions = await ExamSession.find({
    studentId,
    status: 'submitted',
    createdAt: { $gte: startDate }
  }).populate({
    path: 'examId',
    select: 'title subject duration'
  }).sort({ createdAt: -1 });

  const examAttempts = await ExamAttempt.find({
    student: studentId,
    createdAt: { $gte: startDate }
  }).populate({
    path: 'examId',
    select: 'title course'
  }).sort({ createdAt: -1 });

  // Calculate statistics
  const totalAttempts = sessions.length + examAttempts.length;
  const averageScore = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.scoring.percentage, 0) / sessions.length
    : (examAttempts.length > 0 ? examAttempts.reduce((sum, a) => sum + a.score, 0) / examAttempts.length : 0);

  const passedExams = sessions.filter(s => s.scoring.isPassed).length + 
                     examAttempts.filter(a => a.passed).length;
  const passRate = totalAttempts > 0 ? (passedExams / totalAttempts) * 100 : 0;

  // Performance trend
  const performanceData = [
    ...sessions.map(session => ({
      date: session.createdAt,
      score: session.scoring.percentage,
      examTitle: session.examId?.title || 'Unknown Exam',
      examType: 'InstantExam',
      violations: session.proctoring.totalViolations,
      timeTaken: Math.round(session.duration / 60)
    })),
    ...examAttempts.map(attempt => ({
      date: attempt.createdAt,
      score: attempt.score,
      examTitle: attempt.examId?.title || 'Unknown Exam',
      examType: 'Exam',
      violations: 0,
      timeTaken: attempt.timeSpent ? Math.round(attempt.timeSpent / 60) : 0
    }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Subject-wise performance
  const subjectPerformance = {};
  sessions.forEach(session => {
    const subject = session.examId?.subject || 'Unknown';
    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = {
        attempts: 0,
        totalScore: 0,
        passed: 0
      };
    }
    subjectPerformance[subject].attempts++;
    subjectPerformance[subject].totalScore += session.scoring.percentage;
    if (session.scoring.isPassed) subjectPerformance[subject].passed++;
  });

  examAttempts.forEach(attempt => {
    const subject = attempt.examId?.course || 'Unknown';
    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = {
        attempts: 0,
        totalScore: 0,
        passed: 0
      };
    }
    subjectPerformance[subject].attempts++;
    subjectPerformance[subject].totalScore += attempt.score;
    if (attempt.passed) subjectPerformance[subject].passed++;
  });

  const subjectStats = Object.keys(subjectPerformance).map(subject => ({
    subject,
    attempts: subjectPerformance[subject].attempts,
    averageScore: Math.round((subjectPerformance[subject].totalScore / subjectPerformance[subject].attempts) * 100) / 100,
    passRate: Math.round((subjectPerformance[subject].passed / subjectPerformance[subject].attempts) * 100)
  }));

  // Violation analysis
  const violations = sessions.reduce((acc, session) => {
    session.proctoring.violations?.forEach(violation => {
      if (!acc[violation.type]) {
        acc[violation.type] = 0;
      }
      acc[violation.type]++;
    });
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      student: {
        id: student._id,
        name: student.fullName,
        email: student.email,
        studentId: student.studentId,
        course: student.course,
        semester: student.semester
      },
      overview: {
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        totalViolations: Object.values(violations).reduce((sum, count) => sum + count, 0)
      },
      performanceData,
      subjectPerformance: subjectStats,
      violations,
      recentActivity: performanceData.slice(-10)
    }
  });
});

// @desc    Get comparative analytics
// @route   GET /api/v1/analytics/comparative
// @access  Private (admin/teacher)
const getComparativeAnalytics = asyncHandler(async (req, res) => {
  const { examIds, studentIds, timeframe = '30d' } = req.query;

  if (!examIds && !studentIds) {
    return res.status(400).json({
      success: false,
      message: 'Either examIds or studentIds must be provided'
    });
  }

  // Calculate date range
  let startDate = new Date();
  switch (timeframe) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  let comparisonData = {};

  if (examIds) {
    // Compare exams
    const examIdArray = examIds.split(',');
    comparisonData = await compareExams(examIdArray, startDate);
  }

  if (studentIds) {
    // Compare students
    const studentIdArray = studentIds.split(',');
    comparisonData = await compareStudents(studentIdArray, startDate);
  }

  res.status(200).json({
    success: true,
    data: comparisonData
  });
});

// Helper function to compare exams
const compareExams = async (examIds, startDate) => {
  const comparisons = [];

  for (const examId of examIds) {
    const sessions = await ExamSession.find({
      examId,
      status: 'submitted',
      createdAt: { $gte: startDate }
    });

    const exam = await Exam.findById(examId).select('title') || 
                 await InstantExam.findById(examId).select('title');

    if (sessions.length > 0) {
      const averageScore = sessions.reduce((sum, s) => sum + s.scoring.percentage, 0) / sessions.length;
      const passRate = (sessions.filter(s => s.scoring.isPassed).length / sessions.length) * 100;
      const averageTime = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;

      comparisons.push({
        examId,
        examTitle: exam?.title || 'Unknown Exam',
        totalAttempts: sessions.length,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        averageTime: Math.round(averageTime / 60), // Convert to minutes
        highestScore: Math.max(...sessions.map(s => s.scoring.percentage)),
        lowestScore: Math.min(...sessions.map(s => s.scoring.percentage))
      });
    }
  }

  return {
    type: 'exam_comparison',
    data: comparisons
  };
};

// Helper function to compare students
const compareStudents = async (studentIds, startDate) => {
  const comparisons = [];

  for (const studentId of studentIds) {
    const student = await User.findById(studentId).select('fullName email studentId');
    
    if (student) {
      const sessions = await ExamSession.find({
        studentId,
        status: 'submitted',
        createdAt: { $gte: startDate }
      });

      const examAttempts = await ExamAttempt.find({
        student: studentId,
        createdAt: { $gte: startDate }
      });

      const totalAttempts = sessions.length + examAttempts.length;
      
      if (totalAttempts > 0) {
        const sessionScores = sessions.map(s => s.scoring.percentage);
        const attemptScores = examAttempts.map(a => a.score);
        const allScores = [...sessionScores, ...attemptScores];
        
        const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
        const passedCount = sessions.filter(s => s.scoring.isPassed).length + 
                           examAttempts.filter(a => a.passed).length;
        const passRate = (passedCount / totalAttempts) * 100;

        comparisons.push({
          studentId,
          studentName: student.fullName,
          studentEmail: student.email,
          studentNumber: student.studentId,
          totalAttempts,
          averageScore: Math.round(averageScore * 100) / 100,
          passRate: Math.round(passRate * 100) / 100,
          highestScore: Math.max(...allScores),
          lowestScore: Math.min(...allScores),
          totalViolations: sessions.reduce((sum, s) => sum + s.proctoring.totalViolations, 0)
        });
      }
    }
  }

  return {
    type: 'student_comparison',
    data: comparisons
  };
};

module.exports = {
  getDashboardAnalytics,
  getExamPerformanceAnalytics,
  getStudentPerformanceAnalytics,
  getComparativeAnalytics
};
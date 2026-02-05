const ExamAttempt = require('../models/ExamAttempt');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Subject = require('../models/Subject');

// @desc    Generate comprehensive exam report
// @route   GET /api/v1/reports/exam/:examId
// @access  Private (Admin/Teacher)
exports.generateExamReport = async (req, res) => {
  try {
    const { examId } = req.params;
    const { format = 'json' } = req.query;

    // Verify access
    const exam = await Exam.findById(examId).populate('instructor', 'fullName email');
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    if (req.user.userType === 'teacher' && exam.instructor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all exam attempts
    const attempts = await ExamAttempt.find({ exam: examId })
      .populate('student', 'fullName studentId email college department semester')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter(a => a.status === 'completed').length,
      inProgressAttempts: attempts.filter(a => a.status === 'in_progress').length,
      cancelledAttempts: attempts.filter(a => a.status === 'cancelled').length,
      flaggedAttempts: attempts.filter(a => a.proctoring?.flaggedForReview).length,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0,
      averageTimeSpent: 0,
      averageRiskScore: 0
    };

    const completedAttempts = attempts.filter(a => a.status === 'completed');
    
    if (completedAttempts.length > 0) {
      const scores = completedAttempts.map(a => a.score.percentage);
      const timeSpent = completedAttempts.map(a => a.timeSpent);
      const riskScores = completedAttempts.map(a => a.proctoring?.riskScore || 0);

      stats.averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
      stats.highestScore = Math.max(...scores);
      stats.lowestScore = Math.min(...scores);
      stats.passRate = Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100);
      stats.averageTimeSpent = Math.round(timeSpent.reduce((a, b) => a + b, 0) / timeSpent.length);
      stats.averageRiskScore = Math.round((riskScores.reduce((a, b) => a + b, 0) / riskScores.length) * 100) / 100;
    }

    // Grade distribution
    const gradeDistribution = {
      'A+': 0, 'A': 0, 'A-': 0,
      'B+': 0, 'B': 0, 'B-': 0,
      'C+': 0, 'C': 0, 'C-': 0,
      'D+': 0, 'D': 0, 'F': 0
    };

    completedAttempts.forEach(attempt => {
      if (gradeDistribution.hasOwnProperty(attempt.score.grade)) {
        gradeDistribution[attempt.score.grade]++;
      }
    });

    // Question-wise analysis
    const questionAnalysis = exam.questions.map((question, index) => {
      const questionAttempts = completedAttempts.map(attempt => 
        attempt.answers.find(ans => ans.questionId.toString() === question._id.toString())
      ).filter(Boolean);

      const correctAnswers = questionAttempts.filter(ans => ans.isCorrect).length;
      const totalAnswers = questionAttempts.length;
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

      // For multiple choice, get option distribution
      let optionDistribution = {};
      if (question.questionType === 'multiple-choice') {
        question.options.forEach(option => {
          const count = questionAttempts.filter(ans => 
            ans.selectedOption && ans.selectedOption.toString() === option._id.toString()
          ).length;
          optionDistribution[option.text] = count;
        });
      }

      return {
        questionNumber: index + 1,
        questionText: question.questionText.substring(0, 100) + (question.questionText.length > 100 ? '...' : ''),
        questionType: question.questionType,
        points: question.points,
        totalAttempts: totalAnswers,
        correctAnswers,
        accuracy: `${accuracy}%`,
        optionDistribution: question.questionType === 'multiple-choice' ? optionDistribution : null
      };
    });

    // Proctoring analysis
    const proctoringAnalysis = {
      totalEvents: 0,
      eventTypes: {},
      riskDistribution: {
        low: attempts.filter(a => (a.proctoring?.riskScore || 0) < 25).length,
        medium: attempts.filter(a => (a.proctoring?.riskScore || 0) >= 25 && (a.proctoring?.riskScore || 0) < 50).length,
        high: attempts.filter(a => (a.proctoring?.riskScore || 0) >= 50 && (a.proctoring?.riskScore || 0) < 75).length,
        critical: attempts.filter(a => (a.proctoring?.riskScore || 0) >= 75).length
      }
    };

    attempts.forEach(attempt => {
      if (attempt.proctoring?.events) {
        proctoringAnalysis.totalEvents += attempt.proctoring.events.length;
        attempt.proctoring.events.forEach(event => {
          if (!proctoringAnalysis.eventTypes[event.eventType]) {
            proctoringAnalysis.eventTypes[event.eventType] = 0;
          }
          proctoringAnalysis.eventTypes[event.eventType]++;
        });
      }
    });

    // Student performance details
    const studentPerformance = completedAttempts.map(attempt => ({
      studentId: attempt.student.studentId,
      studentName: attempt.student.fullName,
      email: attempt.student.email,
      college: attempt.student.college,
      department: attempt.student.department,
      semester: attempt.student.semester,
      attemptNumber: attempt.attemptNumber,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      timeSpent: attempt.timeSpent,
      formattedTimeSpent: attempt.formattedTimeSpent,
      score: {
        raw: attempt.score.raw,
        percentage: attempt.score.percentage,
        grade: attempt.score.grade
      },
      passed: attempt.passed,
      proctoring: {
        riskScore: attempt.proctoring?.riskScore || 0,
        flaggedForReview: attempt.proctoring?.flaggedForReview || false,
        eventCount: attempt.proctoring?.events?.length || 0,
        topEvents: attempt.proctoring?.events?.slice(0, 3).map(event => ({
          type: event.eventType,
          severity: event.severity,
          timestamp: event.timestamp
        })) || []
      }
    }));

    const report = {
      examInfo: {
        title: exam.title,
        course: exam.course,
        courseCode: exam.courseCode,
        instructor: exam.instructor.fullName,
        duration: exam.settings.duration,
        totalQuestions: exam.questions.length,
        totalPoints: exam.settings.totalPoints,
        passingScore: exam.settings.passingScore,
        startDate: exam.scheduling.startDate,
        endDate: exam.scheduling.endDate,
        status: exam.status
      },
      statistics: stats,
      gradeDistribution,
      questionAnalysis,
      proctoringAnalysis,
      studentPerformance,
      reportGeneratedAt: new Date(),
      reportGeneratedBy: req.user.fullName
    };

    // Handle different response formats
    if (format === 'csv') {
      // Generate CSV for student performance
      const csvData = [
        ['Student ID', 'Student Name', 'Email', 'College', 'Department', 'Semester', 'Score %', 'Grade', 'Passed', 'Time Spent', 'Risk Score', 'Events Count', 'Status'],
        ...studentPerformance.map(student => [
          student.studentId,
          student.studentName,
          student.email,
          student.college || '',
          student.department || '',
          student.semester || '',
          student.score.percentage,
          student.score.grade,
          student.passed ? 'Yes' : 'No',
          student.formattedTimeSpent,
          student.proctoring.riskScore,
          student.proctoring.eventCount,
          student.proctoring.flaggedForReview ? 'Flagged' : 'Clear'
        ])
      ];

      const csvString = csvData.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="exam-report-${exam.title.replace(/\s+/g, '-')}-${Date.now()}.csv"`);
      return res.send(csvString);
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate exam report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating exam report',
      error: error.message
    });
  }
};

// @desc    Generate student performance report
// @route   GET /api/v1/reports/student/:studentId
// @access  Private (Admin/Teacher/Student)
exports.generateStudentReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examId } = req.query;

    // Verify access
    if (req.user.userType === 'student' && req.user.id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Build query
    let query = { student: studentId };
    if (examId) {
      query.exam = examId;
    }

    // If teacher, only show their exams
    if (req.user.userType === 'teacher') {
      const teacherExams = await Exam.find({ instructor: req.user.id }).distinct('_id');
      query.exam = query.exam ? 
        (teacherExams.includes(query.exam) ? query.exam : null) : 
        { $in: teacherExams };
    }

    const attempts = await ExamAttempt.find(query)
      .populate('exam', 'title course courseCode settings scheduling')
      .sort({ createdAt: -1 });

    // Calculate overall statistics
    const completedAttempts = attempts.filter(a => a.status === 'completed');
    const stats = {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      totalTimeSpent: 0,
      averageRiskScore: 0,
      totalFlaggedAttempts: attempts.filter(a => a.proctoring?.flaggedForReview).length
    };

    if (completedAttempts.length > 0) {
      const scores = completedAttempts.map(a => a.score.percentage);
      const timeSpent = completedAttempts.map(a => a.timeSpent);
      const riskScores = completedAttempts.map(a => a.proctoring?.riskScore || 0);

      stats.averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
      stats.highestScore = Math.max(...scores);
      stats.lowestScore = Math.min(...scores);
      stats.totalTimeSpent = timeSpent.reduce((a, b) => a + b, 0);
      stats.averageRiskScore = Math.round((riskScores.reduce((a, b) => a + b, 0) / riskScores.length) * 100) / 100;
    }

    // Performance over time
    const performanceOverTime = completedAttempts.map(attempt => ({
      examTitle: attempt.exam.title,
      date: attempt.startTime,
      score: attempt.score.percentage,
      grade: attempt.score.grade,
      timeSpent: attempt.timeSpent,
      riskScore: attempt.proctoring?.riskScore || 0
    }));

    // Detailed attempt history
    const attemptHistory = attempts.map(attempt => ({
      examId: attempt.exam._id,
      examTitle: attempt.exam.title,
      course: attempt.exam.course,
      courseCode: attempt.exam.courseCode,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      timeSpent: attempt.timeSpent,
      formattedTimeSpent: attempt.formattedTimeSpent,
      score: attempt.status === 'completed' ? {
        raw: attempt.score.raw,
        percentage: attempt.score.percentage,
        grade: attempt.score.grade
      } : null,
      passed: attempt.passed,
      proctoring: {
        enabled: attempt.proctoring?.enabled || false,
        riskScore: attempt.proctoring?.riskScore || 0,
        flaggedForReview: attempt.proctoring?.flaggedForReview || false,
        eventCount: attempt.proctoring?.events?.length || 0,
        events: attempt.proctoring?.events || []
      }
    }));

    const report = {
      studentInfo: {
        name: student.fullName,
        studentId: student.studentId,
        email: student.email,
        college: student.college,
        department: student.department,
        semester: student.semester,
        course: student.course
      },
      statistics: stats,
      performanceOverTime,
      attemptHistory,
      reportGeneratedAt: new Date(),
      reportGeneratedBy: req.user.fullName
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate student report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating student report',
      error: error.message
    });
  }
};

// @desc    Generate institution-wide analytics
// @route   GET /api/v1/reports/analytics
// @access  Private (Admin only)
exports.generateAnalyticsReport = async (req, res) => {
  try {
    const { startDate, endDate, college, department } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get overall statistics
    const [totalExams, totalUsers, totalAttempts] = await Promise.all([
      Exam.countDocuments(),
      User.countDocuments({ userType: 'student' }),
      ExamAttempt.countDocuments(dateFilter)
    ]);

    // Department-wise performance
    const departmentPerformance = await ExamAttempt.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      ...(college ? [{ $match: { 'studentInfo.college': college } }] : []),
      ...(department ? [{ $match: { 'studentInfo.department': department } }] : []),
      {
        $group: {
          _id: '$studentInfo.department',
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$score.percentage' },
          passRate: { 
            $avg: { $cond: [{ $eq: ['$passed', true] }, 1, 0] }
          },
          averageRiskScore: { $avg: '$proctoring.riskScore' }
        }
      },
      { $sort: { totalAttempts: -1 } }
    ]);

    // Monthly trends
    const monthlyTrends = await ExamAttempt.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$score.percentage' },
          flaggedAttempts: {
            $sum: { $cond: [{ $eq: ['$proctoring.flaggedForReview', true] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top performing students
    const topStudents = await ExamAttempt.aggregate([
      { $match: { status: 'completed', ...dateFilter } },
      {
        $group: {
          _id: '$student',
          averageScore: { $avg: '$score.percentage' },
          totalAttempts: { $sum: 1 },
          totalPassed: { $sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] } }
        }
      },
      { $match: { totalAttempts: { $gte: 3 } } }, // At least 3 attempts
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          studentName: '$studentInfo.fullName',
          studentId: '$studentInfo.studentId',
          college: '$studentInfo.college',
          department: '$studentInfo.department',
          averageScore: { $round: ['$averageScore', 2] },
          totalAttempts: 1,
          passRate: { 
            $round: [{ $multiply: [{ $divide: ['$totalPassed', '$totalAttempts'] }, 100] }, 2] 
          }
        }
      },
      { $sort: { averageScore: -1 } },
      { $limit: 10 }
    ]);

    // Proctoring insights
    const proctoringInsights = await ExamAttempt.aggregate([
      { $match: { 'proctoring.enabled': true, ...dateFilter } },
      { $unwind: '$proctoring.events' },
      {
        $group: {
          _id: '$proctoring.events.eventType',
          count: { $sum: 1 },
          averageSeverity: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$proctoring.events.severity', 'low'] }, then: 1 },
                  { case: { $eq: ['$proctoring.events.severity', 'medium'] }, then: 2 },
                  { case: { $eq: ['$proctoring.events.severity', 'high'] }, then: 3 },
                  { case: { $eq: ['$proctoring.events.severity', 'critical'] }, then: 4 }
                ],
                default: 2
              }
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const report = {
      overview: {
        totalExams,
        totalStudents: totalUsers,
        totalAttempts,
        reportPeriod: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present',
          college: college || 'All colleges',
          department: department || 'All departments'
        }
      },
      departmentPerformance: departmentPerformance.map(dept => ({
        department: dept._id || 'Unknown',
        totalAttempts: dept.totalAttempts,
        averageScore: Math.round(dept.averageScore * 100) / 100,
        passRate: Math.round(dept.passRate * 100),
        averageRiskScore: Math.round((dept.averageRiskScore || 0) * 100) / 100
      })),
      monthlyTrends: monthlyTrends.map(trend => ({
        period: `${trend._id.year}-${trend._id.month.toString().padStart(2, '0')}`,
        totalAttempts: trend.totalAttempts,
        averageScore: Math.round(trend.averageScore * 100) / 100,
        flaggedAttempts: trend.flaggedAttempts,
        flaggedRate: Math.round((trend.flaggedAttempts / trend.totalAttempts) * 100)
      })),
      topStudents,
      proctoringInsights: proctoringInsights.map(insight => ({
        eventType: insight._id,
        count: insight.count,
        severity: insight.averageSeverity > 3 ? 'Critical' : 
                  insight.averageSeverity > 2 ? 'High' : 
                  insight.averageSeverity > 1 ? 'Medium' : 'Low'
      })),
      reportGeneratedAt: new Date(),
      reportGeneratedBy: req.user.fullName
    };

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate analytics report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analytics report',
      error: error.message
    });
  }
};

module.exports = exports;
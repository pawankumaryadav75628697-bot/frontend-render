const Exam = require('../models/Exam');
const User = require('../models/User');
const ExamAttempt = require('../models/ExamAttempt');
const jwt = require('jsonwebtoken');

// @desc    Access exam using exam key
// @route   POST /api/v1/exam-access/verify-key
// @access  Public
exports.verifyExamKey = async (req, res) => {
  try {
    const { examKey, studentId } = req.body;

    if (!examKey || !studentId) {
      return res.status(400).json({
        success: false,
        error: 'Exam key and student ID are required'
      });
    }

    // Find exam by key
    const exam = await Exam.findOne({ examKey: examKey.toUpperCase() })
      .populate('instructor', 'fullName email');

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Invalid exam key'
      });
    }

    // Find student
    const student = await User.findOne({ 
      studentId: studentId,
      userType: 'student',
      isActive: true
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Invalid student ID'
      });
    }

    // Check if exam is currently active
    const now = new Date();
    if (now < exam.scheduling.startDate) {
      return res.status(400).json({
        success: false,
        error: 'Exam has not started yet',
        startTime: exam.scheduling.startDate
      });
    }

    if (now > exam.scheduling.endDate) {
      return res.status(400).json({
        success: false,
        error: 'Exam has ended'
      });
    }

    if (exam.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Exam is not currently available'
      });
    }

    // Check if student is eligible (if eligibility is restricted)
    if (!exam.isStudentEligible(student._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not eligible for this exam'
      });
    }

    // Check existing attempts
    const existingAttempts = await ExamAttempt.find({
      exam: exam._id,
      student: student._id
    });

    const completedAttempts = existingAttempts.filter(attempt => 
      attempt.status === 'completed' || attempt.status === 'submitted'
    ).length;

    if (completedAttempts >= exam.settings.maxAttempts) {
      return res.status(403).json({
        success: false,
        error: `Maximum attempts (${exam.settings.maxAttempts}) reached for this exam`
      });
    }

    // Check for ongoing attempt
    const ongoingAttempt = existingAttempts.find(attempt => 
      attempt.status === 'in-progress'
    );

    if (ongoingAttempt) {
      // Check if attempt has expired
      const attemptEndTime = new Date(ongoingAttempt.startedAt.getTime() + (exam.settings.duration * 60 * 1000));
      if (now > attemptEndTime) {
        // Auto-submit expired attempt
        ongoingAttempt.status = 'auto-submitted';
        ongoingAttempt.endedAt = attemptEndTime;
        ongoingAttempt.timeSpent = exam.settings.duration * 60;
        await ongoingAttempt.save();
      } else {
        // Continue with existing attempt
        const accessToken = student.generateExamAccessToken(exam._id);
        return res.status(200).json({
          success: true,
          data: {
            exam: exam.getStudentVersion(),
            student: {
              _id: student._id,
              studentId: student.studentId,
              fullName: student.fullName,
              email: student.email
            },
            attempt: ongoingAttempt,
            accessToken,
            timeRemaining: Math.max(0, Math.floor((attemptEndTime - now) / 1000))
          },
          message: 'Continuing existing exam attempt'
        });
      }
    }

    // Create new exam attempt
    const newAttempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: now,
      status: 'in-progress',
      answers: [],
      timeSpent: 0
    });

    // Generate access token
    const accessToken = student.generateExamAccessToken(exam._id);

    // Update exam analytics
    exam.analytics.totalAttempts += 1;
    await exam.save();

    res.status(200).json({
      success: true,
      data: {
        exam: exam.getStudentVersion(),
        student: {
          _id: student._id,
          studentId: student.studentId,
          fullName: student.fullName,
          email: student.email
        },
        attempt: newAttempt,
        accessToken,
        timeRemaining: exam.settings.duration * 60 // in seconds
      },
      message: 'Exam access granted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get exam details by key (preview without starting)
// @route   GET /api/v1/exam-access/preview/:examKey
// @access  Public
exports.previewExam = async (req, res) => {
  try {
    const { examKey } = req.params;

    if (!examKey) {
      return res.status(400).json({
        success: false,
        error: 'Exam key is required'
      });
    }

    // Find exam by key
    const exam = await Exam.findOne({ examKey: examKey.toUpperCase() })
      .populate('instructor', 'fullName email')
      .select('-questions'); // Don't include questions in preview

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Invalid exam key'
      });
    }

    // Check if exam is published
    if (exam.status === 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Exam is not yet available'
      });
    }

    const now = new Date();
    const isActive = now >= exam.scheduling.startDate && now <= exam.scheduling.endDate && exam.status === 'active';
    const hasStarted = now >= exam.scheduling.startDate;
    const hasEnded = now > exam.scheduling.endDate;

    res.status(200).json({
      success: true,
      data: {
        exam: {
          _id: exam._id,
          title: exam.title,
          description: exam.description,
          course: exam.course,
          courseCode: exam.courseCode,
          examKey: exam.examKey,
          instructor: exam.instructor,
          settings: {
            duration: exam.settings.duration,
            totalPoints: exam.settings.totalPoints,
            maxAttempts: exam.settings.maxAttempts
          },
          scheduling: exam.scheduling,
          proctoring: exam.proctoring,
          status: exam.status,
          questionCount: exam.questions.length
        },
        examStatus: {
          isActive,
          hasStarted,
          hasEnded,
          canStart: isActive
        },
        timeInfo: {
          currentTime: now,
          startTime: exam.scheduling.startDate,
          endTime: exam.scheduling.endDate,
          timeUntilStart: hasStarted ? 0 : Math.max(0, exam.scheduling.startDate - now),
          timeUntilEnd: hasEnded ? 0 : Math.max(0, exam.scheduling.endDate - now)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Submit exam answers
// @route   POST /api/v1/exam-access/submit
// @access  Private (Student with valid exam access token)
exports.submitExam = async (req, res) => {
  try {
    const { answers } = req.body;
    
    // This would require exam-specific authentication middleware
    // For now, we'll expect examId and studentId from the token
    const { examId, userId } = req.user;

    const exam = await Exam.findById(examId);
    const student = await User.findById(userId);

    if (!exam || !student) {
      return res.status(404).json({
        success: false,
        error: 'Exam or student not found'
      });
    }

    // Find the active attempt
    const attempt = await ExamAttempt.findOne({
      exam: examId,
      student: userId,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(400).json({
        success: false,
        error: 'No active exam attempt found'
      });
    }

    const now = new Date();
    const timeSpent = Math.floor((now - attempt.startedAt) / 1000); // in seconds

    // Calculate score
    let score = 0;
    const processedAnswers = [];

    exam.questions.forEach((question, index) => {
      const studentAnswer = answers.find(ans => ans.questionId === question._id.toString());
      
      let isCorrect = false;
      let earnedPoints = 0;

      if (studentAnswer) {
        if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
          const correctOption = question.options.find(opt => opt.isCorrect);
          if (correctOption && studentAnswer.selectedOption === correctOption._id.toString()) {
            isCorrect = true;
            earnedPoints = question.points;
          }
        } else if (question.questionType === 'short-answer') {
          // Simple string comparison (can be enhanced)
          if (question.correctAnswer && 
              studentAnswer.textAnswer && 
              question.correctAnswer.toLowerCase().trim() === studentAnswer.textAnswer.toLowerCase().trim()) {
            isCorrect = true;
            earnedPoints = question.points;
          }
        } else if (question.questionType === 'coding') {
          // For coding questions, we'll mark as completed but not auto-grade
          // Manual review will be required for proper evaluation
          if (studentAnswer.codeAnswer && studentAnswer.codeAnswer.trim()) {
            // Award partial points for submission (can be modified later during manual review)
            earnedPoints = Math.floor(question.points * 0.5); // 50% for code submission
            isCorrect = false; // Will be determined during manual review
          }
        }
      }

      score += earnedPoints;

      processedAnswers.push({
        questionId: question._id,
        selectedOption: studentAnswer?.selectedOption || null,
        textAnswer: studentAnswer?.textAnswer || null,
        codeAnswer: studentAnswer?.codeAnswer || null,
        programmingLanguage: studentAnswer?.programmingLanguage || null,
        isCorrect,
        earnedPoints,
        timeSpent: studentAnswer?.timeSpent || 0
      });
    });

    // Update attempt
    attempt.answers = processedAnswers;
    attempt.score = score;
    attempt.endedAt = now;
    attempt.timeSpent = timeSpent;
    attempt.status = 'completed';
    attempt.submittedAt = now;

    await attempt.save();

    // Update exam analytics
    exam.analytics.completedAttempts += 1;
    const allCompletedAttempts = await ExamAttempt.find({
      exam: examId,
      status: { $in: ['completed', 'submitted'] }
    });

    if (allCompletedAttempts.length > 0) {
      const totalScore = allCompletedAttempts.reduce((sum, att) => sum + att.score, 0);
      exam.analytics.averageScore = totalScore / allCompletedAttempts.length;
      
      const passedCount = allCompletedAttempts.filter(att => 
        (att.score / exam.settings.totalPoints) * 100 >= exam.settings.passingScore
      ).length;
      exam.analytics.passRate = (passedCount / allCompletedAttempts.length) * 100;
    }

    await exam.save();

    const percentage = (score / exam.settings.totalPoints) * 100;
    const passed = percentage >= exam.settings.passingScore;

    res.status(200).json({
      success: true,
      data: {
        attempt: attempt,
        results: {
          score,
          totalPoints: exam.settings.totalPoints,
          percentage: percentage.toFixed(2),
          passed,
          passingScore: exam.settings.passingScore,
          timeSpent: Math.floor(timeSpent / 60), // in minutes
          submittedAt: now
        }
      },
      message: 'Exam submitted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Check exam results
// @route   POST /api/v1/exam-access/results
// @access  Public
exports.checkResults = async (req, res) => {
  try {
    const { studentId, examKey } = req.body;

    if (!studentId || !examKey) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and exam key are required'
      });
    }

    // Find exam
    const exam = await Exam.findOne({ examKey: examKey.toUpperCase() });
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Invalid exam key'
      });
    }

    // Find student
    const student = await User.findOne({ studentId, userType: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Invalid student ID'
      });
    }

    // Find completed attempts
    const attempts = await ExamAttempt.find({
      exam: exam._id,
      student: student._id,
      status: { $in: ['completed', 'submitted', 'auto-submitted'] }
    }).sort({ submittedAt: -1 });

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No exam results found'
      });
    }

    const latestAttempt = attempts[0];
    const percentage = (latestAttempt.score / exam.settings.totalPoints) * 100;
    const passed = percentage >= exam.settings.passingScore;

    res.status(200).json({
      success: true,
      data: {
        exam: {
          title: exam.title,
          course: exam.course,
          courseCode: exam.courseCode,
          totalPoints: exam.settings.totalPoints,
          passingScore: exam.settings.passingScore
        },
        student: {
          studentId: student.studentId,
          fullName: student.fullName
        },
        result: {
          score: latestAttempt.score,
          totalPoints: exam.settings.totalPoints,
          percentage: percentage.toFixed(2),
          passed,
          status: latestAttempt.status,
          submittedAt: latestAttempt.submittedAt,
          timeSpent: Math.floor(latestAttempt.timeSpent / 60), // in minutes
          attemptNumber: attempts.length
        },
        allAttempts: attempts.map(attempt => ({
          score: attempt.score,
          percentage: ((attempt.score / exam.settings.totalPoints) * 100).toFixed(2),
          status: attempt.status,
          submittedAt: attempt.submittedAt,
          timeSpent: Math.floor(attempt.timeSpent / 60)
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
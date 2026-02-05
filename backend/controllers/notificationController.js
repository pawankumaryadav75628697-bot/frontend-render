const nodemailer = require('nodemailer');
const User = require('../models/User');
const Exam = require('../models/Exam');
const InstantExam = require('../models/InstantExam');
const ExamSession = require('../models/ExamSession');
const asyncHandler = require('express-async-handler');

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};


// @desc    Send exam invitation
// @route   POST /api/v1/notifications/send-exam-invitation
// @access  Private (admin/teacher)
const sendExamInvitation = asyncHandler(async (req, res) => {
  const { examId, examType = 'Exam', studentIds, customMessage } = req.body;

  // Get exam details
  const ExamModel = examType === 'InstantExam' ? InstantExam : Exam;
  const exam = await ExamModel.findById(examId);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Check if user owns this exam
  const isOwner = (examType === 'InstantExam' && exam.createdBy.toString() === req.user._id.toString()) ||
                  (examType === 'Exam' && exam.instructor.toString() === req.user._id.toString()) ||
                  req.user.userType === 'admin';

  if (!isOwner) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get student details
  const students = await User.find({
    _id: { $in: studentIds },
    userType: 'student'
  });

  if (students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid students found'
    });
  }

  const transporter = createEmailTransporter();
  const sentEmails = [];
  const failedEmails = [];

  // Send email to each student
  for (const student of students) {
    try {
      const emailContent = generateExamInvitationEmail(exam, student, examType, customMessage);
      
      await transporter.sendMail({
        from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
        to: student.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      sentEmails.push(student.email);
    } catch (error) {
      console.error(`Failed to send email to ${student.email}:`, error);
      failedEmails.push({
        email: student.email,
        error: error.message
      });
    }
  }

  // Log notification activity
  await logNotificationActivity('exam_invitation', examId, examType, {
    sentTo: sentEmails,
    failed: failedEmails,
    sentBy: req.user._id
  });

  res.status(200).json({
    success: true,
    message: `Exam invitations sent to ${sentEmails.length} students`,
    data: {
      sent: sentEmails.length,
      failed: failedEmails.length,
      sentEmails,
      failedEmails
    }
  });
});

// @desc    Send exam reminder
// @route   POST /api/v1/notifications/send-exam-reminder
// @access  Private (admin/teacher)
const sendExamReminder = asyncHandler(async (req, res) => {
  const { examId, examType = 'Exam', reminderType = 'general', minutesBefore } = req.body;

  const ExamModel = examType === 'InstantExam' ? InstantExam : Exam;
  const exam = await ExamModel.findById(examId);

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Get eligible students for this exam
  let studentIds = [];
  if (examType === 'Exam') {
    studentIds = exam.eligibleStudents.length > 0 ? exam.eligibleStudents : 
                 await User.find({ userType: 'student' }).distinct('_id');
  } else {
    // For instant exams, get all students or those who haven't attempted yet
    studentIds = await User.find({ userType: 'student' }).distinct('_id');
  }

  const students = await User.find({ _id: { $in: studentIds } });
  const transporter = createEmailTransporter();
  const sentReminders = [];
  const failedReminders = [];

  for (const student of students) {
    try {
      const emailContent = generateExamReminderEmail(exam, student, examType, reminderType, minutesBefore);
      
      await transporter.sendMail({
        from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
        to: student.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      sentReminders.push(student.email);
    } catch (error) {
      console.error(`Failed to send reminder to ${student.email}:`, error);
      failedReminders.push({
        email: student.email,
        error: error.message
      });
    }
  }

  await logNotificationActivity('exam_reminder', examId, examType, {
    reminderType,
    minutesBefore,
    sentTo: sentReminders,
    failed: failedReminders,
    sentBy: req.user._id
  });

  res.status(200).json({
    success: true,
    message: `Exam reminders sent to ${sentReminders.length} students`,
    data: {
      sent: sentReminders.length,
      failed: failedReminders.length,
      reminderType,
      sentReminders,
      failedReminders
    }
  });
});

// @desc    Send violation alert
// @route   POST /api/v1/notifications/violation-alert
// @access  Private (system/admin)
const sendViolationAlert = asyncHandler(async (req, res) => {
  const { sessionId, violationType, severity, studentInfo } = req.body;

  const session = await ExamSession.findOne({ sessionId })
    .populate('examId', 'title')
    .populate('studentId', 'fullName email');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  // Get exam owner/instructor
  let examOwner = null;
  if (session.examType === 'InstantExam') {
    const instantExam = await InstantExam.findById(session.examId).populate('createdBy');
    examOwner = instantExam?.createdBy;
  } else {
    const exam = await Exam.findById(session.examId).populate('instructor');
    examOwner = exam?.instructor;
  }

  if (!examOwner) {
    return res.status(404).json({
      success: false,
      message: 'Exam owner not found'
    });
  }

  const transporter = createEmailTransporter();

  try {
    const emailContent = generateViolationAlertEmail(session, violationType, severity);
    
    await transporter.sendMail({
      from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
      to: examOwner.email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    // Also send to admins if severity is high/critical
    if (['high', 'critical'].includes(severity)) {
      const admins = await User.find({ userType: 'admin' });
      for (const admin of admins) {
        try {
          await transporter.sendMail({
            from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
            to: admin.email,
            subject: `[URGENT] ${emailContent.subject}`,
            html: emailContent.html
          });
        } catch (error) {
          console.error(`Failed to send alert to admin ${admin.email}:`, error);
        }
      }
    }

    await logNotificationActivity('violation_alert', session.examId, session.examType, {
      violationType,
      severity,
      sessionId,
      studentId: session.studentId._id,
      sentTo: examOwner.email
    });

    res.status(200).json({
      success: true,
      message: 'Violation alert sent successfully'
    });
  } catch (error) {
    console.error('Failed to send violation alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send violation alert',
      error: error.message
    });
  }
});

// @desc    Send exam completion notification
// @route   POST /api/v1/notifications/exam-completion
// @access  Private (system)
const sendExamCompletionNotification = asyncHandler(async (req, res) => {
  const { sessionId, score, passed } = req.body;

  const session = await ExamSession.findOne({ sessionId })
    .populate('examId', 'title')
    .populate('studentId', 'fullName email');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const transporter = createEmailTransporter();

  try {
    const emailContent = generateCompletionNotificationEmail(session, score, passed);
    
    // Send to student
    await transporter.sendMail({
      from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
      to: session.studentId.email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    res.status(200).json({
      success: true,
      message: 'Completion notification sent successfully'
    });
  } catch (error) {
    console.error('Failed to send completion notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send completion notification',
      error: error.message
    });
  }
});

// @desc    Get notification history
// @route   GET /api/v1/notifications/history
// @access  Private (admin/teacher)
const getNotificationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, examId } = req.query;

  // This would typically be stored in a separate NotificationLog model
  // For now, we'll return a placeholder response
  const notifications = []; // This would be fetched from database

  res.status(200).json({
    success: true,
    count: notifications.length,
    pagination: {
      page: parseInt(page),
      pages: 1,
      total: notifications.length
    },
    data: notifications
  });
});

// @desc    Send bulk notification
// @route   POST /api/v1/notifications/bulk-send
// @access  Private (admin)
const sendBulkNotification = asyncHandler(async (req, res) => {
  const { recipientType, subject, message, urgency = 'normal' } = req.body;

  if (req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can send bulk notifications'
    });
  }

  // Get recipients based on type
  let recipients = [];
  switch (recipientType) {
    case 'all_students':
      recipients = await User.find({ userType: 'student', isActive: true });
      break;
    case 'all_teachers':
      recipients = await User.find({ userType: 'teacher', isActive: true });
      break;
    case 'all_users':
      recipients = await User.find({ userType: { $in: ['student', 'teacher'] }, isActive: true });
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient type'
      });
  }

  const transporter = createEmailTransporter();
  const sentNotifications = [];
  const failedNotifications = [];

  for (const recipient of recipients) {
    try {
      const emailContent = generateBulkNotificationEmail(subject, message, recipient, urgency);
      
      await transporter.sendMail({
        from: `${process.env.APP_NAME || 'Exam Monitor'} <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      sentNotifications.push(recipient.email);
    } catch (error) {
      console.error(`Failed to send notification to ${recipient.email}:`, error);
      failedNotifications.push({
        email: recipient.email,
        error: error.message
      });
    }
  }

  await logNotificationActivity('bulk_notification', null, null, {
    recipientType,
    subject,
    urgency,
    sentTo: sentNotifications,
    failed: failedNotifications,
    sentBy: req.user._id
  });

  res.status(200).json({
    success: true,
    message: `Bulk notification sent to ${sentNotifications.length} recipients`,
    data: {
      sent: sentNotifications.length,
      failed: failedNotifications.length,
      recipientType,
      sentNotifications,
      failedNotifications
    }
  });
});

// Helper functions
const generateExamInvitationEmail = (exam, student, examType, customMessage) => {
  const examUrl = examType === 'InstantExam' 
    ? `${process.env.FRONTEND_URL}/instant-exam/${exam.accessCode}`
    : `${process.env.FRONTEND_URL}/exam/${exam._id}`;

  const subject = `Invitation: ${exam.title}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Exam Invitation</h2>
      
      <p>Dear ${student.fullName},</p>
      
      <p>You have been invited to take the following exam:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${exam.title}</h3>
        <p><strong>Duration:</strong> ${exam.duration || exam.settings?.duration} minutes</p>
        ${examType === 'InstantExam' ? `
          <p><strong>Access Code:</strong> <code style="background-color: #e7e7e7; padding: 2px 6px; border-radius: 3px;">${exam.accessCode}</code></p>
          <p><strong>Valid Until:</strong> ${new Date(exam.validUntil).toLocaleString()}</p>
        ` : `
          <p><strong>Start Date:</strong> ${new Date(exam.scheduling?.startDate).toLocaleString()}</p>
          <p><strong>End Date:</strong> ${new Date(exam.scheduling?.endDate).toLocaleString()}</p>
        `}
      </div>
      
      ${customMessage ? `
        <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
          <p style="margin: 0;"><strong>Additional Message:</strong></p>
          <p style="margin: 10px 0 0 0;">${customMessage}</p>
        </div>
      ` : ''}
      
      <p>
        <a href="${examUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Access Exam
        </a>
      </p>
      
      <p style="color: #666; font-size: 14px;">
        Please ensure you have a stable internet connection and a quiet environment for taking the exam.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #888; font-size: 12px;">
        This is an automated message from ${process.env.APP_NAME || 'Exam Monitor System'}.
      </p>
    </div>
  `;

  return { subject, html };
};

const generateExamReminderEmail = (exam, student, examType, reminderType, minutesBefore) => {
  const subject = `Reminder: ${exam.title} - ${reminderType === 'urgent' ? 'Starting Soon!' : 'Scheduled'}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${reminderType === 'urgent' ? '#f44336' : '#ff9800'};">Exam Reminder</h2>
      
      <p>Dear ${student.fullName},</p>
      
      <p>This is a reminder about your upcoming exam:</p>
      
      <div style="background-color: ${reminderType === 'urgent' ? '#ffebee' : '#fff3e0'}; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${reminderType === 'urgent' ? '#f44336' : '#ff9800'};">
        <h3 style="margin-top: 0;">${exam.title}</h3>
        <p><strong>Duration:</strong> ${exam.duration || exam.settings?.duration} minutes</p>
        ${minutesBefore ? `<p><strong>Starting in:</strong> ${minutesBefore} minutes</p>` : ''}
      </div>
      
      <p>Please ensure you are prepared and have:</p>
      <ul>
        <li>A stable internet connection</li>
        <li>A quiet, distraction-free environment</li>
        <li>Any required materials or resources</li>
        <li>Camera and microphone access (if required)</li>
      </ul>
      
      <p style="color: #666; font-style: italic;">
        Good luck with your exam!
      </p>
    </div>
  `;

  return { subject, html };
};

const generateViolationAlertEmail = (session, violationType, severity) => {
  const subject = `${severity.toUpperCase()} Violation Alert - ${session.examId?.title}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f44336;">Violation Alert</h2>
      
      <p>A ${severity} violation has been detected during an exam session:</p>
      
      <div style="background-color: #ffebee; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
        <h3 style="margin-top: 0;">Violation Details</h3>
        <p><strong>Exam:</strong> ${session.examId?.title}</p>
        <p><strong>Student:</strong> ${session.studentId?.fullName}</p>
        <p><strong>Violation Type:</strong> ${violationType.replace('_', ' ').toUpperCase()}</p>
        <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
        <p><strong>Session ID:</strong> ${session.sessionId}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <p>
        <a href="${process.env.FRONTEND_URL}/proctoring/session/${session.sessionId}" 
           style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Review Session
        </a>
      </p>
    </div>
  `;

  return { subject, html };
};

const generateCompletionNotificationEmail = (session, score, passed) => {
  const subject = `Exam Completed - ${session.examId?.title}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${passed ? '#4CAF50' : '#ff9800'};">Exam Completed</h2>
      
      <p>Dear ${session.studentId?.fullName},</p>
      
      <p>You have successfully completed the exam: <strong>${session.examId?.title}</strong></p>
      
      <div style="background-color: ${passed ? '#e8f5e8' : '#fff3e0'}; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Your Results</h3>
        <p><strong>Score:</strong> ${score}%</p>
        <p><strong>Status:</strong> <span style="color: ${passed ? '#4CAF50' : '#ff9800'}; font-weight: bold;">${passed ? 'PASSED' : 'NEEDS REVIEW'}</span></p>
        <p><strong>Completed on:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <p>${passed ? 'Congratulations on passing the exam!' : 'Please review your performance and contact your instructor if needed.'}</p>
    </div>
  `;

  return { subject, html };
};

const generateBulkNotificationEmail = (subject, message, recipient, urgency) => {
  const urgencyColors = {
    low: '#4CAF50',
    normal: '#2196F3',
    high: '#ff9800',
    critical: '#f44336'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgencyColors[urgency]};">${subject}</h2>
      
      <p>Dear ${recipient.fullName},</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${urgencyColors[urgency]};">
        ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
      </div>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #888; font-size: 12px;">
        This is an automated message from ${process.env.APP_NAME || 'Exam Monitor System'}.
      </p>
    </div>
  `;

  return { subject, html };
};

const logNotificationActivity = async (type, examId, examType, data) => {
  // In a real implementation, this would save to a NotificationLog model
  console.log('Notification logged:', {
    type,
    examId,
    examType,
    data,
    timestamp: new Date()
  });
};

module.exports = {
  sendExamInvitation,
  sendExamReminder,
  sendViolationAlert,
  sendExamCompletionNotification,
  getNotificationHistory,
  sendBulkNotification
};
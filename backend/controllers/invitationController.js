const User = require('../models/User');
const Exam = require('../models/Exam');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');

// Configure email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// @desc    Send exam invitations to candidates
// @route   POST /api/v1/invitations/send
// @access  Private (Admin/Teacher)
const sendExamInvitations = asyncHandler(async (req, res) => {
  const { examId, candidateIds, message, settings } = req.body;

  // Verify exam exists and user has permission
  const exam = await Exam.findById(examId);
  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Check if user has permission to send invitations for this exam
  if (req.user.userType === 'teacher' && exam.instructor.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only send invitations for your own exams.'
    });
  }

  // Get candidate details
  const candidates = await User.find({
    _id: { $in: candidateIds },
    userType: 'student'
  });

  if (candidates.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid candidates found'
    });
  }

  const invitationResults = [];
  const transporter = createTransporter();

  for (const candidate of candidates) {
    try {
      // Generate secure access key
      const accessKey = crypto.randomBytes(32).toString('hex');
      
      // Create exam invitation record
      const invitation = {
        examId: exam._id,
        candidateId: candidate._id,
        accessKey,
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(exam.startTime.getTime() + (exam.duration * 60 * 1000)),
        settings: {
          allowLateJoin: settings?.allowLateJoin || false,
          maxAttempts: settings?.maxAttempts || 1,
          showResults: settings?.showResults || false,
          proctoringEnabled: exam.proctoring?.enabled || false
        }
      };

      // Add invitation to exam
      exam.invitations = exam.invitations || [];
      exam.invitations.push(invitation);

      // Generate secure exam link
      const examLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/exam/join/${examId}?key=${accessKey}`;

      // Prepare email content
      const emailContent = await generateInvitationEmail({
        candidate,
        exam,
        examLink,
        accessKey,
        message,
        instructor: req.user.fullName || 'Exam Administrator'
      });

      // Send email invitation
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'ExamOnline'}" <${process.env.EMAIL_USER}>`,
        to: candidate.email,
        subject: `Exam Invitation: ${exam.title}`,
        html: emailContent.html,
        text: emailContent.text
      };

      await transporter.sendMail(mailOptions);

      invitationResults.push({
        candidateId: candidate._id,
        candidateName: candidate.fullName,
        email: candidate.email,
        status: 'sent',
        accessKey,
        examLink
      });

    } catch (error) {
      console.error(`Failed to send invitation to ${candidate.email}:`, error);
      invitationResults.push({
        candidateId: candidate._id,
        candidateName: candidate.fullName,
        email: candidate.email,
        status: 'failed',
        error: error.message
      });
    }
  }

  // Save exam with invitations
  await exam.save();

  // Record invitation activity
  await recordInvitationActivity({
    examId,
    senderId: req.user.id,
    candidateCount: candidates.length,
    successCount: invitationResults.filter(r => r.status === 'sent').length,
    failedCount: invitationResults.filter(r => r.status === 'failed').length
  });

  const successCount = invitationResults.filter(r => r.status === 'sent').length;
  const failedCount = invitationResults.filter(r => r.status === 'failed').length;

  res.status(200).json({
    success: true,
    message: `Invitations sent successfully. ${successCount} sent, ${failedCount} failed.`,
    data: {
      examId,
      examTitle: exam.title,
      totalCandidates: candidates.length,
      successCount,
      failedCount,
      results: invitationResults
    }
  });
});

// @desc    Resend exam invitation
// @route   POST /api/v1/invitations/resend
// @access  Private (Admin/Teacher)
const resendInvitation = asyncHandler(async (req, res) => {
  const { examId, candidateId } = req.body;

  const exam = await Exam.findById(examId);
  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  const candidate = await User.findById(candidateId);
  if (!candidate) {
    return res.status(404).json({
      success: false,
      message: 'Candidate not found'
    });
  }

  // Check permissions
  if (req.user.userType === 'teacher' && exam.instructor.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Find existing invitation
  const invitationIndex = exam.invitations?.findIndex(
    inv => inv.candidateId.toString() === candidateId
  );

  let invitation;
  if (invitationIndex !== -1) {
    // Update existing invitation
    invitation = exam.invitations[invitationIndex];
    invitation.status = 'resent';
    invitation.sentAt = new Date();
    invitation.resendCount = (invitation.resendCount || 0) + 1;
  } else {
    // Create new invitation
    const accessKey = crypto.randomBytes(32).toString('hex');
    invitation = {
      examId: exam._id,
      candidateId: candidate._id,
      accessKey,
      status: 'sent',
      sentAt: new Date(),
      expiresAt: new Date(exam.startTime.getTime() + (exam.duration * 60 * 1000)),
      settings: {
        allowLateJoin: false,
        maxAttempts: 1,
        showResults: false,
        proctoringEnabled: exam.proctoring?.enabled || false
      }
    };
    exam.invitations = exam.invitations || [];
    exam.invitations.push(invitation);
  }

  try {
    const examLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/exam/join/${examId}?key=${invitation.accessKey}`;
    
    const emailContent = await generateInvitationEmail({
      candidate,
      exam,
      examLink,
      accessKey: invitation.accessKey,
      message: 'This is a resent invitation.',
      instructor: req.user.fullName || 'Exam Administrator'
    });

    const transporter = createTransporter();
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ExamOnline'}" <${process.env.EMAIL_USER}>`,
      to: candidate.email,
      subject: `Exam Invitation (Resent): ${exam.title}`,
      html: emailContent.html,
      text: emailContent.text
    };

    await transporter.sendMail(mailOptions);
    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        candidateName: candidate.fullName,
        email: candidate.email,
        examTitle: exam.title,
        sentAt: invitation.sentAt
      }
    });

  } catch (error) {
    console.error('Failed to resend invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend invitation',
      error: error.message
    });
  }
});

// @desc    Get invitation status for an exam
// @route   GET /api/v1/invitations/status/:examId
// @access  Private (Admin/Teacher)
const getInvitationStatus = asyncHandler(async (req, res) => {
  const { examId } = req.params;

  const exam = await Exam.findById(examId)
    .populate('invitations.candidateId', 'fullName email studentId')
    .populate('instructor', 'fullName email');

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Check permissions
  if (req.user.userType === 'teacher' && exam.instructor._id.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const invitations = exam.invitations || [];
  const statusSummary = {
    total: invitations.length,
    sent: invitations.filter(inv => inv.status === 'sent' || inv.status === 'resent').length,
    opened: invitations.filter(inv => inv.status === 'opened').length,
    started: invitations.filter(inv => inv.status === 'started').length,
    completed: invitations.filter(inv => inv.status === 'completed').length,
    expired: invitations.filter(inv => inv.status === 'expired').length,
    failed: invitations.filter(inv => inv.status === 'failed').length
  };

  const invitationDetails = invitations.map(inv => ({
    id: inv._id,
    candidate: {
      id: inv.candidateId._id,
      name: inv.candidateId.fullName,
      email: inv.candidateId.email,
      studentId: inv.candidateId.studentId
    },
    status: inv.status,
    sentAt: inv.sentAt,
    openedAt: inv.openedAt,
    startedAt: inv.startedAt,
    completedAt: inv.completedAt,
    expiresAt: inv.expiresAt,
    resendCount: inv.resendCount || 0,
    accessKey: inv.accessKey,
    examLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/exam/join/${examId}?key=${inv.accessKey}`
  }));

  res.status(200).json({
    success: true,
    data: {
      examId,
      examTitle: exam.title,
      examStatus: exam.status,
      startTime: exam.startTime,
      endTime: exam.endTime,
      summary: statusSummary,
      invitations: invitationDetails
    }
  });
});

// @desc    Validate invitation and allow candidate to join exam
// @route   GET /api/v1/invitations/validate/:examId
// @access  Public (with access key)
const validateInvitation = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Access key is required'
    });
  }

  const exam = await Exam.findById(examId)
    .populate('instructor', 'fullName email');

  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Find invitation with matching access key
  const invitation = exam.invitations?.find(inv => inv.accessKey === key);

  if (!invitation) {
    return res.status(401).json({
      success: false,
      message: 'Invalid access key'
    });
  }

  // Check if invitation has expired
  if (invitation.expiresAt && new Date() > invitation.expiresAt) {
    invitation.status = 'expired';
    await exam.save();
    return res.status(410).json({
      success: false,
      message: 'Invitation has expired'
    });
  }

  // Check if exam is available
  const now = new Date();
  const examStart = new Date(exam.startTime);
  const examEnd = new Date(exam.endTime);

  if (now < examStart) {
    return res.status(400).json({
      success: false,
      message: 'Exam has not started yet',
      startTime: exam.startTime
    });
  }

  if (now > examEnd && !invitation.settings.allowLateJoin) {
    return res.status(400).json({
      success: false,
      message: 'Exam has ended and late joining is not allowed'
    });
  }

  // Update invitation status
  if (invitation.status === 'sent' || invitation.status === 'resent') {
    invitation.status = 'opened';
    invitation.openedAt = new Date();
    await exam.save();
  }

  // Get candidate information
  const candidate = await User.findById(invitation.candidateId);

  res.status(200).json({
    success: true,
    message: 'Invitation validated successfully',
    data: {
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        totalQuestions: exam.questions.length,
        startTime: exam.startTime,
        endTime: exam.endTime,
        instructions: exam.instructions,
        proctoring: {
          enabled: exam.proctoring?.enabled || false,
          cameraRequired: exam.proctoring?.cameraRequired || false,
          microphoneRequired: exam.proctoring?.microphoneRequired || false,
          lockdownBrowser: exam.proctoring?.lockdownBrowser || false
        }
      },
      candidate: {
        id: candidate._id,
        name: candidate.fullName,
        email: candidate.email,
        studentId: candidate.studentId
      },
      invitation: {
        accessKey: invitation.accessKey,
        settings: invitation.settings,
        openedAt: invitation.openedAt,
        maxAttempts: invitation.settings.maxAttempts
      },
      instructor: {
        name: exam.instructor.fullName,
        email: exam.instructor.email
      }
    }
  });
});

// @desc    Bulk send invitations to multiple candidates
// @route   POST /api/v1/invitations/bulk-send
// @access  Private (Admin/Teacher)
const bulkSendInvitations = asyncHandler(async (req, res) => {
  const { examId, candidateEmails, message, settings } = req.body;

  const exam = await Exam.findById(examId);
  if (!exam) {
    return res.status(404).json({
      success: false,
      message: 'Exam not found'
    });
  }

  // Find candidates by email
  const candidates = await User.find({
    email: { $in: candidateEmails },
    userType: 'student'
  });

  const foundEmails = candidates.map(c => c.email);
  const notFoundEmails = candidateEmails.filter(email => !foundEmails.includes(email));

  // Create invitations for found candidates
  const candidateIds = candidates.map(c => c._id);

  // Call the existing sendExamInvitations function
  req.body.candidateIds = candidateIds;
  
  const result = await sendExamInvitations(req, res);

  // Add information about not found emails
  if (notFoundEmails.length > 0) {
    result.data = result.data || {};
    result.data.notFoundEmails = notFoundEmails;
    result.message += ` ${notFoundEmails.length} email(s) not found in system.`;
  }

  return result;
});

// Helper function to generate email content
const generateInvitationEmail = async ({
  candidate,
  exam,
  examLink,
  accessKey,
  message,
  instructor
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exam Invitation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .exam-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #495057;
        }
        .value {
            color: #6c757d;
        }
        .cta-button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
            transition: transform 0.2s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .access-key {
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            text-align: center;
            margin: 20px 0;
            border: 2px dashed #6c757d;
        }
        .instructions {
            background: #d4edda;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            margin: 20px 0;
        }
        .warning {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 0;
            }
            .info-row {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 Exam Invitation</h1>
            <p>You're invited to take an online examination</p>
        </div>
        
        <div class="content">
            <p>Dear ${candidate.fullName},</p>
            
            <p>You have been invited by <strong>${instructor}</strong> to take the following examination:</p>
            
            <div class="exam-info">
                <div class="info-row">
                    <span class="label">Exam Title:</span>
                    <span class="value">${exam.title}</span>
                </div>
                <div class="info-row">
                    <span class="label">Duration:</span>
                    <span class="value">${exam.duration} minutes</span>
                </div>
                <div class="info-row">
                    <span class="label">Questions:</span>
                    <span class="value">${exam.questions.length} questions</span>
                </div>
                <div class="info-row">
                    <span class="label">Start Time:</span>
                    <span class="value">${formatDate(exam.startTime)}</span>
                </div>
                <div class="info-row">
                    <span class="label">End Time:</span>
                    <span class="value">${formatDate(exam.endTime)}</span>
                </div>
            </div>
            
            ${message ? `<p><em>"${message}"</em></p>` : ''}
            
            <div style="text-align: center;">
                <a href="${examLink}" class="cta-button">
                    Start Exam Now
                </a>
            </div>
            
            <div class="access-key">
                <strong>Access Key:</strong> ${accessKey}
            </div>
            
            <div class="instructions">
                <h3>📋 Instructions:</h3>
                <ul style="margin: 10px 0 0 20px;">
                    <li>Click the "Start Exam Now" button to begin</li>
                    <li>Keep your access key safe - you'll need it to join</li>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Use a supported browser (Chrome, Firefox, Safari, Edge)</li>
                    ${exam.proctoring?.enabled ? '<li>Camera and microphone access will be required</li>' : ''}
                    ${exam.proctoring?.lockdownBrowser ? '<li>Secure browser mode will be activated</li>' : ''}
                </ul>
            </div>
            
            ${exam.proctoring?.enabled ? `
            <div class="warning">
                <strong>⚠️ Proctoring Notice:</strong> This exam uses AI-based proctoring technology. 
                Your webcam and microphone will monitor the exam session for security purposes.
            </div>
            ` : ''}
            
            <p>If you encounter any technical issues, please contact the instructor immediately.</p>
            
            <p>Good luck with your examination!</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
            
            <p><small>This invitation is valid until ${formatDate(exam.endTime)}. 
            Please do not share your access key with others.</small></p>
        </div>
        
        <div class="footer">
            <p>This email was sent by ExamOnline Proctoring System</p>
            <p>If you received this email by mistake, please ignore it.</p>
        </div>
    </div>
</body>
</html>
  `;

  const text = `
EXAM INVITATION

Dear ${candidate.fullName},

You have been invited by ${instructor} to take the following examination:

Exam: ${exam.title}
Duration: ${exam.duration} minutes
Questions: ${exam.questions.length} questions
Start Time: ${formatDate(exam.startTime)}
End Time: ${formatDate(exam.endTime)}

${message ? `Message: "${message}"` : ''}

To join the exam, please visit: ${examLink}

Access Key: ${accessKey}

INSTRUCTIONS:
- Click the link above or visit it manually in your browser
- Enter your access key when prompted
- Ensure you have a stable internet connection
- Use a supported browser (Chrome, Firefox, Safari, Edge)
${exam.proctoring?.enabled ? '- Camera and microphone access will be required' : ''}
${exam.proctoring?.lockdownBrowser ? '- Secure browser mode will be activated' : ''}

${exam.proctoring?.enabled ? 'PROCTORING NOTICE: This exam uses AI-based proctoring technology. Your webcam and microphone will monitor the exam session for security purposes.' : ''}

If you encounter any technical issues, please contact the instructor immediately.

Good luck with your examination!

This invitation is valid until ${formatDate(exam.endTime)}. Please do not share your access key with others.

---
This email was sent by ExamOnline Proctoring System
  `;

  return { html, text };
};

// Helper function to record invitation activity
const recordInvitationActivity = async ({
  examId,
  senderId,
  candidateCount,
  successCount,
  failedCount
}) => {
  // In a production system, you might want to store this in a separate activity log
  console.log('Invitation Activity:', {
    examId,
    senderId,
    candidateCount,
    successCount,
    failedCount,
    timestamp: new Date()
  });
};

module.exports = {
  sendExamInvitations,
  resendInvitation,
  getInvitationStatus,
  validateInvitation,
  bulkSendInvitations
};

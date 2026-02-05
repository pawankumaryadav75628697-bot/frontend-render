const express = require('express');
const {
  sendExamInvitations,
  resendInvitation,
  getInvitationStatus,
  validateInvitation,
  bulkSendInvitations
} = require('../controllers/invitationController');
const { protect, authorize } = require('../middlewares/auth');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// @desc    Send exam invitations to selected candidates
// @route   POST /api/v1/invitations/send
// @access  Private (Admin/Teacher)
router.post('/send',
  protect,
  authorize('admin', 'teacher'),
  [
    body('examId').isMongoId().withMessage('Valid exam ID is required'),
    body('candidateIds').isArray({ min: 1 }).withMessage('At least one candidate ID is required'),
    body('candidateIds.*').isMongoId().withMessage('All candidate IDs must be valid'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
    body('settings.allowLateJoin').optional().isBoolean().withMessage('allowLateJoin must be boolean'),
    body('settings.maxAttempts').optional().isInt({ min: 1, max: 5 }).withMessage('maxAttempts must be between 1 and 5'),
    body('settings.showResults').optional().isBoolean().withMessage('showResults must be boolean')
  ],
  handleValidationErrors,
  sendExamInvitations
);

// @desc    Send invitations to candidates by email addresses
// @route   POST /api/v1/invitations/bulk-send
// @access  Private (Admin/Teacher)
router.post('/bulk-send',
  protect,
  authorize('admin', 'teacher'),
  [
    body('examId').isMongoId().withMessage('Valid exam ID is required'),
    body('candidateEmails').isArray({ min: 1 }).withMessage('At least one email is required'),
    body('candidateEmails.*').isEmail().withMessage('All entries must be valid email addresses'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
    body('settings.allowLateJoin').optional().isBoolean().withMessage('allowLateJoin must be boolean'),
    body('settings.maxAttempts').optional().isInt({ min: 1, max: 5 }).withMessage('maxAttempts must be between 1 and 5'),
    body('settings.showResults').optional().isBoolean().withMessage('showResults must be boolean')
  ],
  handleValidationErrors,
  bulkSendInvitations
);

// @desc    Resend invitation to a specific candidate
// @route   POST /api/v1/invitations/resend
// @access  Private (Admin/Teacher)
router.post('/resend',
  protect,
  authorize('admin', 'teacher'),
  [
    body('examId').isMongoId().withMessage('Valid exam ID is required'),
    body('candidateId').isMongoId().withMessage('Valid candidate ID is required')
  ],
  handleValidationErrors,
  resendInvitation
);

// @desc    Get invitation status and statistics for an exam
// @route   GET /api/v1/invitations/status/:examId
// @access  Private (Admin/Teacher)
router.get('/status/:examId',
  protect,
  authorize('admin', 'teacher'),
  [
    param('examId').isMongoId().withMessage('Valid exam ID is required')
  ],
  handleValidationErrors,
  getInvitationStatus
);

// @desc    Validate invitation and get exam details (public with access key)
// @route   GET /api/v1/invitations/validate/:examId
// @access  Public (with access key)
router.get('/validate/:examId',
  [
    param('examId').isMongoId().withMessage('Valid exam ID is required'),
    query('key').isLength({ min: 32, max: 128 }).withMessage('Valid access key is required')
  ],
  handleValidationErrors,
  validateInvitation
);

// @desc    Get invitation statistics summary
// @route   GET /api/v1/invitations/stats
// @access  Private (Admin only)
router.get('/stats',
  protect,
  authorize('admin'),
  async (req, res) => {
    try {
      const { Exam } = require('../models/Exam');
      
      // Get invitation statistics across all exams
      const stats = await Exam.aggregate([
        {
          $match: {
            invitations: { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: '$invitations'
        },
        {
          $group: {
            _id: null,
            totalInvitations: { $sum: 1 },
            sentInvitations: {
              $sum: {
                $cond: [
                  { $in: ['$invitations.status', ['sent', 'resent']] },
                  1,
                  0
                ]
              }
            },
            openedInvitations: {
              $sum: {
                $cond: [{ $eq: ['$invitations.status', 'opened'] }, 1, 0]
              }
            },
            startedInvitations: {
              $sum: {
                $cond: [{ $eq: ['$invitations.status', 'started'] }, 1, 0]
              }
            },
            completedInvitations: {
              $sum: {
                $cond: [{ $eq: ['$invitations.status', 'completed'] }, 1, 0]
              }
            },
            expiredInvitations: {
              $sum: {
                $cond: [{ $eq: ['$invitations.status', 'expired'] }, 1, 0]
              }
            },
            failedInvitations: {
              $sum: {
                $cond: [{ $eq: ['$invitations.status', 'failed'] }, 1, 0]
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalInvitations: 0,
        sentInvitations: 0,
        openedInvitations: 0,
        startedInvitations: 0,
        completedInvitations: 0,
        expiredInvitations: 0,
        failedInvitations: 0
      };

      // Calculate rates
      const openRate = result.totalInvitations > 0 
        ? Math.round((result.openedInvitations / result.totalInvitations) * 100)
        : 0;
      
      const completionRate = result.openedInvitations > 0
        ? Math.round((result.completedInvitations / result.openedInvitations) * 100)
        : 0;

      res.status(200).json({
        success: true,
        data: {
          ...result,
          openRate,
          completionRate,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error fetching invitation stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching invitation statistics',
        error: error.message
      });
    }
  }
);

// @desc    Cancel/revoke invitation
// @route   DELETE /api/v1/invitations/cancel
// @access  Private (Admin/Teacher)
router.delete('/cancel',
  protect,
  authorize('admin', 'teacher'),
  [
    body('examId').isMongoId().withMessage('Valid exam ID is required'),
    body('candidateId').isMongoId().withMessage('Valid candidate ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { examId, candidateId } = req.body;
      const { Exam } = require('../models/Exam');

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Exam not found'
        });
      }

      // Check permissions
      if (req.user.userType === 'teacher' && exam.instructor.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find and cancel the invitation
      const invitationIndex = exam.invitations?.findIndex(
        inv => inv.candidateId.toString() === candidateId
      );

      if (invitationIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      // Check if invitation can be cancelled
      const invitation = exam.invitations[invitationIndex];
      if (invitation.status === 'started' || invitation.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel invitation that has already been started or completed'
        });
      }

      // Cancel the invitation
      invitation.status = 'cancelled';
      invitation.cancelledAt = new Date();
      invitation.cancelledBy = req.user.id;

      await exam.save();

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled successfully',
        data: {
          examId,
          candidateId,
          cancelledAt: invitation.cancelledAt
        }
      });

    } catch (error) {
      console.error('Error cancelling invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling invitation',
        error: error.message
      });
    }
  }
);

// @desc    Update invitation settings
// @route   PUT /api/v1/invitations/settings
// @access  Private (Admin/Teacher)
router.put('/settings',
  protect,
  authorize('admin', 'teacher'),
  [
    body('examId').isMongoId().withMessage('Valid exam ID is required'),
    body('candidateId').isMongoId().withMessage('Valid candidate ID is required'),
    body('settings.allowLateJoin').optional().isBoolean().withMessage('allowLateJoin must be boolean'),
    body('settings.maxAttempts').optional().isInt({ min: 1, max: 5 }).withMessage('maxAttempts must be between 1 and 5'),
    body('settings.showResults').optional().isBoolean().withMessage('showResults must be boolean'),
    body('settings.proctoringEnabled').optional().isBoolean().withMessage('proctoringEnabled must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { examId, candidateId, settings } = req.body;
      const { Exam } = require('../models/Exam');

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Exam not found'
        });
      }

      // Check permissions
      if (req.user.userType === 'teacher' && exam.instructor.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find invitation
      const invitationIndex = exam.invitations?.findIndex(
        inv => inv.candidateId.toString() === candidateId
      );

      if (invitationIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      // Update invitation settings
      const invitation = exam.invitations[invitationIndex];
      invitation.settings = { ...invitation.settings, ...settings };
      invitation.updatedAt = new Date();

      await exam.save();

      res.status(200).json({
        success: true,
        message: 'Invitation settings updated successfully',
        data: {
          examId,
          candidateId,
          settings: invitation.settings,
          updatedAt: invitation.updatedAt
        }
      });

    } catch (error) {
      console.error('Error updating invitation settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating invitation settings',
        error: error.message
      });
    }
  }
);

module.exports = router;
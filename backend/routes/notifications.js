const express = require('express');
const {
  sendExamInvitation,
  sendExamReminder,
  sendViolationAlert,
  sendExamCompletionNotification,
  getNotificationHistory,
  sendBulkNotification
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Admin/Teacher routes
router.post('/send-exam-invitation', protect, authorize(['admin', 'teacher']), sendExamInvitation);
router.post('/send-exam-reminder', protect, authorize(['admin', 'teacher']), sendExamReminder);
router.post('/bulk-send', protect, authorize('admin'), sendBulkNotification);
router.get('/history', protect, authorize(['admin', 'teacher']), getNotificationHistory);

// System routes (can be called by the system itself)
router.post('/violation-alert', sendViolationAlert);
router.post('/exam-completion', sendExamCompletionNotification);

module.exports = router;
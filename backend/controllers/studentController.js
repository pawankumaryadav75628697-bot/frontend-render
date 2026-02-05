const User = require('../models/User');
const notificationService = require('../utils/notificationService');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate random password
const generatePassword = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// @desc    Get all students
// @route   GET /api/v1/admin/students
// @access  Private (Admin only)
exports.getAllStudents = async (req, res) => {
  try {
    // Validate and sanitize input parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Limit between 1-100
    const search = req.query.search ? req.query.search.toString().trim() : '';
    
    // Build query with proper validation
    const query = {
      userType: 'student'
    };
    
    // Add search conditions if search parameter exists
    if (search && search.trim()) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { studentId: { $regex: search.trim(), $options: 'i' } },
        { course: { $regex: search.trim(), $options: 'i' } }
      ];
    }
    
    // Add status filter if provided
    const status = req.query.status;
    if (status && status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    const students = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get all students error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: 'Invalid ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

// @desc    Create individual student
// @route   POST /api/v1/admin/students
// @access  Private (Admin only)
exports.createStudent = async (req, res) => {
  try {
    console.log('Creating student with data:', req.body);
    
    const {
      fullName,
      email,
      phoneNumber,
      course,
      semester,
      batch,
      rollNumber
    } = req.body;

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Full name and email are required'
      });
    }

    // Check if student already exists
    const existingStudent = await User.findOne({
      $or: [{ email }, { rollNumber: rollNumber && rollNumber.trim() !== '' ? rollNumber : null }].filter(Boolean)
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: 'Student with this email or roll number already exists'
      });
    }

    // Generate password
    const password = generatePassword();

    // Create student
    const student = await User.create({
      userType: 'student',
      fullName,
      email,
      password,
      phoneNumber: phoneNumber || null,
      course: course || null,
      semester: semester || null,
      batch: batch || null,
      rollNumber: rollNumber || null
    });

    console.log('Student created successfully:', student.studentId);

    // Try to send credentials via SMS and Email (don't let this fail the request)
    let notificationResults = {
      sms: { success: false, error: 'SMS service not configured' },
      email: { success: false, error: 'Email service not configured' }
    };

    try {
      notificationResults = await notificationService.sendStudentCredentials(student, password);
      console.log('Notification results:', notificationResults);
    } catch (notificationError) {
      console.error('Notification service error:', notificationError.message);
      // Continue without failing the request
    }

    res.status(201).json({
      success: true,
      data: {
        student: {
          ...student.toJSON(),
          password: undefined // Don't send password in response
        },
        notifications: notificationResults
      },
      message: 'Student created successfully'
    });

  } catch (error) {
    console.error('Create student error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Student with this email or student ID already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Upload students via CSV/Excel
// @route   POST /api/v1/admin/students/bulk-upload
// @access  Private (Admin only)
exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let students = [];

    if (fileExtension === '.csv') {
      // Parse CSV
      students = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // Parse Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      students = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Only CSV and Excel files are supported'
      });
    }

    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid student data found in file'
      });
    }

    const results = {
      success: [],
      errors: [],
      notifications: []
    };

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      
      try {
        // Normalize field names (handle different column naming)
        const normalizedData = {
          fullName: studentData.fullName || studentData['Full Name'] || studentData.name || studentData.Name,
          email: studentData.email || studentData.Email,
          phoneNumber: studentData.phoneNumber || studentData['Phone Number'] || studentData.phone || studentData.Phone,
          course: studentData.course || studentData.Course,
          semester: studentData.semester || studentData.Semester,
          batch: studentData.batch || studentData.Batch,
          rollNumber: studentData.rollNumber || studentData['Roll Number'] || studentData.rollNo || studentData.RollNo
        };

        // Validate required fields
        if (!normalizedData.fullName || !normalizedData.email) {
          results.errors.push({
            row: i + 1,
            error: 'Full name and email are required',
            data: studentData
          });
          continue;
        }

        // Check if student already exists
        const existingStudent = await User.findOne({
          $or: [
            { email: normalizedData.email },
            { rollNumber: normalizedData.rollNumber && normalizedData.rollNumber.trim() !== '' ? normalizedData.rollNumber : null }
          ].filter(Boolean)
        });

        if (existingStudent) {
          results.errors.push({
            row: i + 1,
            error: 'Student already exists',
            data: studentData
          });
          continue;
        }

        // Generate password
        const password = generatePassword();

        // Create student
        const student = await User.create({
          userType: 'student',
          fullName: normalizedData.fullName,
          email: normalizedData.email,
          password,
          phoneNumber: normalizedData.phoneNumber || null,
          course: normalizedData.course || null,
          semester: normalizedData.semester ? parseInt(normalizedData.semester) : null,
          batch: normalizedData.batch || null,
          rollNumber: normalizedData.rollNumber || null
        });

        results.success.push({
          row: i + 1,
          studentId: student.studentId,
          email: student.email,
          fullName: student.fullName
        });

        // Send credentials (async, don't wait)
        notificationService.sendStudentCredentials(student, password)
          .then(notificationResult => {
            results.notifications.push({
              studentId: student.studentId,
              email: student.email,
              sms: notificationResult.sms,
              email: notificationResult.email
            });
          })
          .catch(error => {
            console.error(`Failed to send credentials to ${student.email}:`, error);
          });

      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: studentData
        });
      }
    }

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Bulk upload completed. ${results.success.length} students created, ${results.errors.length} errors`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/v1/admin/students/:id
// @access  Private (Admin only)
exports.updateStudent = async (req, res) => {
  try {
    const student = await User.findOne({ 
      _id: req.params.id, 
      userType: 'student' 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['fullName', 'email', 'phoneNumber', 'course', 'semester', 'batch', 'rollNumber', 'isActive'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: updatedStudent
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/v1/admin/students/:id
// @access  Private (Admin only)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findOne({ 
      _id: req.params.id, 
      userType: 'student' 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/v1/admin/students/stats
// @access  Private (Admin only)
exports.getStudentStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ userType: 'student' });
    const activeStudents = await User.countDocuments({ userType: 'student', isActive: true });
    const inactiveStudents = totalStudents - activeStudents;

    // Students by course
    const courseStats = await User.aggregate([
      { $match: { userType: 'student' } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Students by batch
    const batchStats = await User.aggregate([
      { $match: { userType: 'student' } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRegistrations = await User.countDocuments({
      userType: 'student',
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalStudents,
        active: activeStudents,
        inactive: inactiveStudents,
        recentRegistrations,
        courseDistribution: courseStats,
        batchDistribution: batchStats
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Rate limiting for resend credentials (prevent spam)
const resendRateLimit = new Map();

// Export rate limit info for debugging
exports.getRateLimitInfo = () => {
  return {
    activeEntries: resendRateLimit.size,
    entries: Array.from(resendRateLimit.entries()).map(([key, timestamp]) => ({
      key,
      timestamp: new Date(timestamp).toISOString(),
      remainingTime: Math.max(0, Math.ceil((timestamp + 30000 - Date.now()) / 1000))
    }))
  };
};

// @desc    Resend credentials to student
// @route   POST /api/v1/admin/students/:id/resend-credentials
// @access  Private (Admin only)
exports.resendCredentials = async (req, res) => {
  try {
    const studentId = req.params.id;
    const adminId = req.user.id;
    
    // Rate limiting: Allow only 1 resend per student per 30 seconds (reduced for better UX)
    const rateLimitKey = `${studentId}-${adminId}`;
    const now = Date.now();
    const lastResend = resendRateLimit.get(rateLimitKey);
    const rateLimitWindow = 30 * 1000; // 30 seconds
    
    if (lastResend && (now - lastResend) < rateLimitWindow) {
      const remainingTime = Math.ceil(((lastResend + rateLimitWindow) - now) / 1000);
      console.log(`Rate limit triggered for student ${studentId} by admin ${adminId}. ${remainingTime}s remaining.`);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingTime} seconds before resending credentials again`,
        error: `Rate limited: ${remainingTime} seconds remaining`,
        rateLimited: true,
        remainingTime: remainingTime
      });
    }

    const student = await User.findOne({ 
      _id: studentId, 
      userType: 'student' 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    console.log(`Admin ${req.user.fullName} requesting credential resend for student ${student.fullName} (${student.email})`);

    // Generate new password
    const newPassword = generatePassword();
    
    // Update student password
    student.password = newPassword;
    await student.save();

    // Send credentials (with error handling)
    let notificationResults = {
      sms: { success: false, error: 'SMS service not configured' },
      email: { success: false, error: 'Email service not configured' }
    };

    try {
      notificationResults = await notificationService.sendStudentCredentials(student, newPassword);
      console.log('Credential resend notification results:', notificationResults);
    } catch (notificationError) {
      console.error('Notification service error during credential resend:', notificationError.message);
      // Continue without failing the request
    }

    // Update rate limit
    resendRateLimit.set(rateLimitKey, now);
    
    // Clean up old rate limit entries (older than 2 minutes)
    setTimeout(() => {
      const cleanupTime = Date.now();
      for (const [key, timestamp] of resendRateLimit.entries()) {
        if (cleanupTime - timestamp > 2 * 60 * 1000) {
          resendRateLimit.delete(key);
        }
      }
    }, 2 * 60 * 1000);

    const response = {
      success: true,
      data: {
        studentId: student.studentId,
        email: student.email,
        fullName: student.fullName,
        notifications: notificationResults
      },
      message: 'New credentials generated and sent successfully'
    };
    
    console.log(`✅ Credentials resent successfully for student ${student.fullName} (${student.email})`);
    console.log(`📧 Email: ${notificationResults.email?.success ? '✅ Sent' : '❌ Failed'}`);
    console.log(`📱 SMS: ${notificationResults.sms?.success ? '✅ Sent' : '❌ Failed/Disabled'}`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error('Resend credentials error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

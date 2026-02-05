const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
// const Subject = require('../models/Subject'); // Commented out until Subject model exists
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// @desc    Get admin dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private (Admin/Teacher)
exports.getDashboard = async (req, res) => {
  try {
    const { userType } = req.user;
    let matchCondition = {};

    // If teacher, only show their data
    if (userType === 'teacher') {
      matchCondition.instructor = req.user.id;
    }

    // Get basic statistics
    const [
      totalStudents,
      totalTeachers,
      totalExams,
      totalAttempts,
      activeExams,
      completedAttempts,
      pendingReviews
    ] = await Promise.all([
      User.countDocuments({ userType: 'student' }),
      userType === 'admin' ? User.countDocuments({ userType: 'teacher' }) : 0,
      Exam.countDocuments(matchCondition),
      ExamAttempt.countDocuments(userType === 'teacher' ? { 
        exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
      } : {}),
      Exam.countDocuments({ ...matchCondition, status: 'active' }),
      ExamAttempt.countDocuments({ 
        status: 'completed',
        ...(userType === 'teacher' ? { 
          exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
        } : {})
      }),
      ExamAttempt.countDocuments({ 
        'proctoring.flaggedForReview': true,
        status: 'completed',
        ...(userType === 'teacher' ? { 
          exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
        } : {})
      })
    ]);

    // Get recent activities
    const recentExams = await Exam.find(matchCondition)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('instructor', 'fullName email')
      .select('title course status scheduling.startDate analytics');

    const recentAttempts = await ExamAttempt.find(
      userType === 'teacher' ? { 
        exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
      } : {}
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('student', 'fullName studentId')
      .populate('exam', 'title course')
      .select('status score startTime endTime proctoring.riskScore');

    // Calculate average scores
    const avgScoreResult = await ExamAttempt.aggregate([
      { 
        $match: { 
          status: 'completed',
          ...(userType === 'teacher' ? { 
            exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
          } : {})
        }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score.percentage' },
          avgRiskScore: { $avg: '$proctoring.riskScore' }
        }
      }
    ]);

    const averageScore = avgScoreResult[0]?.avgScore || 0;
    const averageRiskScore = avgScoreResult[0]?.avgRiskScore || 0;

    // Get exam performance by month
    const monthlyStats = await ExamAttempt.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) },
          ...(userType === 'teacher' ? { 
            exam: { $in: await Exam.find({ instructor: req.user.id }).distinct('_id') }
          } : {})
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          attempts: { $sum: 1 },
          avgScore: { $avg: '$score.percentage' },
          avgRiskScore: { $avg: '$proctoring.riskScore' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalStudents,
          totalTeachers,
          totalExams,
          totalAttempts,
          activeExams,
          completedAttempts,
          pendingReviews,
          averageScore: Math.round(averageScore * 100) / 100,
          averageRiskScore: Math.round(averageRiskScore * 100) / 100
        },
        recentExams,
        recentAttempts,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/v1/admin/users
// @access  Private (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const { userType, search, college, department, semester, page = 1, limit = 10 } = req.query;

    // Build filter object
    let filter = {};
    if (userType && userType !== 'all') {
      filter.userType = userType;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }
    if (college) {
      filter.college = college;
    }
    if (department) {
      filter.department = department;
    }
    if (semester) {
      filter.semester = parseInt(semester);
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password');

    const totalUsers = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasMore: page * limit < totalUsers
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// @desc    Create new user (bulk or single)
// @route   POST /api/v1/admin/users
// @access  Private (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of users'
      });
    }

    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const user = new User(users[i]);
        await user.save();
        createdUsers.push(user);
      } catch (error) {
        errors.push({
          row: i + 1,
          data: users[i],
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdUsers.length} users`,
      data: {
        created: createdUsers,
        errors: errors
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating users',
      error: error.message
    });
  }
};

// @desc    Upload and process CSV/Excel file for bulk user creation
// @route   POST /api/v1/admin/users/upload
// @access  Private (Admin only)
exports.uploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let users = [];

    if (fileExtension === '.csv') {
      // Process CSV file
      users = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // Process Excel file
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      users = xlsx.utils.sheet_to_json(worksheet);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file format. Please upload CSV or Excel file'
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Validate and format user data
    const formattedUsers = users.map(user => ({
      fullName: user.name || user.fullName || user['Full Name'],
      email: user.email || user['Email'],
      userType: user.userType || user.type || user['User Type'] || 'student',
      studentId: user.studentId || user['Student ID'],
      rollNumber: user.rollNumber || user['Roll Number'],
      course: user.course || user['Course'],
      semester: user.semester ? parseInt(user.semester) : undefined,
      department: user.department || user['Department'],
      college: user.college || user['College'],
      phoneNumber: user.phoneNumber || user.phone || user['Phone Number'],
      password: user.password || 'tempPassword123' // Default password
    }));

    // Create users
    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < formattedUsers.length; i++) {
      try {
        const user = new User(formattedUsers[i]);
        await user.save();
        createdUsers.push(user);
      } catch (error) {
        errors.push({
          row: i + 1,
          data: formattedUsers[i],
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully processed ${users.length} records. Created ${createdUsers.length} users.`,
      data: {
        totalProcessed: users.length,
        created: createdUsers.length,
        errors: errors.length,
        createdUsers: createdUsers.map(user => ({
          id: user._id,
          name: user.fullName,
          email: user.email,
          userType: user.userType
        })),
        errors: errors
      }
    });
  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Upload users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing uploaded file',
      error: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/v1/admin/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData._id;
    delete updateData.__v;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/v1/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Also delete related exam attempts if it's a student
    if (user.userType === 'student') {
      await ExamAttempt.deleteMany({ student: id });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// @desc    Get subjects
// @route   GET /api/v1/admin/subjects
// @access  Private (Admin/Teacher)
exports.getSubjects = async (req, res) => {
  try {
    // Temporarily return empty subjects list until Subject model is implemented
    res.status(200).json({
      success: true,
      data: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalSubjects: 0,
        hasMore: false
      }
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subjects',
      error: error.message
    });
  }
};

// @desc    Create subject
// @route   POST /api/v1/admin/subjects
// @access  Private (Admin only)
exports.createSubject = async (req, res) => {
  try {
    // Temporarily return success until Subject model is implemented
    res.status(201).json({
      success: true,
      message: 'Subject feature coming soon',
      data: null
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subject',
      error: error.message
    });
  }
};

// @desc    Get monitoring statistics
// @route   GET /api/v1/admin/monitoring/stats
// @access  Private (Admin only)
exports.getMonitoringStats = async (req, res) => {
  try {
    const { userType } = req.user;
    let matchCondition = {};

    // If teacher, only show their data
    if (userType === 'teacher') {
      matchCondition.instructor = req.user.id;
    }

    // Get current date
    const now = new Date();
    
    // Get active exams count
    const totalActiveExams = await Exam.countDocuments({
      ...matchCondition,
      status: { $in: ['active', 'published'] },
      'scheduling.startDate': { $lte: now },
      'scheduling.endDate': { $gte: now }
    });

    // Get total students taking exams (active attempts)
    const activeExamIds = await Exam.find({
      ...matchCondition,
      status: { $in: ['active', 'published'] },
      'scheduling.startDate': { $lte: now },
      'scheduling.endDate': { $gte: now }
    }).distinct('_id');

    const totalStudents = await ExamAttempt.countDocuments({
      exam: { $in: activeExamIds },
      status: 'in_progress'
    });

    // Get total active incidents (high risk attempts)
    const totalIncidents = await ExamAttempt.countDocuments({
      exam: { $in: activeExamIds },
      status: { $in: ['in_progress', 'completed'] },
      'proctoring.riskScore': { $gte: 70 }
    });

    // Get completed attempts today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completed = await ExamAttempt.countDocuments({
      exam: { $in: activeExamIds },
      status: 'completed',
      endTime: { $gte: todayStart }
    });

    res.status(200).json({
      success: true,
      data: {
        totalActiveExams,
        totalStudents,
        totalIncidents,
        completed
      }
    });
  } catch (error) {
    console.error('Get monitoring stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monitoring statistics',
      error: error.message
    });
  }
};

module.exports = exports;

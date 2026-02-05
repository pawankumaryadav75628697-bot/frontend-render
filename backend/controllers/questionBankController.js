const QuestionBank = require('../models/QuestionBank');
const asyncHandler = require('express-async-handler');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');

// @desc    Create question bank
// @route   POST /api/v1/question-banks
// @access  Private (admin/teacher)
const createQuestionBank = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    subject,
    subjectCode,
    difficulty,
    tags,
    questions,
    isPublic
  } = req.body;

  const questionBank = await QuestionBank.create({
    title,
    description,
    category,
    subject,
    subjectCode,
    difficulty,
    tags,
    questions,
    createdBy: req.user._id,
    isPublic: req.user.userType === 'admin' ? isPublic : false
  });

  res.status(201).json({
    success: true,
    message: 'Question bank created successfully',
    data: questionBank
  });
});

// @desc    Get all question banks
// @route   GET /api/v1/question-banks
// @access  Private
const getQuestionBanks = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    category, 
    subject, 
    difficulty, 
    tags, 
    isPublic,
    search 
  } = req.query;

  const query = {
    $or: [
      { createdBy: req.user._id },
      { isPublic: true }
    ]
  };

  if (category) query.category = category;
  if (subject) query.subject = new RegExp(subject, 'i');
  if (difficulty) query.difficulty = difficulty;
  if (tags) query.tags = { $in: tags.split(',') };
  if (isPublic !== undefined) query.isPublic = isPublic === 'true';
  
  if (search) {
    query.$and = [
      query.$or ? { $or: query.$or } : {},
      {
        $or: [
          { title: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { subject: new RegExp(search, 'i') },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      }
    ];
    delete query.$or;
  }

  const questionBanks = await QuestionBank.find(query)
    .populate('createdBy', 'fullName email')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await QuestionBank.countDocuments(query);

  res.status(200).json({
    success: true,
    count: questionBanks.length,
    pagination: {
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    },
    data: questionBanks
  });
});

// @desc    Get question bank by ID
// @route   GET /api/v1/question-banks/:id
// @access  Private
const getQuestionBankById = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id)
    .populate('createdBy', 'fullName email');

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check if user has access to this question bank
  const hasAccess = questionBank.isPublic || 
                   questionBank.createdBy._id.toString() === req.user._id.toString() ||
                   req.user.userType === 'admin';

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this question bank'
    });
  }

  res.status(200).json({
    success: true,
    data: questionBank
  });
});

// @desc    Update question bank
// @route   PUT /api/v1/question-banks/:id
// @access  Private (owner/admin)
const updateQuestionBank = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check if user owns this question bank or is admin
  if (questionBank.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this question bank'
    });
  }

  const updatedQuestionBank = await QuestionBank.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Question bank updated successfully',
    data: updatedQuestionBank
  });
});

// @desc    Delete question bank
// @route   DELETE /api/v1/question-banks/:id
// @access  Private (owner/admin)
const deleteQuestionBank = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check if user owns this question bank or is admin
  if (questionBank.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this question bank'
    });
  }

  await questionBank.remove();

  res.status(200).json({
    success: true,
    message: 'Question bank deleted successfully'
  });
});

// @desc    Get random questions from question bank
// @route   GET /api/v1/question-banks/:id/random
// @access  Private
const getRandomQuestions = asyncHandler(async (req, res) => {
  const { count = 10, difficulty } = req.query;

  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check access
  const hasAccess = questionBank.isPublic || 
                   questionBank.createdBy.toString() === req.user._id.toString() ||
                   req.user.userType === 'admin';

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this question bank'
    });
  }

  const randomQuestions = questionBank.getRandomQuestions(parseInt(count), difficulty);

  // Update usage stats
  questionBank.usageStats.totalUsage += 1;
  questionBank.usageStats.lastUsed = new Date();
  await questionBank.save();

  res.status(200).json({
    success: true,
    count: randomQuestions.length,
    data: randomQuestions
  });
});

// @desc    Import questions from CSV/Excel
// @route   POST /api/v1/question-banks/:id/import
// @access  Private (owner/admin)
const importQuestions = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check if user owns this question bank or is admin
  if (questionBank.createdBy.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to modify this question bank'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const filePath = req.file.path;
  const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
  const importedQuestions = [];
  let errors = [];

  try {
    if (fileExtension === 'csv') {
      // Parse CSV file
      const results = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      // Process CSV data
      results.forEach((row, index) => {
        try {
          const question = {
            questionText: row.question || row.questionText,
            questionType: row.type || row.questionType || 'multiple-choice',
            points: parseInt(row.points) || 1,
            difficulty: row.difficulty || 'medium',
            explanation: row.explanation,
            bloomsTaxonomy: row.bloomsTaxonomy || row.blooms || 'understand'
          };

          // Parse options for multiple choice questions
          if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
            const options = [];
            for (let i = 1; i <= 6; i++) {
              const optionText = row[`option${i}`] || row[`option_${i}`];
              if (optionText) {
                options.push({
                  text: optionText,
                  isCorrect: (row.correctAnswer || row.correct_answer) === optionText ||
                            (row.correctAnswer || row.correct_answer) === i.toString()
                });
              }
            }
            question.options = options;
          } else {
            question.correctAnswer = row.correctAnswer || row.correct_answer;
          }

          importedQuestions.push(question);
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      });

    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      data.forEach((row, index) => {
        try {
          const question = {
            questionText: row.Question || row.question || row.questionText,
            questionType: row.Type || row.type || row.questionType || 'multiple-choice',
            points: parseInt(row.Points || row.points) || 1,
            difficulty: row.Difficulty || row.difficulty || 'medium',
            explanation: row.Explanation || row.explanation,
            bloomsTaxonomy: row.BloomsTaxonomy || row.bloomsTaxonomy || row.Blooms || row.blooms || 'understand'
          };

          // Parse options
          if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
            const options = [];
            ['A', 'B', 'C', 'D', 'E', 'F'].forEach((letter, i) => {
              const optionText = row[`Option${letter}`] || row[`option${letter}`] || 
                               row[`Option_${letter}`] || row[`option_${letter}`] ||
                               row[`Option${i+1}`] || row[`option${i+1}`];
              if (optionText) {
                options.push({
                  text: optionText,
                  isCorrect: (row.CorrectAnswer || row.correctAnswer || row.correct_answer) === optionText ||
                            (row.CorrectAnswer || row.correctAnswer || row.correct_answer) === letter ||
                            (row.CorrectAnswer || row.correctAnswer || row.correct_answer) === (i+1).toString()
                });
              }
            });
            question.options = options;
          } else {
            question.correctAnswer = row.CorrectAnswer || row.correctAnswer || row.correct_answer;
          }

          importedQuestions.push(question);
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      });
    }

    // Add imported questions to question bank
    if (importedQuestions.length > 0) {
      questionBank.questions.push(...importedQuestions);
      await questionBank.save();
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importedQuestions.length} questions`,
      data: {
        importedCount: importedQuestions.length,
        totalQuestions: questionBank.questions.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      success: false,
      message: 'Error importing questions',
      error: error.message
    });
  }
});

// @desc    Export questions to CSV
// @route   GET /api/v1/question-banks/:id/export
// @access  Private (owner/admin)
const exportQuestions = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check access
  const hasAccess = questionBank.createdBy.toString() === req.user._id.toString() ||
                   req.user.userType === 'admin' ||
                   questionBank.isPublic;

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this question bank'
    });
  }

  const { format = 'csv' } = req.query;

  if (format === 'csv') {
    // Generate CSV data
    const csvHeader = [
      'Question',
      'Type',
      'OptionA',
      'OptionB', 
      'OptionC',
      'OptionD',
      'CorrectAnswer',
      'Points',
      'Difficulty',
      'Explanation',
      'BloomsTaxonomy'
    ].join(',');

    const csvData = questionBank.questions.map(q => {
      const row = [
        `"${q.questionText.replace(/"/g, '""')}"`,
        q.questionType,
        q.options[0] ? `"${q.options[0].text.replace(/"/g, '""')}"` : '',
        q.options[1] ? `"${q.options[1].text.replace(/"/g, '""')}"` : '',
        q.options[2] ? `"${q.options[2].text.replace(/"/g, '""')}"` : '',
        q.options[3] ? `"${q.options[3].text.replace(/"/g, '""')}"` : '',
        q.questionType === 'multiple-choice' || q.questionType === 'true-false' 
          ? q.options.find(opt => opt.isCorrect)?.text || ''
          : q.correctAnswer || '',
        q.points,
        q.difficulty,
        q.explanation ? `"${q.explanation.replace(/"/g, '""')}"` : '',
        q.bloomsTaxonomy
      ];
      return row.join(',');
    }).join('\n');

    const csvContent = csvHeader + '\n' + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${questionBank.title}_questions.csv"`);
    res.send(csvContent);

  } else if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${questionBank.title}_questions.json"`);
    res.send(JSON.stringify({
      questionBank: {
        title: questionBank.title,
        subject: questionBank.subject,
        category: questionBank.category,
        difficulty: questionBank.difficulty
      },
      questions: questionBank.questions
    }, null, 2));
  } else {
    res.status(400).json({
      success: false,
      message: 'Unsupported export format. Use csv or json.'
    });
  }
});

// @desc    Get question bank statistics
// @route   GET /api/v1/question-banks/:id/stats
// @access  Private
const getQuestionBankStats = asyncHandler(async (req, res) => {
  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check access
  const hasAccess = questionBank.isPublic || 
                   questionBank.createdBy.toString() === req.user._id.toString() ||
                   req.user.userType === 'admin';

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this question bank'
    });
  }

  const stats = {
    totalQuestions: questionBank.totalQuestions,
    difficultyDistribution: questionBank.difficultyDistribution,
    questionTypeDistribution: {},
    bloomsDistribution: {},
    averagePoints: 0,
    totalPoints: 0,
    usageStats: questionBank.usageStats
  };

  // Calculate distributions
  questionBank.questions.forEach(q => {
    // Question type distribution
    stats.questionTypeDistribution[q.questionType] = 
      (stats.questionTypeDistribution[q.questionType] || 0) + 1;
    
    // Blooms taxonomy distribution
    stats.bloomsDistribution[q.bloomsTaxonomy] = 
      (stats.bloomsDistribution[q.bloomsTaxonomy] || 0) + 1;
    
    // Points calculation
    stats.totalPoints += q.points;
  });

  stats.averagePoints = questionBank.questions.length > 0 
    ? Math.round((stats.totalPoints / questionBank.questions.length) * 100) / 100
    : 0;

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Search questions within question bank
// @route   GET /api/v1/question-banks/:id/search
// @access  Private
const searchQuestions = asyncHandler(async (req, res) => {
  const { query, difficulty, questionType, bloomsTaxonomy, page = 1, limit = 10 } = req.query;

  const questionBank = await QuestionBank.findById(req.params.id);

  if (!questionBank) {
    return res.status(404).json({
      success: false,
      message: 'Question bank not found'
    });
  }

  // Check access
  const hasAccess = questionBank.isPublic || 
                   questionBank.createdBy.toString() === req.user._id.toString() ||
                   req.user.userType === 'admin';

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this question bank'
    });
  }

  let filteredQuestions = questionBank.questions;

  // Apply filters
  if (query) {
    const searchRegex = new RegExp(query, 'i');
    filteredQuestions = filteredQuestions.filter(q => 
      searchRegex.test(q.questionText) || 
      (q.explanation && searchRegex.test(q.explanation))
    );
  }

  if (difficulty) {
    filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficulty);
  }

  if (questionType) {
    filteredQuestions = filteredQuestions.filter(q => q.questionType === questionType);
  }

  if (bloomsTaxonomy) {
    filteredQuestions = filteredQuestions.filter(q => q.bloomsTaxonomy === bloomsTaxonomy);
  }

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);

  res.status(200).json({
    success: true,
    count: paginatedQuestions.length,
    total: filteredQuestions.length,
    pagination: {
      page: parseInt(page),
      pages: Math.ceil(filteredQuestions.length / limit)
    },
    data: paginatedQuestions
  });
});

module.exports = {
  createQuestionBank,
  getQuestionBanks,
  getQuestionBankById,
  updateQuestionBank,
  deleteQuestionBank,
  getRandomQuestions,
  importQuestions,
  exportQuestions,
  getQuestionBankStats,
  searchQuestions
};
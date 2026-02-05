const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const CodingQuestion = require('./models/CodingQuestion');
const CodingExam = require('./models/CodingExam');
const User = require('./models/User');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const createTestCodingExam = async () => {
  try {
    await connectDB();

    // Find an admin user to be the instructor
    const adminUser = await User.findOne({ userType: 'admin' });
    if (!adminUser) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log('✅ Found admin user:', adminUser.email);

    // Check if test coding question already exists
    let codingQuestion = await CodingQuestion.findOne({ title: 'Test Two Sum Problem' });
    
    if (!codingQuestion) {
      // Create a test coding question
      codingQuestion = await CodingQuestion.create({
        title: 'Test Two Sum Problem',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        difficulty: 'easy',
        category: 'Algorithms',
        supportedLanguages: ['python', 'java'],
        starterCode: {
          python: 'def two_sum(nums, target):\n    # Your solution here\n    pass',
          java: 'public int[] twoSum(int[] nums, int target) {\n    // Your solution here\n    return new int[]{};\n}'
        },
        solutionCode: {
          python: 'def two_sum(nums, target):\n    hash_map = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in hash_map:\n            return [hash_map[complement], i]\n        hash_map[num] = i\n    return []'
        },
        testCases: [
          {
            input: '[2,7,11,15], 9',
            expectedOutput: '[0,1]',
            isHidden: false,
            points: 10,
            description: 'Basic test case'
          },
          {
            input: '[3,2,4], 6',
            expectedOutput: '[1,2]',
            isHidden: true,
            points: 10,
            description: 'Hidden test case'
          }
        ],
        constraints: {
          timeLimit: 2000,
          memoryLimit: 256,
          inputFormat: 'Array of integers and target value',
          outputFormat: 'Array of indices'
        },
        createdBy: adminUser._id
      });

      console.log('✅ Created test coding question:', codingQuestion.title);
    } else {
      console.log('✅ Found existing test coding question:', codingQuestion.title);
    }

    // Check if test coding exam already exists
    let codingExam = await CodingExam.findOne({ title: 'Test Coding Challenge' });
    
    if (!codingExam) {
      // Create a test coding exam
      codingExam = await CodingExam.create({
        title: 'Test Coding Challenge',
        description: 'A test coding challenge to verify student access functionality',
        codingQuestion: codingQuestion._id,
        course: 'Computer Science',
        courseCode: 'CS101',
        instructor: adminUser._id,
        settings: {
          duration: 60, // 1 hour
          totalPoints: 100,
          passingScore: 60,
          allowedLanguages: ['python', 'java'],
          showResultsImmediately: false,
          maxAttempts: 3,
          autoSubmit: true
        },
        scheduling: {
          startDate: new Date(), // Start now
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // End in 7 days
        },
        eligibleStudents: [], // Open to all students
        proctoring: {
          enabled: true,
          cameraRequired: false,
          microphoneRequired: false,
          screenRecording: false,
          lockdownBrowser: false
        },
        status: 'active' // Set to active so students can access it
      });

      console.log('✅ Created test coding exam:', codingExam.title);
    } else {
      // Update existing exam to be active
      codingExam.status = 'active';
      codingExam.scheduling.startDate = new Date();
      codingExam.scheduling.endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await codingExam.save();
      
      console.log('✅ Updated existing test coding exam to active status');
    }

    console.log('\n🎉 Test coding exam setup complete!');
    console.log('📋 Students should now be able to see and access the coding exam from their dashboard.');
    console.log(`📝 Exam ID: ${codingExam._id}`);
    console.log(`🔗 Exam Title: ${codingExam.title}`);
    console.log(`📅 Available from: ${codingExam.scheduling.startDate}`);
    console.log(`📅 Available until: ${codingExam.scheduling.endDate}`);

  } catch (error) {
    console.error('❌ Error creating test coding exam:', error);
  } finally {
    process.exit(0);
  }
};

createTestCodingExam();
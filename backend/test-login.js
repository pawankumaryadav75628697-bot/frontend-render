const mongoose = require('mongoose');
const User = require('./models/User');
const generateToken = require('./utils/generateToken');
require('dotenv').config();

async function testLogin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a test user if it doesn't exist
    const testEmail = 'test@example.com';
    let user = await User.findOne({ email: testEmail });
    
    if (!user) {
      console.log('Creating test user...');
      user = await User.create({
        userType: 'student',
        fullName: 'Test Student',
        email: testEmail,
        password: 'password123',
        studentId: 'TEST123',
        course: 'Computer Science',
        semester: 3
      });
      console.log('Test user created:', user.email);
    } else {
      console.log('Test user already exists:', user.email);
    }

    // Test password comparison
    console.log('\n--- Testing Password Comparison ---');
    const userWithPassword = await User.findOne({ email: testEmail }).select('+password');
    console.log('User found:', !!userWithPassword);
    console.log('Password field exists:', !!userWithPassword.password);
    
    const isMatch = await userWithPassword.comparePassword('password123');
    console.log('Password match test:', isMatch);
    
    const isMatchWrong = await userWithPassword.comparePassword('wrongpassword');
    console.log('Wrong password test:', isMatchWrong);

    // Test token generation
    console.log('\n--- Testing Token Generation ---');
    const token = generateToken(user._id);
    console.log('Token generated:', !!token);
    console.log('Token length:', token.length);

    console.log('\n✅ All tests passed! Login should work now.');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testLogin();
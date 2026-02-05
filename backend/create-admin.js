const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exammonitor');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: 'pawankumaryadav0909200@gmail.com',
      userType: 'admin'
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('User Type:', existingAdmin.userType);
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      userType: 'admin',
      fullName: 'Pawan Kumar',
      email: 'pawankumaryadav0909200@gmail.com',
      password: '123456', // This will be hashed automatically
      institution: 'Exam Monitor Institute',
      department: 'IT Administration',
      employeeId: 'ADMIN001'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', adminUser.email);
    console.log('Password: 123456');
    console.log('User Type:', adminUser.userType);
    console.log('Full Name:', adminUser.fullName);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the script
createAdminUser();
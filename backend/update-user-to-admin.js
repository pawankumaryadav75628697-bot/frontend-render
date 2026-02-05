const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const updateUserToAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exammonitor');
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'pawankumaryadav0909200@gmail.com' });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('Found user:');
    console.log('Email:', user.email);
    console.log('Current User Type:', user.userType);
    console.log('Full Name:', user.fullName);

    if (user.userType === 'admin') {
      console.log('✅ User is already an admin');
    } else {
      // Update user to admin
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          userType: 'admin',
          institution: user.institution || 'Exam Monitor Institute',
          department: user.department || 'IT Administration',
          employeeId: user.employeeId || 'ADMIN001'
        },
        { new: true }
      );

      console.log('✅ User updated to admin successfully!');
      console.log('Email:', updatedUser.email);
      console.log('New User Type:', updatedUser.userType);
      console.log('Institution:', updatedUser.institution);
      console.log('Department:', updatedUser.department);
      console.log('Employee ID:', updatedUser.employeeId);
    }
    
  } catch (error) {
    console.error('❌ Error updating user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the script
updateUserToAdmin();
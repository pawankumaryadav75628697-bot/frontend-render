const mongoose = require('mongoose');
require('dotenv').config();

const testDatabaseConnection = async () => {
  console.log('🔍 Testing Database Connection...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET');
  
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI is not set in environment variables');
    return false;
  }
  
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Database Connected Successfully!');
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`🗄️ Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${conn.connection.readyState}`);
    
    // Test a simple query
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`📊 Collections found: ${collections.length}`);
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    await mongoose.disconnect();
    console.log('✅ Test completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Database Connection Failed:');
    console.error('Error:', error.message);
    
    // Provide specific error analysis
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Fix: Check MongoDB URI format and cluster name');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Fix: Check if MongoDB is running and accessible');
    } else if (error.message.includes('authentication failed')) {
      console.log('💡 Fix: Check username and password in MongoDB Atlas');
    } else if (error.message.includes('IP not whitelisted')) {
      console.log('💡 Fix: Add your IP to MongoDB Atlas Network Access');
    }
    
    return false;
  }
};

// Run the test
testDatabaseConnection().then(success => {
  process.exit(success ? 0 : 1);
});

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Setting up Online Exam Monitoring System...\n');

// Check if Node.js version is compatible
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion < 16) {
  console.error('❌ Node.js version 16 or higher is required');
  console.error(`Current version: ${nodeVersion}`);
  process.exit(1);
}

console.log('✅ Node.js version check passed');

// Check if package.json files exist
const backendPackageJson = path.join(__dirname, 'backend', 'package.json');
const frontendPackageJson = path.join(__dirname, 'package.json');

if (!fs.existsSync(backendPackageJson)) {
  console.error('❌ Backend package.json not found');
  process.exit(1);
}

if (!fs.existsSync(frontendPackageJson)) {
  console.error('❌ Frontend package.json not found');
  process.exit(1);
}

console.log('✅ Package files check passed');

// Install dependencies function
function installDependencies(directory, name) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Installing ${name} dependencies...`);
    
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawn(npm, ['install'], { 
      cwd: directory,
      stdio: 'inherit',
      shell: true
    });
    
    install.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} dependencies installed successfully`);
        resolve();
      } else {
        console.error(`❌ Failed to install ${name} dependencies`);
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
    
    install.on('error', (err) => {
      console.error(`❌ Error installing ${name} dependencies:`, err);
      reject(err);
    });
  });
}

// Create uploads directory
function createDirectories() {
  console.log('📁 Creating required directories...');
  
  const directories = [
    path.join(__dirname, 'backend', 'uploads'),
    path.join(__dirname, 'backend', 'logs'),
    path.join(__dirname, 'dist')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
}

// Create environment file if it doesn't exist
function createEnvironmentFile() {
  console.log('🔧 Setting up environment configuration...');
  
  const backendEnvPath = path.join(__dirname, 'backend', '.env');
  const envExamplePath = path.join(__dirname, 'backend', '.env.example');
  
  if (!fs.existsSync(backendEnvPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, backendEnvPath);
    console.log('✅ Created backend .env file from example');
  } else if (!fs.existsSync(backendEnvPath)) {
    // Create basic .env file
    const envContent = `NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/exammonitor
JWT_SECRET=${require('crypto').randomBytes(32).toString('hex')}
JWT_EXPIRE=7d
BCRYPT_SALT_ROUNDS=12

# Email Configuration (Optional)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASS=your-app-password

# File Upload Configuration
UPLOAD_MAX_SIZE=5242880
UPLOAD_PATH=./uploads
`;
    
    fs.writeFileSync(backendEnvPath, envContent);
    console.log('✅ Created backend .env file with default values');
  }
}

// Validate MongoDB connection
function validateMongoDB() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking MongoDB connection...');
    
    try {
      const mongoose = require('mongoose');
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/exammonitor';
      
      mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      });
      
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connection successful');
        mongoose.connection.close();
        resolve();
      });
      
      mongoose.connection.on('error', (err) => {
        console.log('⚠️  MongoDB connection failed:', err.message);
        console.log('💡 Make sure MongoDB is running on your system');
        console.log('   - Windows: Start MongoDB service');
        console.log('   - macOS: brew services start mongodb-community');
        console.log('   - Linux: sudo systemctl start mongod');
        resolve(); // Don't fail setup if MongoDB is not running
      });
      
    } catch (error) {
      console.log('⚠️  MongoDB validation skipped (mongoose not installed yet)');
      resolve();
    }
  });
}

// Create sample data
function createSampleData() {
  console.log('📋 Creating sample data...');
  
  const sampleUsersCSV = `name,email,userType,college,department,semester,course
John Doe,john.doe@student.edu,student,MIT,Computer Science,3,BSc Computer Science
Jane Smith,jane.smith@student.edu,student,MIT,Computer Science,3,BSc Computer Science
Dr. Alice Johnson,alice.johnson@mit.edu,teacher,MIT,Computer Science,,
Prof. Bob Wilson,bob.wilson@mit.edu,teacher,MIT,Computer Science,,
Admin User,admin@mit.edu,admin,MIT,Administration,,`;

  const sampleDataDir = path.join(__dirname, 'sample-data');
  if (!fs.existsSync(sampleDataDir)) {
    fs.mkdirSync(sampleDataDir);
  }
  
  fs.writeFileSync(path.join(sampleDataDir, 'sample-users.csv'), sampleUsersCSV);
  console.log('✅ Created sample users CSV file');
}

// Main setup function
async function setup() {
  try {
    console.log('🔧 Starting setup process...\n');
    
    // Step 1: Create directories
    createDirectories();
    
    // Step 2: Create environment files
    createEnvironmentFile();
    
    // Step 3: Install backend dependencies
    await installDependencies(path.join(__dirname, 'backend'), 'Backend');
    
    // Step 4: Install frontend dependencies
    await installDependencies(__dirname, 'Frontend');
    
    // Step 5: Validate MongoDB (optional)
    await validateMongoDB();
    
    // Step 6: Create sample data
    createSampleData();
    
    console.log('\n🎉 Setup completed successfully!\n');
    
    console.log('📋 Next steps:');
    console.log('1. Start MongoDB if not already running');
    console.log('2. Configure your .env file in the backend directory');
    console.log('3. Start the backend server: npm run dev (in backend directory)');
    console.log('4. Start the frontend server: npm run dev (in root directory)');
    console.log('5. Open http://localhost:5173 in your browser');
    
    console.log('\n📖 Documentation:');
    console.log('- Backend API: http://localhost:5000/api/health');
    console.log('- Sample CSV file: sample-data/sample-users.csv');
    console.log('- MongoDB database: exammonitor');
    
    console.log('\n🔒 Default Admin Credentials:');
    console.log('You can create an admin user through the registration page or API');
    
    console.log('\n🚀 Happy examining!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure you have Node.js 16+ installed');
    console.error('2. Check your internet connection for package downloads');
    console.error('3. Ensure you have write permissions in the project directory');
    console.error('4. Try running: npm cache clean --force');
    process.exit(1);
  }
}

// Check if this script is being run directly
if (require.main === module) {
  setup();
}

module.exports = { setup };
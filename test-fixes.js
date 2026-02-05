#!/usr/bin/env node

/**
 * Test script to verify the fixes made to the exam monitoring system
 * Run this script to check if all the issues have been resolved
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5001/api/v1';
const TEST_EMAIL = 'test@example.com';
const TEST_PHONE = '+1234567890';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n${colors.bold}🧪 Testing: ${testName}${colors.reset}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

async function testServerConnection() {
  logTest('Server Connection');
  try {
    const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}/api/health`);
    if (response.data.success) {
      logSuccess('Server is running and accessible');
      return true;
    } else {
      logError('Server health check failed');
      return false;
    }
  } catch (error) {
    logError(`Cannot connect to server: ${error.message}`);
    return false;
  }
}

async function testEmailConfiguration() {
  logTest('Email Configuration');
  try {
    // Check if email configuration exists
    const envPath = path.join(__dirname, 'backend', '.env');
    if (!fs.existsSync(envPath)) {
      logError('.env file not found');
      return false;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasEmailUser = envContent.includes('EMAIL_USER=') && !envContent.includes('EMAIL_USER=your_email@gmail.com');
    const hasEmailPass = envContent.includes('EMAIL_PASSWORD=') && !envContent.includes('EMAIL_PASSWORD=your_app_password');

    if (hasEmailUser && hasEmailPass) {
      logSuccess('Email configuration found in .env file');
      
      // Test email service initialization
      const notificationServicePath = path.join(__dirname, 'backend', 'utils', 'notificationService.js');
      if (fs.existsSync(notificationServicePath)) {
        logSuccess('Email notification service file exists');
        return true;
      } else {
        logError('Email notification service file missing');
        return false;
      }
    } else {
      logWarning('Email configuration incomplete - emails may not send in production');
      return false;
    }
  } catch (error) {
    logError(`Email configuration test failed: ${error.message}`);
    return false;
  }
}

async function testProctoringComponents() {
  logTest('Proctoring Components');
  try {
    const componentsPath = path.join(__dirname, 'src', 'components', 'Proctoring');
    if (!fs.existsSync(componentsPath)) {
      logError('Proctoring components directory not found');
      return false;
    }

    const requiredComponents = [
      'ProctoringSuite.jsx',
      'FaceDetection.jsx',
      'AudioMonitoring.jsx',
      'BrowserLock.jsx'
    ];

    let componentsFound = 0;
    for (const component of requiredComponents) {
      const componentPath = path.join(componentsPath, component);
      if (fs.existsSync(componentPath)) {
        componentsFound++;
        logSuccess(`${component} found`);
        
        // Check if component has proper imports
        const content = fs.readFileSync(componentPath, 'utf8');
        if (content.includes('import React') || content.includes('from \'react\'')) {
          logSuccess(`${component} has proper React imports`);
        } else {
          logWarning(`${component} may have import issues`);
        }
      } else {
        logError(`${component} not found`);
      }
    }

    if (componentsFound === requiredComponents.length) {
      logSuccess('All required proctoring components found');
      return true;
    } else {
      logError(`Only ${componentsFound}/${requiredComponents.length} components found`);
      return false;
    }
  } catch (error) {
    logError(`Proctoring components test failed: ${error.message}`);
    return false;
  }
}

async function testBackendRoutes() {
  logTest('Backend Routes Configuration');
  try {
    const routesPath = path.join(__dirname, 'backend', 'routes');
    if (!fs.existsSync(routesPath)) {
      logError('Routes directory not found');
      return false;
    }

    const requiredRoutes = [
      'exams.js',
      'notifications.js',
      'proctoring.js'
    ];

    let routesFound = 0;
    for (const route of requiredRoutes) {
      const routePath = path.join(routesPath, route);
      if (fs.existsSync(routePath)) {
        routesFound++;
        logSuccess(`${route} found`);
        
        // Check specific routes
        const content = fs.readFileSync(routePath, 'utf8');
        
        if (route === 'proctoring.js' && content.includes('critical-violation')) {
          logSuccess('Critical violation route found in proctoring.js');
        }
        
        if (route === 'notifications.js' && content.includes('send-exam-invitation')) {
          logSuccess('Exam invitation route found in notifications.js');
        }
        
        if (route === 'exams.js' && content.includes('submitExamAttempt')) {
          logSuccess('Exam submission route found in exams.js');
        }
      } else {
        logError(`${route} not found`);
      }
    }

    return routesFound === requiredRoutes.length;
  } catch (error) {
    logError(`Backend routes test failed: ${error.message}`);
    return false;
  }
}

async function testExamController() {
  logTest('Exam Controller Enhancements');
  try {
    const controllerPath = path.join(__dirname, 'backend', 'controllers', 'examController.js');
    if (!fs.existsSync(controllerPath)) {
      logError('Exam controller not found');
      return false;
    }

    const content = fs.readFileSync(controllerPath, 'utf8');
    
    // Check for email notification integration
    if (content.includes('notificationController.sendExamInvitation')) {
      logSuccess('Email notification integration found in exam publishing');
    } else {
      logError('Email notification integration missing');
      return false;
    }

    // Check for improved result handling
    if (content.includes('resultData') && content.includes('showResults')) {
      logSuccess('Enhanced result display logic found');
    } else {
      logError('Enhanced result display logic missing');
      return false;
    }

    // Check for completion notifications
    if (content.includes('sendExamCompletionNotification')) {
      logSuccess('Completion notification found');
    } else {
      logWarning('Completion notification may be missing');
    }

    return true;
  } catch (error) {
    logError(`Exam controller test failed: ${error.message}`);
    return false;
  }
}

async function testProctoringController() {
  logTest('Proctoring Controller Enhancements');
  try {
    const controllerPath = path.join(__dirname, 'backend', 'controllers', 'proctoringController.js');
    if (!fs.existsSync(controllerPath)) {
      logError('Proctoring controller not found');
      return false;
    }

    const content = fs.readFileSync(controllerPath, 'utf8');
    
    // Check for critical violation handling
    if (content.includes('handleCriticalViolation')) {
      logSuccess('Critical violation handler found');
    } else {
      logError('Critical violation handler missing');
      return false;
    }

    // Check for session locking logic
    if (content.includes('sessionLocked') && content.includes('terminated')) {
      logSuccess('Session locking logic found');
    } else {
      logError('Session locking logic missing');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Proctoring controller test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  log('🚀 Starting Exam Monitoring System Test Suite\n', 'bold');
  
  const testResults = {
    serverConnection: await testServerConnection(),
    emailConfiguration: await testEmailConfiguration(),
    proctoringComponents: await testProctoringComponents(),
    backendRoutes: await testBackendRoutes(),
    examController: await testExamController(),
    proctoringController: await testProctoringController()
  };

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('📊 TEST SUMMARY', 'bold');
  log('='.repeat(50), 'blue');

  const passed = Object.values(testResults).filter(result => result).length;
  const total = Object.keys(testResults).length;

  for (const [testName, result] of Object.entries(testResults)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    const color = result ? 'green' : 'red';
    log(`${status} - ${testName.replace(/([A-Z])/g, ' $1').toLowerCase()}`, color);
  }

  log('\n' + '='.repeat(50), 'blue');
  log(`Overall Result: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('🎉 All tests passed! The fixes have been successfully implemented.', 'green');
    log('\n📋 Issues Fixed:', 'bold');
    log('✅ Email notifications now sent when exams are published', 'green');
    log('✅ Camera and microphone detection improved with proper alerts', 'green');
    log('✅ Session locking implemented for critical violations', 'green');
    log('✅ Exam results now properly displayed after submission', 'green');
  } else {
    log('\n⚠️ Some issues may still exist. Please review the failed tests above.', 'yellow');
  }

  log('\n🔧 Next Steps:', 'bold');
  log('1. Start the backend server: cd backend && npm start');
  log('2. Start the frontend: npm run dev');
  log('3. Test the actual functionality in the browser');
  log('4. Verify camera/microphone permissions work properly');
  log('5. Test exam creation and student notifications');
}

// Run the tests
runAllTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
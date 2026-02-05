#!/usr/bin/env node

/**
 * Development server restart script
 * This script helps clear rate limiting and restart the development server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

async function main() {
  log('🔄 Restarting Development Server...', 'bold');
  
  // Check if we're in the right directory
  const backendPath = path.join(__dirname, 'backend');
  if (!fs.existsSync(backendPath)) {
    log('❌ Backend directory not found. Make sure you\'re running this from the project root.', 'red');
    process.exit(1);
  }

  // Check if package.json exists
  const packagePath = path.join(backendPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    log('❌ Backend package.json not found.', 'red');
    process.exit(1);
  }

  // Set development environment
  process.env.NODE_ENV = 'development';
  
  log('📂 Changing to backend directory...', 'blue');
  process.chdir(backendPath);
  
  log('⚡ Setting up development environment with no rate limiting...', 'yellow');
  
  // Kill any existing Node.js processes on port 5001
  log('🔄 Stopping any existing servers on port 5001...', 'yellow');
  
  try {
    if (process.platform === 'win32') {
      // Windows command to kill process on port 5001
      spawn('netstat', ['-ano'], { stdio: 'pipe' })
        .stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            if (line.includes(':5001')) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(pid)) {
                spawn('taskkill', ['/PID', pid, '/F'], { stdio: 'inherit' });
              }
            }
          });
        });
    } else {
      // Unix/Linux command
      spawn('lsof', ['-ti:5001'], { stdio: 'pipe' })
        .stdout.on('data', (data) => {
          const pids = data.toString().trim().split('\n');
          pids.forEach(pid => {
            if (pid) {
              spawn('kill', ['-9', pid], { stdio: 'inherit' });
            }
          });
        });
    }
  } catch (error) {
    log('⚠️ Could not automatically stop existing servers. Please manually stop any running servers.', 'yellow');
  }

  // Wait a moment for processes to stop
  setTimeout(() => {
    log('🚀 Starting development server with no rate limiting...', 'green');
    
    // Start the server
    const serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DISABLE_RATE_LIMIT: 'true'
      }
    });

    // Handle server process events
    serverProcess.on('error', (error) => {
      log(`❌ Failed to start server: ${error.message}`, 'red');
    });

    serverProcess.on('close', (code) => {
      log(`\n🔄 Server process exited with code ${code}`, code === 0 ? 'green' : 'yellow');
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      log('\n⚠️ Stopping development server...', 'yellow');
      serverProcess.kill('SIGINT');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });

    // Show helpful information
    setTimeout(() => {
      log('\n' + '='.repeat(60), 'blue');
      log('🎉 Development Server Started Successfully!', 'green');
      log('='.repeat(60), 'blue');
      log('📍 Server URL: http://localhost:5001', 'blue');
      log('📍 API Base: http://localhost:5001/api/v1', 'blue');
      log('📍 Health Check: http://localhost:5001/api/health', 'blue');
      log('', 'reset');
      log('✅ Rate limiting is DISABLED for development', 'green');
      log('✅ Enhanced logging is ENABLED', 'green');
      log('✅ CORS is configured for local development', 'green');
      log('', 'reset');
      log('🔧 To test the fixes:', 'bold');
      log('   1. Open your frontend (usually http://localhost:5173)', 'blue');
      log('   2. Try creating and publishing an exam', 'blue');
      log('   3. Test camera/microphone permissions', 'blue');
      log('   4. Check console logs for any remaining issues', 'blue');
      log('', 'reset');
      log('🛑 Press Ctrl+C to stop the server', 'yellow');
      log('='.repeat(60), 'blue');
    }, 3000);
    
  }, 2000);
}

main().catch(error => {
  log(`❌ Failed to restart server: ${error.message}`, 'red');
  process.exit(1);
});
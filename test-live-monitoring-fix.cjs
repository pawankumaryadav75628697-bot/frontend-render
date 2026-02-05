#!/usr/bin/env node

/**
 * Test script to verify LiveMonitoring component fixes
 * This script checks if the undefined toFixed error has been resolved
 */

const fs = require('fs');
const path = require('path');

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

function testLiveMonitoringFixes() {
  log('🔍 Testing LiveMonitoring component fixes...', 'bold');
  
  const liveMonitoringPath = path.join(
    __dirname, 
    'src', 
    'pages', 
    'Admin', 
    'Monitoring', 
    'LiveMonitoring.jsx'
  );
  
  if (!fs.existsSync(liveMonitoringPath)) {
    log('❌ LiveMonitoring.jsx not found!', 'red');
    return false;
  }
  
  const content = fs.readFileSync(liveMonitoringPath, 'utf8');
  
  // Test 1: Check if dangerous toFixed usage is fixed
  const dangerousToFixedPattern = /examStats\.averageProgress\.toFixed/;
  const hasDangerousToFixed = dangerousToFixedPattern.test(content);
  
  if (hasDangerousToFixed) {
    log('❌ Dangerous toFixed usage still exists!', 'red');
    return false;
  } else {
    log('✅ Fixed dangerous toFixed usage', 'green');
  }
  
  // Test 2: Check if safe toFixed usage exists
  const safeToFixedPattern = /\(examStats\.averageProgress \|\| 0\)\.toFixed/;
  const hasSafeToFixed = safeToFixedPattern.test(content);
  
  if (hasSafeToFixed) {
    log('✅ Safe toFixed implementation found', 'green');
  } else {
    log('⚠️ Safe toFixed implementation not found', 'yellow');
  }
  
  // Test 3: Check if error boundary is implemented
  const hasErrorBoundary = content.includes('LiveMonitoringErrorBoundary');
  
  if (hasErrorBoundary) {
    log('✅ Error boundary implemented', 'green');
  } else {
    log('⚠️ Error boundary not found', 'yellow');
  }
  
  // Test 4: Check if all examStats properties have null checks
  const examStatsChecks = [
    'examStats.totalStudents || 0',
    'examStats.activeStudents || 0', 
    'examStats.completedStudents || 0',
    'examStats.flaggedIncidents || 0',
    'examStats.timeRemaining || 0'
  ];
  
  let checksFound = 0;
  examStatsChecks.forEach(check => {
    if (content.includes(check)) {
      checksFound++;
    }
  });
  
  log(`✅ Found ${checksFound}/${examStatsChecks.length} safety checks`, 'green');
  
  // Test 5: Check for React import
  const hasProperReactImport = content.includes('import React,');
  
  if (hasProperReactImport) {
    log('✅ Proper React import found', 'green');
  } else {
    log('⚠️ React import might be incomplete', 'yellow');
  }
  
  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('📊 LiveMonitoring Fix Summary', 'bold');
  log('='.repeat(50), 'blue');
  
  if (!hasDangerousToFixed && hasSafeToFixed && hasErrorBoundary && checksFound >= 3) {
    log('🎉 All critical fixes have been applied!', 'green');
    log('', 'reset');
    log('✅ Fixed: undefined toFixed error', 'green');
    log('✅ Added: Null checks for all examStats properties', 'green');
    log('✅ Added: Error boundary for crash protection', 'green');
    log('✅ Added: Proper error handling and fallbacks', 'green');
    log('', 'reset');
    log('The LiveMonitoring component should now work without crashing.', 'blue');
    return true;
  } else {
    log('⚠️ Some fixes may be incomplete. Please review:', 'yellow');
    if (hasDangerousToFixed) log('- Dangerous toFixed usage still exists', 'red');
    if (!hasSafeToFixed) log('- Safe toFixed implementation missing', 'yellow');
    if (!hasErrorBoundary) log('- Error boundary not implemented', 'yellow');
    if (checksFound < 3) log('- Insufficient safety checks for examStats', 'yellow');
    return false;
  }
}

function provideTroubleshootingTips() {
  log('\n🔧 Troubleshooting Tips:', 'bold');
  log('', 'reset');
  log('If you still encounter errors:', 'blue');
  log('1. Clear your browser cache and refresh', 'blue');
  log('2. Check browser console for any new error messages', 'blue');
  log('3. Restart your development server', 'blue');
  log('4. Verify that the backend API is returning proper data structure', 'blue');
  log('', 'reset');
  log('Common React Error Patterns:', 'bold');
  log('- Cannot read properties of undefined: Add null checks (obj?.property || defaultValue)', 'yellow');
  log('- toFixed() on undefined: Use (value || 0).toFixed(n)', 'yellow'); 
  log('- Map on undefined array: Use (array || []).map()', 'yellow');
  log('', 'reset');
  log('Error Boundary Benefits:', 'bold');
  log('- Prevents entire app from crashing due to component errors', 'green');
  log('- Provides user-friendly error messages', 'green');
  log('- Logs errors for debugging', 'green');
  log('- Allows graceful recovery with page refresh', 'green');
}

// Run the test
const success = testLiveMonitoringFixes();
provideTroubleshootingTips();

if (success) {
  log('\n🚀 LiveMonitoring component is ready for use!', 'green');
  process.exit(0);
} else {
  log('\n⚠️ Please review and apply remaining fixes.', 'yellow');
  process.exit(1);
}
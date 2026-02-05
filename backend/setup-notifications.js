#!/usr/bin/env node

/**
 * Exam Monitor System - Notification Setup Script
 * 
 * This script helps you configure email and SMS notifications for your exam monitoring system.
 * It provides step-by-step guidance for setting up:
 * - Email notifications (Gmail, Ethereal, or custom SMTP)
 * - SMS notifications (Twilio)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupEmailConfiguration() {
  console.log('\n🔧 EMAIL CONFIGURATION');
  console.log('='.repeat(50));
  console.log('Choose your email provider:');
  console.log('1. Ethereal Email (Test emails - recommended for development)');
  console.log('2. Gmail (Real emails - requires app password)');
  console.log('3. Custom SMTP (Other email providers)');
  console.log('4. Skip email configuration');
  
  const choice = await askQuestion('\nEnter your choice (1-4): ');
  
  switch (choice) {
    case '1':
      return await setupEtherealEmail();
    case '2':
      return await setupGmailEmail();
    case '3':
      return await setupCustomSMTP();
    case '4':
      return {
        EMAIL_USER: 'disabled',
        EMAIL_PASSWORD: 'disabled'
      };
    default:
      console.log('Invalid choice, using Ethereal Email as default...');
      return await setupEtherealEmail();
  }
}

async function setupEtherealEmail() {
  console.log('\n📧 Setting up Ethereal Email (Test Environment)');
  console.log('Ethereal Email creates test email accounts automatically.');
  console.log('Visit: https://ethereal.email/create for a test account');
  
  const username = await askQuestion('Enter Ethereal username (or press Enter to use default): ');
  const password = await askQuestion('Enter Ethereal password (or press Enter to use default): ');
  
  return {
    EMAIL_USER: username || 'peter21@ethereal.email',
    EMAIL_PASSWORD: password || 'AhYeUW5AwbXBvXJ88y'
  };
}

async function setupGmailEmail() {
  console.log('\n📧 Setting up Gmail');
  console.log('For Gmail, you need to:');
  console.log('1. Enable 2-Factor Authentication on your Google account');
  console.log('2. Generate an App Password (16 characters)');
  console.log('3. Use the App Password (not your regular password)');
  console.log('\nInstructions: https://support.google.com/accounts/answer/185833');
  
  const email = await askQuestion('Enter your Gmail address: ');
  const password = await askQuestion('Enter your Gmail App Password (16 characters): ');
  
  if (password.length !== 16) {
    console.log('⚠️  Warning: App passwords are typically 16 characters long');
  }
  
  return {
    EMAIL_USER: email,
    EMAIL_PASSWORD: password
  };
}

async function setupCustomSMTP() {
  console.log('\n📧 Setting up Custom SMTP');
  
  const host = await askQuestion('SMTP Host (e.g., smtp.example.com): ');
  const port = await askQuestion('SMTP Port (e.g., 587): ');
  const secure = await askQuestion('Use SSL/TLS? (y/n): ');
  const username = await askQuestion('SMTP Username: ');
  const password = await askQuestion('SMTP Password: ');
  
  return {
    EMAIL_HOST: host,
    EMAIL_PORT: port,
    EMAIL_SECURE: secure.toLowerCase() === 'y' ? 'true' : 'false',
    EMAIL_USER: username,
    EMAIL_PASSWORD: password
  };
}

async function setupSMSConfiguration() {
  console.log('\n📱 SMS CONFIGURATION');
  console.log('='.repeat(50));
  console.log('Choose SMS configuration:');
  console.log('1. Twilio (Real SMS - requires Twilio account)');
  console.log('2. Skip SMS configuration (recommended for development)');
  
  const choice = await askQuestion('\nEnter your choice (1-2): ');
  
  switch (choice) {
    case '1':
      return await setupTwilioSMS();
    case '2':
    default:
      return {
        TWILIO_ACCOUNT_SID: 'disabled',
        TWILIO_AUTH_TOKEN: 'disabled',
        TWILIO_PHONE_NUMBER: 'disabled'
      };
  }
}

async function setupTwilioSMS() {
  console.log('\n📱 Setting up Twilio SMS');
  console.log('You need a Twilio account with:');
  console.log('1. Account SID (starts with AC)');
  console.log('2. Auth Token');
  console.log('3. Twilio Phone Number (in E.164 format, e.g., +1234567890)');
  console.log('\nSign up at: https://www.twilio.com/try-twilio');
  
  const accountSid = await askQuestion('Enter Twilio Account SID: ');
  const authToken = await askQuestion('Enter Twilio Auth Token: ');
  const phoneNumber = await askQuestion('Enter Twilio Phone Number (with country code, e.g., +1234567890): ');
  
  if (!accountSid.startsWith('AC')) {
    console.log('⚠️  Warning: Twilio Account SID should start with "AC"');
  }
  
  if (!phoneNumber.startsWith('+')) {
    console.log('⚠️  Warning: Phone number should be in E.164 format (start with +)');
  }
  
  return {
    TWILIO_ACCOUNT_SID: accountSid,
    TWILIO_AUTH_TOKEN: authToken,
    TWILIO_PHONE_NUMBER: phoneNumber
  };
}

async function updateEnvFile(config) {
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.log('⚠️  .env file not found, creating new one...');
  }
  
  // Update or add configuration
  for (const [key, value] of Object.entries(config)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Configuration saved to ${envPath}`);
}

async function main() {
  console.log('🚀 Exam Monitor System - Notification Setup');
  console.log('='.repeat(50));
  console.log('This script will help you configure email and SMS notifications.\n');
  
  try {
    // Setup email
    const emailConfig = await setupEmailConfiguration();
    
    // Setup SMS
    const smsConfig = await setupSMSConfiguration();
    
    // Combine configuration
    const fullConfig = { ...emailConfig, ...smsConfig };
    
    // Update .env file
    await updateEnvFile(fullConfig);
    
    console.log('\n✅ Configuration complete!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test notifications by creating a student');
    console.log('3. Check the console logs for notification status');
    
    if (emailConfig.EMAIL_USER === 'peter21@ethereal.email') {
      console.log('\n📧 Using Ethereal Email:');
      console.log('   - Check console logs for email preview URLs');
      console.log('   - Visit https://ethereal.email/messages to view test emails');
    }
    
    if (smsConfig.TWILIO_ACCOUNT_SID === 'disabled') {
      console.log('\n📱 SMS is disabled:');
      console.log('   - SMS notifications will be logged to console only');
      console.log('   - Enable SMS later by running this script again');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = { main };
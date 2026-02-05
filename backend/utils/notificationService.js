const twilio = require('twilio');
const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    // Check if we're in development or production mode
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Initialize Twilio client only if valid credentials are provided
    if (this.isValidTwilioConfig()) {
      try {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        console.log('✅ Twilio SMS service initialized successfully');
      } catch (error) {
        console.warn('❌ Twilio initialization failed:', error.message);
        this.twilioClient = null;
      }
    } else {
      if (this.isDevelopment) {
        console.warn('⚠️ Twilio credentials not configured. SMS functionality disabled (Development Mode).');
      }
      this.twilioClient = null;
    }

    // Initialize email transporter with better configuration detection
    if (this.isValidEmailConfig()) {
      try {
        // Support multiple email providers
        const emailConfig = this.getEmailConfig();
        this.emailTransporter = nodemailer.createTransport(emailConfig);
        
        // Verify the connection in development
        if (this.isDevelopment) {
          this.verifyEmailConnection();
        }
        
        console.log('✅ Email service initialized successfully');
      } catch (error) {
        console.warn('❌ Email transporter initialization failed:', error.message);
        this.emailTransporter = null;
      }
    } else {
      if (this.isDevelopment) {
        console.warn('⚠️ Email credentials not configured. Email functionality disabled (Development Mode).');
      }
      this.emailTransporter = null;
    }
  }

  // Validate Twilio configuration
  isValidTwilioConfig() {
    return process.env.TWILIO_ACCOUNT_SID && 
           process.env.TWILIO_AUTH_TOKEN && 
           process.env.TWILIO_PHONE_NUMBER &&
           process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
           process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid' &&
           process.env.TWILIO_PHONE_NUMBER.length >= 10;
  }

  // Validate email configuration
  isValidEmailConfig() {
    return process.env.EMAIL_USER && 
           process.env.EMAIL_PASSWORD && 
           process.env.EMAIL_USER.includes('@') &&
           process.env.EMAIL_USER !== 'your_email@gmail.com' &&
           process.env.EMAIL_PASSWORD !== 'your_app_password' &&
           process.env.EMAIL_PASSWORD.length > 8;
  }

  // Get email configuration based on provider
  getEmailConfig() {
    const user = process.env.EMAIL_USER;
    
    // Ethereal Email (Testing)
    if (user.includes('ethereal.email')) {
      return {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };
    }
    
    // Gmail
    if (user.includes('gmail.com')) {
      return {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };
    }
    
    // Default SMTP configuration
    return {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    };
  }

  // Verify email connection
  async verifyEmailConnection() {
    if (this.emailTransporter) {
      try {
        await this.emailTransporter.verify();
        console.log('📧 Email server connection verified');
      } catch (error) {
        console.warn('⚠️ Email server verification failed:', error.message);
        this.emailTransporter = null;
      }
    }
  }

  // Send SMS notification
  async sendSMS(phoneNumber, message) {
    try {
      if (!this.twilioClient) {
        if (this.isDevelopment) {
          console.log(`📱 SMS (Dev Mode): ${phoneNumber} - ${message.substring(0, 50)}...`);
          return { success: true, messageId: 'dev-mode-sms', note: 'Development mode - SMS not actually sent' };
        }
        return { success: false, error: 'SMS service not configured' };
      }

      // Validate and format phone number
      const cleanPhone = phoneNumber.toString().replace(/\D/g, ''); // Remove non-digits
      
      if (cleanPhone.length < 10) {
        throw new Error(`Invalid phone number: ${phoneNumber}`);
      }

      // Format phone number with country code
      let formattedPhone;
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        formattedPhone = `+${cleanPhone}`;
      } else if (cleanPhone.length === 10) {
        formattedPhone = `+91${cleanPhone}`;
      } else {
        formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${cleanPhone}`;
      }

      // Format Twilio phone number (must be E.164 format)
      let fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!fromNumber.startsWith('+')) {
        fromNumber = `+1${fromNumber}`; // Assume US number if no country code
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: formattedPhone
      });

      console.log(`📱 SMS sent successfully to ${formattedPhone}: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('📱 SMS sending failed:', error.message);
      
      // In development, don't fail completely
      if (this.isDevelopment) {
        console.log(`📱 SMS (Dev Fallback): ${phoneNumber} - Message would have been: ${message.substring(0, 50)}...`);
        return { success: false, error: error.message, note: 'Development mode - SMS service error handled gracefully' };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Send email notification
  async sendEmail(to, subject, htmlContent) {
    try {
      if (!this.emailTransporter) {
        if (this.isDevelopment) {
          console.log(`📧 Email (Dev Mode): ${to} - ${subject}`);
          console.log(`📧 Content preview: ${htmlContent.substring(0, 100)}...`);
          return { success: true, messageId: 'dev-mode-email', note: 'Development mode - Email logged but not actually sent' };
        }
        return { success: false, error: 'Email service not configured' };
      }

      // Validate email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        throw new Error(`Invalid email address: ${to}`);
      }

      const mailOptions = {
        from: `"Exam Monitor System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent,
        // Add text fallback
        text: htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log(`📧 Email sent successfully to ${to}: ${result.messageId}`);
      
      // For Ethereal Email, provide preview URL
      if (process.env.EMAIL_USER.includes('ethereal.email')) {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        console.log(`🔗 Preview URL: ${previewUrl}`);
        return { success: true, messageId: result.messageId, previewUrl };
      }
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('📧 Email sending failed:', error.message);
      
      // In development, provide more helpful error information
      if (this.isDevelopment) {
        console.log(`📧 Email (Dev Fallback): ${to} - Subject: ${subject}`);
        console.log(`📧 Error details:`, {
          code: error.code,
          command: error.command,
          response: error.response
        });
        return { success: false, error: error.message, note: 'Development mode - Email service error with detailed logging' };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Send student credentials via SMS and Email
  async sendStudentCredentials(student, password) {
    const smsMessage = `Welcome to Exam Monitor System!
Your Student ID: ${student.studentId}
Password: ${password}
Use these credentials to access exams.`;

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Exam Monitor System</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
          <h3>Your Login Credentials</h3>
          <p><strong>Student ID:</strong> ${student.studentId}</p>
          <p><strong>Password:</strong> ${password}</p>
          <p><strong>Full Name:</strong> ${student.fullName}</p>
          <p><strong>Course:</strong> ${student.course || 'N/A'}</p>
          <p><strong>Batch:</strong> ${student.batch || 'N/A'}</p>
        </div>
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <h3 style="color: #1976d2; margin-top: 0;">📚 How to Access Your Exams</h3>
          <p><strong>Recommended Method:</strong></p>
          <ol style="margin-left: 20px;">
            <li>Log in to your student account using the credentials above</li>
            <li>Go to your <strong>Student Dashboard</strong></li>
            <li>View all available exams in the "Available Exams" section</li>
            <li>Click "Start Exam" when ready - no exam key required!</li>
          </ol>
          <p><strong>Alternative:</strong> If you receive an exam invitation with an exam key, you can also use the manual exam key entry at the Exam Access Portal.</p>
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #856404;"><strong>💡 Pro Tip:</strong> When exams are published, you'll receive email and SMS notifications with exam details and keys. However, logging into your dashboard is the easiest way to see all your scheduled exams!</p>
        </div>
        <p style="margin-top: 20px;">Please keep these credentials safe and use them to access your exams.</p>
        <p style="color: #64748b; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    const results = {
      sms: null,
      email: null
    };

    // Send SMS if phone number is provided
    if (student.phoneNumber) {
      results.sms = await this.sendSMS(student.phoneNumber, smsMessage);
    }

    // Send email if email is provided
    if (student.email) {
      results.email = await this.sendEmail(
        student.email,
        'Your Exam Monitor System Credentials',
        emailContent
      );
    }

    return results;
  }

  // Send exam invitation notification
  async sendExamInvitation(student, exam) {
    const smsMessage = `Exam Alert!
Exam: ${exam.title}
Key: ${exam.examKey}
Duration: ${exam.duration} minutes
Start Time: ${new Date(exam.startTime).toLocaleString()}
Good luck!`;

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Exam Invitation</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
          <h3>${exam.title}</h3>
          <p><strong>Exam Key:</strong> <span style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${exam.examKey}</span></p>
          <p><strong>Duration:</strong> ${exam.duration} minutes</p>
          <p><strong>Start Time:</strong> ${new Date(exam.startTime).toLocaleString()}</p>
          <p><strong>Description:</strong> ${exam.description || 'No description provided'}</p>
        </div>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0;"><strong>Instructions:</strong></p>
          <ul style="margin: 10px 0;">
            <li>Use the exam key to start your exam</li>
            <li>Ensure stable internet connection</li>
            <li>Have your student ID ready</li>
            <li>Read all instructions carefully before starting</li>
          </ul>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    const results = {
      sms: null,
      email: null
    };

    // Send SMS if phone number is provided
    if (student.phoneNumber) {
      results.sms = await this.sendSMS(student.phoneNumber, smsMessage);
    }

    // Send email if email is provided
    if (student.email) {
      results.email = await this.sendEmail(
        student.email,
        `Exam Invitation: ${exam.title}`,
        emailContent
      );
    }

    return results;
  }

  // Send exam result notification
  async sendExamResult(student, examAttempt, exam) {
    const score = examAttempt.score;
    const percentage = ((score / exam.totalMarks) * 100).toFixed(2);
    
    const smsMessage = `Exam Result
${exam.title}
Score: ${score}/${exam.totalMarks} (${percentage}%)
Status: ${examAttempt.status}
Check detailed results online.`;

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Exam Results</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
          <h3>${exam.title}</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div>
              <p><strong>Score:</strong> ${score}/${exam.totalMarks}</p>
              <p><strong>Percentage:</strong> ${percentage}%</p>
            </div>
            <div>
              <p><strong>Status:</strong> ${examAttempt.status}</p>
              <p><strong>Duration:</strong> ${Math.round(examAttempt.timeSpent / 60)} minutes</p>
            </div>
          </div>
          <p><strong>Submitted At:</strong> ${new Date(examAttempt.submittedAt).toLocaleString()}</p>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    const results = {
      sms: null,
      email: null
    };

    // Send SMS if phone number is provided
    if (student.phoneNumber) {
      results.sms = await this.sendSMS(student.phoneNumber, smsMessage);
    }

    // Send email if email is provided
    if (student.email) {
      results.email = await this.sendEmail(
        student.email,
        `Exam Results: ${exam.title}`,
        emailContent
      );
    }

    return results;
  }

  // Send coding question notification
  async sendCodingQuestionNotification(student, codingQuestion) {
    const languagesText = codingQuestion.supportedLanguages.join(', ').toUpperCase();
    
    const smsMessage = `New Coding Question Available!
Title: ${codingQuestion.title}
Difficulty: ${codingQuestion.difficulty.toUpperCase()}
Languages: ${languagesText}
Category: ${codingQuestion.category}
Login to practice and test your skills!`;

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🚀 New Coding Challenge Available!</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">${codingQuestion.title}</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
            <div>
              <p><strong>Difficulty:</strong> <span style="background: ${this.getDifficultyColor(codingQuestion.difficulty)}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">${codingQuestion.difficulty.toUpperCase()}</span></p>
              <p><strong>Category:</strong> ${codingQuestion.category}</p>
            </div>
            <div>
              <p><strong>Languages:</strong> ${languagesText}</p>
              <p><strong>Total Points:</strong> ${codingQuestion.totalPoints}</p>
            </div>
          </div>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin-top: 0;">📝 Problem Description</h3>
          <p style="color: #424242; line-height: 1.6;">${codingQuestion.description.substring(0, 200)}${codingQuestion.description.length > 200 ? '...' : ''}</p>
        </div>

        <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7b1fa2; margin-top: 0;">💻 Supported Programming Languages</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${codingQuestion.supportedLanguages.map(lang => 
              `<span style="background: #9c27b0; color: white; padding: 4px 12px; border-radius: 16px; font-size: 14px;">${lang.toUpperCase()}</span>`
            ).join('')}
          </div>
        </div>

        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #f57c00; margin-top: 0;">🎯 Test Case Information</h3>
          <p><strong>Visible Test Cases:</strong> ${codingQuestion.testCases.filter(tc => !tc.isHidden).length}</p>
          <p><strong>Time Limit:</strong> ${codingQuestion.constraints.timeLimit}ms per test case</p>
          <p><strong>Memory Limit:</strong> ${codingQuestion.constraints.memoryLimit}MB</p>
        </div>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="color: #2e7d32; margin-top: 0;">🚀 Ready to Code?</h3>
          <p style="margin: 15px 0;">Log into your student dashboard to:</p>
          <ul style="list-style: none; padding: 0; color: #424242;">
            <li>✅ View the complete problem statement</li>
            <li>✅ Access the built-in code editor</li>
            <li>✅ Test your solution against sample cases</li>
            <li>✅ Submit and get instant feedback</li>
          </ul>
        </div>

        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #c62828; font-size: 14px;"><strong>💡 Pro Tip:</strong> Start with the sample test cases to understand the input/output format, then optimize your solution for all edge cases!</p>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Happy Coding! 🎉<br>This is an automated message. Please do not reply.</p>
      </div>
    `;

    const results = {
      sms: null,
      email: null
    };

    // Send SMS if phone number is provided
    if (student.phoneNumber) {
      results.sms = await this.sendSMS(student.phoneNumber, smsMessage);
    }

    // Send email if email is provided
    if (student.email) {
      results.email = await this.sendEmail(
        student.email,
        `🚀 New Coding Challenge: ${codingQuestion.title}`,
        emailContent
      );
    }

    return results;
  }

  // Helper method to get difficulty color
  getDifficultyColor(difficulty) {
    const colors = {
      easy: '#22c55e',
      medium: '#f59e0b', 
      hard: '#ef4444',
      expert: '#8b5cf6'
    };
    return colors[difficulty] || '#64748b';
  }
}

module.exports = new NotificationService();

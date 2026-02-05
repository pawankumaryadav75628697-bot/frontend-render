import React from 'react';
import './StudentLoginGuide.css';

const StudentLoginGuide = () => {
  return (
    <div className="student-login-guide">
      <div className="guide-container">
        <div className="guide-header">
          <h2>🎓 Student Access Guide</h2>
          <p>Follow these simple steps to access your exams</p>
        </div>
        
        <div className="guide-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>📧 Check Your Email</h3>
              <p>You should have received your student credentials via email with:</p>
              <ul>
                <li>Student ID</li>
                <li>Password</li>
                <li>Course information</li>
                <li>Instructions to use the Student Dashboard</li>
              </ul>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>🔑 Login to Your Account</h3>
              <p>Click the "Login" button in the top navigation and use your student credentials:</p>
              <ul>
                <li><strong>Email/Student ID:</strong> As provided in your email</li>
                <li><strong>Password:</strong> As provided in your email</li>
              </ul>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>📚 Access Your Dashboard</h3>
              <p>After logging in, you'll be taken to your Student Dashboard where you can:</p>
              <ul>
                <li>View all your available exams</li>
                <li>See exam schedules and details</li>
                <li>Start exams directly (no exam key required!)</li>
                <li>Check your exam history and results</li>
              </ul>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>🚀 Start Your Exam</h3>
              <p>When ready to take an exam:</p>
              <ul>
                <li>Click "Start Exam" on any available exam</li>
                <li>Complete system checks if required</li>
                <li>Begin your exam in the secure interface</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="guide-tips">
          <h3>💡 Important Tips</h3>
          <div className="tips-grid">
            <div className="tip">
              <strong>🚫 No Exam Key Needed:</strong> When logged in, you don't need to manually enter exam keys
            </div>
            <div className="tip">
              <strong>📱 Notifications:</strong> You'll receive email/SMS notifications when new exams are published
            </div>
            <div className="tip">
              <strong>🔄 Automatic Updates:</strong> Your dashboard automatically shows newly available exams
            </div>
            <div className="tip">
              <strong>🔐 Secure Access:</strong> Always use the Student Dashboard for the best exam experience
            </div>
          </div>
        </div>
        
        <div className="guide-footer">
          <div className="help-section">
            <h4>Need Help?</h4>
            <p>If you're having trouble accessing your exams:</p>
            <ol>
              <li>Make sure you're using the credentials from your email</li>
              <li>Try refreshing the page after logging in</li>
              <li>Contact your instructor if you don't see expected exams</li>
              <li>Use "Exam Access" only for special exams that require a key</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginGuide;
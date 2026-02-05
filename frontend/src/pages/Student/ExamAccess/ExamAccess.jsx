import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import './ExamAccess.css';

const ExamAccess = () => {
  const { user, isAuthenticated } = useAuth();
  const [examKey, setExamKey] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [examPreview, setExamPreview] = useState(null);
  const [step, setStep] = useState('enter-key'); // 'enter-key', 'preview', 'verify-id', 'starting'
  const [showStudentDashboardPrompt, setShowStudentDashboardPrompt] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated as a student
    if (isAuthenticated && user?.userType === 'student') {
      setShowStudentDashboardPrompt(true);
    } else {
      // Clear any existing auth tokens since this is key-based access
      localStorage.removeItem('examToken');
    }
  }, [isAuthenticated, user]);

  const handleGoToDashboard = () => {
    navigate('/student/dashboard');
  };

  const handleContinueWithKeyAccess = () => {
    setShowStudentDashboardPrompt(false);
    // Clear any existing auth tokens since this is key-based access
    localStorage.removeItem('examToken');
  };

  const handleKeySubmit = async (e) => {
    e.preventDefault();
    if (!examKey.trim()) {
      toast.error('Please enter an exam key');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/exam-access/preview/${examKey.toUpperCase()}`, {
        method: 'GET'
      });

      const data = await response.json();

      if (response.ok) {
        setExamPreview(data.data);
        setStep('preview');
        toast.success('Exam found! Please review the details below.');
      } else {
        toast.error(data.error || 'Invalid exam key');
      }
    } catch (error) {
      console.error('Error fetching exam preview:', error);
      toast.error('Failed to verify exam key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!studentId.trim()) {
      toast.error('Please enter your student ID');
      return;
    }

    setLoading(true);
    setStep('starting');

    try {
      const response = await fetch('/api/v1/exam-access/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          examKey: examKey.toUpperCase(),
          studentId: studentId.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store the exam access token
        localStorage.setItem('examToken', data.data.accessToken);
        localStorage.setItem('examData', JSON.stringify({
          exam: data.data.exam,
          student: data.data.student,
          attempt: data.data.attempt,
          timeRemaining: data.data.timeRemaining
        }));

        toast.success('Access granted! Starting exam...');
        
        // Navigate to secure exam interface
        setTimeout(() => {
          navigate(`/exam-interface/${data.data.attempt._id}`);
        }, 2000);
      } else {
        toast.error(data.error || 'Failed to start exam');
        setStep('preview');
      }
    } catch (error) {
      console.error('Error starting exam:', error);
      toast.error('Failed to start exam. Please try again.');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckResults = () => {
    navigate('/results');
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeRemaining = (milliseconds) => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getExamStatusMessage = () => {
    if (!examPreview) return '';
    
    const { examStatus, timeInfo } = examPreview;
    
    if (examStatus.hasEnded) {
      return {
        type: 'error',
        message: 'This exam has ended and is no longer available.'
      };
    }
    
    if (!examStatus.hasStarted) {
      return {
        type: 'warning',
        message: `This exam will start on ${formatDateTime(timeInfo.startTime)}`
      };
    }
    
    if (!examStatus.isActive) {
      return {
        type: 'warning',
        message: 'This exam is not currently active.'
      };
    }
    
    return {
      type: 'success',
      message: 'This exam is currently active and available.'
    };
  };

  if (step === 'starting') {
    return (
      <div className="exam-access-container starting">
        <div className="starting-screen">
          <div className="loading-animation">
            <div className="exam-icon">📝</div>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <h2>Starting Your Exam...</h2>
          <p>Please wait while we prepare your exam environment.</p>
          <div className="starting-checklist">
            <div className="check-item completed">
              <span className="check-icon">✅</span>
              Verifying credentials
            </div>
            <div className="check-item completed">
              <span className="check-icon">✅</span>
              Loading exam questions
            </div>
            <div className="check-item active">
              <span className="check-icon">⏳</span>
              Initializing secure environment
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showStudentDashboardPrompt) {
    return (
      <div className="exam-access-container">
        <div className="exam-access-header">
          <h1>🎓 Exam Access Portal</h1>
          <p>We noticed you're already logged in as a student</p>
        </div>
        
        <div className="student-dashboard-prompt">
          <div className="form-card prompt-card">
            <div className="card-header">
              <h2>👋 Welcome, {user?.fullName}!</h2>
              <p>You're logged in as a student. We recommend using your student dashboard to access exams.</p>
            </div>
            
            <div className="prompt-content">
              <div className="recommendation-section">
                <div className="recommendation-item">
                  <span className="icon">📚</span>
                  <div className="content">
                    <h4>Use Student Dashboard (Recommended)</h4>
                    <p>Access all your assigned exams, view schedules, and track your progress.</p>
                  </div>
                </div>
                <div className="recommendation-item">
                  <span className="icon">🔑</span>
                  <div className="content">
                    <h4>Manual Exam Key Entry</h4>
                    <p>For special exams or external access that requires an exam key.</p>
                  </div>
                </div>
              </div>
              
              <div className="action-buttons">
                <button 
                  onClick={handleGoToDashboard}
                  className="primary-btn dashboard-btn"
                >
                  🏠 Go to Student Dashboard
                </button>
                <button 
                  onClick={handleContinueWithKeyAccess}
                  className="secondary-btn key-access-btn"
                >
                  🔑 Continue with Exam Key
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-access-container">
      <div className="exam-access-header">
        <h1>🎓 Exam Access Portal</h1>
        <p>Enter your exam key to join an exam or check your results</p>
      </div>

      {step === 'enter-key' && (
        <div className="exam-key-form">
          <div className="form-card">
            <div className="card-header">
              <h2>Enter Exam Key</h2>
              <p>Get your exam key from your instructor</p>
            </div>
            
            <form onSubmit={handleKeySubmit} className="key-form">
              <div className="input-group">
                <label htmlFor="examKey">Exam Key</label>
                <input
                  type="text"
                  id="examKey"
                  value={examKey}
                  onChange={(e) => setExamKey(e.target.value.toUpperCase())}
                  placeholder="Enter 6-8 character exam key"
                  className="key-input"
                  maxLength="8"
                  pattern="[A-Z0-9]{6,8}"
                  required
                />
                <small className="input-help">
                  Example: ABC123 or XYZ789AB
                </small>
              </div>
              
              <button 
                type="submit" 
                className="submit-btn primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Verifying...
                  </>
                ) : (
                  <>
                    🔍 Find Exam
                  </>
                )}
              </button>
            </form>

            <div className="alternative-actions">
              <button 
                onClick={handleCheckResults}
                className="link-button"
              >
                📊 Check My Results
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && examPreview && (
        <div className="exam-preview">
          <div className="preview-card">
            <div className="card-header">
              <button 
                onClick={() => setStep('enter-key')}
                className="back-btn"
              >
                ← Back
              </button>
              <h2>Exam Details</h2>
            </div>

            <div className="exam-info">
              <div className="exam-header">
                <h3>{examPreview.exam.title}</h3>
                <div className="exam-key-display">
                  Key: <span className="key">{examPreview.exam.examKey}</span>
                </div>
              </div>

              <div className="exam-meta">
                <div className="meta-item">
                  <span className="label">Course:</span>
                  <span className="value">
                    {examPreview.exam.course} ({examPreview.exam.courseCode})
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Instructor:</span>
                  <span className="value">{examPreview.exam.instructor.fullName}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Duration:</span>
                  <span className="value">{examPreview.exam.settings.duration} minutes</span>
                </div>
                <div className="meta-item">
                  <span className="label">Total Questions:</span>
                  <span className="value">{examPreview.exam.questionCount}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Total Points:</span>
                  <span className="value">{examPreview.exam.settings.totalPoints}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Max Attempts:</span>
                  <span className="value">{examPreview.exam.settings.maxAttempts}</span>
                </div>
              </div>

              {examPreview.exam.description && (
                <div className="exam-description">
                  <h4>Description:</h4>
                  <p>{examPreview.exam.description}</p>
                </div>
              )}

              <div className="exam-schedule">
                <div className="schedule-item">
                  <span className="label">Start Time:</span>
                  <span className="value">
                    {formatDateTime(examPreview.exam.scheduling.startDate)}
                  </span>
                </div>
                <div className="schedule-item">
                  <span className="label">End Time:</span>
                  <span className="value">
                    {formatDateTime(examPreview.exam.scheduling.endDate)}
                  </span>
                </div>
                {examPreview.timeInfo.timeUntilEnd > 0 && (
                  <div className="schedule-item">
                    <span className="label">Time Remaining:</span>
                    <span className="value time-remaining">
                      {formatTimeRemaining(examPreview.timeInfo.timeUntilEnd)}
                    </span>
                  </div>
                )}
              </div>

              {/* Exam Status Alert */}
              {(() => {
                const statusMsg = getExamStatusMessage();
                return (
                  <div className={`status-alert ${statusMsg.type}`}>
                    <span className="status-icon">
                      {statusMsg.type === 'error' ? '❌' : 
                       statusMsg.type === 'warning' ? '⚠️' : '✅'}
                    </span>
                    <span className="status-message">{statusMsg.message}</span>
                  </div>
                );
              })()}

              {/* Proctoring Information */}
              {examPreview.exam.proctoring.enabled && (
                <div className="proctoring-info">
                  <h4>🔒 Proctoring Requirements:</h4>
                  <ul>
                    {examPreview.exam.proctoring.cameraRequired && (
                      <li>Camera access required</li>
                    )}
                    {examPreview.exam.proctoring.microphoneRequired && (
                      <li>Microphone access required</li>
                    )}
                    {examPreview.exam.proctoring.screenRecording && (
                      <li>Screen recording will be active</li>
                    )}
                    {examPreview.exam.proctoring.lockdownBrowser && (
                      <li>Lockdown browser required</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {examPreview.examStatus.canStart && (
              <div className="student-id-form">
                <div className="form-section">
                  <label htmlFor="studentId">Your Student ID</label>
                  <input
                    type="text"
                    id="studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Enter your student ID"
                    className="student-id-input"
                    required
                  />
                </div>
                
                <button 
                  onClick={handleStartExam}
                  className="start-exam-btn"
                  disabled={loading || !studentId.trim()}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Starting Exam...
                    </>
                  ) : (
                    <>
                      🚀 Start Exam
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamAccess;
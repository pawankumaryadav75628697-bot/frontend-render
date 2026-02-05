import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import './ExamTaking.css';

const ExamTaking = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [warnings, setWarnings] = useState([]);
  
  // Proctoring state
  const [proctoringData, setProctoringData] = useState({
    tabSwitches: 0,
    focusLosses: 0,
    suspiciousActivity: [],
    cameraEnabled: false,
    microphoneEnabled: false
  });
  
  // Refs
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const saveIntervalRef = useRef(null);
  
  useEffect(() => {
    if (attemptId && token) {
      initializeExam();
      setupProctoring();
      setupEventListeners();
    }

    return () => {
      cleanup();
    };
  }, [attemptId, token]);

  const initializeExam = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/exams/attempts/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        const attemptData = data.data;
        setAttempt(attemptData);
        setExam(attemptData.exam);
        
        // Initialize answers from existing attempt data
        const existingAnswers = {};
        attemptData.answers?.forEach(answer => {
          existingAnswers[answer.questionId] = {
            selectedOption: answer.selectedOption,
            textAnswer: answer.textAnswer
          };
        });
        setAnswers(existingAnswers);
        
        // Calculate time remaining
        const duration = attemptData.exam.settings.duration * 60; // Convert to seconds
        const elapsed = Math.floor((new Date() - new Date(attemptData.startTime)) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);
        
        if (remaining > 0) {
          startTimer(remaining);
        } else {
          // Time's up, auto-submit
          handleTimeUp();
        }
        
        // Auto-save setup
        setupAutoSave();
        
      } else {
        toast.error(data.message || 'Failed to load exam');
        navigate('/student/dashboard');
      }
    } catch (error) {
      console.error('Error initializing exam:', error);
      toast.error('Error loading exam');
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const setupProctoring = async () => {
    if (!exam?.proctoring?.enabled) return;

    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setProctoringData(prev => ({
        ...prev,
        cameraEnabled: true,
        microphoneEnabled: true
      }));
      
      toast.success('Proctoring enabled successfully');
    } catch (error) {
      console.error('Error setting up proctoring:', error);
      toast.error('Failed to enable camera/microphone for proctoring');
    }
  };

  const setupEventListeners = () => {
    // Tab switch detection
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Focus loss detection
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    // Right-click prevention
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    // Copy/paste prevention
    document.addEventListener('keydown', handleKeyDown);
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }
    
    // Cleanup event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    document.removeEventListener('contextmenu', e => e.preventDefault());
    document.removeEventListener('keydown', handleKeyDown);
    
    // Cleanup camera stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const startTimer = (initialTime) => {
    setTimeRemaining(initialTime);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const setupAutoSave = () => {
    saveIntervalRef.current = setInterval(() => {
      saveCurrentAnswer();
    }, 30000); // Auto-save every 30 seconds
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setProctoringData(prev => ({
        ...prev,
        tabSwitches: prev.tabSwitches + 1,
        suspiciousActivity: [
          ...prev.suspiciousActivity,
          {
            type: 'tab_switch',
            timestamp: new Date().toISOString(),
            description: 'Student switched to another tab'
          }
        ]
      }));
      
      addWarning('Tab switch detected! This activity is being monitored.');
    }
  };

  const handleWindowBlur = () => {
    setProctoringData(prev => ({
      ...prev,
      focusLosses: prev.focusLosses + 1,
      suspiciousActivity: [
        ...prev.suspiciousActivity,
        {
          type: 'window_blur',
          timestamp: new Date().toISOString(),
          description: 'Student switched focus away from exam'
        }
      ]
    }));
  };

  const handleWindowFocus = () => {
    // Could implement focus return handling here
  };

  const handleKeyDown = (e) => {
    // Prevent common shortcuts
    if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
      e.preventDefault();
      addWarning('Copy/paste operations are not allowed during the exam');
    }
    
    // Prevent F12, Ctrl+Shift+I (Dev Tools)
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
      e.preventDefault();
      addWarning('Developer tools are not allowed during the exam');
    }
  };

  const addWarning = (message) => {
    const warning = {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString()
    };
    
    setWarnings(prev => [...prev, warning]);
    toast.warning(message);
    
    // Remove warning after 5 seconds
    setTimeout(() => {
      setWarnings(prev => prev.filter(w => w.id !== warning.id));
    }, 5000);
  };

  const handleAnswerChange = (questionId, answerData) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerData
    }));
  };

  const saveCurrentAnswer = async () => {
    const currentQuestion = exam?.questions[currentQuestionIndex];
    if (!currentQuestion || !answers[currentQuestion._id]) return;

    try {
      await fetch(`/api/v1/exams/attempts/${attemptId}/answer`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: currentQuestion._id,
          ...answers[currentQuestion._id]
        })
      });
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  const handleQuestionNavigation = (direction) => {
    saveCurrentAnswer(); // Save current answer before navigating
    
    if (direction === 'next' && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (direction === 'prev' && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleTimeUp = async () => {
    toast.info('Time is up! Submitting your exam...');
    await submitExam(true); // Auto-submit
  };

  const submitExam = async (isAutoSubmit = false) => {
    if (!isAutoSubmit && !window.confirm('Are you sure you want to submit your exam? This action cannot be undone.')) {
      return;
    }

    try {
      // Save current answer before submitting
      await saveCurrentAnswer();
      
      const response = await fetch(`/api/v1/exams/attempts/${attemptId}/submit`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proctoringData,
          finalAnswers: answers
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(isAutoSubmit ? 'Exam submitted automatically' : 'Exam submitted successfully!');
        
        // Navigate to results page
        navigate(`/student/results/${attemptId}`, { 
          state: { 
            examCompleted: true,
            results: data.data 
          }
        });
      } else {
        toast.error(data.message || 'Error submitting exam');
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Error submitting exam');
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question, index) => {
    const currentAnswer = answers[question._id] || {};
    
    switch (question.questionType) {
      case 'multiple-choice':
        return (
          <div className="question-content">
            <h3>Question {index + 1}</h3>
            <div className="question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            <div className="question-options">
              {question.options.map((option, optIndex) => (
                <label key={option._id} className="option-label">
                  <input
                    type="radio"
                    name={`question_${question._id}`}
                    value={option._id}
                    checked={currentAnswer.selectedOption === option._id}
                    onChange={() => handleAnswerChange(question._id, { selectedOption: option._id })}
                  />
                  <span className="option-text">{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        );
        
      case 'true-false':
        return (
          <div className="question-content">
            <h3>Question {index + 1}</h3>
            <div className="question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            <div className="question-options">
              <label className="option-label">
                <input
                  type="radio"
                  name={`question_${question._id}`}
                  value="true"
                  checked={currentAnswer.selectedOption === 'true'}
                  onChange={() => handleAnswerChange(question._id, { selectedOption: 'true' })}
                />
                <span className="option-text">True</span>
              </label>
              <label className="option-label">
                <input
                  type="radio"
                  name={`question_${question._id}`}
                  value="false"
                  checked={currentAnswer.selectedOption === 'false'}
                  onChange={() => handleAnswerChange(question._id, { selectedOption: 'false' })}
                />
                <span className="option-text">False</span>
              </label>
            </div>
          </div>
        );
        
      case 'short-answer':
        return (
          <div className="question-content">
            <h3>Question {index + 1}</h3>
            <div className="question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            <div className="question-input">
              <textarea
                placeholder="Enter your answer here..."
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => handleAnswerChange(question._id, { textAnswer: e.target.value })}
                rows={4}
                className="answer-textarea"
              />
            </div>
          </div>
        );
        
      default:
        return <div>Unsupported question type</div>;
    }
  };

  if (loading) {
    return (
      <div className="exam-loading">
        <div className="loading-spinner">⏳</div>
        <h2>Loading Exam...</h2>
        <p>Please wait while we prepare your exam...</p>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="exam-error">
        <h2>Exam Not Found</h2>
        <p>The exam you're looking for could not be found.</p>
        <button onClick={() => navigate('/student/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;
  const answeredQuestions = Object.keys(answers).length;

  return (
    <div className="exam-taking">
      {/* Proctoring Video */}
      {exam.proctoring?.enabled && (
        <video
          ref={videoRef}
          className="proctoring-video"
          autoPlay
          muted
        />
      )}
      
      {/* Warning Messages */}
      {warnings.length > 0 && (
        <div className="warning-messages">
          {warnings.map(warning => (
            <div key={warning.id} className="warning-message">
              ⚠️ {warning.message}
            </div>
          ))}
        </div>
      )}
      
      {/* Exam Header */}
      <div className="exam-header">
        <div className="exam-info">
          <h1>{exam.title}</h1>
          <p>{exam.course} - {exam.courseCode}</p>
        </div>
        
        <div className="exam-timer">
          <div className={`timer ${timeRemaining < 300 ? 'warning' : ''}`}>
            <span className="timer-icon">⏱️</span>
            <span className="timer-text">{formatTime(timeRemaining)}</span>
          </div>
        </div>
        
        <div className="exam-progress">
          <div className="progress-info">
            Question {currentQuestionIndex + 1} of {exam.questions.length}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="answered-info">
            {answeredQuestions} answered
          </div>
        </div>
      </div>
      
      {/* Question Content */}
      <div className="exam-content">
        <div className="question-container">
          {renderQuestion(currentQuestion, currentQuestionIndex)}
        </div>
      </div>
      
      {/* Navigation Controls */}
      <div className="exam-controls">
        <div className="navigation-buttons">
          <button
            className="nav-btn prev"
            onClick={() => handleQuestionNavigation('prev')}
            disabled={currentQuestionIndex === 0}
          >
            ← Previous
          </button>
          
          <div className="question-grid">
            {exam.questions.map((_, index) => (
              <button
                key={index}
                className={`question-nav ${index === currentQuestionIndex ? 'current' : ''} ${answers[exam.questions[index]._id] ? 'answered' : ''}`}
                onClick={() => {
                  saveCurrentAnswer();
                  setCurrentQuestionIndex(index);
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <button
            className="nav-btn next"
            onClick={() => handleQuestionNavigation('next')}
            disabled={currentQuestionIndex === exam.questions.length - 1}
          >
            Next →
          </button>
        </div>
        
        <div className="action-buttons">
          <button 
            className="save-btn"
            onClick={saveCurrentAnswer}
          >
            💾 Save Answer
          </button>
          
          <button 
            className="submit-btn"
            onClick={() => submitExam(false)}
          >
            ✅ Submit Exam
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamTaking;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import './SecureExamInterface.css';

const SecureExamInterface = () => {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState(null);
  const [examAttempt, setExamAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctoring, setProctoring] = useState({
    enabled: false,
    cameraStream: null,
    microphoneStream: null,
    requirements: {}
  });
  const [systemCheck, setSystemCheck] = useState({
    passed: false,
    camera: false,
    microphone: false,
    fullscreen: false,
    browser: false
  });
  const [loading, setLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [warnings, setWarnings] = useState([]);
  
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const proctoringIntervalRef = useRef(null);
  
  // Lockdown browser event handlers
  const handleKeyDown = useCallback((e) => {
    // Prevent common shortcuts
    const forbiddenKeys = [
      'F12', 'F11', 'F5', 'F1',
      'Alt+Tab', 'Alt+F4', 'Ctrl+Shift+I', 'Ctrl+U',
      'Ctrl+S', 'Ctrl+P', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A'
    ];
    
    const key = e.key;
    const isCtrl = e.ctrlKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    
    // Block function keys
    if (key.startsWith('F')) {
      e.preventDefault();
      recordProctoringEvent('right_click', 'Function key pressed', 'medium');
      return;
    }
    
    // Block Ctrl combinations
    if (isCtrl && ['s', 'p', 'u', 'c', 'v', 'a', 'i'].includes(key.toLowerCase())) {
      e.preventDefault();
      recordProctoringEvent('copy_paste', 'Keyboard shortcut blocked', 'high');
      return;
    }
    
    // Block Alt+Tab
    if (isAlt && key === 'Tab') {
      e.preventDefault();
      recordProctoringEvent('tab_switch', 'Alt+Tab pressed', 'high');
      return;
    }
    
    // Block Ctrl+Shift+I (Developer Tools)
    if (isCtrl && isShift && key === 'I') {
      e.preventDefault();
      recordProctoringEvent('suspicious_activity', 'Developer tools attempt', 'critical');
      return;
    }
  }, []);
  
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    recordProctoringEvent('right_click', 'Right click detected', 'medium');
  }, []);
  
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && examStarted) {
      recordProctoringEvent('tab_switch', 'Window lost focus', 'high');
      addWarning('You switched tabs or minimized the window. This is not allowed during the exam.');
    }
  }, [examStarted]);
  
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
    
    if (!isCurrentlyFullscreen && examStarted) {
      recordProctoringEvent('full_screen_exit', 'Exited fullscreen mode', 'high');
      addWarning('You must remain in fullscreen mode during the exam.');
      requestFullscreen();
    }
  }, [examStarted]);
  
  useEffect(() => {
    if (examId) {
      initializeExam();
    }
    
    // Add event listeners for lockdown browser
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Prevent text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      
      // Restore text selection\n      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      
      // Clean up streams and intervals
      if (proctoring.cameraStream) {\n        proctoring.cameraStream.getTracks().forEach(track => track.stop());
      }
      if (proctoring.microphoneStream) {
        proctoring.microphoneStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (proctoringIntervalRef.current) clearInterval(proctoringIntervalRef.current);
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
  }, [examId, handleKeyDown, handleContextMenu, handleVisibilityChange, handleFullscreenChange]);
  
  const initializeExam = async () => {
    try {
      // Get exam details
      const examResponse = await api.get(`/exams/${examId}`);
      const examData = examResponse.data.data;
      setExam(examData);
      
      // Perform system check
      await performSystemCheck(examData);
      
      setLoading(false);
    } catch (error) {
      console.error('Error initializing exam:', error);
      toast.error('Failed to load exam');
      navigate('/student/exams');
    }
  };
  
  const performSystemCheck = async () => {
    const check = { ...systemCheck };
    
    try {
      // Check system requirements
      const response = await api.post('/proctoring/system-check', { examId });
      const requirements = response.data.data.requirements;
      
      // Check camera
      if (requirements.cameraRequired) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
          check.camera = true;
          cameraStream.getTracks().forEach(track => track.stop()); // Stop test stream
        } catch (error) {
          check.camera = false;
          toast.error('Camera access is required for this exam');
        }
      } else {
        check.camera = true;
      }
      
      // Check microphone
      if (requirements.microphoneRequired) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          check.microphone = true;
          micStream.getTracks().forEach(track => track.stop()); // Stop test stream
        } catch (error) {
          check.microphone = false;
          toast.error('Microphone access is required for this exam');
        }
      } else {
        check.microphone = true;
      }
      
      // Check browser compatibility
      check.browser = !!document.fullscreenEnabled;
      
      // Check if all requirements are met
      check.passed = check.camera && check.microphone && check.browser;
      
      setSystemCheck(check);
      setProctoring(prev => ({ ...prev, requirements }));
    } catch (error) {
      console.error('System check failed:', error);
      toast.error('System check failed');
    }
  };
  
  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      toast.error('Failed to enter fullscreen mode');
    }
  };
  
  const initializeProctoring = async () => {
    try {
      const systemInfo = {
        browser: {
          name: navigator.userAgent.split(' ')[0],
          version: navigator.appVersion
        },
        os: {
          name: navigator.platform
        },
        screenResolution: {
          width: screen.width,
          height: screen.height
        }
      };
      
      const response = await api.post('/proctoring/initialize', {
        examId,
        systemInfo
      });
      
      const requirements = response.data.data.requirements;
      
      // Start camera if required
      if (requirements.cameraRequired) {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
        }
        setProctoring(prev => ({ ...prev, cameraStream }));
      }
      
      // Start microphone monitoring if required
      if (requirements.microphoneRequired) {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setProctoring(prev => ({ ...prev, microphoneStream: micStream }));
      }
      
      setProctoring(prev => ({ ...prev, enabled: true, requirements }));
      
      // Start periodic monitoring
      proctoringIntervalRef.current = setInterval(() => {
        // Monitor for suspicious activity
        monitorSuspiciousActivity();
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      console.error('Failed to initialize proctoring:', error);
      toast.error('Failed to initialize exam monitoring');
    }
  };
  
  const monitorSuspiciousActivity = () => {
    // Check if multiple browser tabs are open
    if (document.hidden) {
      recordProctoringEvent('window_blur', 'Window not in focus', 'medium');
    }
    
    // Check if developer tools might be open (simple heuristic)
    const devtools = {
      open: false,
      orientation: null
    };
    
    const threshold = 160;
    const height = window.outerHeight - window.innerHeight;
    const width = window.outerWidth - window.innerWidth;
    
    if (height > threshold || width > threshold) {
      devtools.open = true;
      devtools.orientation = height > width ? 'vertical' : 'horizontal';
      recordProctoringEvent('suspicious_activity', 'Possible developer tools detected', 'critical');
    }
  };
  
  const recordProctoringEvent = async (eventType, description, severity = 'medium') => {
    try {
      await api.post('/proctoring/event', {
        examId,
        eventType,
        description,
        severity
      });
      
      console.log(`Proctoring event recorded: ${eventType} - ${description}`);
    } catch (error) {
      console.error('Failed to record proctoring event:', error);
    }
  };
  
  const addWarning = (message) => {
    const warning = {
      id: Date.now(),
      message,
      timestamp: new Date()
    };
    setWarnings(prev => [...prev, warning]);
    
    // Auto-remove warning after 5 seconds
    setTimeout(() => {
      setWarnings(prev => prev.filter(w => w.id !== warning.id));
    }, 5000);
  };
  
  const startExam = async () => {
    if (!systemCheck.passed) {
      toast.error('Please complete system requirements before starting');
      return;
    }
    
    try {
      // Request fullscreen
      await requestFullscreen();
      
      // Initialize proctoring
      await initializeProctoring();
      
      // Start exam attempt
      const response = await api.post('/exams/start', { examId });
      const attemptData = response.data.data;
      setExamAttempt(attemptData);
      setExamStarted(true);
      
      // Set timer
      const duration = exam.settings.duration * 60; // Convert to seconds
      setTimeRemaining(duration);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            submitExam(true); // Auto-submit when time runs out
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Auto-save answers every 30 seconds
      saveIntervalRef.current = setInterval(() => {
        saveAnswers();
      }, 30000);
      
    } catch (error) {
      console.error('Failed to start exam:', error);
      toast.error('Failed to start exam');
    }
  };
  
  const saveAnswers = async () => {
    try {
      await api.put(`/exams/attempts/${examAttempt._id}/save`, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          selectedOption: answer.selectedOption,
          textAnswer: answer.textAnswer
        }))
      });
    } catch (error) {
      console.error('Failed to save answers:', error);
    }
  };
  
  const submitExam = async (autoSubmit = false) => {
    try {
      if (!autoSubmit) {
        const confirmSubmit = window.confirm(
          'Are you sure you want to submit your exam? You cannot make changes after submission.'
        );
        if (!confirmSubmit) return;
      }
      
      // Save final answers
      await saveAnswers();
      
      // Submit exam
      await api.post(`/exams/attempts/${examAttempt._id}/submit`);
      
      // Clean up
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (proctoringIntervalRef.current) clearInterval(proctoringIntervalRef.current);
      
      // Stop proctoring streams
      if (proctoring.cameraStream) {
        proctoring.cameraStream.getTracks().forEach(track => track.stop());
      }
      if (proctoring.microphoneStream) {
        proctoring.microphoneStream.getTracks().forEach(track => track.stop());
      }
      
      toast.success('Exam submitted successfully');
      navigate('/student/results');
      
    } catch (error) {
      console.error('Failed to submit exam:', error);
      toast.error('Failed to submit exam');
    }
  };
  
  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  if (loading) {
    return (
      <div className="secure-exam-interface">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading secure exam environment...</p>
        </div>
      </div>
    );
  }
  
  if (!systemCheck.passed && !examStarted) {
    return (
      <div className="secure-exam-interface">
        <div className="system-check">
          <h2>System Requirements Check</h2>
          <p>Please ensure all requirements are met before starting the exam.</p>
          
          <div className="requirements-list">
            <div className={`requirement ${systemCheck.camera ? 'passed' : 'failed'}`}>
              <i className={`fas ${systemCheck.camera ? 'fa-check' : 'fa-times'}`}></i>
              <span>Camera Access</span>
            </div>
            <div className={`requirement ${systemCheck.microphone ? 'passed' : 'failed'}`}>
              <i className={`fas ${systemCheck.microphone ? 'fa-check' : 'fa-times'}`}></i>
              <span>Microphone Access</span>
            </div>
            <div className={`requirement ${systemCheck.browser ? 'passed' : 'failed'}`}>
              <i className={`fas ${systemCheck.browser ? 'fa-check' : 'fa-times'}`}></i>
              <span>Browser Compatibility</span>
            </div>
          </div>
          
          <div className="exam-info">
            <h3>{exam?.title}</h3>
            <p>Duration: {exam?.settings?.duration} minutes</p>
            <p>Questions: {exam?.questions?.length}</p>
            <p>Total Points: {exam?.settings?.totalPoints}</p>
          </div>
          
          <button 
            className="btn btn--primary btn--large"
            onClick={startExam}
            disabled={!systemCheck.passed}
          >
            {systemCheck.passed ? 'Start Exam' : 'Complete Requirements First'}
          </button>
        </div>
      </div>
    );
  }
  
  if (!examStarted) {
    return (
      <div className="secure-exam-interface">
        <div className="exam-instructions">
          <h2>Exam Instructions</h2>
          <div className="instructions-content">
            <h3>{exam?.title}</h3>
            <ul>
              <li>This exam is monitored. Any suspicious activity will be recorded.</li>
              <li>You must remain in fullscreen mode throughout the exam.</li>
              <li>Do not switch tabs, minimize the window, or open other applications.</li>
              <li>Your answers are automatically saved every 30 seconds.</li>
              <li>You have {exam?.settings?.duration} minutes to complete the exam.</li>
              {proctoring.requirements.cameraRequired && <li>Your camera will record during the exam.</li>}
              {proctoring.requirements.microphoneRequired && <li>Your microphone will monitor audio during the exam.</li>}
            </ul>
          </div>
          <button 
            className="btn btn--primary btn--large"
            onClick={startExam}
          >
            I Understand - Start Exam
          </button>
        </div>
      </div>
    );
  }
  
  const currentQuestionData = exam?.questions?.[currentQuestion];
  
  return (
    <div className="secure-exam-interface exam-active">
      {/* Warnings overlay */}
      {warnings.length > 0 && (
        <div className="warnings-overlay">
          {warnings.map(warning => (
            <div key={warning.id} className="warning-message">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Proctoring video */}
      {proctoring.enabled && proctoring.requirements.cameraRequired && (
        <div className="proctoring-video">
          <video 
            ref={videoRef}
            autoPlay
            muted
            className="camera-feed"
          />
        </div>
      )}
      
      {/* Exam header */}
      <header className="exam-header">
        <div className="exam-info">
          <h1>{exam?.title}</h1>
          <span>Question {currentQuestion + 1} of {exam?.questions?.length}</span>
        </div>
        
        <div className="exam-timer">
          <i className="fas fa-clock"></i>
          <span className={timeRemaining < 300 ? 'timer-warning' : ''}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </header>
      
      {/* Question content */}
      <div className="question-container">
        {currentQuestionData && (
          <>
            <div className="question-header">
              <h2>Question {currentQuestion + 1}</h2>
              <span className="points">({currentQuestionData.points} points)</span>
            </div>
            
            <div className="question-content">
              <p className="question-text">{currentQuestionData.questionText}</p>
              
              {currentQuestionData.questionType === 'multiple-choice' && (
                <div className="options-list">
                  {currentQuestionData.options?.map((option, index) => (
                    <label key={index} className="option-label">
                      <input
                        type="radio"
                        name={`question-${currentQuestionData._id}`}
                        value={option._id}
                        checked={answers[currentQuestionData._id]?.selectedOption === option._id}
                        onChange={(e) => handleAnswerChange(currentQuestionData._id, {
                          selectedOption: e.target.value
                        })}
                      />
                      <span className="option-text">{option.text}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {currentQuestionData.questionType === 'true-false' && (
                <div className="options-list">
                  <label className="option-label">
                    <input
                      type="radio"
                      name={`question-${currentQuestionData._id}`}
                      value="true"
                      checked={answers[currentQuestionData._id]?.textAnswer === 'true'}
                      onChange={(e) => handleAnswerChange(currentQuestionData._id, {
                        textAnswer: 'true'
                      })}
                    />
                    <span className="option-text">True</span>
                  </label>
                  <label className="option-label">
                    <input
                      type="radio"
                      name={`question-${currentQuestionData._id}`}
                      value="false"
                      checked={answers[currentQuestionData._id]?.textAnswer === 'false'}
                      onChange={(e) => handleAnswerChange(currentQuestionData._id, {
                        textAnswer: 'false'
                      })}
                    />
                    <span className="option-text">False</span>
                  </label>
                </div>
              )}
              
              {currentQuestionData.questionType === 'short-answer' && (
                <div className="text-answer">
                  <textarea
                    placeholder="Enter your answer here..."
                    value={answers[currentQuestionData._id]?.textAnswer || ''}
                    onChange={(e) => handleAnswerChange(currentQuestionData._id, {
                      textAnswer: e.target.value
                    })}
                    rows="4"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Navigation */}
      <div className="exam-navigation">
        <button
          className="btn btn--secondary"
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0 || !exam?.settings?.allowBackTracking}
        >
          <i className="fas fa-chevron-left"></i>
          Previous
        </button>
        
        <div className="question-indicators">
          {exam?.questions?.map((_, index) => (
            <button
              key={index}
              className={`question-indicator ${
                index === currentQuestion ? 'current' : 
                answers[exam.questions[index]._id] ? 'answered' : ''
              }`}
              onClick={() => setCurrentQuestion(index)}
              disabled={!exam?.settings?.allowBackTracking && index > currentQuestion}
            >
              {index + 1}
            </button>
          ))}
        </div>
        
        {currentQuestion < exam?.questions?.length - 1 ? (
          <button
            className="btn btn--primary"
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
          >
            Next
            <i className="fas fa-chevron-right"></i>
          </button>
        ) : (
          <button
            className="btn btn--success"
            onClick={() => submitExam()}
          >
            Submit Exam
            <i className="fas fa-check"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default SecureExamInterface;
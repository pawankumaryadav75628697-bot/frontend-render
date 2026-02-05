import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import codingExamProctoringService from '../../services/codingExamProctoringService';
import './StudentCodingExam.css';
import './ProctoringStyles.css';

const StudentCodingExam = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const editorRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const videoRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [question, setQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [testResults, setTestResults] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Proctoring states
  const [proctoringActive, setProctoringActive] = useState(false);
  const [proctoringInitialized, setProctoringInitialized] = useState(false);
  const [showProctoringSetup, setShowProctoringSetup] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState('checking');
  const [audioDetectionStatus, setAudioDetectionStatus] = useState('normal');
  const [violationWarnings, setViolationWarnings] = useState([]);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [currentViolation, setCurrentViolation] = useState(null);
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState(null);

  const [activeTab, setActiveTab] = useState('problem');
  const [testCaseTab, setTestCaseTab] = useState('visible');
  const [showConsole, setShowConsole] = useState(true);
  const [editorSettings, setEditorSettings] = useState({
    theme: 'vs-dark',
    fontSize: 14,
    wordWrap: 'on',
    minimap: false
  });

  useEffect(() => {
    if (attemptId && token) {
      fetchAttempt();
    }

    // Cleanup proctoring on unmount
    return () => {
      if (proctoringActive) {
        codingExamProctoringService.cleanup();
      }
    };
  }, [attemptId, token]);

  useEffect(() => {
    let timer;
    if (timeRemaining > 0 && attempt?.status === 'in_progress') {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeRemaining, attempt?.status]);

  useEffect(() => {
    // Auto-save code every 30 seconds
    if (attempt?.status === 'in_progress') {
      autoSaveIntervalRef.current = setInterval(() => {
        if (unsavedChanges) {
          handleSaveCode(false);
        }
      }, 30000);
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [unsavedChanges, attempt?.status]);

  const fetchAttempt = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/coding-exams/attempts/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch attempt');
      }

      const data = await response.json();
      const attemptData = data.data;

      setAttempt(attemptData);
      setExam(attemptData.codingExam);
      setQuestion(attemptData.codingExam.codingQuestion);
      setCode(attemptData.submittedCode || '');
      setLanguage(attemptData.programmingLanguage || 'python');

      // Calculate time remaining
      const now = new Date();
      const startTime = new Date(attemptData.startedAt);
      const timeLimit = attemptData.timeLimit * 60 * 1000; // Convert minutes to milliseconds
      const elapsed = now - startTime;
      const remaining = Math.max(0, Math.floor((timeLimit - elapsed) / 1000));
      setTimeRemaining(remaining);

      // Set default starter code if no code exists
      if (!attemptData.submittedCode && attemptData.codingExam.codingQuestion.starterCode) {
        const defaultCode = attemptData.codingExam.codingQuestion.starterCode[attemptData.programmingLanguage] || '';
        setCode(defaultCode);
      }

    } catch (error) {
      console.error('Error fetching attempt:', error);
      toast.error('Failed to load coding exam');
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCode = useCallback(async (showToast = true) => {
    if (!attempt || attempt.status !== 'in_progress') return;

    try {
      const response = await fetch(`/api/v1/coding-exams/attempts/${attempt._id}/code`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          programmingLanguage: language
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLastSaved(new Date(data.data.lastSaved));
        setUnsavedChanges(false);
        if (showToast) {
          toast.success('Code saved successfully');
        }
      }
    } catch (error) {
      console.error('Error saving code:', error);
      if (showToast) {
        toast.error('Failed to save code');
      }
    }
  }, [attempt, code, language, token]);

  const handleRunCode = async (useCustomInput = false) => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }

    try {
      setIsRunning(true);
      const requestBody = {
        code,
        programmingLanguage: language
      };

      if (useCustomInput) {
        requestBody.customInput = customInput;
      }

      const response = await fetch(`/api/v1/coding-exams/attempts/${attempt._id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        if (data.data.type === 'custom') {
          setCustomOutput(data.data.result.output || data.data.result.error || 'No output');
        } else {
          setTestResults(data.data);
        }

        if (!useCustomInput) {
          setActiveTab('results');
        }
      } else {
        toast.error(data.message || 'Failed to run code');
      }
    } catch (error) {
      console.error('Error running code:', error);
      toast.error('Failed to run code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Save code before submitting
      await handleSaveCode(false);

      const response = await fetch(`/api/v1/coding-exams/attempts/${attempt._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Coding exam submitted successfully!');
        navigate('/student/dashboard', {
          state: {
            submissionResult: data.data
          }
        });
      } else {
        throw new Error(data.message || 'Failed to submit exam');
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error(error.message || 'Failed to submit exam');
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (attempt?.status === 'in_progress') {
      toast.warning('Time is up! Auto-submitting your exam...');
      await handleSubmit();
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setUnsavedChanges(true);

    // Set starter code for new language
    if (question?.starterCode?.[newLanguage]) {
      const starterCode = question.starterCode[newLanguage];
      setCode(starterCode);
      if (editorRef.current) {
        editorRef.current.setValue(starterCode);
      }
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveCode(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode(false);
    });
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

  const getTimeColor = () => {
    if (timeRemaining <= 300) return '#ef4444'; // Red for last 5 minutes
    if (timeRemaining <= 900) return '#f59e0b'; // Orange for last 15 minutes
    return '#10b981'; // Green otherwise
  };

  /**
   * Initialize proctoring system
   */
  const initializeProctoring = async () => {
    try {
      const result = await codingExamProctoringService.initialize(attemptId, {
        onViolation: handleViolation,
        onWarning: handleWarning,
        onTermination: handleTermination,
        onFaceDetected: () => {
          console.log('✅ Face detected callback triggered');
          setFaceDetectionStatus('detected');
        },
        onNoFaceDetected: (count) => {
          console.warn(`⚠️ No face detected callback: ${count}/3`);
          if (count >= 2) {
            setFaceDetectionStatus('warning');
            toast.warning(`⚠️ Face not visible! ${3 - count} more failure(s) will trigger violation!`, {
              autoClose: 3000
            });
          } else {
            setFaceDetectionStatus('checking');
          }
        },
        onAudioDetected: (volume) => {
          setAudioDetectionStatus(volume > 0.5 ? 'warning' : 'detected');
          setTimeout(() => setAudioDetectionStatus('normal'), 2000);
        }
      });

      // Get camera stream for video preview
      const stream = codingExamProctoringService.videoStream;
      setCameraStream(stream);

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }

      setProctoringActive(true);
      setProctoringInitialized(true);
      setShowProctoringSetup(false);

      toast.success('Proctoring system activated');
      console.log('Proctoring initialized:', result);
    } catch (error) {
      console.error('Failed to initialize proctoring:', error);
      toast.error(error.message || 'Failed to initialize proctoring. Camera and microphone access required.');

      // Give user option to retry or exit
      if (confirm('Proctoring setup failed. Camera and microphone access are required. Retry?')) {
        initializeProctoring();
      } else {
        navigate('/student/dashboard');
      }
    }
  };

  /**
   * Handle violation callback
   */
  const handleViolation = async (violation) => {
    console.log('Violation recorded:', violation);

    // Send violation to backend
    try {
      await fetch(`/api/v1/coding-exams/attempts/${attemptId}/violations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(violation)
      });
    } catch (error) {
      console.error('Failed to report violation to backend:', error);
    }
  };

  /**
   * Handle warning callback
   */
  const handleWarning = (warningData) => {
    const { violation, remainingWarnings, totalViolations } = warningData;

    setCurrentViolation({
      ...violation,
      remainingWarnings,
      totalViolations
    });

    setViolationWarnings(prev => [...prev, violation]);
    setShowViolationAlert(true);

    // Auto-hide alert after 10 seconds
    setTimeout(() => {
      setShowViolationAlert(false);
    }, 10000);

    // Show toast notification
    toast.error(
      `⚠️ Warning ${totalViolations}/3: ${getViolationMessage(violation.type)}. ${remainingWarnings} warning(s) remaining!`,
      { autoClose: 8000 }
    );
  };

  /**
   * Handle termination callback
   */
  const handleTermination = async (terminationData) => {
    console.log('Exam terminated:', terminationData);

    setTerminationReason(terminationData);
    setShowTerminationModal(true);

    // Auto-submit exam
    try {
      await fetch(`/api/v1/coding-exams/attempts/${attemptId}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: terminationData.reason,
          violations: terminationData.violations,
          totalViolations: terminationData.totalViolations
        })
      });

      // Cleanup and redirect after 5 seconds
      setTimeout(() => {
        codingExamProctoringService.cleanup();
        navigate('/student/dashboard', {
          state: {
            examTerminated: true,
            reason: terminationData.reason
          }
        });
      }, 5000);
    } catch (error) {
      console.error('Failed to terminate exam:', error);
    }
  };

  /**
   * Get user-friendly violation message
   */
  const getViolationMessage = (type) => {
    const messages = {
      'tab_switch': 'Tab switching detected',
      'window_blur': 'Window focus lost',
      'fullscreen_exit': 'Exited fullscreen mode',
      'no_face_detected': 'Face not visible in camera',
      'suspicious_audio_detected': 'Suspicious audio detected',
      'blocked_key_attempt': 'Blocked keyboard shortcut used',
      'context_menu_attempt': 'Context menu access attempted',
      'navigation_attempt': 'Navigation attempt detected',
      'page_unload_attempt': 'Attempted to leave exam page',
      'copy_attempt': 'Unauthorized copy operation detected',
      'paste_attempt': 'Unauthorized paste operation detected',
      'cut_attempt': 'Unauthorized cut operation detected',
      'drag_attempt': 'Unauthorized drag operation detected',
      'drop_attempt': 'Unauthorized drop operation detected'
    };
    return messages[type] || 'Suspicious activity detected';
  };

  if (loading) {
    return (
      <div className="coding-exam-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <h2>Loading Coding Challenge...</h2>
          <p>Preparing your coding environment...</p>
        </div>
      </div>
    );
  }

  // Show proctoring setup screen
  if (!proctoringInitialized && showProctoringSetup && attempt) {
    return (
      <div className="coding-exam-container">
        <div className="proctoring-setup-screen">
          <div className="setup-content">
            <div className="setup-icon">🔒</div>
            <h1>Exam Proctoring Setup</h1>
            <p className="setup-description">
              This exam requires proctoring to ensure academic integrity.
              Please allow camera and microphone access to continue.
            </p>

            <div className="proctoring-requirements">
              <h3>Proctoring Features:</h3>
              <ul>
                <li>📹 <strong>Face Detection:</strong> Your face must be visible throughout the exam</li>
                <li>🎤 <strong>Audio Monitoring:</strong> Suspicious sounds will be detected</li>
                <li>🔒 <strong>Tab Lock:</strong> Switching tabs will be recorded</li>
                <li>🖥️ <strong>Browser Lock:</strong> Must remain in fullscreen mode</li>
                <li>📋 <strong>Copy-Paste Control:</strong> Large pastes (&gt;100 chars) are blocked</li>
                <li>🚫 <strong>Drag & Drop Blocked:</strong> Cannot drag/drop external content</li>
                <li>⚠️ <strong>3-Strike System:</strong> Exam will auto-terminate after 3 violations</li>
              </ul>
            </div>

            <div className="warning-box">
              <strong>⚠️ Important:</strong> Any violation of exam rules will be recorded.
              After 3 violations, your exam will be automatically terminated and submitted.
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={initializeProctoring}
            >
              🚀 Start Proctored Exam
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => navigate('/student/dashboard')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt || !exam || !question) {
    return (
      <div className="coding-exam-container">
        <div className="error-screen">
          <h2>Exam Not Found</h2>
          <p>The requested coding exam could not be loaded.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/student/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-exam-container proctored-exam">
      {/* Proctoring Status Bar */}
      {proctoringActive && (
        <div className="proctoring-status-bar">
          <div className="status-indicators">
            <div className={`status-item ${faceDetectionStatus}`}>
              <span className="status-icon">📹</span>
              <span className="status-label">
                Face: {faceDetectionStatus === 'detected' ? '✓ Detected' : faceDetectionStatus === 'warning' ? '⚠️ WARNING' : '🔍 Checking...'}
              </span>
            </div>

            <div className={`status-item ${audioDetectionStatus}`}>
              <span className="status-icon">🎤</span>
              <span className="status-label">
                Audio: {audioDetectionStatus === 'normal' ? '✓' : audioDetectionStatus === 'warning' ? '⚠️' : '🔊'}
              </span>
            </div>

            <div className="status-item">
              <span className="status-icon">⚠️</span>
              <span className="status-label">
                Warnings: {violationWarnings.length}/3
              </span>
            </div>
          </div>

          <div className="camera-preview">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="preview-video"
            />
            <span className="preview-label">Camera Feed</span>
          </div>
        </div>
      )}

      {/* Violation Alert */}
      {showViolationAlert && currentViolation && (
        <div className="violation-alert-banner">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <strong>Warning {currentViolation.totalViolations}/3:</strong>
              {' '}{getViolationMessage(currentViolation.type)}
              <br />
              <small>{currentViolation.remainingWarnings} warning(s) remaining before exam termination</small>
            </div>
            <button
              className="alert-close"
              onClick={() => setShowViolationAlert(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="exam-header">
        <div className="exam-info">
          <h1>{exam.title}</h1>
          <div className="exam-meta">
            <span className="course">{exam.course}</span>
            <span className="difficulty-badge" data-difficulty={question.difficulty}>
              {question.difficulty?.toUpperCase()}
            </span>
            <span className="points">{exam.settings.totalPoints} points</span>
          </div>
        </div>

        <div className="exam-controls">
          <div className="time-display" style={{ color: getTimeColor() }}>
            <span className="time-icon">⏱️</span>
            <span className="time-text">{formatTime(timeRemaining)}</span>
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-secondary"
              onClick={() => handleSaveCode(true)}
              disabled={!unsavedChanges}
            >
              💾 Save
            </button>

            <button
              className="btn btn-primary"
              onClick={() => handleRunCode(false)}
              disabled={isRunning}
            >
              {isRunning ? '🔄 Running...' : '▶️ Run Tests'}
            </button>

            <button
              className="btn btn-success"
              onClick={() => setShowSubmitModal(true)}
              disabled={isSubmitting}
            >
              📤 Submit
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="exam-content">
        {/* Left Panel - Problem Description */}
        <div className="problem-panel">
          <div className="panel-tabs">
            <button
              className={`tab-button ${activeTab === 'problem' ? 'active' : ''}`}
              onClick={() => setActiveTab('problem')}
            >
              📋 Problem
            </button>
            <button
              className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              🧪 Test Results
            </button>
            <button
              className={`tab-button ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
            >
              💻 Console
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'problem' && (
              <div className="problem-content">
                <h2>{question.title}</h2>
                <div className="problem-description">
                  <p>{question.description}</p>
                </div>

                {question.constraints && (
                  <div className="constraints-section">
                    <h3>Constraints</h3>
                    <ul>
                      <li>Time Limit: {question.constraints.timeLimit}ms</li>
                      <li>Memory Limit: {question.constraints.memoryLimit}MB</li>
                      {question.constraints.inputFormat && (
                        <li>Input Format: {question.constraints.inputFormat}</li>
                      )}
                      {question.constraints.outputFormat && (
                        <li>Output Format: {question.constraints.outputFormat}</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="sample-cases">
                  <h3>Sample Test Cases</h3>
                  {question.testCases
                    .filter(tc => !tc.isHidden)
                    .map((testCase, index) => (
                      <div key={index} className="sample-case">
                        <h4>Sample Input {index + 1}:</h4>
                        <pre className="sample-input">{testCase.input}</pre>
                        <h4>Expected Output:</h4>
                        <pre className="sample-output">{testCase.expectedOutput}</pre>
                        {testCase.description && (
                          <>
                            <h4>Explanation:</h4>
                            <p>{testCase.description}</p>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="results-content">
                <h3>Test Results</h3>
                {testResults ? (
                  <div className="test-results">
                    <div className="results-summary">
                      <div className="summary-stat">
                        <span className="stat-label">Passed:</span>
                        <span className="stat-value success">{testResults.summary.passedTests}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Failed:</span>
                        <span className="stat-value error">{testResults.summary.failedTests}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Total:</span>
                        <span className="stat-value">{testResults.summary.totalTests}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Pass Rate:</span>
                        <span className="stat-value">{testResults.summary.passRate}%</span>
                      </div>
                    </div>

                    <div className="test-cases-results">
                      {testResults.results.map((result, index) => (
                        <div key={index} className={`test-case-result ${result.passed ? 'passed' : 'failed'}`}>
                          <div className="test-case-header">
                            <span>Test Case {index + 1}</span>
                            <span className={`result-badge ${result.passed ? 'passed' : 'failed'}`}>
                              {result.passed ? '✅ PASSED' : '❌ FAILED'}
                            </span>
                          </div>

                          {!result.passed && (
                            <div className="test-case-details">
                              <div className="detail-item">
                                <strong>Input:</strong>
                                <pre>{result.input}</pre>
                              </div>
                              <div className="detail-item">
                                <strong>Expected:</strong>
                                <pre>{result.expectedOutput}</pre>
                              </div>
                              <div className="detail-item">
                                <strong>Your Output:</strong>
                                <pre>{result.actualOutput}</pre>
                              </div>
                              {result.error && (
                                <div className="detail-item error">
                                  <strong>Error:</strong>
                                  <pre>{result.error}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="no-results">
                    <p>Run your code to see test results here.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'console' && (
              <div className="console-content">
                <h3>Custom Input & Output</h3>
                <div className="console-section">
                  <div className="input-section">
                    <label htmlFor="custom-input">Custom Input:</label>
                    <textarea
                      id="custom-input"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Enter your test input here..."
                      rows={4}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleRunCode(true)}
                      disabled={isRunning}
                    >
                      {isRunning ? '🔄 Running...' : '▶️ Run with Custom Input'}
                    </button>
                  </div>

                  <div className="output-section">
                    <label>Output:</label>
                    <pre className="console-output">{customOutput || 'No output yet...'}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="editor-panel">
          <div className="editor-toolbar">
            <div className="language-selector">
              <label>Language:</label>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                {exam.settings.allowedLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="editor-settings">
              <select
                value={editorSettings.theme}
                onChange={(e) => setEditorSettings(prev => ({ ...prev, theme: e.target.value }))}
              >
                <option value="vs-dark">Dark Theme</option>
                <option value="light">Light Theme</option>
                <option value="hc-black">High Contrast</option>
              </select>

              <select
                value={editorSettings.fontSize}
                onChange={(e) => setEditorSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              >
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
              </select>
            </div>

            <div className="save-status">
              {unsavedChanges ? (
                <span className="unsaved">● Unsaved changes</span>
              ) : lastSaved ? (
                <span className="saved">✓ Saved {formatTime(Math.floor((new Date() - lastSaved) / 1000))} ago</span>
              ) : (
                <span className="no-changes">No changes</span>
              )}
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              value={code}
              onChange={(value) => {
                setCode(value || '');
                setUnsavedChanges(true);
              }}
              onMount={handleEditorDidMount}
              theme={editorSettings.theme}
              options={{
                fontSize: editorSettings.fontSize,
                wordWrap: editorSettings.wordWrap,
                minimap: { enabled: editorSettings.minimap },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 20,
                lineNumbersMinChars: 3,
                renderWhitespace: 'selection',
                contextmenu: true,
                mouseWheelZoom: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                wordBasedSuggestions: true,
                parameterHints: { enabled: true },
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoSurround: 'languageDefined',
                colorDecorators: true,
                dragAndDrop: true,
                links: true,
                matchBrackets: 'always',
                multiCursorModifier: 'ctrlCmd',
                overviewRulerBorder: false,
                renderControlCharacters: false,
                renderIndentGuides: true,
                renderLineHighlight: 'all',
                selectOnLineNumbers: true,
                selectionHighlight: true,
                smoothScrolling: true,
                suggestSelection: 'first',
                wordWrap: 'on',
                wrappingIndent: 'indent'
              }}
            />
          </div>

          <div className="editor-shortcuts">
            <span>Shortcuts: Ctrl+S (Save), Ctrl+Enter (Run Tests)</span>
          </div>
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Submit Coding Exam</h2>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to submit your solution?</p>
              <p>Once submitted, you cannot make any further changes.</p>
              {unsavedChanges && (
                <div className="warning-message">
                  ⚠️ You have unsaved changes. They will be saved before submission.
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Solution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Termination Modal */}
      {showTerminationModal && terminationReason && (
        <div className="modal-overlay termination-modal">
          <div className="modal-container termination-container">
            <div className="modal-header termination-header">
              <span className="termination-icon">🚫</span>
              <h2>Exam Terminated</h2>
            </div>
            <div className="modal-content">
              <p className="termination-message">
                Your exam has been automatically terminated due to multiple violations.
              </p>

              <div className="termination-details">
                <h3>Reason:</h3>
                <p>{terminationReason.reason}</p>

                <h3>Total Violations: {terminationReason.totalViolations}</h3>

                <div className="violations-list">
                  {terminationReason.violations.slice(-3).map((v, idx) => (
                    <div key={idx} className="violation-item">
                      <span className="violation-number">{idx + 1}.</span>
                      <span className="violation-type">{getViolationMessage(v.type)}</span>
                      <span className="violation-time">
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="termination-notice">
                <p>Your current progress has been saved and submitted.</p>
                <p>You will be redirected to the dashboard shortly...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCodingExam;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import BrowserLock from './BrowserLock';
import FaceDetection from './FaceDetection';
import AudioMonitoring from './AudioMonitoring';
import './ProctoringSuite.css';

const ProctoringSuite = ({ 
  isActive = true,
  onExamTerminated,
  onViolationReport,
  examId,
  studentId,
  studentName = '',
  securityLevel = 'strict',
  maxWarnings = 3,
  autoTerminateOnMaxWarnings = true,
  examDuration = 120, // minutes
  enableScreenRecording = false
}) => {
  // State Management
  const [violations, setViolations] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [systemStatus, setSystemStatus] = useState({
    browserLock: 'initializing',
    faceDetection: 'initializing',
    audioMonitoring: 'initializing'
  });
  const [examStartTime] = useState(new Date());
  const [lastActivityTime, setLastActivityTime] = useState(new Date());
  const [suspiciousActivityScore, setSuspiciousActivityScore] = useState(0);

  // Refs
  const violationLogRef = useRef([]);
  const alertTimeoutRef = useRef(null);
  const screenshotIntervalRef = useRef(null);
  const activityTimeoutRef = useRef(null);

  // Violation Types and Severity
  const violationSeverity = {
    // Critical violations (immediate warning)
    'tab-switch': 3,
    'multiple-faces': 3,
    'no-face-detected': 2,
    'suspicious-audio': 2,
    'developer-tools': 3,
    'right-click': 1,
    
    // Medium violations
    'face-turned-away': 2,
    'multiple-voices': 2,
    'window-blur': 2,
    'copy-paste-attempt': 2,
    
    // Low violations
    'suspicious-movement': 1,
    'background-noise': 1,
    'keyboard-shortcut': 1
  };

  // Initialize monitoring
  useEffect(() => {
    if (isActive && !isExamTerminated) {
      initializeMonitoring();
      startPeriodicScreenshots();
      setupActivityMonitoring();
    }

    return () => {
      cleanup();
    };
  }, [isActive, isExamTerminated]);

  const initializeMonitoring = () => {
    console.log('🔒 Proctoring Suite Initialized', {
      examId,
      studentId,
      studentName,
      startTime: examStartTime,
      securityLevel
    });

    // Log exam start
    logViolation({
      type: 'exam-started',
      severity: 0,
      message: 'Exam monitoring initiated',
      timestamp: new Date(),
      systemInfo: getSystemInfo()
    });
  };

  const cleanup = () => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
  };

  const getSystemInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown'
    };
  };

  const logViolation = (violation) => {
    const violationWithId = {
      ...violation,
      id: Date.now() + Math.random(),
      examId,
      studentId,
      studentName,
      examDuration: Math.floor((new Date() - examStartTime) / 60000), // minutes elapsed
      suspiciousScore: suspiciousActivityScore
    };

    violationLogRef.current.push(violationWithId);
    setViolations(prev => [...prev, violationWithId]);

    // Report to parent component
    if (onViolationReport) {
      onViolationReport(violationWithId);
    }

    console.warn('🚨 VIOLATION LOGGED:', violationWithId);
  };

  const handleViolation = useCallback((violation) => {
    if (isExamTerminated) return;

    const severity = violationSeverity[violation.type] || 1;
    const enhancedViolation = {
      ...violation,
      severity,
      timestamp: new Date(),
      screenshot: null, // Will be populated if screenshot is taken
      systemState: {
        ...systemStatus,
        suspiciousScore: suspiciousActivityScore
      }
    };

    // Update suspicious activity score
    setSuspiciousActivityScore(prev => prev + severity);

    // Log violation
    logViolation(enhancedViolation);

    // Handle critical violations immediately (camera/mic issues)
    const criticalViolations = [
      'camera_access_denied', 
      'microphone_access_denied',
      'camera_covered',
      'microphone_covered',
      'no_face_detected',
      'multiple_faces'
    ];

    if (criticalViolations.includes(violation.type)) {
      // For critical violations, show persistent alert and potentially lock session
      showCriticalAlert(enhancedViolation);
      
      // Auto-terminate for multiple critical violations or specific types
      if (violation.type === 'camera_access_denied' || 
          violation.type === 'microphone_access_denied' ||
          (criticalViolations.includes(violation.type) && warningCount >= 2)) {
        terminateExam(`Critical violation: ${violation.type.replace('_', ' ')}`);
        return;
      }
    }

    // Determine if this should trigger a warning
    if (severity >= 2) {
      const newWarningCount = warningCount + 1;
      setWarningCount(newWarningCount);

      // Show alert
      showAlert(enhancedViolation, newWarningCount);

      // Take screenshot for serious violations
      if (severity >= 3) {
        takeScreenshot().then(screenshot => {
          enhancedViolation.screenshot = screenshot;
          logViolation({ ...enhancedViolation, screenshot });
        });
      }

      // Check if exam should be terminated
      if (newWarningCount >= maxWarnings && autoTerminateOnMaxWarnings) {
        terminateExam('Maximum warnings exceeded');
      }
    }

    // Update last activity time
    setLastActivityTime(new Date());
  }, [warningCount, isExamTerminated, suspiciousActivityScore, systemStatus]);

  const showAlert = (violation, currentWarnings) => {
    const alertData = {
      violation,
      currentWarnings,
      maxWarnings,
      remainingWarnings: maxWarnings - currentWarnings,
      isLastWarning: currentWarnings === maxWarnings - 1,
      willTerminate: currentWarnings >= maxWarnings && autoTerminateOnMaxWarnings
    };

    setCurrentAlert(alertData);

    // Auto-dismiss alert after 10 seconds unless it's a termination warning
    if (!alertData.willTerminate) {
      alertTimeoutRef.current = setTimeout(() => {
        setCurrentAlert(null);
      }, 10000);
    }
  };

  const showCriticalAlert = (violation) => {
    const criticalAlertData = {
      violation,
      currentWarnings: warningCount,
      maxWarnings,
      remainingWarnings: 0, // No remaining warnings for critical violations
      isLastWarning: true,
      willTerminate: true,
      isCritical: true
    };

    setCurrentAlert(criticalAlertData);

    // Critical alerts don't auto-dismiss
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }

    // Log critical violation to backend for immediate instructor notification
    if (examId && studentId) {
      fetch('/api/v1/proctoring/critical-violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          examId,
          studentId,
          violation: violation,
          timestamp: new Date().toISOString(),
          severity: 'critical',
          sessionLocked: true
        })
      }).catch(error => {
        console.error('Failed to report critical violation:', error);
      });
    }
  };

  const dismissAlert = () => {
    setCurrentAlert(null);
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
  };

  const terminateExam = (reason) => {
    setIsExamTerminated(true);
    
    const terminationData = {
      reason,
      timestamp: new Date(),
      totalViolations: violations.length,
      warningCount,
      examDuration: Math.floor((new Date() - examStartTime) / 60000),
      suspiciousActivityScore,
      finalSystemState: systemStatus,
      violationLog: violationLogRef.current
    };

    logViolation({
      type: 'exam-terminated',
      severity: 5,
      message: `Exam terminated: ${reason}`,
      timestamp: new Date(),
      terminationData
    });

    if (onExamTerminated) {
      onExamTerminated(terminationData);
    }

    console.error('❌ EXAM TERMINATED:', terminationData);
  };

  const takeScreenshot = async () => {
    try {
      if (enableScreenRecording && 'getDisplayMedia' in navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' }
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        return new Promise((resolve) => {
          video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            stream.getTracks().forEach(track => track.stop());
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
        });
      }
    } catch (error) {
      console.warn('Screenshot failed:', error);
      return null;
    }
  };

  const startPeriodicScreenshots = () => {
    if (enableScreenRecording && securityLevel === 'strict') {
      screenshotIntervalRef.current = setInterval(() => {
        if (!isExamTerminated) {
          takeScreenshot().then(screenshot => {
            if (screenshot) {
              logViolation({
                type: 'periodic-screenshot',
                severity: 0,
                message: 'Periodic monitoring screenshot',
                timestamp: new Date(),
                screenshot
              });
            }
          });
        }
      }, 30000); // Every 30 seconds
    }
  };

  const setupActivityMonitoring = () => {
    const resetActivityTimer = () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      activityTimeoutRef.current = setTimeout(() => {
        handleViolation({
          type: 'suspicious-inactivity',
          message: 'Prolonged inactivity detected',
          details: 'No user activity detected for extended period'
        });
      }, 300000); // 5 minutes
    };

    // Monitor various activity indicators
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivityTimer, { passive: true });
    });

    resetActivityTimer();
  };

  const handleSystemStatusChange = (system, status) => {
    setSystemStatus(prev => ({
      ...prev,
      [system]: status
    }));
  };

  const getOverallSystemStatus = () => {
    const statuses = Object.values(systemStatus);
    if (statuses.some(status => status === 'error')) return 'error';
    if (statuses.some(status => status === 'warning')) return 'warning';
    if (statuses.every(status => status === 'active')) return 'active';
    return 'initializing';
  };

  const getViolationSummary = () => {
    const summary = {};
    violations.forEach(violation => {
      summary[violation.type] = (summary[violation.type] || 0) + 1;
    });
    return summary;
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={`proctoring-suite ${isExamTerminated ? 'exam-terminated' : ''}`}>
      {/* Alert Modal */}
      {currentAlert && (
        <div className="proctoring-alert-overlay">
          <div className={`proctoring-alert ${currentAlert.willTerminate ? 'termination-alert' : ''}`}>
            <div className="alert-header">
              <div className="alert-icon">
                {currentAlert.willTerminate ? '🚫' : '⚠️'}
              </div>
              <h2>
                {currentAlert.willTerminate 
                  ? 'EXAM TERMINATED' 
                  : `WARNING ${currentAlert.currentWarnings}/${currentAlert.maxWarnings}`
                }
              </h2>
            </div>
            
            <div className="alert-content">
              <div className="violation-details">
                <h3>Violation Detected:</h3>
                <p className="violation-type">{currentAlert.violation.type.replace('-', ' ').toUpperCase()}</p>
                <p className="violation-message">{currentAlert.violation.message}</p>
                {currentAlert.violation.details && (
                  <p className="violation-additional">{currentAlert.violation.details}</p>
                )}
              </div>

              {!currentAlert.willTerminate && (
                <div className="warning-progress">
                  <div className="warning-bar">
                    <div 
                      className="warning-fill" 
                      style={{ width: `${(currentAlert.currentWarnings / currentAlert.maxWarnings) * 100}%` }}
                    ></div>
                  </div>
                  <p className="warning-text">
                    {currentAlert.remainingWarnings > 0 
                      ? `${currentAlert.remainingWarnings} warning${currentAlert.remainingWarnings > 1 ? 's' : ''} remaining`
                      : 'Final warning - next violation will terminate exam'
                    }
                  </p>
                </div>
              )}
            </div>

            <div className="alert-actions">
              {currentAlert.willTerminate ? (
                <div className="termination-message">
                  <p>This exam session has been terminated due to multiple violations.</p>
                  <p>Please contact your instructor or exam administrator.</p>
                </div>
              ) : (
                <div className="warning-actions">
                  <button 
                    className="acknowledge-btn"
                    onClick={dismissAlert}
                  >
                    I UNDERSTAND - CONTINUE EXAM
                  </button>
                  {currentAlert.isLastWarning && (
                    <p className="final-warning-text">
                      ⚠️ This is your final warning. Any further violations will result in exam termination.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Status Panel */}
      <div className={`system-status-panel status-${getOverallSystemStatus()}`}>
        <div className="status-header">
          <div className="status-indicator">
            <div className={`status-dot ${getOverallSystemStatus()}`}></div>
            <span className="status-text">
              {getOverallSystemStatus().toUpperCase()}
            </span>
          </div>
          <div className="warning-counter">
            <span className="warning-count">{warningCount}</span>
            <span className="warning-label">/{maxWarnings} WARNINGS</span>
          </div>
        </div>

        <div className="monitoring-systems">
          <div className={`system-item ${systemStatus.browserLock}`}>
            <span className="system-icon">🔒</span>
            <span className="system-name">Browser Lock</span>
            <div className={`system-status-dot ${systemStatus.browserLock}`}></div>
          </div>
          <div className={`system-item ${systemStatus.faceDetection}`}>
            <span className="system-icon">👁️</span>
            <span className="system-name">Face Detection</span>
            <div className={`system-status-dot ${systemStatus.faceDetection}`}></div>
          </div>
          <div className={`system-item ${systemStatus.audioMonitoring}`}>
            <span className="system-icon">🎤</span>
            <span className="system-name">Audio Monitor</span>
            <div className={`system-status-dot ${systemStatus.audioMonitoring}`}></div>
          </div>
        </div>

        <div className="exam-info">
          <div className="exam-detail">
            <span className="detail-label">Student:</span>
            <span className="detail-value">{studentName || studentId}</span>
          </div>
          <div className="exam-detail">
            <span className="detail-label">Exam ID:</span>
            <span className="detail-value">{examId}</span>
          </div>
          <div className="exam-detail">
            <span className="detail-label">Violations:</span>
            <span className="detail-value">{violations.length}</span>
          </div>
        </div>
      </div>

      {/* Integrated Monitoring Components */}
      <BrowserLock
        isActive={isActive && !isExamTerminated}
        onViolation={handleViolation}
        onStatusChange={(status) => handleSystemStatusChange('browserLock', status)}
        examId={examId}
        studentId={studentId}
        securityLevel={securityLevel}
        enableVirtualMachineDetection={true}
        enablePrintScreenBlocking={true}
        enableCopyPasteBlocking={true}
      />

      <FaceDetection
        isActive={isActive && !isExamTerminated}
        onViolation={handleViolation}
        onStatusChange={(status) => handleSystemStatusChange('faceDetection', status)}
        examId={examId}
        studentId={studentId}
        securityLevel={securityLevel}
        maxFaces={1}
        gazeTrackingEnabled={true}
        headPoseTrackingEnabled={true}
      />

      <AudioMonitoring
        isActive={isActive && !isExamTerminated}
        onViolation={handleViolation}
        onStatusChange={(status) => handleSystemStatusChange('audioMonitoring', status)}
        examId={examId}
        studentId={studentId}
        securityLevel={securityLevel}
        voiceDetectionEnabled={true}
        backgroundNoiseDetection={true}
        suspiciousSoundDetection={true}
      />

      {/* Exam Terminated Overlay */}
      {isExamTerminated && (
        <div className="exam-terminated-overlay">
          <div className="terminated-content">
            <div className="terminated-icon">🚫</div>
            <h2>EXAM SESSION TERMINATED</h2>
            <p>This exam has been automatically terminated due to policy violations.</p>
            <div className="violation-summary">
              <h3>Violation Summary:</h3>
              <ul>
                {Object.entries(getViolationSummary()).map(([type, count]) => (
                  <li key={type}>
                    {type.replace('-', ' ')}: {count} occurrence{count > 1 ? 's' : ''}
                  </li>
                ))}
              </ul>
            </div>
            <p className="contact-info">
              Please contact your instructor or exam administrator for further assistance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctoringSuite;
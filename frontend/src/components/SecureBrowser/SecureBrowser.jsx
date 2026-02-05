import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import './SecureBrowser.css';

const SecureBrowser = ({ children, examId, onSecurityViolation, isEnabled = true }) => {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState([]);
  const [lockdownActive, setLockdownActive] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    fullscreen: false,
    devToolsBlocked: true,
    tabSwitchBlocked: true,
    rightClickBlocked: true,
    copyPasteBlocked: true,
    keyboardShortcutsBlocked: true
  });

  useEffect(() => {
    if (!isEnabled) return;

    initializeLockdown();
    return () => {
      cleanupLockdown();
    };
  }, [isEnabled]);

  const initializeLockdown = async () => {
    try {
      // Enter fullscreen mode
      await enterFullscreen();
      
      // Set up event listeners
      setupSecurityListeners();
      
      // Disable right-click context menu
      disableContextMenu();
      
      // Block keyboard shortcuts
      blockKeyboardShortcuts();
      
      // Monitor window focus
      monitorWindowFocus();
      
      // Detect developer tools
      detectDevTools();
      
      // Block copy/paste operations
      blockCopyPaste();
      
      setLockdownActive(true);
      toast.success('Secure browser mode activated');
      
      // Update security status
      setSecurityStatus({
        fullscreen: true,
        devToolsBlocked: true,
        tabSwitchBlocked: true,
        rightClickBlocked: true,
        copyPasteBlocked: true,
        keyboardShortcutsBlocked: true
      });
      
    } catch (error) {
      console.error('Failed to initialize lockdown:', error);
      toast.error('Failed to activate secure browser mode');
      recordViolation('initialization_failed', 'Failed to initialize secure browser', 'high');
    }
  };

  const enterFullscreen = async () => {
    try {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (containerRef.current && containerRef.current.webkitRequestFullscreen) {
        await containerRef.current.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (containerRef.current && containerRef.current.mozRequestFullScreen) {
        await containerRef.current.mozRequestFullScreen();
        setIsFullscreen(true);
      } else {
        throw new Error('Fullscreen not supported');
      }
    } catch (error) {
      recordViolation('fullscreen_failed', 'Failed to enter fullscreen mode', 'critical');
      throw error;
    }
  };

  const setupSecurityListeners = () => {
    // Monitor fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    // Monitor visibility changes (tab switching)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Monitor window blur/focus
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    // Monitor beforeunload (prevent closing)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Monitor key events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Monitor mouse events
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Monitor copy/cut/paste events
    document.addEventListener('copy', handleCopyEvent);
    document.addEventListener('cut', handleCutEvent);
    document.addEventListener('paste', handlePasteEvent);
  };

  const handleFullscreenChange = () => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    );
    
    setIsFullscreen(isCurrentlyFullscreen);
    
    if (!isCurrentlyFullscreen && lockdownActive) {
      recordViolation('fullscreen_exit', 'Student exited fullscreen mode', 'high');
      // Try to re-enter fullscreen
      setTimeout(() => {
        if (lockdownActive) {
          enterFullscreen().catch(() => {
            toast.error('Please return to fullscreen mode to continue the exam');
          });
        }
      }, 1000);
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && lockdownActive) {
      recordViolation('tab_switch', 'Student switched to another tab/window', 'high');
    }
  };

  const handleWindowBlur = () => {
    if (lockdownActive) {
      recordViolation('window_blur', 'Exam window lost focus', 'medium');
    }
  };

  const handleWindowFocus = () => {
    // Log when window regains focus
    if (lockdownActive) {
      console.log('Exam window regained focus');
    }
  };

  const handleBeforeUnload = (e) => {
    if (lockdownActive) {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the exam? This will be recorded as a violation.';
      recordViolation('attempted_exit', 'Student attempted to leave exam', 'critical');
      return e.returnValue;
    }
  };

  const handleKeyDown = (e) => {
    if (!lockdownActive) return;

    // Block dangerous key combinations
    const blockedCombinations = [
      { key: 'F12' }, // Developer tools
      { key: 'F5' }, // Refresh
      { ctrlKey: true, key: 'r' }, // Refresh
      { ctrlKey: true, key: 'R' }, // Refresh
      { ctrlKey: true, shiftKey: true, key: 'I' }, // Developer tools
      { ctrlKey: true, shiftKey: true, key: 'i' }, // Developer tools
      { ctrlKey: true, shiftKey: true, key: 'C' }, // Developer tools
      { ctrlKey: true, shiftKey: true, key: 'c' }, // Developer tools
      { ctrlKey: true, shiftKey: true, key: 'J' }, // Console
      { ctrlKey: true, shiftKey: true, key: 'j' }, // Console
      { ctrlKey: true, key: 'U' }, // View source
      { ctrlKey: true, key: 'u' }, // View source
      { ctrlKey: true, key: 'S' }, // Save page
      { ctrlKey: true, key: 's' }, // Save page
      { ctrlKey: true, key: 'A' }, // Select all (in some contexts)
      { ctrlKey: true, key: 'a' }, // Select all (in some contexts)
      { ctrlKey: true, key: 'C' }, // Copy
      { ctrlKey: true, key: 'c' }, // Copy
      { ctrlKey: true, key: 'V' }, // Paste
      { ctrlKey: true, key: 'v' }, // Paste
      { ctrlKey: true, key: 'X' }, // Cut
      { ctrlKey: true, key: 'x' }, // Cut
      { ctrlKey: true, key: 'Z' }, // Undo
      { ctrlKey: true, key: 'z' }, // Undo
      { ctrlKey: true, key: 'Y' }, // Redo
      { ctrlKey: true, key: 'y' }, // Redo
      { altKey: true, key: 'Tab' }, // Alt+Tab
      { altKey: true, key: 'F4' }, // Alt+F4
      { key: 'PrintScreen' }, // Print screen
      { key: 'Insert' }, // Insert key
    ];

    const isBlocked = blockedCombinations.some(combo => {
      return Object.keys(combo).every(key => {
        if (key === 'key') return e.key === combo[key];
        return e[key] === combo[key];
      });
    });

    if (isBlocked) {
      e.preventDefault();
      e.stopPropagation();
      recordViolation('blocked_shortcut', `Blocked keyboard shortcut: ${e.key}`, 'medium');
      return false;
    }
  };

  const handleKeyUp = (e) => {
    // Additional monitoring on key release if needed
  };

  const handleContextMenu = (e) => {
    if (lockdownActive) {
      e.preventDefault();
      e.stopPropagation();
      recordViolation('right_click', 'Student attempted right-click', 'low');
      return false;
    }
  };

  const handleCopyEvent = (e) => {
    if (lockdownActive) {
      e.preventDefault();
      recordViolation('copy_attempt', 'Student attempted to copy content', 'medium');
      return false;
    }
  };

  const handleCutEvent = (e) => {
    if (lockdownActive) {
      e.preventDefault();
      recordViolation('cut_attempt', 'Student attempted to cut content', 'medium');
      return false;
    }
  };

  const handlePasteEvent = (e) => {
    if (lockdownActive) {
      e.preventDefault();
      recordViolation('paste_attempt', 'Student attempted to paste content', 'medium');
      return false;
    }
  };

  const disableContextMenu = () => {
    document.addEventListener('contextmenu', handleContextMenu);
  };

  const blockKeyboardShortcuts = () => {
    document.addEventListener('keydown', handleKeyDown);
  };

  const monitorWindowFocus = () => {
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
  };

  const detectDevTools = () => {
    // Multiple methods to detect developer tools
    let devtools = false;

    // Method 1: Console detection
    const detectConsole = () => {
      const threshold = 160;
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools) {
          devtools = true;
          recordViolation('dev_tools_detected', 'Developer tools detected', 'critical');
        }
      }
    };

    // Method 2: Debugger detection
    const detectDebugger = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start > 100) {
        if (!devtools) {
          devtools = true;
          recordViolation('debugger_detected', 'Debugger detected', 'critical');
        }
      }
    };

    // Method 3: Console log detection
    const detectConsoleLog = () => {
      const originalLog = console.log;
      console.log = function(...args) {
        recordViolation('console_usage', 'Console usage detected', 'high');
        return originalLog.apply(console, args);
      };
    };

    // Run detection methods periodically
    setInterval(() => {
      detectConsole();
      detectDebugger();
    }, 1000);

    detectConsoleLog();
  };

  const blockCopyPaste = () => {
    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';

    // Block drag and drop
    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      recordViolation('drag_attempt', 'Student attempted to drag content', 'low');
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      recordViolation('drop_attempt', 'Student attempted to drop content', 'low');
    });
  };

  const recordViolation = async (type, description, severity = 'medium') => {
    const violation = {
      type,
      description,
      severity,
      timestamp: new Date().toISOString(),
      examId
    };

    setViolations(prev => [...prev, violation]);

    try {
      // Send violation to backend
      await fetch('/api/v1/proctoring/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          examId,
          eventType: type,
          description,
          severity
        })
      });

      // Notify parent component
      if (onSecurityViolation) {
        onSecurityViolation(violation);
      }

      // Show warning to student
      if (severity === 'high' || severity === 'critical') {
        toast.warning(`Security violation detected: ${description}`);
      }

    } catch (error) {
      console.error('Failed to record violation:', error);
    }
  };

  const cleanupLockdown = () => {
    if (!lockdownActive) return;

    // Remove event listeners
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('copy', handleCopyEvent);
    document.removeEventListener('cut', handleCutEvent);
    document.removeEventListener('paste', handlePasteEvent);
    
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    // Restore text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.mozUserSelect = '';
    document.body.style.msUserSelect = '';

    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }

    setLockdownActive(false);
    setIsFullscreen(false);
  };

  const getSecurityStatusIcon = (status) => {
    return status ? '🟢' : '🔴';
  };

  if (!isEnabled) {
    return <div className="secure-browser-container">{children}</div>;
  }

  return (
    <div 
      ref={containerRef}
      className={`secure-browser-container ${lockdownActive ? 'lockdown-active' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* Security Status Bar */}
      <div className={`security-status-bar ${isFullscreen ? 'fullscreen-mode' : ''}`}>
        <div className="security-indicators">
          <span title="Fullscreen Mode">
            {getSecurityStatusIcon(securityStatus.fullscreen)} Fullscreen
          </span>
          <span title="Developer Tools Blocked">
            {getSecurityStatusIcon(securityStatus.devToolsBlocked)} Dev Tools
          </span>
          <span title="Tab Switch Protection">
            {getSecurityStatusIcon(securityStatus.tabSwitchBlocked)} Tab Switch
          </span>
          <span title="Right Click Blocked">
            {getSecurityStatusIcon(securityStatus.rightClickBlocked)} Right Click
          </span>
          <span title="Copy/Paste Blocked">
            {getSecurityStatusIcon(securityStatus.copyPasteBlocked)} Copy/Paste
          </span>
        </div>
        <div className="violation-count">
          Violations: {violations.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="secure-content">
        {children}
      </div>

      {/* Security Warnings Overlay */}
      {!isFullscreen && lockdownActive && (
        <div className="security-warning-overlay">
          <div className="security-warning">
            <h3>⚠️ Security Warning</h3>
            <p>Please return to fullscreen mode to continue the exam.</p>
            <button onClick={enterFullscreen} className="btn btn-primary">
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Violation History (for debugging, hidden in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="violation-history">
          <h4>Recent Violations:</h4>
          {violations.slice(-5).map((violation, index) => (
            <div key={index} className={`violation-item ${violation.severity}`}>
              <strong>{violation.type}:</strong> {violation.description}
              <span className="violation-time">
                {new Date(violation.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecureBrowser;
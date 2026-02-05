class ProctoringMonitorService {
  constructor() {
    this.isActive = false;
    this.sessionId = null;
    this.callbacks = {
      onViolation: null,
      onWarning: null,
      onTermination: null,
      onStatusChange: null
    };
    
    // State tracking
    this.isDocumentVisible = true;
    this.isWindowFocused = true;
    this.isFullScreen = false;
    this.tabSwitchCount = 0;
    this.focusLossCount = 0;
    this.fullScreenExitCount = 0;
    
    // Timing
    this.lastViolationTime = 0;
    this.violationCooldown = 2000; // 2 seconds between similar violations
    
    // Browser detection
    this.browserInfo = this.getBrowserInfo();
    
    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleDevToolsDetection = this.handleDevToolsDetection.bind(this);
  }

  /**
   * Initialize proctoring monitoring
   */
  initialize(sessionId, callbacks = {}) {
    this.sessionId = sessionId;
    this.callbacks = { ...this.callbacks, ...callbacks };
    this.isActive = true;
    
    console.log('🔒 Initializing proctoring monitoring for session:', sessionId);
    
    // Add event listeners
    this.addEventListeners();
    
    // Enter full screen mode
    this.enterFullScreen();
    
    // Start monitoring loops
    this.startDevToolsDetection();
    this.startNetworkMonitoring();
    
    // Disable browser shortcuts
    this.disableBrowserShortcuts();
    
    return {
      success: true,
      message: 'Proctoring monitoring initialized',
      browserInfo: this.browserInfo
    };
  }

  /**
   * Add all event listeners for monitoring
   */
  addEventListeners() {
    // Document visibility (tab switch detection)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Window focus events
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('blur', this.handleWindowBlur);
    
    // Full screen events
    document.addEventListener('fullscreenchange', this.handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', this.handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', this.handleFullScreenChange);
    
    // Keyboard monitoring
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Mouse events
    document.addEventListener('mouseleave', this.handleMouseLeave);
    document.addEventListener('contextmenu', this.handleContextMenu);
    
    // Browser navigation
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('pagehide', this.handleBeforeUnload);
    
    // Prevent back/forward navigation
    window.history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', () => {
      window.history.pushState(null, null, window.location.href);
      this.reportViolation('unauthorized_device', {
        description: 'Attempted to navigate away from exam',
        browserNavigation: true
      });
    });
  }

  /**
   * Handle document visibility change (tab switching)
   */
  handleVisibilityChange() {
    const wasVisible = this.isDocumentVisible;
    this.isDocumentVisible = !document.hidden;
    
    if (wasVisible && document.hidden) {
      // Tab switched away
      this.tabSwitchCount++;
      console.log('🚨 Tab switch detected:', this.tabSwitchCount);
      
      this.reportViolation('tab_switch', {
        tabSwitchCount: this.tabSwitchCount,
        timestamp: new Date().toISOString(),
        duration: 'unknown'
      });
    } else if (!wasVisible && !document.hidden) {
      // Tab switched back
      console.log('✅ Returned to exam tab');
      this.notifyStatusChange('returned_to_exam');
    }
  }

  /**
   * Handle window focus events
   */
  handleWindowFocus() {
    if (!this.isWindowFocused) {
      this.isWindowFocused = true;
      console.log('✅ Window focus regained');
      this.notifyStatusChange('window_focused');
    }
  }

  /**
   * Handle window blur events
   */
  handleWindowBlur() {
    if (this.isWindowFocused) {
      this.isWindowFocused = false;
      this.focusLossCount++;
      
      console.log('🚨 Window focus lost:', this.focusLossCount);
      
      this.reportViolation('window_focus_lost', {
        focusLossCount: this.focusLossCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle full screen changes
   */
  handleFullScreenChange() {
    const isCurrentlyFullScreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (this.isFullScreen && !isCurrentlyFullScreen) {
      // Exited full screen
      this.fullScreenExitCount++;
      console.log('🚨 Full screen mode exited:', this.fullScreenExitCount);
      
      this.reportViolation('full_screen_exit', {
        exitCount: this.fullScreenExitCount,
        timestamp: new Date().toISOString()
      });
      
      // Try to re-enter full screen after a short delay
      setTimeout(() => {
        if (this.isActive) {
          this.enterFullScreen();
        }
      }, 1000);
    }
    
    this.isFullScreen = isCurrentlyFullScreen;
  }

  /**
   * Handle keyboard events (detect suspicious shortcuts)
   */
  handleKeyDown(event) {
    const suspiciousKeys = [
      // Function keys
      'F12', // Dev tools
      
      // Alt combinations
      'Alt+Tab', // Task switching
      'Alt+F4', // Close window
      
      // Ctrl combinations  
      'Ctrl+Shift+I', // Dev tools
      'Ctrl+Shift+J', // Console
      'Ctrl+U', // View source
      'Ctrl+Shift+C', // Inspect element
      'Ctrl+T', // New tab
      'Ctrl+N', // New window
      'Ctrl+W', // Close tab
      'Ctrl+R', // Refresh
      'Ctrl+F5', // Hard refresh
      'Ctrl+L', // Address bar
      
      // Windows key
      'Meta', // Start menu
      
      // Other
      'Escape' // Often used to exit full screen
    ];

    const key = event.key;
    const keyCombo = 
      (event.ctrlKey ? 'Ctrl+' : '') +
      (event.altKey ? 'Alt+' : '') +
      (event.shiftKey ? 'Shift+' : '') +
      (event.metaKey ? 'Meta+' : '') +
      key;

    // Check for suspicious key combinations
    if (suspiciousKeys.includes(key) || suspiciousKeys.includes(keyCombo)) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🚨 Suspicious key combination blocked:', keyCombo);
      
      this.reportViolation('unauthorized_device', {
        type: 'suspicious_keyboard',
        key: keyCombo,
        description: `Attempted to use blocked key combination: ${keyCombo}`
      });
    }

    // Specific key handling
    if (key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
      event.preventDefault();
      this.handleDevToolsDetection();
    }
  }

  /**
   * Handle mouse leaving document
   */
  handleMouseLeave() {
    // Mouse left the browser window area
    console.log('⚠️ Mouse left exam window');
    
    this.reportViolation('suspicious_eye_movement', {
      type: 'mouse_outside_window',
      description: 'Mouse cursor moved outside exam window'
    });
  }

  /**
   * Handle right-click context menu
   */
  handleContextMenu(event) {
    event.preventDefault();
    
    this.reportViolation('unauthorized_device', {
      type: 'context_menu',
      description: 'Attempted to access context menu'
    });
  }

  /**
   * Handle page unload attempts
   */
  handleBeforeUnload(event) {
    if (this.isActive) {
      const message = 'Leaving the exam will be recorded as a violation. Are you sure?';
      event.returnValue = message;
      
      this.reportViolation('unauthorized_device', {
        type: 'page_unload_attempt',
        description: 'Attempted to leave exam page'
      });
      
      return message;
    }
  }

  /**
   * Enter full screen mode
   */
  async enterFullScreen() {
    try {
      const element = document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      
      this.isFullScreen = true;
      console.log('✅ Entered full screen mode');
    } catch (error) {
      console.error('Failed to enter full screen:', error);
      this.reportViolation('unauthorized_device', {
        type: 'fullscreen_failure',
        description: 'Failed to enter required full screen mode'
      });
    }
  }

  /**
   * Disable browser shortcuts and context menus
   */
  disableBrowserShortcuts() {
    // Disable drag and drop
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    
    // Disable text selection in sensitive areas
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    // Disable image dragging
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.draggable = false;
    });
  }

  /**
   * Start developer tools detection
   */
  startDevToolsDetection() {
    // Method 1: Console monitoring
    let devtools = { open: false, orientation: null };
    const threshold = 160;
    
    setInterval(() => {
      if (!this.isActive) return;
      
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      
      if (widthDiff || heightDiff) {
        if (!devtools.open) {
          devtools.open = true;
          console.log('🚨 Developer tools detected');
          this.handleDevToolsDetection();
        }
      } else {
        devtools.open = false;
      }
    }, 1000);

    // Method 2: Performance monitoring
    const startTime = performance.now();
    const detector = () => {
      const endTime = performance.now();
      if (endTime - startTime > 100) { // Threshold for detecting debugging
        this.handleDevToolsDetection();
      }
    };
    
    setInterval(detector, 5000);
  }

  /**
   * Handle developer tools detection
   */
  handleDevToolsDetection() {
    console.log('🚨 Developer tools or debugging detected');
    
    this.reportViolation('unauthorized_device', {
      type: 'developer_tools',
      description: 'Developer tools or debugging interface detected'
    });
  }

  /**
   * Start network monitoring for suspicious activity
   */
  startNetworkMonitoring() {
    // Monitor for screen sharing applications
    const checkForScreenSharing = () => {
      if (!this.isActive) return;
      
      // Check for common screen sharing indicators
      const indicators = [
        'getDisplayMedia' in navigator.mediaDevices,
        window.chrome && window.chrome.desktopCapture
      ];
      
      if (indicators.some(indicator => indicator)) {
        console.log('🚨 Potential screen sharing capability detected');
        this.reportViolation('screen_share_detected', {
          description: 'Screen sharing capabilities detected'
        });
      }
    };
    
    setInterval(checkForScreenSharing, 10000);
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    const browser = {
      name: 'Unknown',
      version: 'Unknown',
      os: 'Unknown'
    };
    
    // Detect browser
    if (ua.includes('Chrome')) browser.name = 'Chrome';
    else if (ua.includes('Firefox')) browser.name = 'Firefox';
    else if (ua.includes('Safari')) browser.name = 'Safari';
    else if (ua.includes('Edge')) browser.name = 'Edge';
    
    // Detect OS
    if (ua.includes('Windows')) browser.os = 'Windows';
    else if (ua.includes('Mac')) browser.os = 'macOS';
    else if (ua.includes('Linux')) browser.os = 'Linux';
    
    return {
      ...browser,
      userAgent: ua,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };
  }

  /**
   * Report a violation to the backend
   */
  reportViolation(type, metadata = {}) {
    if (!this.isActive) return;
    
    // Implement cooldown to prevent spam
    const now = Date.now();
    if (now - this.lastViolationTime < this.violationCooldown) {
      return;
    }
    this.lastViolationTime = now;
    
    const violation = {
      sessionId: this.sessionId,
      type,
      metadata: {
        ...metadata,
        browserInfo: this.browserInfo,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    };
    
    console.log('📝 Reporting violation:', violation);
    
    if (this.callbacks.onViolation) {
      this.callbacks.onViolation(violation);
    }
  }

  /**
   * Notify status change
   */
  notifyStatusChange(status, data = {}) {
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange({ status, data, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Clean up and stop monitoring
   */
  cleanup() {
    console.log('🔓 Cleaning up proctoring monitoring');
    
    this.isActive = false;
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('fullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('mozfullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('MSFullscreenChange', this.handleFullScreenChange);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('pagehide', this.handleBeforeUnload);
    
    // Exit full screen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    // Re-enable user selection
    document.body.style.userSelect = 'auto';
    document.body.style.webkitUserSelect = 'auto';
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      sessionId: this.sessionId,
      isDocumentVisible: this.isDocumentVisible,
      isWindowFocused: this.isWindowFocused,
      isFullScreen: this.isFullScreen,
      violationCounts: {
        tabSwitch: this.tabSwitchCount,
        focusLoss: this.focusLossCount,
        fullScreenExit: this.fullScreenExitCount
      }
    };
  }
}

// Create singleton instance
const proctoringMonitorService = new ProctoringMonitorService();

export default proctoringMonitorService;
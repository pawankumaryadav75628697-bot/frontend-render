/**
 * Enhanced Proctoring Service for Coding Exams
 * Features: Face Detection, Audio Detection, Tab Lock, Browser Lock, 3-Strike System
 */

class CodingExamProctoringService {
  constructor() {
    this.isActive = false;
    this.sessionId = null;
    this.attemptId = null;
    
    // Violation tracking
    this.violationCount = 0;
    this.maxViolations = 3;
    this.violations = [];
    
    // Media streams
    this.videoStream = null;
    this.audioStream = null;
    this.audioContext = null;
    this.audioAnalyser = null;
    
    // Face detection
    this.faceDetectionInterval = null;
    this.noFaceDetectedCount = 0;
    this.maxNoFaceCount = 3; // 3 consecutive checks without face = violation (9 seconds)
    this.lastFaceDetectionResult = null;
    
    // Audio detection
    this.audioMonitoringInterval = null;
    this.audioViolationThreshold = 0.3; // Threshold for detecting speech/noise
    this.suspiciousAudioCount = 0;
    this.maxSuspiciousAudioCount = 3;
    
    // Tab/Browser lock
    this.tabSwitchCount = 0;
    this.windowBlurCount = 0;
    this.fullScreenExitCount = 0;
    
    // State tracking
    this.isDocumentVisible = true;
    this.isWindowFocused = true;
    this.isFullScreen = false;
    this.lastViolationTime = 0;
    this.violationCooldown = 3000; // 3 seconds between similar violations
    
    // Callbacks
    this.callbacks = {
      onViolation: null,
      onWarning: null,
      onTermination: null,
      onFaceDetected: null,
      onNoFaceDetected: null,
      onAudioDetected: null
    };
    
    // Copy-paste tracking
    this.copyAttempts = 0;
    this.pasteAttempts = 0;
    this.cutAttempts = 0;
    
    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleCopy = this.handleCopy.bind(this);
    this.handlePaste = this.handlePaste.bind(this);
    this.handleCut = this.handleCut.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
  }

  /**
   * Initialize proctoring with all features
   */
  async initialize(attemptId, callbacks = {}) {
    try {
      this.attemptId = attemptId;
      this.sessionId = `coding-exam-${attemptId}-${Date.now()}`;
      this.callbacks = { ...this.callbacks, ...callbacks };
      this.isActive = true;
      
      console.log('🔒 Initializing enhanced proctoring for coding exam:', this.sessionId);
      
      // Request camera access for face detection
      await this.initializeCamera();
      
      // Request microphone access for audio detection
      await this.initializeMicrophone();
      
      // Add event listeners for tab/browser lock
      this.addEventListeners();
      
      // Enter fullscreen mode
      await this.enterFullScreen();
      
      // Start face detection
      this.startFaceDetection();
      
      // Start audio monitoring
      this.startAudioMonitoring();
      
      // Disable browser shortcuts
      this.disableBrowserShortcuts();
      
      return {
        success: true,
        message: 'Proctoring initialized successfully',
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Failed to initialize proctoring:', error);
      throw error;
    }
  }

  /**
   * Initialize camera for face detection
   */
  async initializeCamera() {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      console.log('✅ Camera initialized for face detection');
      return this.videoStream;
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      this.recordViolation('camera_access_denied', {
        error: error.message,
        description: 'Camera access is required for exam proctoring'
      });
      throw new Error('Camera access is required to take this exam');
    }
  }

  /**
   * Initialize microphone for audio detection
   */
  async initializeMicrophone() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Create audio context for analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioAnalyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.audioAnalyser);
      this.audioAnalyser.fftSize = 256;
      
      console.log('✅ Microphone initialized for audio detection');
      return this.audioStream;
    } catch (error) {
      console.error('Failed to initialize microphone:', error);
      this.recordViolation('microphone_access_denied', {
        error: error.message,
        description: 'Microphone access is required for exam proctoring'
      });
      throw new Error('Microphone access is required to take this exam');
    }
  }

  /**
   * Start face detection monitoring
   */
  startFaceDetection() {
    console.log('🔍 Starting face detection monitoring...');
    
    // Check for face every 3 seconds
    this.faceDetectionInterval = setInterval(async () => {
      if (!this.isActive || !this.videoStream) {
        console.warn('Face detection skipped - inactive or no stream');
        return;
      }
      
      try {
        const faceDetected = await this.detectFace();
        this.lastFaceDetectionResult = faceDetected;
        
        console.log(`👤 Face detection result: ${faceDetected ? '✅ DETECTED' : '❌ NOT DETECTED'} (Count: ${this.noFaceDetectedCount + 1}/${this.maxNoFaceCount})`);
        
        if (faceDetected) {
          // Face detected - reset counter
          if (this.noFaceDetectedCount > 0) {
            console.log('✅ Face detected again, resetting counter');
          }
          this.noFaceDetectedCount = 0;
          
          if (this.callbacks.onFaceDetected) {
            this.callbacks.onFaceDetected();
          }
        } else {
          // No face detected - increment counter
          this.noFaceDetectedCount++;
          
          console.warn(`⚠️ No face detected! Count: ${this.noFaceDetectedCount}/${this.maxNoFaceCount}`);
          
          if (this.callbacks.onNoFaceDetected) {
            this.callbacks.onNoFaceDetected(this.noFaceDetectedCount);
          }
          
          // If no face detected for too long, record violation
          if (this.noFaceDetectedCount >= this.maxNoFaceCount) {
            console.error('🚨 VIOLATION: Face not detected for too long!');
            this.recordViolation('no_face_detected', {
              duration: this.noFaceDetectedCount * 3,
              consecutiveFailures: this.noFaceDetectedCount,
              description: 'Face not detected in camera view for extended period'
            });
            this.noFaceDetectedCount = 0; // Reset counter after violation
          }
        }
      } catch (error) {
        console.error('❌ Face detection error:', error);
        this.noFaceDetectedCount++;
      }
    }, 3000);
    
    console.log('✅ Face detection monitoring started (checking every 3 seconds)');
  }

  /**
   * Detect face in video stream using improved algorithm
   */
  async detectFace() {
    if (!this.videoStream) {
      return false;
    }

    try {
      // Get video track
      const videoTrack = this.videoStream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.enabled) {
        return false;
      }

      // Create ImageCapture to get frame
      if ('ImageCapture' in window) {
        try {
          const imageCapture = new ImageCapture(videoTrack);
          const bitmap = await imageCapture.grabFrame();
          
          // Analyze the frame
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          
          const faceDetected = await this.analyzeFaceInFrame(ctx, canvas.width, canvas.height);
          return faceDetected;
        } catch (e) {
          console.warn('ImageCapture failed, using fallback method:', e);
        }
      }
      
      // Fallback: Use video element
      return await this.detectFaceFromVideoElement();
      
    } catch (error) {
      console.error('Face detection error:', error);
      return false;
    }
  }

  /**
   * Fallback method using video element
   */
  async detectFaceFromVideoElement() {
    return new Promise((resolve) => {
      // Use existing video element if available
      const existingVideo = document.querySelector('.preview-video');
      
      if (existingVideo && existingVideo.readyState >= 2) {
        // Video is ready
        const canvas = document.createElement('canvas');
        canvas.width = existingVideo.videoWidth || 640;
        canvas.height = existingVideo.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        try {
          ctx.drawImage(existingVideo, 0, 0, canvas.width, canvas.height);
          const faceDetected = this.analyzeFaceInFrame(ctx, canvas.width, canvas.height);
          resolve(faceDetected);
        } catch (e) {
          console.error('Error drawing video frame:', e);
          resolve(false);
        }
      } else {
        // Create temporary video element
        const video = document.createElement('video');
        video.srcObject = this.videoStream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        
        const timeout = setTimeout(() => {
          video.srcObject = null;
          resolve(false);
        }, 2000);
        
        video.onloadeddata = () => {
          clearTimeout(timeout);
          
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const faceDetected = this.analyzeFaceInFrame(ctx, canvas.width, canvas.height);
            video.srcObject = null;
            resolve(faceDetected);
          } catch (e) {
            console.error('Error processing video frame:', e);
            video.srcObject = null;
            resolve(false);
          }
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          video.srcObject = null;
          resolve(false);
        };
      }
    });
  }

  /**
   * Analyze frame for face presence using multiple techniques
   */
  analyzeFaceInFrame(ctx, width, height) {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Method 1: Check for skin tone colors in center region
      const centerX = width / 2;
      const centerY = height / 2;
      const regionSize = Math.min(width, height) / 3;
      
      let skinTonePixels = 0;
      let totalPixels = 0;
      let brightPixels = 0;
      let darkPixels = 0;
      
      for (let y = centerY - regionSize / 2; y < centerY + regionSize / 2; y += 3) {
        for (let x = centerX - regionSize / 2; x < centerX + regionSize / 2; x += 3) {
          const i = (Math.floor(y) * width + Math.floor(x)) * 4;
          
          if (i >= 0 && i + 2 < data.length) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            totalPixels++;
            
            // Check for skin tone (simplified)
            // Skin tones typically have: R > G > B, and R > 95
            if (r > 95 && g > 40 && b > 20 && 
                r > g && g > b && 
                Math.abs(r - g) > 15 &&
                r - b > 15) {
              skinTonePixels++;
            }
            
            const brightness = (r + g + b) / 3;
            if (brightness > 200) brightPixels++;
            if (brightness < 50) darkPixels++;
          }
        }
      }
      
      const skinToneRatio = skinTonePixels / totalPixels;
      const brightRatio = brightPixels / totalPixels;
      const darkRatio = darkPixels / totalPixels;
      
      // Face detected if:
      // 1. Reasonable amount of skin tone pixels (3-50%) - more lenient
      // 2. Not too bright (not overexposed) < 70%
      // 3. Not too dark (not underexposed) < 80%
      const hasSkinTone = skinToneRatio > 0.03 && skinToneRatio < 0.5;
      const notOverexposed = brightRatio < 0.7;
      const notUnderexposed = darkRatio < 0.8;
      
      // Method 2: Check for contrast/edges (face features)
      let edgePixels = 0;
      const edgeSampleSize = Math.min(width, height) / 4;
      
      for (let y = centerY - edgeSampleSize / 2; y < centerY + edgeSampleSize / 2; y += 5) {
        for (let x = centerX - edgeSampleSize / 2; x < centerX + edgeSampleSize / 2; x += 5) {
          const i = (Math.floor(y) * width + Math.floor(x)) * 4;
          const iRight = (Math.floor(y) * width + Math.floor(x + 5)) * 4;
          const iDown = (Math.floor(y + 5) * width + Math.floor(x)) * 4;
          
          if (i >= 0 && iRight < data.length && iDown < data.length) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const brightnessRight = (data[iRight] + data[iRight + 1] + data[iRight + 2]) / 3;
            const brightnessDown = (data[iDown] + data[iDown + 1] + data[iDown + 2]) / 3;
            
            // Detect edges (significant brightness changes)
            if (Math.abs(brightness - brightnessRight) > 30 || 
                Math.abs(brightness - brightnessDown) > 30) {
              edgePixels++;
            }
          }
        }
      }
      
      const hasFeatures = edgePixels > 8; // Some facial features detected (lowered threshold)
      
      // Final decision - face detected if most conditions are met
      // More lenient: 3 out of 4 conditions should pass
      const conditionsPassed = [hasSkinTone, notOverexposed, notUnderexposed, hasFeatures].filter(Boolean).length;
      const faceDetected = conditionsPassed >= 3;
      
      // Always log detection analysis for debugging
      console.log('🔍 Face detection analysis:', {
        faceDetected: faceDetected ? '✅ YES' : '❌ NO',
        skinToneRatio: (skinToneRatio * 100).toFixed(1) + '%',
        brightRatio: (brightRatio * 100).toFixed(1) + '%',
        darkRatio: (darkRatio * 100).toFixed(1) + '%',
        edgePixels,
        conditions: {
          hasSkinTone: hasSkinTone ? '✅' : '❌',
          notOverexposed: notOverexposed ? '✅' : '❌',
          notUnderexposed: notUnderexposed ? '✅' : '❌',
          hasFeatures: hasFeatures ? '✅' : '❌'
        },
        conditionsPassed: `${conditionsPassed}/4`
      });
      
      return faceDetected;
      
    } catch (error) {
      console.error('Error analyzing frame:', error);
      return false;
    }
  }

  /**
   * Start audio monitoring
   */
  startAudioMonitoring() {
    this.audioMonitoringInterval = setInterval(() => {
      if (!this.isActive || !this.audioAnalyser) return;
      
      const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
      this.audioAnalyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedVolume = average / 255;
      
      // Check if audio level exceeds threshold
      if (normalizedVolume > this.audioViolationThreshold) {
        this.suspiciousAudioCount++;
        
        if (this.callbacks.onAudioDetected) {
          this.callbacks.onAudioDetected(normalizedVolume);
        }
        
        // If suspicious audio detected multiple times, record violation
        if (this.suspiciousAudioCount >= this.maxSuspiciousAudioCount) {
          this.recordViolation('suspicious_audio_detected', {
            volume: normalizedVolume,
            description: 'Suspicious audio/speech detected during exam'
          });
          this.suspiciousAudioCount = 0; // Reset counter
        }
      } else {
        // Decay the suspicious audio count
        this.suspiciousAudioCount = Math.max(0, this.suspiciousAudioCount - 0.5);
      }
    }, 1000);
  }

  /**
   * Add event listeners for tab/browser lock
   */
  addEventListeners() {
    // Tab visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Window focus
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    
    // Fullscreen
    document.addEventListener('fullscreenchange', this.handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', this.handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', this.handleFullScreenChange);
    
    // Keyboard
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Context menu
    document.addEventListener('contextmenu', this.handleContextMenu);
    
    // Page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // Prevent navigation
    window.history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', () => {
      window.history.pushState(null, null, window.location.href);
      this.recordViolation('navigation_attempt', {
        description: 'Attempted to navigate away from exam'
      });
    });
    
    // Copy-paste blocking
    document.addEventListener('copy', this.handleCopy, true);
    document.addEventListener('paste', this.handlePaste, true);
    document.addEventListener('cut', this.handleCut, true);
    
    // Drag and drop blocking
    document.addEventListener('dragstart', this.handleDragStart, true);
    document.addEventListener('drop', this.handleDrop, true);
    document.addEventListener('dragover', (e) => e.preventDefault(), true);
  }

  /**
   * Handle tab visibility change
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.tabSwitchCount++;
      this.isDocumentVisible = false;
      
      console.log('🚨 Tab switch detected:', this.tabSwitchCount);
      
      this.recordViolation('tab_switch', {
        count: this.tabSwitchCount,
        description: 'Switched to another tab or window'
      });
    } else {
      this.isDocumentVisible = true;
      console.log('✅ Returned to exam tab');
    }
  }

  /**
   * Handle window blur
   */
  handleWindowBlur() {
    this.windowBlurCount++;
    this.isWindowFocused = false;
    
    console.log('🚨 Window focus lost:', this.windowBlurCount);
    
    this.recordViolation('window_blur', {
      count: this.windowBlurCount,
      description: 'Exam window lost focus'
    });
  }

  /**
   * Handle window focus
   */
  handleWindowFocus() {
    this.isWindowFocused = true;
    console.log('✅ Window focus regained');
  }

  /**
   * Handle fullscreen change
   */
  handleFullScreenChange() {
    const isCurrentlyFullScreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (this.isFullScreen && !isCurrentlyFullScreen) {
      this.fullScreenExitCount++;
      
      console.log('🚨 Exited fullscreen:', this.fullScreenExitCount);
      
      this.recordViolation('fullscreen_exit', {
        count: this.fullScreenExitCount,
        description: 'Exited fullscreen mode'
      });
      
      // Try to re-enter fullscreen
      setTimeout(() => {
        if (this.isActive) {
          this.enterFullScreen();
        }
      }, 1000);
    }
    
    this.isFullScreen = isCurrentlyFullScreen;
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    const blockedKeys = [
      'F12', 'F11',
      'PrintScreen', 'Meta'
    ];
    
    const blockedCombos = [
      event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J' || event.key === 'C'),
      event.ctrlKey && event.key === 'u',
      event.ctrlKey && event.key === 't',
      event.ctrlKey && event.key === 'n',
      event.ctrlKey && event.key === 'w',
      event.altKey && event.key === 'Tab',
      event.altKey && event.key === 'F4'
    ];
    
    if (blockedKeys.includes(event.key) || blockedCombos.some(combo => combo)) {
      event.preventDefault();
      event.stopPropagation();
      
      this.recordViolation('blocked_key_attempt', {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        description: 'Attempted to use blocked keyboard shortcut'
      });
    }
  }

  /**
   * Handle context menu
   */
  handleContextMenu(event) {
    event.preventDefault();
    
    this.recordViolation('context_menu_attempt', {
      description: 'Attempted to open context menu'
    });
  }

  /**
   * Handle page unload
   */
  handleBeforeUnload(event) {
    if (this.isActive) {
      const message = 'Leaving the exam will count as a violation. Are you sure?';
      event.returnValue = message;
      
      this.recordViolation('page_unload_attempt', {
        description: 'Attempted to leave exam page'
      });
      
      return message;
    }
  }

  /**
   * Handle copy attempts
   */
  handleCopy(event) {
    // Check if copy is from code editor (Monaco editor allows internal copy)
    const target = event.target;
    const isMonacoEditor = target.closest('.monaco-editor') !== null;
    
    if (!isMonacoEditor) {
      // Block copy from outside editor - silently
      event.preventDefault();
      event.stopPropagation();
      
      this.copyAttempts++;
      console.log(`🚫 Copy blocked silently. Attempt #${this.copyAttempts}`);
      
      // No violation recorded - just block the action
    } else {
      // Allow copy within editor
      console.log('📋 Copy within editor allowed');
    }
  }

  /**
   * Handle paste attempts
   */
  handlePaste(event) {
    // Check if paste is into code editor
    const target = event.target;
    const isMonacoEditor = target.closest('.monaco-editor') !== null;
    const isTextArea = target.tagName === 'TEXTAREA';
    const isInput = target.tagName === 'INPUT';
    
    // Block paste from external sources
    if (event.clipboardData) {
      const pastedText = event.clipboardData.getData('text');
      
      // Check if pasted content is suspiciously long (likely external code)
      if (pastedText.length > 100) {
        event.preventDefault();
        event.stopPropagation();
        
        this.pasteAttempts++;
        console.log(`🚫 Large paste blocked silently. ${pastedText.length} characters. Attempt #${this.pasteAttempts}`);
        
        // No violation recorded - just block the action
        // No warning shown - silent blocking
        
        return false;
      } else if (isMonacoEditor || isTextArea || isInput) {
        // Allow small pastes in editor (like variable names, small snippets)
        console.log(`📋 Small paste allowed: ${pastedText.length} characters`);
      }
    }
  }

  /**
   * Handle cut attempts
   */
  handleCut(event) {
    const target = event.target;
    const isMonacoEditor = target.closest('.monaco-editor') !== null;
    
    if (!isMonacoEditor) {
      event.preventDefault();
      event.stopPropagation();
      
      this.cutAttempts++;
      console.log(`🚫 Cut blocked silently. Attempt #${this.cutAttempts}`);
      
      // No violation recorded - just block the action
    } else {
      console.log('✂️ Cut within editor allowed');
    }
  }

  /**
   * Handle drag start (prevent dragging content out)
   */
  handleDragStart(event) {
    const target = event.target;
    const isMonacoEditor = target.closest('.monaco-editor') !== null;
    
    // Block dragging content out of exam
    if (!isMonacoEditor) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🚫 Drag operation blocked silently');
      
      // No violation recorded - just block the action
    }
  }

  /**
   * Handle drop (prevent dropping external content)
   */
  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🚫 Drop operation blocked silently');
    
    // No violation recorded - just block the action
    
    return false;
  }

  /**
   * Enter fullscreen mode
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
      console.log('✅ Entered fullscreen mode');
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }

  /**
   * Disable browser shortcuts
   */
  disableBrowserShortcuts() {
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }

  /**
   * Record a violation
   */
  recordViolation(type, metadata = {}) {
    if (!this.isActive) return;
    
    // Implement cooldown
    const now = Date.now();
    if (now - this.lastViolationTime < this.violationCooldown) {
      return;
    }
    this.lastViolationTime = now;
    
    this.violationCount++;
    
    const violation = {
      id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        violationNumber: this.violationCount,
        sessionId: this.sessionId,
        attemptId: this.attemptId
      }
    };
    
    this.violations.push(violation);
    
    console.log(`🚨 Violation ${this.violationCount}/${this.maxViolations}:`, violation);
    
    // Trigger callbacks based on violation count
    if (this.violationCount >= this.maxViolations) {
      // Terminate exam
      if (this.callbacks.onTermination) {
        this.callbacks.onTermination({
          reason: 'Maximum violations reached',
          violations: this.violations,
          totalViolations: this.violationCount
        });
      }
    } else {
      // Show warning
      if (this.callbacks.onWarning) {
        this.callbacks.onWarning({
          violation,
          remainingWarnings: this.maxViolations - this.violationCount,
          totalViolations: this.violationCount
        });
      }
    }
    
    // Always trigger violation callback
    if (this.callbacks.onViolation) {
      this.callbacks.onViolation(violation);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      sessionId: this.sessionId,
      attemptId: this.attemptId,
      violationCount: this.violationCount,
      maxViolations: this.maxViolations,
      remainingWarnings: this.maxViolations - this.violationCount,
      violations: this.violations,
      monitoring: {
        camera: !!this.videoStream,
        microphone: !!this.audioStream,
        faceDetection: !!this.faceDetectionInterval,
        audioMonitoring: !!this.audioMonitoringInterval
      },
      state: {
        isDocumentVisible: this.isDocumentVisible,
        isWindowFocused: this.isWindowFocused,
        isFullScreen: this.isFullScreen,
        tabSwitchCount: this.tabSwitchCount,
        windowBlurCount: this.windowBlurCount,
        fullScreenExitCount: this.fullScreenExitCount
      }
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  cleanup() {
    console.log('🔓 Cleaning up proctoring service');
    
    this.isActive = false;
    
    // Stop face detection
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    
    // Stop audio monitoring
    if (this.audioMonitoringInterval) {
      clearInterval(this.audioMonitoringInterval);
      this.audioMonitoringInterval = null;
    }
    
    // Stop media streams
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('fullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('mozfullscreenchange', this.handleFullScreenChange);
    document.removeEventListener('MSFullscreenChange', this.handleFullScreenChange);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    // Remove copy-paste listeners
    document.removeEventListener('copy', this.handleCopy, true);
    document.removeEventListener('paste', this.handlePaste, true);
    document.removeEventListener('cut', this.handleCut, true);
    document.removeEventListener('dragstart', this.handleDragStart, true);
    document.removeEventListener('drop', this.handleDrop, true);
    
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    
    // Re-enable user selection
    document.body.style.userSelect = 'auto';
    document.body.style.webkitUserSelect = 'auto';
  }
}

// Create singleton instance
const codingExamProctoringService = new CodingExamProctoringService();

export default codingExamProctoringService;

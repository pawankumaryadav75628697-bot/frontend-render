const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const ProctoringSession = require('../models/ProctoringSession');

class AIProctoringService {
  constructor() {
    this.pythonPath = 'python';
    this.scriptPath = path.join(__dirname, '..', 'python_services', 'ai_proctoring_service.py');
    this.activeSessions = new Map(); // sessionId -> session data
  }

  /**
   * Initialize a new proctoring session
   */
  async initializeSession(sessionData) {
    try {
      const session = await ProctoringSession.create({
        student: sessionData.studentId,
        exam: sessionData.examId,
        codingExam: sessionData.codingExamId,
        examAttempt: sessionData.examAttemptId,
        codingExamAttempt: sessionData.codingExamAttemptId,
        settings: {
          faceDetectionEnabled: true,
          eyeTrackingEnabled: true,
          tabSwitchMonitoring: true,
          audioMonitoring: false,
          screenRecording: false,
          strictMode: sessionData.strictMode || true
        },
        systemInfo: {
          browser: sessionData.browser,
          os: sessionData.os,
          screenResolution: sessionData.screenResolution,
          cameraResolution: sessionData.cameraResolution,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent
        }
      });

      // Store active session
      this.activeSessions.set(session._id.toString(), {
        sessionId: session._id.toString(),
        studentId: sessionData.studentId,
        startTime: new Date(),
        lastActivity: new Date(),
        frameCount: 0,
        violationCount: 0
      });

      return session;
    } catch (error) {
      console.error('Error initializing proctoring session:', error);
      throw error;
    }
  }

  /**
   * Analyze a frame using Python AI service
   */
  async analyzeFrame(sessionId, frameData) {
    return new Promise((resolve, reject) => {
      try {
        // Spawn Python process
        const pythonProcess = spawn(this.pythonPath, [this.scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        // Send data to Python process
        const inputData = JSON.stringify({
          action: 'analyze_frame',
          frame_data: frameData
        });

        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        // Collect output
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          try {
            if (code !== 0) {
              console.error('Python process error:', errorOutput);
              return reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
            }

            const result = JSON.parse(output);
            
            if (!result.success) {
              return reject(new Error(result.error || 'AI analysis failed'));
            }

            // Update session with analysis results
            if (this.activeSessions.has(sessionId)) {
              const sessionInfo = this.activeSessions.get(sessionId);
              sessionInfo.frameCount += 1;
              sessionInfo.lastActivity = new Date();
              
              if (result.violations && result.violations.length > 0) {
                sessionInfo.violationCount += result.violations.length;
                await this.processViolations(sessionId, result.violations, result.metadata);
              }
            }

            resolve(result);
          } catch (parseError) {
            console.error('Error parsing Python output:', parseError);
            reject(new Error('Failed to parse AI analysis result'));
          }
        });

        // Set timeout for Python process
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          reject(new Error('AI analysis timeout'));
        }, 10000); // 10 second timeout

      } catch (error) {
        console.error('Error spawning Python process:', error);
        reject(error);
      }
    });
  }

  /**
   * Process detected violations and update session
   */
  async processViolations(sessionId, violations, metadata) {
    try {
      const session = await ProctoringSession.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      for (const violation of violations) {
        await session.addViolation({
          type: violation.type,
          severity: violation.severity,
          description: violation.description,
          confidence: violation.confidence,
          metadata: metadata || {}
        });
      }

      // Check if session should be terminated
      if (session.terminated) {
        await this.terminateSession(sessionId, session.terminationReason);
        return {
          action: 'terminate',
          reason: session.terminationReason,
          warningCount: session.warningCount
        };
      }

      // Check if warning should be issued
      const lastViolation = session.violations[session.violations.length - 1];
      if (lastViolation && lastViolation.warningIssued) {
        return {
          action: 'warning',
          warningNumber: lastViolation.warningNumber,
          warningCount: session.warningCount,
          message: this.getWarningMessage(lastViolation.warningNumber)
        };
      }

      return { action: 'continue' };

    } catch (error) {
      console.error('Error processing violations:', error);
      throw error;
    }
  }

  /**
   * Get warning message based on warning number
   */
  getWarningMessage(warningNumber) {
    const messages = {
      1: "⚠️ First Warning: Suspicious activity detected. Please maintain proper exam conduct.",
      2: "⚠️ Second Warning: Continued violations detected. This is your second warning.",
      3: "⚠️ Final Warning: This is your final warning. Any further violations will result in exam termination."
    };
    return messages[warningNumber] || "Warning: Please maintain proper exam conduct.";
  }

  /**
   * Record non-AI violations (tab switch, window focus, etc.)
   */
  async recordViolation(sessionId, violationType, metadata = {}) {
    try {
      const session = await ProctoringSession.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const violationConfig = {
        tab_switch: {
          severity: 'high',
          description: 'Student switched to another browser tab'
        },
        window_focus_lost: {
          severity: 'high', 
          description: 'Student switched to another application window'
        },
        full_screen_exit: {
          severity: 'critical',
          description: 'Student exited full-screen mode'
        },
        unauthorized_device: {
          severity: 'critical',
          description: 'Unauthorized device or software detected'
        },
        audio_detection: {
          severity: 'medium',
          description: 'Suspicious audio activity detected'
        },
        screen_share_detected: {
          severity: 'critical',
          description: 'Screen sharing or remote access detected'
        }
      };

      const config = violationConfig[violationType];
      if (!config) {
        throw new Error('Invalid violation type');
      }

      const result = await session.addViolation({
        type: violationType,
        severity: config.severity,
        description: config.description,
        confidence: 0.9,
        metadata
      });

      // Update active session info
      if (this.activeSessions.has(sessionId)) {
        const sessionInfo = this.activeSessions.get(sessionId);
        sessionInfo.violationCount += 1;
        sessionInfo.lastActivity = new Date();
      }

      return this.processViolations(sessionId, [], {});

    } catch (error) {
      console.error('Error recording violation:', error);
      throw error;
    }
  }

  /**
   * Terminate a proctoring session
   */
  async terminateSession(sessionId, reason = 'completed') {
    try {
      const session = await ProctoringSession.findById(sessionId);
      if (session) {
        await session.endSession(reason);
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      return { success: true, terminated: true, reason };
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId) {
    try {
      const session = await ProctoringSession.findById(sessionId)
        .populate('student', 'fullName email')
        .populate('exam', 'title')
        .populate('codingExam', 'title');

      if (!session) {
        throw new Error('Session not found');
      }

      const activeSession = this.activeSessions.get(sessionId);
      
      return {
        session: {
          id: session._id,
          student: session.student,
          exam: session.exam || session.codingExam,
          status: session.status,
          startTime: session.startTime,
          duration: session.duration,
          warningCount: session.warningCount,
          terminated: session.terminated,
          violationCount: session.violations.length,
          trustScore: session.getCurrentTrustScore()
        },
        realtime: activeSession ? {
          frameCount: activeSession.frameCount,
          lastActivity: activeSession.lastActivity,
          currentViolationCount: activeSession.violationCount
        } : null,
        violations: session.violations.slice(-10), // Last 10 violations
        aiAnalysis: session.aiAnalysis
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      const sessionInfo = this.activeSessions.get(sessionId);
      sessionInfo.lastActivity = new Date();
    }
  }

  /**
   * Check for inactive sessions and clean them up
   */
  async cleanupInactiveSessions() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, sessionInfo] of this.activeSessions.entries()) {
      if (now - sessionInfo.lastActivity > inactiveThreshold) {
        console.log(`Cleaning up inactive session: ${sessionId}`);
        await this.terminateSession(sessionId, 'inactive');
      }
    }
  }

  /**
   * Install Python dependencies
   */
  async installPythonDependencies() {
    return new Promise((resolve, reject) => {
      const requirementsPath = path.join(__dirname, '..', 'python_services', 'requirements.txt');
      const installProcess = spawn('pip', ['install', '-r', requirementsPath]);

      let output = '';
      let errorOutput = '';

      installProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('pip install:', data.toString());
      });

      installProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('pip install error:', data.toString());
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Python dependencies installed successfully');
          resolve({ success: true, output });
        } else {
          console.error('Failed to install Python dependencies');
          reject(new Error(`Installation failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }
}

// Singleton instance
const aiProctoringService = new AIProctoringService();

// Cleanup inactive sessions every 10 minutes
setInterval(() => {
  aiProctoringService.cleanupInactiveSessions().catch(console.error);
}, 10 * 60 * 1000);

module.exports = aiProctoringService;
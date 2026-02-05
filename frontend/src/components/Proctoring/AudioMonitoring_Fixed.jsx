import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import './AudioMonitoring.css';

const AudioMonitoring = ({ 
  isActive, 
  onViolation, 
  onStatusChange,
  examId, 
  studentId, 
  securityLevel = 2,
  voiceDetectionEnabled = true,
  backgroundNoiseDetection = true,
  suspiciousSoundDetection = true
}) => {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array());
  const audioHistoryRef = useRef([]);
  const lastViolationTimeRef = useRef({});
  
  const [stream, setStream] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState('prompt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [violations, setViolations] = useState([]);
  
  const [audioData, setAudioData] = useState({
    volume: 0,
    frequency: 0,
    isVoiceDetected: false,
    backgroundNoise: 0,
    suspiciousActivity: false,
    voiceCount: 0,
    silenceLevel: 0,
    microphoneWorking: true
  });

  // Violation types
  const VIOLATION_TYPES = {
    VOICE_DETECTED: 'voice_detected',
    MULTIPLE_VOICES: 'multiple_voices_detected',
    SUSPICIOUS_SOUND: 'suspicious_sound',
    BACKGROUND_NOISE: 'excessive_background_noise',
    MICROPHONE_COVERED: 'microphone_covered',
    MICROPHONE_ACCESS_DENIED: 'microphone_access_denied',
    MICROPHONE_DISCONNECTED: 'microphone_disconnected',
    COMMUNICATION_DETECTED: 'communication_detected',
    PHONE_RINGING: 'phone_ringing_detected'
  };

  // Update status callback
  const updateStatus = useCallback((status) => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [onStatusChange]);

  // Log violation with improved cooldown
  const logViolation = useCallback((type, details = {}) => {
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;
    const cooldownPeriod = getCooldownPeriod(type);
    
    if (now - lastTime < cooldownPeriod) return;
    
    lastViolationTimeRef.current[type] = now;

    const violation = {
      id: `${type}-${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      examId,
      studentId,
      details: {
        ...details,
        audioData,
        microphonePermission,
        isInitialized
      },
      severity: getViolationSeverity(type)
    };

    setViolations(prev => [...prev, violation]);
    
    // Call parent violation handler
    if (onViolation) {
      onViolation({
        type,
        message: getViolationMessage(type),
        details: violation.details,
        severity: violation.severity
      });
    }

    // Show appropriate notification
    const message = getViolationMessage(type);
    switch (violation.severity) {
      case 'critical':
        toast.error(`🚨 CRITICAL: ${message}`, {
          position: "top-center",
          autoClose: false,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: false,
          draggable: false,
        });
        break;
      case 'major':
        toast.warn(`⚠️ WARNING: ${message}`, {
          position: "top-center",
          autoClose: 8000,
        });
        break;
      case 'minor':
        if (securityLevel >= 2) {
          toast.info(`ℹ️ ${message}`, {
            position: "bottom-right",
            autoClose: 5000,
          });
        }
        break;
    }

    console.warn('🚨 AUDIO MONITORING VIOLATION:', violation);
  }, [examId, studentId, onViolation, securityLevel, audioData, microphonePermission, isInitialized]);

  // Get cooldown period
  const getCooldownPeriod = (type) => {
    switch (type) {
      case VIOLATION_TYPES.MULTIPLE_VOICES:
      case VIOLATION_TYPES.COMMUNICATION_DETECTED:
        return 2000;
      case VIOLATION_TYPES.MICROPHONE_ACCESS_DENIED:
      case VIOLATION_TYPES.MICROPHONE_DISCONNECTED:
        return 10000;
      case VIOLATION_TYPES.VOICE_DETECTED:
      case VIOLATION_TYPES.SUSPICIOUS_SOUND:
        return 3000;
      default:
        return 5000;
    }
  };

  // Get violation severity
  const getViolationSeverity = (type) => {
    switch (type) {
      case VIOLATION_TYPES.MULTIPLE_VOICES:
      case VIOLATION_TYPES.COMMUNICATION_DETECTED:
      case VIOLATION_TYPES.MICROPHONE_ACCESS_DENIED:
      case VIOLATION_TYPES.MICROPHONE_DISCONNECTED:
        return 'critical';
      case VIOLATION_TYPES.VOICE_DETECTED:
      case VIOLATION_TYPES.SUSPICIOUS_SOUND:
      case VIOLATION_TYPES.BACKGROUND_NOISE:
      case VIOLATION_TYPES.MICROPHONE_COVERED:
        return 'major';
      default:
        return 'minor';
    }
  };

  // Get violation message
  const getViolationMessage = (type) => {
    switch (type) {
      case VIOLATION_TYPES.VOICE_DETECTED:
        return 'Speaking detected! Please remain silent during the exam.';
      case VIOLATION_TYPES.MULTIPLE_VOICES:
        return 'Multiple voices detected! Only you should be present during the exam.';
      case VIOLATION_TYPES.SUSPICIOUS_SOUND:
        return 'Suspicious sound detected. Please minimize noise.';
      case VIOLATION_TYPES.BACKGROUND_NOISE:
        return 'High background noise detected. Please find a quieter location.';
      case VIOLATION_TYPES.MICROPHONE_COVERED:
        return 'Microphone appears to be covered, muted, or not working properly.';
      case VIOLATION_TYPES.MICROPHONE_ACCESS_DENIED:
        return 'Microphone access is required for this exam. Please grant microphone permission.';
      case VIOLATION_TYPES.MICROPHONE_DISCONNECTED:
        return 'Microphone disconnected! Please reconnect your microphone.';
      case VIOLATION_TYPES.COMMUNICATION_DETECTED:
        return 'Communication with another person detected.';
      case VIOLATION_TYPES.PHONE_RINGING:
        return 'Phone ringing detected. Please silence all devices.';
      default:
        return 'Audio monitoring violation detected.';
    }
  };

  // Initialize microphone with better error handling
  const initializeMicrophone = useCallback(async () => {
    try {
      updateStatus('initializing');
      setIsProcessing(true);
      
      console.log('🎤 Initializing microphone for audio monitoring...');
      
      // Test microphone availability first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (audioDevices.length === 0) {
        throw new Error('No microphone devices found');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          deviceId: audioDevices[0].deviceId
        }
      });
      
      setStream(mediaStream);
      setMicrophonePermission('granted');
      updateStatus('microphone_ready');
      
      // Initialize Web Audio API
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
      
      // Configure analyser
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Connect microphone to analyser
      microphoneRef.current.connect(analyserRef.current);
      
      // Initialize audio data array
      audioDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      setIsInitialized(true);
      updateStatus('active');
      startMonitoring();
      
      toast.success('🎤 Audio monitoring is now active!', {
        position: "bottom-right",
        autoClose: 3000,
      });
      
      // Monitor stream health
      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          console.warn('Microphone track ended');
          logViolation(VIOLATION_TYPES.MICROPHONE_DISCONNECTED, {
            reason: 'track_ended',
            trackState: track.readyState
          });
          updateStatus('error');
        };
        
        track.onmute = () => {
          console.warn('Microphone muted');
          logViolation(VIOLATION_TYPES.MICROPHONE_COVERED, {
            reason: 'track_muted',
            trackState: track.readyState
          });
        };
      });
      
    } catch (error) {
      console.error('Microphone initialization failed:', error);
      setMicrophonePermission('denied');
      updateStatus('error');
      
      logViolation(VIOLATION_TYPES.MICROPHONE_ACCESS_DENIED, {
        error: error.message,
        name: error.name,
        constraint: error.constraint
      });
      
      toast.error('🚨 EXAM BLOCKED: Microphone access is required to proceed!', {
        position: "top-center",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: false,
        draggable: false,
      });
      
    } finally {
      setIsProcessing(false);
    }
  }, [updateStatus, logViolation]);

  // Start monitoring with improved detection
  const startMonitoring = useCallback(() => {
    if (!isActive) return;
    
    const monitor = () => {
      if (!isActive || !analyserRef.current) {
        animationRef.current = requestAnimationFrame(monitor);
        return;
      }

      try {
        analyzeAudio();
        detectViolations();
      } catch (error) {
        console.error('Audio monitoring error:', error);
        updateStatus('warning');
        
        // Check if microphone is still working
        if (stream && stream.getTracks().length > 0) {
          const track = stream.getTracks()[0];
          if (!track.enabled || track.readyState !== 'live') {
            logViolation(VIOLATION_TYPES.MICROPHONE_DISCONNECTED, {
              trackEnabled: track.enabled,
              trackState: track.readyState,
              error: error.message
            });
          }
        }
      }

      animationRef.current = requestAnimationFrame(monitor);
    };

    monitor();
  }, [isActive, stream, logViolation, updateStatus]);

  // Improved audio analysis
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    analyserRef.current.getByteFrequencyData(audioDataRef.current);
    
    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < audioDataRef.current.length; i++) {
      sum += audioDataRef.current[i] * audioDataRef.current[i];
    }
    const volume = Math.sqrt(sum / audioDataRef.current.length) / 255;
    
    // Check if microphone is working
    const microphoneWorking = volume > 0.001 || audioDataRef.current.some(val => val > 10);
    
    // Voice detection
    const isVoiceDetected = voiceDetectionEnabled ? detectVoice(audioDataRef.current, volume) : false;
    
    // Background noise calculation
    const backgroundNoise = backgroundNoiseDetection ? calculateBackgroundNoise(audioDataRef.current) : 0;
    
    // Suspicious activity detection
    const suspiciousActivity = suspiciousSoundDetection ? detectSuspiciousAudio(audioDataRef.current) : false;
    
    const newAudioData = {
      volume: Math.round(volume * 100) / 100,
      frequency: getDominantFrequency(audioDataRef.current),
      isVoiceDetected,
      backgroundNoise: Math.round(backgroundNoise * 100) / 100,
      suspiciousActivity,
      voiceCount: isVoiceDetected ? 1 : 0,
      silenceLevel: volume < 0.005 ? 1 : 0,
      microphoneWorking
    };
    
    setAudioData(newAudioData);
    
    // Update history
    audioHistoryRef.current.push(newAudioData);
    if (audioHistoryRef.current.length > 100) {
      audioHistoryRef.current.shift();
    }
    
  }, [voiceDetectionEnabled, backgroundNoiseDetection, suspiciousSoundDetection]);

  // Detect human voice
  const detectVoice = (frequencyData, volume) => {
    if (volume < 0.1) return false;
    
    // Check voice frequency range (85-300 Hz fundamental)
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const voiceStart = Math.floor(85 * frequencyData.length / (sampleRate / 2));
    const voiceEnd = Math.floor(300 * frequencyData.length / (sampleRate / 2));
    
    let voiceEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const energy = frequencyData[i] * frequencyData[i];
      totalEnergy += energy;
      
      if (i >= voiceStart && i <= voiceEnd) {
        voiceEnergy += energy;
      }
    }
    
    const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
    return voiceRatio > 0.3 && volume > 0.15;
  };

  // Calculate background noise
  const calculateBackgroundNoise = (frequencyData) => {
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const voiceStart = Math.floor(85 * frequencyData.length / (sampleRate / 2));
    const voiceEnd = Math.floor(300 * frequencyData.length / (sampleRate / 2));
    
    let backgroundEnergy = 0;
    let sampleCount = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (i < voiceStart || i > voiceEnd) {
        backgroundEnergy += frequencyData[i];
        sampleCount++;
      }
    }
    
    return sampleCount > 0 ? (backgroundEnergy / sampleCount) / 255 : 0;
  };

  // Detect suspicious audio
  const detectSuspiciousAudio = (frequencyData) => {
    const dominantFreq = getDominantFrequency(frequencyData);
    
    // Phone ring detection (400-800 Hz)
    if (dominantFreq >= 400 && dominantFreq <= 800) {
      return 'phone_ring';
    }
    
    return false;
  };

  // Get dominant frequency
  const getDominantFrequency = (frequencyData) => {
    let maxAmplitude = 0;
    let dominantFrequency = 0;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxAmplitude) {
        maxAmplitude = frequencyData[i];
        dominantFrequency = i * (sampleRate / 2) / frequencyData.length;
      }
    }
    
    return Math.round(dominantFrequency);
  };

  // Detect violations with improved logic
  const detectViolations = useCallback(() => {
    const { isVoiceDetected, backgroundNoise, suspiciousActivity, volume, microphoneWorking } = audioData;
    
    // Check microphone health
    if (!microphoneWorking && audioHistoryRef.current.length > 20) {
      const recentlyNotWorking = audioHistoryRef.current.slice(-20).every(data => !data.microphoneWorking);
      if (recentlyNotWorking) {
        logViolation(VIOLATION_TYPES.MICROPHONE_COVERED, {
          reason: 'no_audio_detected',
          duration: 2000
        });
      }
    }
    
    // Voice detection
    if (isVoiceDetected && voiceDetectionEnabled) {
      logViolation(VIOLATION_TYPES.VOICE_DETECTED, {
        volume,
        timestamp: Date.now()
      });
    }
    
    // Background noise
    if (backgroundNoise > 0.4 && backgroundNoiseDetection) {
      logViolation(VIOLATION_TYPES.BACKGROUND_NOISE, {
        level: backgroundNoise,
        threshold: 0.4
      });
    }
    
    // Suspicious activity
    if (suspiciousActivity === 'phone_ring') {
      logViolation(VIOLATION_TYPES.PHONE_RINGING, {
        detected: true,
        timestamp: Date.now()
      });
    }
    
  }, [audioData, logViolation, voiceDetectionEnabled, backgroundNoiseDetection]);

  // Initialize when active
  useEffect(() => {
    if (isActive && !isInitialized && microphonePermission === 'prompt') {
      initializeMicrophone();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isInitialized, microphonePermission, initializeMicrophone]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream]);

  // Update parent status
  useEffect(() => {
    if (microphonePermission === 'denied') {
      updateStatus('error');
    } else if (microphonePermission === 'granted' && isInitialized) {
      updateStatus('active');
    }
  }, [microphonePermission, isInitialized, updateStatus]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="audio-monitoring-container">
      {/* Microphone permission prompt */}
      {microphonePermission === 'prompt' && (
        <div className="microphone-permission-prompt">
          <div className="permission-content">
            <div className="permission-icon">🎤</div>
            <h3>Microphone Access Required</h3>
            <p>This exam requires microphone access for audio monitoring and security purposes.</p>
            <button 
              className="permission-btn" 
              onClick={initializeMicrophone}
              disabled={isProcessing}
            >
              {isProcessing ? 'Requesting Access...' : 'Grant Microphone Access'}
            </button>
            <div className="permission-note">
              <small>⚠️ Microphone access is mandatory to proceed with the exam</small>
            </div>
          </div>
        </div>
      )}
      
      {/* Microphone access denied */}
      {microphonePermission === 'denied' && (
        <div className="microphone-denied">
          <div className="denied-content">
            <div className="denied-icon">❌</div>
            <h3>Microphone Access Denied</h3>
            <p>Microphone access is required to proceed with the exam. Please enable microphone access.</p>
            <div className="denied-instructions">
              <h4>How to enable microphone access:</h4>
              <ol>
                <li>Click the microphone icon in your browser's address bar</li>
                <li>Select "Allow" for microphone access</li>
                <li>Refresh the page if needed</li>
              </ol>
            </div>
            <button className="retry-btn" onClick={initializeMicrophone}>
              Retry Microphone Access
            </button>
          </div>
        </div>
      )}
      
      {/* Audio status display */}
      {isInitialized && microphonePermission === 'granted' && (
        <div className="audio-status-display">
          <div className={`audio-indicator ${audioData.microphoneWorking ? 'working' : 'not-working'}`}>
            <div className="audio-icon">
              {audioData.microphoneWorking ? '🎤' : '🚫'}
            </div>
            <div className="audio-info">
              <div className="audio-status">
                {audioData.microphoneWorking ? 'Microphone Active' : 'Microphone Issue'}
              </div>
              <div className="volume-bar">
                <div 
                  className="volume-fill"
                  style={{ width: `${Math.min(audioData.volume * 100, 100)}%` }}
                />
              </div>
              <div className="audio-details">
                <span>Volume: {Math.round(audioData.volume * 100)}%</span>
                {audioData.isVoiceDetected && (
                  <span className="voice-alert">🗣️ Voice Detected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioMonitoring;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import './AIProctoring.css';

const AIProctoring = ({ examId, onViolationDetected, onInitialized, isEnabled = true }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastSnapshotRef = useRef(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState({
    camera: false,
    microphone: false
  });
  const [isRecording, setIsRecording] = useState(false);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState({
    facesDetected: 0,
    confidence: 0,
    lastDetection: null
  });
  const [audioLevels, setAudioLevels] = useState({
    volume: 0,
    suspiciousNoise: false,
    silenceDuration: 0
  });
  const [violations, setViolations] = useState([]);
  const [settings, setSettings] = useState({
    faceRecognitionEnabled: true,
    audioMonitoringEnabled: true,
    snapshotInterval: 3000, // 3 seconds
    suspiciousNoiseThreshold: 0.7,
    silenceThreshold: 30000, // 30 seconds
    multipleFaceThreshold: 2,
    confidenceThreshold: 0.65
  });

  useEffect(() => {
    if (isEnabled) {
      initializeProctoring();
    }
    return () => {
      cleanup();
    };
  }, [isEnabled]);

  const initializeProctoring = async () => {
    try {
      // Request camera and microphone permissions
      await requestPermissions();
      
      // Initialize media streams
      await setupMediaStreams();
      
      // Initialize face detection
      await initializeFaceDetection();
      
      // Initialize audio analysis
      initializeAudioAnalysis();
      
      // Start monitoring
      startMonitoring();
      
      setIsInitialized(true);
      if (onInitialized) onInitialized(true);
      
      toast.success('AI Proctoring initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize AI proctoring:', error);
      toast.error('Failed to initialize proctoring. Please check camera and microphone permissions.');
      if (onInitialized) onInitialized(false);
      recordViolation('initialization_failed', 'AI proctoring initialization failed', 'critical');
    }
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      
      setPermissionsGranted({
        camera: true,
        microphone: true
      });

      return stream;
    } catch (error) {
      console.error('Permission denied:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Camera and microphone permissions are required for this exam');
        recordViolation('permissions_denied', 'User denied camera/microphone permissions', 'critical');
      } else if (error.name === 'NotFoundError') {
        toast.error('Camera or microphone not found');
        recordViolation('device_not_found', 'Camera or microphone device not found', 'high');
      } else {
        toast.error('Failed to access camera and microphone');
        recordViolation('device_access_failed', 'Failed to access media devices', 'high');
      }
      
      throw error;
    }
  };

  const setupMediaStreams = async () => {
    if (!streamRef.current || !videoRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.onloadedmetadata = () => {
      videoRef.current.play();
      setIsRecording(true);
    };
  };

  const initializeFaceDetection = async () => {
    // In a production environment, you would load a face detection library
    // like face-api.js, MediaPipe, or TensorFlow.js
    // For now, we'll simulate face detection
    console.log('Face detection initialized');
  };

  const initializeAudioAnalysis = () => {
    if (!streamRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      source.connect(analyserRef.current);
      
      console.log('Audio analysis initialized');
    } catch (error) {
      console.error('Failed to initialize audio analysis:', error);
      recordViolation('audio_init_failed', 'Audio analysis initialization failed', 'medium');
    }
  };

  const startMonitoring = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      if (settings.faceRecognitionEnabled) {
        performFaceDetection();
      }
      if (settings.audioMonitoringEnabled) {
        analyzeAudio();
      }
    }, settings.snapshotInterval);
  };

  const performFaceDetection = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for analysis
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    try {
      // Simulate face detection (in production, use actual face detection)
      const detectionResult = await simulateFaceDetection(imageData);
      
      setFaceDetectionStatus({
        facesDetected: detectionResult.faces,
        confidence: detectionResult.confidence,
        lastDetection: new Date()
      });

      // Check for violations
      if (detectionResult.faces === 0) {
        recordViolation('no_face_detected', 'No face visible in camera', 'high');
      } else if (detectionResult.faces > settings.multipleFaceThreshold) {
        recordViolation('multiple_faces', `${detectionResult.faces} faces detected`, 'high');
      } else if (detectionResult.confidence < settings.confidenceThreshold) {
        recordViolation('face_recognition_low_confidence', `Low face recognition confidence: ${detectionResult.confidence}`, 'medium');
      }

      // Send snapshot to backend
      if (detectionResult.faces > 0) {
        await sendSnapshot(imageData, detectionResult);
      }

    } catch (error) {
      console.error('Face detection error:', error);
      recordViolation('face_detection_error', 'Face detection processing error', 'medium');
    }
  };

  const simulateFaceDetection = async (imageData) => {
    // This simulates face detection results
    // In production, replace with actual face detection library
    return new Promise((resolve) => {
      setTimeout(() => {
        const faces = Math.random() > 0.1 ? 1 : Math.random() > 0.8 ? 0 : Math.random() > 0.95 ? 2 : 1;
        const confidence = Math.random() * 0.3 + 0.7; // Random confidence between 0.7-1.0
        
        resolve({ faces, confidence });
      }, 100);
    });
  };

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const averageVolume = sum / dataArrayRef.current.length / 255; // Normalize to 0-1

    // Detect suspicious audio patterns
    const isSuspicious = averageVolume > settings.suspiciousNoiseThreshold;
    const isSilent = averageVolume < 0.01;

    setAudioLevels(prev => ({
      volume: averageVolume,
      suspiciousNoise: isSuspicious,
      silenceDuration: isSilent ? prev.silenceDuration + settings.snapshotInterval : 0
    }));

    // Check for violations
    if (isSuspicious) {
      recordViolation('suspicious_audio', `High audio levels detected (${Math.round(averageVolume * 100)}%)`, 'medium');
    }

    if (audioLevels.silenceDuration > settings.silenceThreshold) {
      recordViolation('prolonged_silence', `No audio detected for ${Math.round(audioLevels.silenceDuration / 1000)} seconds`, 'low');
    }

    // Analyze frequency spectrum for voice patterns
    analyzeFrequencySpectrum();
  };

  const analyzeFrequencySpectrum = () => {
    if (!dataArrayRef.current) return;

    // Analyze different frequency ranges
    const lowFreq = dataArrayRef.current.slice(0, 10); // 0-1000Hz (voice fundamentals)
    const midFreq = dataArrayRef.current.slice(10, 50); // 1000-5000Hz (voice harmonics)
    const highFreq = dataArrayRef.current.slice(50, 100); // 5000-10000Hz (consonants)

    const lowAvg = lowFreq.reduce((a, b) => a + b, 0) / lowFreq.length;
    const midAvg = midFreq.reduce((a, b) => a + b, 0) / midFreq.length;
    const highAvg = highFreq.reduce((a, b) => a + b, 0) / highFreq.length;

    // Detect potential voice patterns vs background noise
    const voicePattern = midAvg > lowAvg && midAvg > highAvg;
    const backgroundNoise = lowAvg > midAvg && lowAvg > highAvg;

    if (voicePattern && midAvg > 100) {
      recordViolation('voice_detected', 'Voice conversation detected', 'medium');
    }
  };

  const sendSnapshot = async (imageData, detectionResult) => {
    try {
      await fetch('/api/v1/proctoring/face-snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          examId,
          image: imageData,
          facesDetected: detectionResult.faces,
          confidence: detectionResult.confidence,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to send snapshot:', error);
    }
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

      if (onViolationDetected) {
        onViolationDetected(violation);
      }

      if (severity === 'high' || severity === 'critical') {
        toast.warning(`Proctoring Alert: ${description}`);
      }

    } catch (error) {
      console.error('Failed to record violation:', error);
    }
  };

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsRecording(false);
    setIsInitialized(false);
  };

  const getStatusColor = (value, good = true) => {
    if (good) {
      return value ? '#28a745' : '#dc3545';
    } else {
      return value ? '#dc3545' : '#28a745';
    }
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="ai-proctoring-container">
      {/* Video Feed */}
      <div className="video-container">
        <video
          ref={videoRef}
          className="proctoring-video"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="proctoring-canvas"
          style={{ display: 'none' }}
        />
        
        {/* Status Overlay */}
        <div className="video-overlay">
          <div className="status-indicators">
            <div 
              className="status-dot"
              style={{ backgroundColor: getStatusColor(isRecording) }}
              title={isRecording ? 'Recording' : 'Not Recording'}
            />
            <span className="status-text">
              {isRecording ? 'Live Monitoring' : 'Offline'}
            </span>
          </div>
          
          {faceDetectionStatus.facesDetected > 0 && (
            <div className="face-indicator">
              <span className="face-count">
                👤 {faceDetectionStatus.facesDetected} Face{faceDetectionStatus.facesDetected !== 1 ? 's' : ''}
              </span>
              <span className="confidence">
                {Math.round(faceDetectionStatus.confidence * 100)}% Confidence
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="proctoring-controls">
        <div className="monitoring-stats">
          <div className="stat-item">
            <span className="stat-label">Camera</span>
            <span 
              className="stat-value"
              style={{ color: getStatusColor(permissionsGranted.camera) }}
            >
              {permissionsGranted.camera ? '✓ Active' : '✗ Inactive'}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Microphone</span>
            <span 
              className="stat-value"
              style={{ color: getStatusColor(permissionsGranted.microphone) }}
            >
              {permissionsGranted.microphone ? '✓ Active' : '✗ Inactive'}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Faces</span>
            <span 
              className="stat-value"
              style={{ color: faceDetectionStatus.facesDetected === 1 ? '#28a745' : '#dc3545' }}
            >
              {faceDetectionStatus.facesDetected}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Audio Level</span>
            <span className="stat-value">
              <div className="audio-meter">
                <div 
                  className="audio-level"
                  style={{ 
                    width: `${Math.min(audioLevels.volume * 100, 100)}%`,
                    backgroundColor: audioLevels.suspiciousNoise ? '#dc3545' : '#28a745'
                  }}
                />
              </div>
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Violations</span>
            <span 
              className="stat-value"
              style={{ color: violations.length > 0 ? '#dc3545' : '#28a745' }}
            >
              {violations.length}
            </span>
          </div>
        </div>
      </div>

      {/* Initialization Error */}
      {!isInitialized && isEnabled && (
        <div className="initialization-error">
          <div className="error-content">
            <h3>🔧 Initializing AI Proctoring</h3>
            <p>Please grant camera and microphone permissions to continue.</p>
            <button onClick={initializeProctoring} className="btn btn-primary">
              Retry Initialization
            </button>
          </div>
        </div>
      )}

      {/* Recent Violations (Development Mode) */}
      {process.env.NODE_ENV === 'development' && violations.length > 0 && (
        <div className="violations-debug">
          <h4>Recent Violations:</h4>
          {violations.slice(-5).map((violation, index) => (
            <div key={index} className={`violation-debug ${violation.severity}`}>
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

export default AIProctoring;
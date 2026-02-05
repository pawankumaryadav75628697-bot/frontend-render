import cv2
import numpy as np
import dlib
import face_recognition
import base64
import json
import sys
import os
import time
from scipy.spatial import distance as dist
from threading import Thread
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIProctoringService:
    def __init__(self):
        """Initialize the AI Proctoring Service with face detection and eye tracking capabilities."""
        self.face_detector = dlib.get_frontal_face_detector()
        
        # Initialize face landmarks predictor
        predictor_path = os.path.join(os.path.dirname(__file__), 'models', 'shape_predictor_68_face_landmarks.dat')
        if os.path.exists(predictor_path):
            self.predictor = dlib.shape_predictor(predictor_path)
        else:
            logger.warning("Face landmarks model not found. Eye tracking will be limited.")
            self.predictor = None
            
        # Eye landmarks indices
        self.LEFT_EYE_START = 36
        self.LEFT_EYE_END = 42
        self.RIGHT_EYE_START = 42  
        self.RIGHT_EYE_END = 48
        
        # Initialize parameters
        self.EYE_AR_THRESHOLD = 0.25
        self.EYE_AR_CONSECUTIVE_FRAMES = 16
        self.GAZE_THRESHOLD = 0.3
        
        # State tracking
        self.eye_closed_counter = 0
        self.total_frames = 0
        self.valid_frames = 0
        self.face_detected_frames = 0
        
    def eye_aspect_ratio(self, eye):
        """Calculate eye aspect ratio to detect blinks and eye closure."""
        # Vertical eye landmarks
        A = dist.euclidean(eye[1], eye[5])
        B = dist.euclidean(eye[2], eye[4])
        # Horizontal eye landmarks  
        C = dist.euclidean(eye[0], eye[3])
        
        # Eye aspect ratio
        ear = (A + B) / (2.0 * C)
        return ear
        
    def get_eye_center(self, eye_landmarks):
        """Calculate the center point of an eye."""
        x_coords = [point[0] for point in eye_landmarks]
        y_coords = [point[1] for point in eye_landmarks]
        center_x = sum(x_coords) / len(x_coords)
        center_y = sum(y_coords) / len(y_coords)
        return (int(center_x), int(center_y))
        
    def estimate_gaze_direction(self, left_eye_center, right_eye_center, face_center):
        """Estimate gaze direction based on eye positions relative to face center."""
        eye_center_avg = (
            (left_eye_center[0] + right_eye_center[0]) / 2,
            (left_eye_center[1] + right_eye_center[1]) / 2
        )
        
        # Calculate gaze vector
        gaze_x = eye_center_avg[0] - face_center[0]
        gaze_y = eye_center_avg[1] - face_center[1]
        
        # Normalize
        magnitude = np.sqrt(gaze_x**2 + gaze_y**2)
        if magnitude > 0:
            gaze_x /= magnitude
            gaze_y /= magnitude
            
        return gaze_x, gaze_y
        
    def analyze_frame(self, frame_data):
        """
        Analyze a single frame for face detection and eye tracking.
        
        Args:
            frame_data (str): Base64 encoded image data
            
        Returns:
            dict: Analysis results including violations and metrics
        """
        try:
            # Decode base64 image
            image_data = base64.b64decode(frame_data.split(',')[1])
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return {
                    'success': False,
                    'error': 'Failed to decode image'
                }
            
            self.total_frames += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_detector(gray)
            
            analysis_result = {
                'success': True,
                'timestamp': time.time(),
                'violations': [],
                'face_detected': len(faces) > 0,
                'face_count': len(faces),
                'eye_data': {},
                'trust_score': 1.0,
                'metadata': {}
            }
            
            # Check for face violations
            if len(faces) == 0:
                analysis_result['violations'].append({
                    'type': 'face_not_detected',
                    'severity': 'high',
                    'description': 'No face detected in the frame',
                    'confidence': 0.9
                })
                analysis_result['trust_score'] -= 0.3
                
            elif len(faces) > 1:
                analysis_result['violations'].append({
                    'type': 'multiple_faces',
                    'severity': 'critical',
                    'description': f'Multiple faces detected: {len(faces)}',
                    'confidence': 0.95
                })
                analysis_result['trust_score'] -= 0.5
                
            # Analyze the primary face (largest face)
            if len(faces) > 0:
                self.face_detected_frames += 1
                self.valid_frames += 1
                
                # Get the largest face
                face = max(faces, key=lambda rect: rect.width() * rect.height())
                
                # Face bounding box
                x, y, w, h = face.left(), face.top(), face.width(), face.height()
                analysis_result['metadata']['face_bounds'] = {
                    'x': x, 'y': y, 'width': w, 'height': h
                }
                
                # Face center
                face_center = (x + w//2, y + h//2)
                
                # Analyze eye tracking if predictor is available
                if self.predictor is not None:
                    landmarks = self.predictor(gray, face)
                    
                    # Extract eye coordinates
                    left_eye = []
                    right_eye = []
                    
                    for n in range(self.LEFT_EYE_START, self.LEFT_EYE_END):
                        point = landmarks.part(n)
                        left_eye.append((point.x, point.y))
                        
                    for n in range(self.RIGHT_EYE_START, self.RIGHT_EYE_END):
                        point = landmarks.part(n)
                        right_eye.append((point.x, point.y))
                    
                    # Calculate eye aspect ratios
                    left_ear = self.eye_aspect_ratio(left_eye)
                    right_ear = self.eye_aspect_ratio(right_eye)
                    avg_ear = (left_ear + right_ear) / 2.0
                    
                    # Get eye centers
                    left_eye_center = self.get_eye_center(left_eye)
                    right_eye_center = self.get_eye_center(right_eye)
                    
                    analysis_result['eye_data'] = {
                        'left_ear': left_ear,
                        'right_ear': right_ear,
                        'avg_ear': avg_ear,
                        'left_eye_center': left_eye_center,
                        'right_eye_center': right_eye_center
                    }
                    
                    analysis_result['metadata']['eye_positions'] = {
                        'left_eye': {'x': left_eye_center[0], 'y': left_eye_center[1]},
                        'right_eye': {'x': right_eye_center[0], 'y': right_eye_center[1]}
                    }
                    
                    # Estimate gaze direction
                    gaze_x, gaze_y = self.estimate_gaze_direction(
                        left_eye_center, right_eye_center, face_center
                    )
                    
                    analysis_result['metadata']['gaze_direction'] = {
                        'x': float(gaze_x), 'y': float(gaze_y), 'z': 0.0
                    }
                    
                    # Check for suspicious eye behavior
                    if avg_ear < self.EYE_AR_THRESHOLD:
                        self.eye_closed_counter += 1
                        if self.eye_closed_counter >= self.EYE_AR_CONSECUTIVE_FRAMES:
                            analysis_result['violations'].append({
                                'type': 'suspicious_eye_movement',
                                'severity': 'medium',
                                'description': 'Eyes closed or looking away for extended period',
                                'confidence': 0.8
                            })
                            analysis_result['trust_score'] -= 0.2
                    else:
                        self.eye_closed_counter = 0
                    
                    # Check gaze direction (looking away)
                    gaze_magnitude = np.sqrt(gaze_x**2 + gaze_y**2)
                    if gaze_magnitude > self.GAZE_THRESHOLD:
                        analysis_result['violations'].append({
                            'type': 'looking_away',
                            'severity': 'medium',
                            'description': 'Student appears to be looking away from screen',
                            'confidence': min(0.9, gaze_magnitude * 2)
                        })
                        analysis_result['trust_score'] -= 0.15
                
                # Check face position (too close, too far, off-center)
                frame_height, frame_width = frame.shape[:2]
                face_area = w * h
                frame_area = frame_width * frame_height
                face_ratio = face_area / frame_area
                
                if face_ratio < 0.05:  # Face too small (too far)
                    analysis_result['violations'].append({
                        'type': 'suspicious_eye_movement',
                        'severity': 'low',
                        'description': 'Student appears to be too far from camera',
                        'confidence': 0.7
                    })
                    analysis_result['trust_score'] -= 0.1
                    
                elif face_ratio > 0.4:  # Face too large (too close)
                    analysis_result['violations'].append({
                        'type': 'suspicious_eye_movement',
                        'severity': 'low',
                        'description': 'Student appears to be too close to camera',
                        'confidence': 0.7
                    })
                    analysis_result['trust_score'] -= 0.1
            
            # Ensure trust score is within bounds
            analysis_result['trust_score'] = max(0.0, min(1.0, analysis_result['trust_score']))
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Error analyzing frame: {str(e)}")
            return {
                'success': False,
                'error': f'Frame analysis failed: {str(e)}',
                'violations': [{
                    'type': 'unauthorized_device',
                    'severity': 'medium',
                    'description': 'Technical error during analysis',
                    'confidence': 0.5
                }]
            }
    
    def get_session_statistics(self):
        """Get overall session statistics."""
        face_detection_rate = (
            self.face_detected_frames / self.total_frames 
            if self.total_frames > 0 else 0
        )
        
        return {
            'total_frames': self.total_frames,
            'valid_frames': self.valid_frames,
            'face_detected_frames': self.face_detected_frames,
            'face_detection_rate': face_detection_rate,
            'processing_accuracy': self.valid_frames / self.total_frames if self.total_frames > 0 else 0
        }

def main():
    """Main function to handle requests from Node.js backend."""
    try:
        # Initialize the service
        service = AIProctoringService()
        
        # Read input from stdin (sent from Node.js)
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({'error': 'No input data provided'}))
            return
            
        # Parse JSON input
        request_data = json.loads(input_data)
        
        if request_data.get('action') == 'analyze_frame':
            frame_data = request_data.get('frame_data')
            if not frame_data:
                print(json.dumps({'error': 'No frame data provided'}))
                return
                
            # Analyze the frame
            result = service.analyze_frame(frame_data)
            
            # Add session statistics
            stats = service.get_session_statistics()
            result['session_stats'] = stats
            
            print(json.dumps(result))
            
        elif request_data.get('action') == 'get_stats':
            stats = service.get_session_statistics()
            print(json.dumps({'success': True, 'stats': stats}))
            
        else:
            print(json.dumps({'error': 'Invalid action'}))
            
    except Exception as e:
        error_response = {
            'success': False,
            'error': f'Service error: {str(e)}'
        }
        print(json.dumps(error_response))

if __name__ == "__main__":
    main()


    
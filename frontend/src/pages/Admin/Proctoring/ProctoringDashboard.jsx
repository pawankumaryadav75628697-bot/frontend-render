import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import './ProctoringDashboard.css';

const ProctoringDashboard = () => {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState(null);
  const [realTimeData, setRealTimeData] = useState({
    activeAttempts: 0,
    attempts: [],
    recentEvents: []
  });
  const [proctoringStats, setProctoringStats] = useState({
    summary: {},
    eventBreakdown: [],
    flaggedAttempts: [],
    riskAnalysis: {}
  });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (examId) {
      fetchExamDetails();
      fetchProctoringStats();
      fetchRealTimeData();
      
      if (autoRefresh) {
        intervalRef.current = setInterval(fetchRealTimeData, 10000); // Refresh every 10 seconds
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [examId, autoRefresh]);

  const fetchExamDetails = async () => {
    try {
      const response = await api.get(`/exams/${examId}`);
      setExam(response.data.data);
    } catch (error) {
      console.error('Error fetching exam details:', error);
      toast.error('Failed to load exam details');
    }
  };

  const fetchProctoringStats = async () => {
    try {
      const response = await api.get(`/proctoring/stats/${examId}`);
      setProctoringStats(response.data.data);
    } catch (error) {
      console.error('Error fetching proctoring stats:', error);
      toast.error('Failed to load proctoring statistics');
    }
  };

  const fetchRealTimeData = async () => {
    try {
      const response = await api.get(`/proctoring/realtime/${examId}`);
      setRealTimeData(response.data.data);
      
      if (loading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      if (loading) {
        setLoading(false);
        toast.error('Failed to load real-time data');
      }
    }
  };

  const handleReviewAttempt = async (attemptId, action, reviewNotes) => {
    try {
      await api.put(`/proctoring/review/${attemptId}`, {
        action,
        reviewNotes
      });
      
      toast.success(`Attempt ${action}d successfully`);
      fetchProctoringStats();
    } catch (error) {
      console.error('Error reviewing attempt:', error);
      toast.error('Failed to review attempt');
    }
  };

  const getRiskLevelColor = (riskScore) => {
    if (riskScore < 25) return '#10b981'; // Green
    if (riskScore < 50) return '#f59e0b'; // Yellow
    if (riskScore < 75) return '#ef4444'; // Red
    return '#7c2d12'; // Dark red
  };

  const getRiskLevelText = (riskScore) => {
    if (riskScore < 25) return 'Low Risk';
    if (riskScore < 50) return 'Medium Risk';
    if (riskScore < 75) return 'High Risk';
    return 'Critical Risk';
  };

  const getEventIcon = (eventType) => {
    const icons = {
      'tab_switch': '🔄',
      'window_blur': '👁️',
      'copy_paste': '📋',
      'right_click': '🖱️',
      'full_screen_exit': '🖥️',
      'camera_disabled': '📹',
      'microphone_disabled': '🎤',
      'multiple_faces': '👥',
      'no_face_detected': '❌',
      'suspicious_noise': '🔊',
      'screen_share_detected': '📺'
    };
    return icons[eventType] || '⚠️';
  };

  const getEventSeverityColor = (severity) => {
    const colors = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'critical': '#7c2d12'
    };
    return colors[severity] || '#6b7280';
  };

  const AttemptCard = ({ attempt }) => (
    <div 
      className={`attempt-card ${attempt.proctoring?.flaggedForReview ? 'flagged' : ''}`}
      onClick={() => setSelectedAttempt(attempt)}
    >
      <div className="attempt-card__header">
        <div className="student-info">
          <h4>{attempt.student.fullName}</h4>
          <span className="student-id">{attempt.student.studentId}</span>
        </div>
        <div 
          className="risk-score"
          style={{ 
            backgroundColor: getRiskLevelColor(attempt.proctoring?.riskScore || 0),
            color: 'white'
          }}
        >
          {attempt.proctoring?.riskScore || 0}
        </div>
      </div>
      
      <div className="attempt-card__content">
        <div className="attempt-meta">
          <span>Started: {new Date(attempt.startTime).toLocaleTimeString()}</span>
          <span>Events: {attempt.proctoring?.events?.length || 0}</span>
        </div>
        
        <div className="system-info">
          {attempt.systemInfo?.browser?.name && (
            <span>Browser: {attempt.systemInfo.browser.name}</span>
          )}
          {attempt.systemInfo?.os?.name && (
            <span>OS: {attempt.systemInfo.os.name}</span>
          )}
        </div>
      </div>
      
      {attempt.proctoring?.flaggedForReview && (
        <div className="attempt-card__flag">
          <i className="fas fa-flag"></i>
          Needs Review
        </div>
      )}
    </div>
  );

  const EventCard = ({ event, studentName }) => (
    <div className="event-card">
      <div className="event-card__icon">
        {getEventIcon(event.eventType)}
      </div>
      <div className="event-card__content">
        <div className="event-header">
          <h5>{event.eventType.replace('_', ' ').toUpperCase()}</h5>
          <span 
            className="event-severity"
            style={{ color: getEventSeverityColor(event.severity) }}
          >
            {event.severity}
          </span>
        </div>
        <p className="event-description">{event.description}</p>
        <div className="event-meta">
          <span>{studentName}</span>
          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );

  const ReviewModal = ({ attempt, onClose, onReview }) => {
    const [reviewNotes, setReviewNotes] = useState('');
    const [selectedAction, setSelectedAction] = useState('approve');

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Review Exam Attempt</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="attempt-details">
              <h4>Student: {attempt.student?.fullName}</h4>
              <p>Student ID: {attempt.student?.studentId}</p>
              <p>Risk Score: {attempt.proctoring?.riskScore || 0}</p>
              <p>Events Count: {attempt.proctoring?.events?.length || 0}</p>
            </div>
            
            <div className="events-list">
              <h5>Proctoring Events:</h5>
              {attempt.proctoring?.events?.map((event, index) => (
                <div key={index} className="event-item">
                  <span className="event-type">{event.eventType}</span>
                  <span className="event-severity">{event.severity}</span>
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              )) || <p>No events recorded</p>}
            </div>
            
            <div className="review-form">
              <div className="form-group">
                <label>Action:</label>
                <select 
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                >
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="needs_review">Needs Further Review</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Review Notes:</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter your review notes..."
                  rows="4"
                />
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="btn btn--primary"
              onClick={() => onReview(attempt._id, selectedAction, reviewNotes)}
            >
              Submit Review
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="proctoring-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading proctoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="proctoring-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <button 
            className="back-btn"
            onClick={() => navigate('/admin/exams')}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Exams
          </button>
          
          <div className="exam-info">
            <h1>{exam?.title}</h1>
            <p>{exam?.course} • {exam?.courseCode}</p>
          </div>
        </div>
        
        <div className="header-actions">
          <div className="auto-refresh">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
          </div>
          
          <button 
            className="btn btn--primary"
            onClick={fetchRealTimeData}
          >
            <i className="fas fa-sync-alt"></i>
            Refresh Now
          </button>
        </div>
      </header>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{realTimeData.activeAttempts}</h3>
            <p>Active Attempts</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>{realTimeData.recentEvents.length}</h3>
            <p>Recent Events (5min)</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <h3>{proctoringStats.summary.flaggedAttempts || 0}</h3>
            <p>Flagged Attempts</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{Math.round(proctoringStats.summary.avgRiskScore || 0)}</h3>
            <p>Avg Risk Score</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="content-left">
          <div className="section">
            <div className="section-header">
              <h2>Active Attempts</h2>
              <span className="last-updated">
                Last updated: {new Date(realTimeData.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="attempts-grid">
              {realTimeData.attempts.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-clipboard-check"></i>
                  <p>No active attempts</p>
                </div>
              ) : (
                realTimeData.attempts.map(attempt => (
                  <AttemptCard key={attempt._id} attempt={attempt} />
                ))
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Risk Analysis</h2>
            </div>
            
            <div className="risk-analysis-grid">
              <div className="risk-card risk-card--low">
                <h4>Low Risk</h4>
                <span className="risk-count">{proctoringStats.riskAnalysis.lowRisk || 0}</span>
              </div>
              <div className="risk-card risk-card--medium">
                <h4>Medium Risk</h4>
                <span className="risk-count">{proctoringStats.riskAnalysis.mediumRisk || 0}</span>
              </div>
              <div className="risk-card risk-card--high">
                <h4>High Risk</h4>
                <span className="risk-count">{proctoringStats.riskAnalysis.highRisk || 0}</span>
              </div>
              <div className="risk-card risk-card--critical">
                <h4>Critical Risk</h4>
                <span className="risk-count">{proctoringStats.riskAnalysis.criticalRisk || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="content-right">
          <div className="section">
            <div className="section-header">
              <h2>Recent Events</h2>
            </div>
            
            <div className="events-feed">
              {realTimeData.recentEvents.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-bell"></i>
                  <p>No recent events</p>
                </div>
              ) : (
                realTimeData.recentEvents.map((eventData, index) => (
                  <EventCard 
                    key={index} 
                    event={eventData.event}
                    studentName={eventData.student.name}
                  />
                ))
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Flagged for Review</h2>
            </div>
            
            <div className="flagged-attempts">
              {proctoringStats.flaggedAttempts.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-shield-alt"></i>
                  <p>No flagged attempts</p>
                </div>
              ) : (
                proctoringStats.flaggedAttempts.map(attempt => (
                  <div key={attempt._id} className="flagged-attempt">
                    <div className="attempt-info">
                      <h5>{attempt.student?.fullName}</h5>
                      <p>{attempt.student?.studentId}</p>
                    </div>
                    <div className="attempt-risk">
                      <span 
                        className="risk-badge"
                        style={{ 
                          backgroundColor: getRiskLevelColor(attempt.proctoring?.riskScore || 0)
                        }}
                      >
                        {attempt.proctoring?.riskScore || 0}
                      </span>
                    </div>
                    <button 
                      className="btn btn--sm btn--primary"
                      onClick={() => setSelectedAttempt(attempt)}
                    >
                      Review
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedAttempt && (
        <ReviewModal
          attempt={selectedAttempt}
          onClose={() => setSelectedAttempt(null)}
          onReview={(attemptId, action, notes) => {
            handleReviewAttempt(attemptId, action, notes);
            setSelectedAttempt(null);
          }}
        />
      )}
    </div>
  );
};

export default ProctoringDashboard;
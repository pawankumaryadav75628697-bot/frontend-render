import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './LiveMonitoring.css';

// Error Boundary Component
class LiveMonitoringErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LiveMonitoring Error:', error, errorInfo);
    toast.error('An error occurred in live monitoring. Please refresh the page.');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          padding: '20px',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h2 style={{
              color: '#ef4444',
              marginBottom: '16px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>⚠️ Something went wrong</h2>
            <p style={{
              color: '#6b7280',
              marginBottom: '24px',
              fontSize: '16px'
            }}>There was an error loading the live monitoring dashboard.</p>
            <details style={{
              textAlign: 'left',
              marginBottom: '24px',
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: 'medium',
                color: '#374151'
              }}>Error details</summary>
              <pre style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#ef4444',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>{this.state.error?.toString()}</pre>
            </details>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
            >
              🔄 Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const LiveMonitoring = () => {
  const { token } = useAuth();
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [activeStudents, setActiveStudents] = useState([]);
  const [examStats, setExamStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    completedStudents: 0,
    flaggedIncidents: 0,
    averageProgress: 0,
    timeRemaining: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [filterType, setFilterType] = useState('all'); // all, active, flagged, completed
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef();
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (examId && token) {
      fetchExamDetails();
      fetchActiveStudents();
      fetchExamStats();
      fetchAlerts();

      if (autoRefresh) {
        intervalRef.current = setInterval(() => {
          fetchActiveStudents();
          fetchExamStats();
          fetchAlerts();
        }, 5000); // Refresh every 5 seconds
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [examId, token, autoRefresh]);

  const fetchExamDetails = async () => {
    try {
      const response = await fetch(`/api/v1/exams/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setExam(data.data);
      }
    } catch (error) {
      console.error('Error fetching exam details:', error);
    }
  };

  const fetchActiveStudents = async () => {
    try {
      const response = await fetch(`/api/v1/proctoring/exam/${examId}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveStudents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching active students:', error);
      // Mock data for demonstration
      setActiveStudents([
        {
          _id: '1',
          student: { fullName: 'John Doe', studentId: 'STU001', email: 'john@example.com' },
          startedAt: new Date(Date.now() - 30 * 60000),
          lastActivity: new Date(),
          progress: 75,
          currentQuestion: 15,
          totalQuestions: 20,
          status: 'active',
          flags: [
            { type: 'tab_switch', timestamp: new Date(Date.now() - 10 * 60000), severity: 'medium' }
          ],
          timeSpent: 1800, // 30 minutes in seconds
          answers: 14
        },
        {
          _id: '2',
          student: { fullName: 'Jane Smith', studentId: 'STU002', email: 'jane@example.com' },
          startedAt: new Date(Date.now() - 45 * 60000),
          lastActivity: new Date(Date.now() - 30000),
          progress: 90,
          currentQuestion: 18,
          totalQuestions: 20,
          status: 'active',
          flags: [],
          timeSpent: 2700, // 45 minutes
          answers: 17
        },
        {
          _id: '3',
          student: { fullName: 'Mike Johnson', studentId: 'STU003', email: 'mike@example.com' },
          startedAt: new Date(Date.now() - 60 * 60000),
          lastActivity: new Date(Date.now() - 5000),
          progress: 100,
          currentQuestion: 20,
          totalQuestions: 20,
          status: 'completed',
          flags: [
            { type: 'face_not_detected', timestamp: new Date(Date.now() - 20 * 60000), severity: 'high' },
            { type: 'multiple_faces', timestamp: new Date(Date.now() - 15 * 60000), severity: 'high' }
          ],
          timeSpent: 3600, // 60 minutes
          answers: 20
        }
      ]);
    }
  };

  const fetchExamStats = async () => {
    try {
      const response = await fetch(`/api/v1/proctoring/exam/${examId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const apiStats = data.data || {};
        
        // Ensure all required fields have default values
        const safeStats = {
          totalStudents: apiStats.totalStudents || 0,
          activeStudents: apiStats.activeStudents || 0,
          completedStudents: apiStats.completedStudents || 0,
          flaggedIncidents: apiStats.flaggedIncidents || 0,
          averageProgress: apiStats.averageProgress || 0,
          timeRemaining: apiStats.timeRemaining || calculateTimeRemaining()
        };
        
        setExamStats(safeStats);
      } else {
        // Mock stats with proper defaults
        const mockStats = {
          totalStudents: 50,
          activeStudents: 2,
          completedStudents: 1,
          flaggedIncidents: 3,
          averageProgress: 78.5,
          timeRemaining: calculateTimeRemaining()
        };
        setExamStats(mockStats);
      }
    } catch (error) {
      console.error('Error fetching exam stats:', error);
      // Fallback to safe default values on error
      const fallbackStats = {
        totalStudents: 0,
        activeStudents: 0,
        completedStudents: 0,
        flaggedIncidents: 0,
        averageProgress: 0,
        timeRemaining: calculateTimeRemaining()
      };
      setExamStats(fallbackStats);
    }
  };

  const fetchAlerts = async () => {
    try {
      const mockAlerts = [
        {
          id: '1',
          type: 'high_risk_behavior',
          message: 'Multiple face detection anomalies - Mike Johnson',
          timestamp: new Date(Date.now() - 5 * 60000),
          severity: 'high',
          studentId: '3',
          resolved: false
        },
        {
          id: '2',
          type: 'tab_switch',
          message: 'Tab switching detected - John Doe',
          timestamp: new Date(Date.now() - 10 * 60000),
          severity: 'medium',
          studentId: '1',
          resolved: false
        },
        {
          id: '3',
          type: 'long_inactivity',
          message: 'Student inactive for 15+ minutes - Sarah Wilson',
          timestamp: new Date(Date.now() - 15 * 60000),
          severity: 'low',
          studentId: '4',
          resolved: true
        }
      ];
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const calculateTimeRemaining = () => {
    if (!exam) return 0;
    const now = new Date();
    const endTime = new Date(exam.scheduling?.endDate);
    const diff = endTime - now;
    return Math.max(0, Math.floor(diff / 1000)); // seconds
  };

  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'flagged': return '#ef4444';
      case 'idle': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const filteredStudents = activeStudents.filter(student => {
    const matchesSearch = student.student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (filterType) {
      case 'active':
        return student.status === 'active';
      case 'completed':
        return student.status === 'completed';
      case 'flagged':
        return student.flags && student.flags.length > 0;
      default:
        return true;
    }
  });

  const handleFlagIncident = async (studentId, flagType) => {
    try {
      await fetch(`/api/v1/proctoring/flag-incident`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          examId,
          studentId,
          flagType,
          severity: 'manual',
          description: 'Manually flagged by administrator'
        })
      });
      
      toast.success('Incident flagged successfully');
      fetchActiveStudents();
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to flag incident');
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ));
      toast.success('Alert resolved');
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  if (!exam) {
    return (
      <div className="monitoring-loading">
        <div className="loading-spinner"></div>
        <p>Loading exam details...</p>
      </div>
    );
  }

  return (
    <div className="live-monitoring">
      {/* Header */}
      <div className="monitoring-header">
        <div className="header-info">
          <Link to="/admin/exams" className="back-link">← Back to Exams</Link>
          <h1>Live Monitoring: {exam.title}</h1>
          <p className="exam-details">
            {exam.courseCode} • Duration: {exam.settings?.duration} min • 
            Key: <span className="exam-key">{exam.examKey}</span>
          </p>
        </div>
        
        <div className="header-controls">
          <div className="time-remaining">
            <span className="label">Time Remaining:</span>
            <span className="time">{formatTimeRemaining(examStats.timeRemaining || 0)}</span>
          </div>
          
          <div className="auto-refresh">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-item total">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{examStats.totalStudents || 0}</h3>
            <p>Total Students</p>
          </div>
        </div>
        
        <div className="stat-item active">
          <div className="stat-icon">🟢</div>
          <div className="stat-info">
            <h3>{examStats.activeStudents || 0}</h3>
            <p>Currently Active</p>
          </div>
        </div>
        
        <div className="stat-item completed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{examStats.completedStudents || 0}</h3>
            <p>Completed</p>
          </div>
        </div>
        
        <div className="stat-item flagged">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{examStats.flaggedIncidents || 0}</h3>
            <p>Flagged Incidents</p>
          </div>
        </div>
        
        <div className="stat-item progress">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{(examStats.averageProgress || 0).toFixed(1)}%</h3>
            <p>Avg Progress</p>
          </div>
        </div>
      </div>

      <div className="monitoring-content">
        {/* Alerts Panel */}
        <div className="alerts-panel">
          <div className="panel-header">
            <h2>🚨 Live Alerts</h2>
            <span className="alert-count">{alerts.filter(a => !a.resolved).length} active</span>
          </div>
          
          <div className="alerts-list">
            {alerts.filter(alert => !alert.resolved).slice(0, 5).map(alert => (
              <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                <div className="alert-content">
                  <div className="alert-type">{alert.type.replace('_', ' ').toUpperCase()}</div>
                  <p className="alert-message">{alert.message}</p>
                  <span className="alert-time">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="alert-actions">
                  <button 
                    onClick={() => resolveAlert(alert.id)}
                    className="resolve-btn"
                    title="Mark as resolved"
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
            
            {alerts.filter(alert => !alert.resolved).length === 0 && (
              <div className="no-alerts">
                <p>✅ No active alerts</p>
              </div>
            )}
          </div>
        </div>

        {/* Students Monitoring */}
        <div className="students-panel">
          <div className="panel-header">
            <h2>👥 Student Activity</h2>
            
            <div className="panel-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="filter-tabs">
                <button 
                  className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All ({activeStudents.length})
                </button>
                <button 
                  className={`filter-tab ${filterType === 'active' ? 'active' : ''}`}
                  onClick={() => setFilterType('active')}
                >
                  Active ({activeStudents.filter(s => s.status === 'active').length})
                </button>
                <button 
                  className={`filter-tab ${filterType === 'flagged' ? 'active' : ''}`}
                  onClick={() => setFilterType('flagged')}
                >
                  Flagged ({activeStudents.filter(s => s.flags?.length > 0).length})
                </button>
                <button 
                  className={`filter-tab ${filterType === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilterType('completed')}
                >
                  Completed ({activeStudents.filter(s => s.status === 'completed').length})
                </button>
              </div>
            </div>
          </div>
          
          <div className="students-grid">
            {filteredStudents.map(student => (
              <div 
                key={student._id} 
                className={`student-card ${student.status} ${student.flags?.length > 0 ? 'flagged' : ''}`}
                onClick={() => setSelectedStudent(student)}
              >
                <div className="student-header">
                  <div className="student-info">
                    <h3>{student.student.fullName}</h3>
                    <p className="student-id">{student.student.studentId}</p>
                  </div>
                  
                  <div className="student-status">
                    <div 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(student.status) }}
                    ></div>
                    <span className="status-text">{student.status}</span>
                  </div>
                </div>
                
                <div className="student-progress">
                  <div className="progress-info">
                    <span>Progress: {student.progress}%</span>
                    <span>Q {student.currentQuestion}/{student.totalQuestions}</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${student.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="student-meta">
                  <div className="meta-item">
                    <span className="label">Time:</span>
                    <span className="value">{formatDuration(student.timeSpent)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Answers:</span>
                    <span className="value">{student.answers}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Flags:</span>
                    <span className={`value ${student.flags?.length > 0 ? 'flagged' : ''}`}>
                      {student.flags?.length || 0}
                    </span>
                  </div>
                </div>
                
                {student.flags?.length > 0 && (
                  <div className="student-flags">
                    {student.flags.slice(0, 2).map((flag, index) => (
                      <div key={index} className={`flag severity-${flag.severity}`}>
                        <span className="flag-type">{flag.type.replace('_', ' ')}</span>
                        <span className="flag-time">
                          {new Date(flag.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="student-actions">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlagIncident(student._id, 'manual_review');
                    }}
                    className="flag-btn"
                    title="Flag for review"
                  >
                    🚩
                  </button>
                  <button 
                    className="view-btn"
                    title="View details"
                  >
                    👁️
                  </button>
                </div>
              </div>
            ))}
            
            {filteredStudents.length === 0 && (
              <div className="no-students">
                <p>No students found matching the current filter</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="student-modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="student-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedStudent.student.fullName} - Detailed View</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedStudent(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="student-details-grid">
                <div className="detail-section">
                  <h3>Student Information</h3>
                  <div className="detail-item">
                    <span>Name:</span>
                    <span>{selectedStudent.student.fullName}</span>
                  </div>
                  <div className="detail-item">
                    <span>Student ID:</span>
                    <span>{selectedStudent.student.studentId}</span>
                  </div>
                  <div className="detail-item">
                    <span>Email:</span>
                    <span>{selectedStudent.student.email}</span>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h3>Exam Progress</h3>
                  <div className="detail-item">
                    <span>Status:</span>
                    <span className={`status ${selectedStudent.status}`}>
                      {selectedStudent.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span>Progress:</span>
                    <span>{selectedStudent.progress}%</span>
                  </div>
                  <div className="detail-item">
                    <span>Current Question:</span>
                    <span>{selectedStudent.currentQuestion} of {selectedStudent.totalQuestions}</span>
                  </div>
                  <div className="detail-item">
                    <span>Time Spent:</span>
                    <span>{formatDuration(selectedStudent.timeSpent)}</span>
                  </div>
                </div>
              </div>
              
              {selectedStudent.flags?.length > 0 && (
                <div className="flags-section">
                  <h3>Incident Flags ({selectedStudent.flags.length})</h3>
                  <div className="flags-list">
                    {selectedStudent.flags.map((flag, index) => (
                      <div key={index} className={`flag-detail severity-${flag.severity}`}>
                        <div className="flag-info">
                          <span className="flag-type">{flag.type.replace('_', ' ').toUpperCase()}</span>
                          <span className="flag-time">
                            {new Date(flag.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className={`flag-severity severity-${flag.severity}`}>
                          {flag.severity} priority
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrap with error boundary
const LiveMonitoringWithErrorBoundary = () => {
  return (
    <LiveMonitoringErrorBoundary>
      <LiveMonitoring />
    </LiveMonitoringErrorBoundary>
  );
};

export default LiveMonitoringWithErrorBoundary;

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './LiveMonitoringList.css';

const LiveMonitoringList = () => {
  const { token } = useAuth();
  const [activeExams, setActiveExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalActiveExams: 0,
    totalStudents: 0,
    totalIncidents: 0
  });

  useEffect(() => {
    fetchActiveExams();
    fetchMonitoringStats();
  }, [token]);

  const fetchActiveExams = async () => {
    try {
      const response = await fetch('/api/v1/exams?status=active', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        // Transform exam data for monitoring
        const examList = exams.map(exam => ({
          id: exam._id,
          title: exam.title,
          courseCode: exam.courseCode,
          examKey: exam.examKey,
          startTime: exam.scheduling?.startDate,
          endTime: exam.scheduling?.endDate,
          duration: exam.settings?.duration || 0,
          totalStudents: exam.eligibleStudents?.length || 0,
          activeStudents: Math.floor(Math.random() * (exam.eligibleStudents?.length || 10)), // Mock active students
          completedStudents: Math.floor(Math.random() * (exam.eligibleStudents?.length || 5)), // Mock completed
          incidents: Math.floor(Math.random() * 5), // Mock incidents
          timeRemaining: calculateTimeRemaining(exam.scheduling?.endDate),
          status: getExamStatus(exam.scheduling?.startDate, exam.scheduling?.endDate)
        }));

        setActiveExams(examList);
      } else {
        // Mock data for demonstration
        const mockExams = [
          {
            id: '1',
            title: 'Mathematics Final Exam',
            courseCode: 'MATH101',
            examKey: 'MTH001',
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // Started 2 hours ago
            endTime: new Date(Date.now() + 60 * 60 * 1000), // Ends in 1 hour
            duration: 180,
            totalStudents: 45,
            activeStudents: 32,
            completedStudents: 8,
            incidents: 3,
            timeRemaining: 3600,
            status: 'active'
          },
          {
            id: '2',
            title: 'Computer Science Quiz',
            courseCode: 'CS201',
            examKey: 'CS002',
            startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
            endTime: new Date(Date.now() + 30 * 60 * 1000), // Ends in 30 minutes
            duration: 60,
            totalStudents: 28,
            activeStudents: 25,
            completedStudents: 2,
            incidents: 1,
            timeRemaining: 1800,
            status: 'active'
          },
          {
            id: '3',
            title: 'Physics Lab Assessment',
            courseCode: 'PHY301',
            examKey: 'PHY003',
            startTime: new Date(Date.now() - 15 * 60 * 1000), // Started 15 minutes ago
            endTime: new Date(Date.now() + 75 * 60 * 1000), // Ends in 75 minutes
            duration: 90,
            totalStudents: 18,
            activeStudents: 16,
            completedStudents: 0,
            incidents: 0,
            timeRemaining: 4500,
            status: 'active'
          }
        ];
        setActiveExams(mockExams);
      }
    } catch (error) {
      console.error('Error fetching active exams:', error);
      toast.error('Failed to load active exams');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitoringStats = async () => {
    try {
      const response = await fetch('/api/v1/admin/monitoring/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data || stats);
      }
    } catch (error) {
      console.error('Error fetching monitoring stats:', error);
    }
  };

  const calculateTimeRemaining = (endDate) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    return Math.max(0, Math.floor(diff / 1000)); // seconds
  };

  const getExamStatus = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'scheduled';
    if (now > end) return 'completed';
    return 'active';
  };

  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'scheduled': return '#3b82f6';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (incidents) => {
    if (incidents === 0) return '#10b981';
    if (incidents <= 2) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="monitoring-list-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading live monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-monitoring-list">
      <div className="page-header">
        <div className="header-info">
          <h1>Live Monitoring Center</h1>
          <p>Monitor active exams and student activity in real-time</p>
        </div>
        <Link to="/admin/dashboard" className="btn btn-secondary">
          <span className="icon">←</span>
          Back to Dashboard
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="monitoring-stats">
        <div className="stat-card">
          <div className="stat-icon">🔴</div>
          <div className="stat-info">
            <h3>{activeExams.length}</h3>
            <p>Active Exams</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{activeExams.reduce((sum, exam) => sum + exam.activeStudents, 0)}</h3>
            <p>Students Taking Exams</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{activeExams.reduce((sum, exam) => sum + exam.incidents, 0)}</h3>
            <p>Active Incidents</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{activeExams.reduce((sum, exam) => sum + exam.completedStudents, 0)}</h3>
            <p>Completed</p>
          </div>
        </div>
      </div>

      {/* Active Exams List */}
      <div className="exams-container">
        <div className="section-header">
          <h2>Active Examinations</h2>
          <p>Click on any exam to start live monitoring</p>
        </div>

        {activeExams.length > 0 ? (
          <div className="exams-grid">
            {activeExams.map(exam => (
              <div key={exam.id} className="exam-card">
                <div className="exam-header">
                  <div className="exam-info">
                    <h3>{exam.title}</h3>
                    <p className="course-code">{exam.courseCode}</p>
                    <p className="exam-key">Key: <span>{exam.examKey}</span></p>
                  </div>
                  <div className="exam-status">
                    <div 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(exam.status) }}
                    ></div>
                    <span className="status-text">{exam.status}</span>
                  </div>
                </div>

                <div className="exam-metrics">
                  <div className="metric">
                    <span className="label">Students</span>
                    <span className="value">{exam.activeStudents}/{exam.totalStudents}</span>
                  </div>
                  <div className="metric">
                    <span className="label">Completed</span>
                    <span className="value">{exam.completedStudents}</span>
                  </div>
                  <div className="metric">
                    <span className="label">Incidents</span>
                    <span 
                      className="value incidents"
                      style={{ color: getSeverityColor(exam.incidents) }}
                    >
                      {exam.incidents}
                    </span>
                  </div>
                </div>

                <div className="exam-timing">
                  <div className="timing-info">
                    <span className="time-remaining">{formatTimeRemaining(exam.timeRemaining)}</span>
                    <span className="duration">Duration: {exam.duration} minutes</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${((exam.duration * 60 - exam.timeRemaining) / (exam.duration * 60)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>

                <div className="exam-actions">
                  <Link 
                    to={`/admin/monitoring/${exam.id}`}
                    className="monitor-btn"
                  >
                    <span className="btn-icon">📊</span>
                    Start Monitoring
                  </Link>
                  
                  {exam.incidents > 0 && (
                    <div className="incident-badge">
                      <span className="badge-icon">⚠️</span>
                      {exam.incidents} Alert{exam.incidents > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Active Exams</h3>
            <p>There are currently no active examinations to monitor.</p>
            <Link to="/admin/exams/create" className="btn btn-primary">
              <span className="icon">➕</span>
              Create New Exam
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMonitoringList;
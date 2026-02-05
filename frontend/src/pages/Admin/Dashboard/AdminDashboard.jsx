import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    flaggedIncidents: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [activeExams, setActiveExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState({
    serverStatus: 'healthy',
    databaseStatus: 'healthy',
    aiModelStatus: 'healthy',
    networkStatus: 'healthy'
  });

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchExamStats(),
        fetchActiveExams(),
        fetchRecentActivity()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamStats = async () => {
    try {
      const response = await fetch('/api/v1/exams?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        const totalExams = exams.length;
        const activeExams = exams.filter(exam => exam.status === 'active').length;
        
        // Calculate total students who have attempted exams
        const totalStudents = exams.reduce((sum, exam) => {
          return sum + (exam.analytics?.totalAttempts || 0);
        }, 0);
        
        // Calculate flagged incidents
        const flaggedIncidents = exams.reduce((sum, exam) => {
          return sum + (exam.analytics?.flaggedAttempts || 0);
        }, 0);
        
        setStats({
          totalExams,
          activeExams,
          totalStudents,
          flaggedIncidents
        });
      } else {
        console.error('Failed to fetch exam stats:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching exam stats:', error);
      // Set default stats on error
      setStats({
        totalExams: 0,
        activeExams: 0,
        totalStudents: 0,
        flaggedIncidents: 0
      });
    }
  };

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
        
        const activeExamsData = exams.map(exam => ({
          id: exam._id,
          title: exam.title,
          course: exam.courseCode,
          students: exam.analytics?.totalAttempts || 0,
          duration: `${exam.settings?.duration || 0} min`,
          timeRemaining: calculateTimeRemaining(exam.scheduling?.endDate),
          suspicious: exam.analytics?.flaggedAttempts || 0,
          status: exam.status
        }));
        
        setActiveExams(activeExamsData);
      } else {
        console.error('Failed to fetch active exams:', response.status, response.statusText);
        setActiveExams([]);
      }
    } catch (error) {
      console.error('Error fetching active exams:', error);
      setActiveExams([]);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Since we don't have a specific recent activity endpoint,
      // we'll use recent exam attempts as activity
      const response = await fetch('/api/v1/exams/attempts/recent', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // For now, show empty activity or create mock recent activity
        setRecentActivity([]);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Set empty array if endpoint doesn't exist yet
      setRecentActivity([]);
    }
  };

  const calculateTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'exam_started': return '🚀';
      case 'suspicious_activity': return '⚠️';
      case 'exam_completed': return '✅';
      case 'system_alert': return '🔧';
      default: return '📝';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'flagged': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'completed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '🔧';
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-dashboard">
          <div className="loading-spinner">⏳</div>
          <h2>Loading Dashboard...</h2>
          <p>Fetching your exam data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{getGreeting()}, {user?.fullName}! 🎯</h1>
          <p>Manage and monitor your institution's exams</p>
        </div>
        <div className="quick-actions">
          <Link to="/admin/profile" className="action-btn profile-btn">
            <span className="icon">👤</span>
            Profile
          </Link>
          <Link to="/admin/exams/create" className="action-btn create-exam-btn">
            <span className="icon">➕</span>
            Create Exam
          </Link>
          <Link to="/admin/exams" className="action-btn monitor-btn">
            <span className="icon">👁️</span>
            Manage Exams
          </Link>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h3>{stats.totalExams}</h3>
            <p>Total Exams</p>
          </div>
          <div className="stat-trend">{stats.totalExams > 0 ? 'Published' : 'Get started!'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔴</div>
          <div className="stat-info">
            <h3>{stats.activeExams}</h3>
            <p>Active Exams</p>
          </div>
          <div className="stat-trend">{stats.activeExams > 0 ? 'Live monitoring' : 'None active'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
          <div className="stat-trend">{stats.totalStudents > 0 ? 'Registered' : 'No students yet'}</div>
        </div>
        <div className="stat-card alert">
          <div className="stat-icon">🚨</div>
          <div className="stat-info">
            <h3>{stats.flaggedIncidents}</h3>
            <p>Flagged Incidents</p>
          </div>
          <div className="stat-trend">{stats.flaggedIncidents > 0 ? 'Needs attention' : 'All clear'}</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="content-left">
          {/* Quick Action Boxes Section */}
          <div className="action-boxes-section">
            <div className="section-header">
              <h2>🚀 Quick Actions</h2>
              <span className="section-subtitle">Manage your exam system efficiently</span>
            </div>
            <div className="action-boxes-grid">
              <div className="action-box create-exam-box">
                <div className="action-box-icon">📝</div>
                <div className="action-box-content">
                  <h3>Create Exam</h3>
                  <p>Design and publish new exams with advanced proctoring features</p>
                  <div className="action-box-stats">
                    <span className="stat-item">
                      <span className="stat-number">{stats.totalExams}</span>
                      <span className="stat-label">Total Created</span>
                    </span>
                  </div>
                  <Link to="/admin/exams/create" className="action-box-btn primary">
                    <span className="btn-icon">➕</span>
                    Create New Exam
                  </Link>
                </div>
              </div>

              <div className="action-box manage-students-box">
                <div className="action-box-icon">👥</div>
                <div className="action-box-content">
                  <h3>Manage Students</h3>
                  <p>Add, edit, and monitor student accounts and their progress</p>
                  <div className="action-box-stats">
                    <span className="stat-item">
                      <span className="stat-number">{stats.totalStudents}</span>
                      <span className="stat-label">Registered</span>
                    </span>
                  </div>
                  <Link to="/admin/students" className="action-box-btn secondary">
                    <span className="btn-icon">⚙️</span>
                    Manage Students
                  </Link>
                </div>
              </div>

              <div className="action-box live-monitoring-box">
                <div className="action-box-icon">👁️</div>
                <div className="action-box-content">
                  <h3>Live Monitoring</h3>
                  <p>Real-time exam monitoring and proctoring dashboard</p>
                  <div className="action-box-stats">
                    <span className="stat-item">
                      <span className="stat-number">{stats.activeExams}</span>
                      <span className="stat-label">Active Now</span>
                    </span>
                    <span className="stat-item alert">
                      <span className="stat-number">{stats.flaggedIncidents}</span>
                      <span className="stat-label">Flagged</span>
                    </span>
                  </div>
                  <Link to="/admin/monitoring" className="action-box-btn warning">
                    <span className="btn-icon">📡</span>
                    Start Monitoring
                  </Link>
                </div>
              </div>

              <div className="action-box coding-questions-box">
                <div className="action-box-icon">💻</div>
                <div className="action-box-content">
                  <h3>Coding Questions</h3>
                  <p>Create and manage programming challenges and assessments</p>
                  <div className="action-box-stats">
                    <span className="stat-item">
                      <span className="stat-number">12</span>
                      <span className="stat-label">Templates</span>
                    </span>
                  </div>
                  <Link to="/admin/coding-questions" className="action-box-btn success">
                    <span className="btn-icon">🔧</span>
                    Manage Coding
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="active-exams-section">
            <div className="section-header">
              <h2>🔴 Active Exams</h2>
              <Link to="/admin/exams" className="view-all-link">View All Exams</Link>
            </div>
            <div className="active-exams-grid">
              {activeExams.length === 0 ? (
                <div className="empty-active-exams">
                  <div className="empty-icon">📋</div>
                  <h3>No Active Exams</h3>
                  <p>You don't have any active exams right now.</p>
                  <Link to="/admin/exams/create" className="create-exam-link">
                    <span className="icon">➕</span>
                    Create Your First Exam
                  </Link>
                </div>
              ) : (
                activeExams.map(exam => (
                  <div key={exam.id} className="active-exam-card">
                    <div className="exam-header">
                      <h3>{exam.title}</h3>
                      <span className="exam-status active">LIVE</span>
                    </div>
                    <div className="exam-meta">
                      <span className="course">{exam.course}</span>
                      <span className="time-remaining">{exam.timeRemaining} left</span>
                    </div>
                    <div className="exam-stats">
                      <div className="stat">
                        <span className="stat-label">Attempts</span>
                        <span className="stat-value">{exam.students}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Suspicious</span>
                        <span className="stat-value" style={{ color: exam.suspicious > 0 ? '#ef4444' : '#10b981' }}>
                          {exam.suspicious}
                        </span>
                      </div>
                    </div>
                    <div className="exam-actions">
                      <Link to={`/admin/exams/${exam.id}`} className="monitor-btn">
                        <span className="icon">👁️</span>
                        View Details
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="analytics-section">
            <div className="section-header">
              <h2>📊 Analytics Overview</h2>
              <select className="time-filter">
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Exam Completion Rate</h4>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '94%' }}></div>
                </div>
                <span className="progress-text">94%</span>
              </div>
              <div className="analytics-card">
                <h4>Average Score</h4>
                <div className="score-display">
                  <span className="score">82.5</span>
                  <span className="score-trend">+2.3% ↗️</span>
                </div>
              </div>
              <div className="analytics-card">
                <h4>Incident Rate</h4>
                <div className="incident-rate">
                  <span className="rate">3.2%</span>
                  <span className="rate-trend">-0.8% ↘️</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-right">
          <div className="recent-activity-section">
            <div className="section-header">
              <h2>⚡ Recent Activity</h2>
              <button className="refresh-btn">🔄</button>
            </div>
            <div className="activity-list">
              {recentActivity.length === 0 ? (
                <div className="empty-activity">
                  <div className="empty-icon">⚡</div>
                  <h4>No Recent Activity</h4>
                  <p>Activity will appear here when students start taking exams.</p>
                </div>
              ) : (
                recentActivity.map(activity => (
                  <div key={activity.id} className="activity-card">
                    <div className="activity-icon">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="activity-content">
                      <div className="activity-main">
                        <span className="student-name">{activity.student}</span>
                        <span className="activity-action">
                          {activity.type === 'exam_started' && 'started exam'}
                          {activity.type === 'suspicious_activity' && 'flagged for suspicious activity'}
                          {activity.type === 'exam_completed' && 'completed exam'}
                          {activity.type === 'system_alert' && 'system alert triggered'}
                        </span>
                      </div>
                      <div className="activity-details">
                        <span className="exam-name">{activity.exam}</span>
                        <span className="activity-time">{activity.time}</span>
                      </div>
                    </div>
                    <div 
                      className="activity-status"
                      style={{ backgroundColor: getStatusColor(activity.status) }}
                    ></div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="system-health-section">
            <div className="section-header">
              <h2>🏥 System Health</h2>
              <span className="health-status">All Systems Operational</span>
            </div>
            <div className="health-grid">
              <div className="health-card">
                <div className="health-header">
                  <span className="health-icon">
                    {getHealthIcon(systemHealth.serverStatus)}
                  </span>
                  <span className="health-name">Server</span>
                </div>
                <span 
                  className="health-status-text"
                  style={{ color: getHealthColor(systemHealth.serverStatus) }}
                >
                  {systemHealth.serverStatus}
                </span>
              </div>
              <div className="health-card">
                <div className="health-header">
                  <span className="health-icon">
                    {getHealthIcon(systemHealth.databaseStatus)}
                  </span>
                  <span className="health-name">Database</span>
                </div>
                <span 
                  className="health-status-text"
                  style={{ color: getHealthColor(systemHealth.databaseStatus) }}
                >
                  {systemHealth.databaseStatus}
                </span>
              </div>
              <div className="health-card">
                <div className="health-header">
                  <span className="health-icon">
                    {getHealthIcon(systemHealth.aiModelStatus)}
                  </span>
                  <span className="health-name">AI Model</span>
                </div>
                <span 
                  className="health-status-text"
                  style={{ color: getHealthColor(systemHealth.aiModelStatus) }}
                >
                  {systemHealth.aiModelStatus}
                </span>
              </div>
              <div className="health-card">
                <div className="health-header">
                  <span className="health-icon">
                    {getHealthIcon(systemHealth.networkStatus)}
                  </span>
                  <span className="health-name">Network</span>
                </div>
                <span 
                  className="health-status-text"
                  style={{ color: getHealthColor(systemHealth.networkStatus) }}
                >
                  {systemHealth.networkStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="quick-stats-section">
            <div className="section-header">
              <h2>📈 Quick Stats</h2>
            </div>
            <div className="quick-stats-grid">
              <div className="quick-stat">
                <span className="stat-number">97.8%</span>
                <span className="stat-label">Uptime</span>
              </div>
              <div className="quick-stat">
                <span className="stat-number">1.2s</span>
                <span className="stat-label">Avg Response</span>
              </div>
              <div className="quick-stat">
                <span className="stat-number">156</span>
                <span className="stat-label">Concurrent Users</span>
              </div>
              <div className="quick-stat">
                <span className="stat-number">2.1TB</span>
                <span className="stat-label">Data Stored</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

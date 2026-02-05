import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './AdminDashboard.css';

const EnhancedAdminDashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    activeStudents: 0,
    completedAttempts: 0,
    flaggedIncidents: 0,
    recentRegistrations: 0
  });

  const [quickActions, setQuickActions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeExams, setActiveExams] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [studentStats, setStudentStats] = useState({
    courseDistribution: [],
    batchDistribution: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState({
    serverStatus: 'healthy',
    databaseStatus: 'healthy',
    notificationService: 'healthy',
    examService: 'healthy'
  });

  useEffect(() => {
    fetchDashboardData();
    // Refresh data every 30 seconds for real-time updates
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchDashboardData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchExamStats(),
        fetchStudentStats(),
        fetchActiveExams(),
        fetchUpcomingExams(),
        fetchRecentActivity(),
        checkSystemHealth()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExamStats = async () => {
    try {
      const response = await fetch('/api/v1/exams/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(prevStats => ({
          ...prevStats,
          totalExams: data.data?.totalExams || 0,
          activeExams: data.data?.activeExams || 0,
          completedAttempts: data.data?.completedAttempts || 0,
          flaggedIncidents: data.data?.flaggedIncidents || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching exam stats:', error);
    }
  };

  const fetchStudentStats = async () => {
    try {
      const response = await fetch('/api/v1/admin/students/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(prevStats => ({
          ...prevStats,
          totalStudents: data.data?.total || 0,
          activeStudents: data.data?.active || 0,
          recentRegistrations: data.data?.recentRegistrations || 0
        }));
        
        setStudentStats({
          courseDistribution: data.data?.courseDistribution || [],
          batchDistribution: data.data?.batchDistribution || [],
          recentActivity: data.data?.recentActivity || []
        });
      }
    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  };

  const fetchActiveExams = async () => {
    try {
      const response = await fetch('/api/v1/exams?status=active&limit=10', {
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
          examKey: exam.examKey,
          course: exam.courseCode,
          students: exam.analytics?.totalAttempts || 0,
          duration: `${exam.settings?.duration || 0} min`,
          timeRemaining: calculateTimeRemaining(exam.scheduling?.endDate),
          suspicious: exam.analytics?.flaggedAttempts || 0,
          status: exam.status,
          startTime: exam.scheduling?.startDate,
          endTime: exam.scheduling?.endDate
        }));
        
        setActiveExams(activeExamsData);
      }
    } catch (error) {
      console.error('Error fetching active exams:', error);
    }
  };

  const fetchUpcomingExams = async () => {
    try {
      const response = await fetch('/api/v1/exams?status=published&upcoming=true&limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        const upcomingExamsData = exams.map(exam => ({
          id: exam._id,
          title: exam.title,
          course: exam.courseCode,
          startTime: exam.scheduling?.startDate,
          duration: `${exam.settings?.duration || 0} min`,
          studentsCount: exam.eligibleStudents?.length || 0
        }));
        
        setUpcomingExams(upcomingExamsData);
      }
    } catch (error) {
      console.error('Error fetching upcoming exams:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Mock recent activity for now - would be replaced with actual API
      const mockActivity = [
        {
          id: 1,
          type: 'exam_started',
          message: 'Mathematics Final Exam started',
          time: new Date(Date.now() - 10000),
          user: 'System'
        },
        {
          id: 2,
          type: 'student_registered',
          message: '5 new students registered',
          time: new Date(Date.now() - 300000),
          user: 'Admin'
        },
        {
          id: 3,
          type: 'suspicious_activity',
          message: 'Suspicious activity detected in Physics Exam',
          time: new Date(Date.now() - 600000),
          user: 'AI Monitor'
        },
        {
          id: 4,
          type: 'exam_completed',
          message: 'Chemistry Exam completed by 45 students',
          time: new Date(Date.now() - 900000),
          user: 'System'
        }
      ];
      
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        setSystemHealth(prev => ({
          ...prev,
          serverStatus: 'healthy',
          databaseStatus: 'healthy'
        }));
      }
    } catch (error) {
      setSystemHealth(prev => ({
        ...prev,
        serverStatus: 'warning'
      }));
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
      case 'student_registered': return '👥';
      case 'suspicious_activity': return '⚠️';
      case 'exam_completed': return '✅';
      case 'system_alert': return '🔧';
      case 'notification_sent': return '📧';
      default: return '📝';
    }
  };

  const formatTimeAgo = (time) => {
    const now = new Date();
    const diff = now - new Date(time);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'flagged': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'completed': return '#6b7280';
      case 'healthy': return '#10b981';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard enhanced">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{getGreeting()}, {user?.fullName || 'Admin'}!</h1>
          <p>Here's what's happening with your exam monitoring system today.</p>
        </div>
        
        <div className="quick-actions">
          <Link to="/admin/exams/create" className="quick-action primary">
            <span className="icon">📝</span>
            Create Exam
          </Link>
          <Link to="/admin/students" className="quick-action secondary">
            <span className="icon">👥</span>
            Manage Students
          </Link>
          <Link to="/admin/monitoring" className="quick-action tertiary">
            <span className="icon">📈</span>
            Live Monitor
          </Link>
          <Link to="/admin/coding-questions" className="quick-action quaternary">
            <span className="icon">💻</span>
            Coding Questions
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <h3>{stats.totalExams}</h3>
            <p>Total Exams</p>
            <span className="stat-change">+{stats.recentRegistrations || 0} this week</span>
          </div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <h3>{stats.activeExams}</h3>
            <p>Active Exams</p>
            <span className="stat-change">Currently running</span>
          </div>
        </div>
        
        <div className="stat-card info">
          <div className="stat-icon">👨‍🎓</div>
          <div className="stat-info">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
            <span className="stat-change">{stats.activeStudents} active</span>
          </div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{stats.flaggedIncidents}</h3>
            <p>Flagged Incidents</p>
            <span className="stat-change">Requires attention</span>
          </div>
        </div>
      </div>

      {/* Featured Action Sections */}
      <div className="featured-actions">
        <div className="action-section create-exam-section">
          <div className="action-header">
            <div className="action-icon-large">📝</div>
            <div className="action-info">
              <h2>Create Exam</h2>
              <p>Design comprehensive exams with advanced proctoring features</p>
            </div>
          </div>
          <div className="action-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.totalExams}</span>
              <span className="stat-label">Total Exams</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.activeExams}</span>
              <span className="stat-label">Currently Active</span>
            </div>
          </div>
          <div className="action-buttons">
            <Link to="/admin/exams/create" className="primary-button">
              <span className="btn-icon">➕</span>
              Create New Exam
            </Link>
            <Link to="/admin/exams" className="secondary-button">
              <span className="btn-icon">📋</span>
              Manage Exams
            </Link>
          </div>
        </div>

        <div className="action-section manage-students-section">
          <div className="action-header">
            <div className="action-icon-large">👥</div>
            <div className="action-info">
              <h2>Manage Students</h2>
              <p>Add, edit, and monitor student accounts and performance</p>
            </div>
          </div>
          <div className="action-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.totalStudents}</span>
              <span className="stat-label">Total Students</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.activeStudents}</span>
              <span className="stat-label">Active Now</span>
            </div>
          </div>
          <div className="action-buttons">
            <Link to="/admin/students" className="primary-button">
              <span className="btn-icon">⚙️</span>
              Manage Students
            </Link>
            <Link to="/admin/students/bulk-upload" className="secondary-button">
              <span className="btn-icon">📁</span>
              Bulk Upload
            </Link>
          </div>
        </div>

        <div className="action-section live-monitoring-section">
          <div className="action-header">
            <div className="action-icon-large">👁️</div>
            <div className="action-info">
              <h2>Live Monitoring</h2>
              <p>Real-time exam monitoring and proctoring dashboard</p>
            </div>
          </div>
          <div className="action-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.activeExams}</span>
              <span className="stat-label">Live Exams</span>
            </div>
            <div className="stat-item alert">
              <span className="stat-value">{stats.flaggedIncidents}</span>
              <span className="stat-label">Flagged</span>
            </div>
          </div>
          <div className="action-buttons">
            <Link to="/admin/monitoring" className="primary-button warning">
              <span className="btn-icon">📡</span>
              Live Monitor
            </Link>
            <Link to="/admin/exams" className="secondary-button">
              <span className="btn-icon">📊</span>
              View Reports
            </Link>
          </div>
        </div>

        <div className="action-section coding-questions-section">
          <div className="action-header">
            <div className="action-icon-large">💻</div>
            <div className="action-info">
              <h2>Coding Questions</h2>
              <p>Create and manage programming challenges and assessments</p>
            </div>
          </div>
          <div className="action-stats">
            <div className="stat-item">
              <span className="stat-value">24</span>
              <span className="stat-label">Questions</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">8</span>
              <span className="stat-label">Templates</span>
            </div>
          </div>
          <div className="action-buttons">
            <Link to="/admin/coding-questions" className="primary-button success">
              <span className="btn-icon">🔧</span>
              Manage Coding
            </Link>
            <Link to="/admin/coding-questions" className="secondary-button">
              <span className="btn-icon">📚</span>
              Browse Library
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Active Exams */}
        <div className="dashboard-card active-exams">
          <div className="card-header">
            <h2>🔴 Live Exams</h2>
            <Link to="/admin/exams" className="view-all">View All</Link>
          </div>
          <div className="card-content">
            {activeExams.length > 0 ? (
              <div className="exam-list">
                {activeExams.map(exam => (
                  <div key={exam.id} className="exam-item">
                    <div className="exam-info">
                      <h4>{exam.title}</h4>
                      <p className="exam-meta">
                        <span className="course">{exam.course}</span>
                        <span className="key">Key: {exam.examKey}</span>
                      </p>
                      <div className="exam-stats">
                        <span className="students">{exam.students} students</span>
                        <span className="duration">{exam.duration}</span>
                        <span className="time-remaining">{exam.timeRemaining}</span>
                      </div>
                    </div>
                    <div className="exam-actions">
                      <Link to={`/admin/monitoring/${exam.id}`} className="monitor-btn">
                        📊 Monitor
                      </Link>
                      {exam.suspicious > 0 && (
                        <span className="suspicious-badge">{exam.suspicious} flagged</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No active exams at the moment</p>
                <Link to="/admin/exams/create" className="create-exam-btn">Create New Exam</Link>
              </div>
            )}
          </div>
        </div>

        {/* Student Analytics */}
        <div className="dashboard-card student-analytics">
          <div className="card-header">
            <h2>📊 Student Analytics</h2>
            <Link to="/admin/students" className="view-all">Manage Students</Link>
          </div>
          <div className="card-content">
            <div className="analytics-grid">
              <div className="analytic-item">
                <h4>Course Distribution</h4>
                {studentStats.courseDistribution.slice(0, 3).map((course, index) => (
                  <div key={index} className="course-bar">
                    <span className="course-name">{course._id || 'Unknown'}</span>
                    <div className="bar">
                      <div 
                        className="bar-fill" 
                        style={{ width: `${(course.count / stats.totalStudents) * 100}%` }}
                      ></div>
                    </div>
                    <span className="course-count">{course.count}</span>
                  </div>
                ))}
              </div>
              
              <div className="analytic-item">
                <h4>Recent Activity</h4>
                <div className="activity-summary">
                  <div className="activity-stat">
                    <span className="label">New Registrations</span>
                    <span className="value">{stats.recentRegistrations}</span>
                  </div>
                  <div className="activity-stat">
                    <span className="label">Completed Exams</span>
                    <span className="value">{stats.completedAttempts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="dashboard-card activity-feed">
          <div className="card-header">
            <h2>⚡ Recent Activity</h2>
          </div>
          <div className="card-content">
            <div className="activity-list">
              {recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="activity-details">
                    <p className="activity-message">{activity.message}</p>
                    <span className="activity-meta">
                      {activity.user} • {formatTimeAgo(activity.time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="dashboard-card upcoming-exams">
          <div className="card-header">
            <h2>📅 Upcoming Exams</h2>
            <Link to="/admin/exams" className="view-all">View All</Link>
          </div>
          <div className="card-content">
            {upcomingExams.length > 0 ? (
              <div className="upcoming-list">
                {upcomingExams.map(exam => (
                  <div key={exam.id} className="upcoming-item">
                    <div className="exam-info">
                      <h4>{exam.title}</h4>
                      <p className="course">{exam.course}</p>
                      <p className="schedule">
                        {new Date(exam.startTime).toLocaleDateString()} at{' '}
                        {new Date(exam.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <div className="exam-meta">
                      <span className="duration">{exam.duration}</span>
                      <span className="students">{exam.studentsCount} students</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No upcoming exams scheduled</p>
              </div>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="dashboard-card system-health">
          <div className="card-header">
            <h2>🔧 System Health</h2>
          </div>
          <div className="card-content">
            <div className="health-grid">
              {Object.entries(systemHealth).map(([service, status]) => (
                <div key={service} className="health-item">
                  <div 
                    className="health-indicator"
                    style={{ backgroundColor: getStatusColor(status) }}
                  ></div>
                  <span className="service-name">
                    {service.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                  <span className={`status ${status}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="dashboard-card quick-actions-panel">
          <div className="card-header">
            <h2>⚡ Quick Actions</h2>
          </div>
          <div className="card-content">
            <div className="actions-grid">
              <Link to="/admin/students/bulk-upload" className="action-item">
                <div className="action-icon">📁</div>
                <span>Bulk Upload Students</span>
              </Link>
              <Link to="/admin/exams/create" className="action-item">
                <div className="action-icon">➕</div>
                <span>Create New Exam</span>
              </Link>
              <Link to="/admin/reports" className="action-item">
                <div className="action-icon">📈</div>
                <span>Generate Report</span>
              </Link>
              <Link to="/admin/coding-questions" className="action-item">
                <div className="action-icon">💻</div>
                <span>Coding Questions</span>
              </Link>
              <Link to="/admin/test" className="action-item">
                <div className="action-icon">🧪</div>
                <span>Test Panel</span>
              </Link>
              <Link to="/admin/settings" className="action-item">
                <div className="action-icon">⚙️</div>
                <span>System Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAdminDashboard;
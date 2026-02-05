import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './AdminProfile.css';

const AdminProfile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    adminId: user?.adminId || '',
    department: user?.department || '',
    role: user?.role || '',
    phone: user?.phone || '',
    address: user?.address || '',
    emergencyContact: user?.emergencyContact || '',
    profileImage: user?.profileImage || ''
  });

  const [systemStats] = useState({
    totalExams: 156,
    activeExams: 12,
    totalStudents: 2847,
    flaggedCases: 23,
    systemUptime: '99.9%',
    avgResponseTime: '120ms'
  });

  const [recentActivities] = useState([
    {
      id: 1,
      action: 'Created new exam',
      target: 'Computer Networks Final',
      timestamp: '2024-01-15 10:30 AM',
      type: 'create',
      severity: 'info'
    },
    {
      id: 2,
      action: 'Reviewed flagged case',
      target: 'Student ID: ST2024001',
      timestamp: '2024-01-15 09:15 AM',
      type: 'review',
      severity: 'warning'
    },
    {
      id: 3,
      action: 'Updated system settings',
      target: 'Monitoring Configuration',
      timestamp: '2024-01-15 08:45 AM',
      type: 'config',
      severity: 'info'
    },
    {
      id: 4,
      action: 'Approved exam results',
      target: 'Database Management Quiz',
      timestamp: '2024-01-14 04:30 PM',
      type: 'approve',
      severity: 'success'
    },
    {
      id: 5,
      action: 'System backup completed',
      target: 'Daily Backup Process',
      timestamp: '2024-01-14 02:00 AM',
      type: 'system',
      severity: 'success'
    }
  ]);

  const [permissions] = useState([
    {
      category: 'Exam Management',
      permissions: ['Create Exams', 'Edit Exams', 'Delete Exams', 'View Results', 'Generate Reports']
    },
    {
      category: 'Student Management',
      permissions: ['View Student Records', 'Manage Enrollments', 'Handle Appeals']
    },
    {
      category: 'System Administration',
      permissions: ['User Management', 'System Settings', 'Backup Management', 'Security Settings']
    },
    {
      category: 'Monitoring & Analytics',
      permissions: ['Real-time Monitoring', 'Analytics Dashboard', 'Incident Management']
    }
  ]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = () => {
    updateUser({ ...user, ...formData });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      fullName: user?.fullName || '',
      email: user?.email || '',
      adminId: user?.adminId || '',
      department: user?.department || '',
      role: user?.role || '',
      phone: user?.phone || '',
      address: user?.address || '',
      emergencyContact: user?.emergencyContact || '',
      profileImage: user?.profileImage || ''
    });
    setIsEditing(false);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'create': return '✏️';
      case 'review': return '👁️';
      case 'config': return '⚙️';
      case 'approve': return '✅';
      case 'system': return '🔧';
      default: return '📝';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="admin-profile">
      <div className="profile-header">
        <Link to="/admin/dashboard" className="back-btn">
          <span className="icon">←</span>
          Back to Dashboard
        </Link>
        <h1>Admin Profile</h1>
        {!isEditing ? (
          <button className="edit-btn" onClick={() => setIsEditing(true)}>
            <span className="icon">✏️</span>
            Edit Profile
          </button>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>
              <span className="icon">✅</span>
              Save
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              <span className="icon">❌</span>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="profile-content">
        <div className="content-left">
          <div className="personal-info-section">
            <div className="section-header">
              <h2>👤 Administrator Information</h2>
            </div>
            <div className="personal-info-card">
              <div className="profile-image-section">
                <div className="profile-image">
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Profile" />
                  ) : (
                    <div className="default-avatar">
                      {formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                  )}
                </div>
                {isEditing && (
                  <button className="change-photo-btn">
                    📷 Change Photo
                  </button>
                )}
              </div>
              
              <div className="info-grid">
                <div className="info-item">
                  <label>Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span>{formData.fullName}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span>{formData.email}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Admin ID</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="adminId"
                      value={formData.adminId}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span>{formData.adminId}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Department</label>
                  {isEditing ? (
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                    >
                      <option value="academic-affairs">Academic Affairs</option>
                      <option value="student-services">Student Services</option>
                      <option value="it-department">IT Department</option>
                      <option value="examination-board">Examination Board</option>
                      <option value="quality-assurance">Quality Assurance</option>
                    </select>
                  ) : (
                    <span>{formData.department}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Role</label>
                  {isEditing ? (
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                    >
                      <option value="super-admin">Super Administrator</option>
                      <option value="exam-admin">Exam Administrator</option>
                      <option value="system-admin">System Administrator</option>
                      <option value="monitoring-admin">Monitoring Administrator</option>
                    </select>
                  ) : (
                    <span>{formData.role}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <span>{formData.phone || 'Not provided'}</span>
                  )}
                </div>
                
                <div className="info-item full-width">
                  <label>Address</label>
                  {isEditing ? (
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Enter your address"
                      rows="3"
                    />
                  ) : (
                    <span>{formData.address || 'Not provided'}</span>
                  )}
                </div>
                
                <div className="info-item full-width">
                  <label>Emergency Contact</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleInputChange}
                      placeholder="Name and phone number"
                    />
                  ) : (
                    <span>{formData.emergencyContact || 'Not provided'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="system-stats-section">
            <div className="section-header">
              <h2>📊 System Overview</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <h3>{systemStats.totalExams}</h3>
                  <p>Total Exams</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🔴</div>
                <div className="stat-info">
                  <h3>{systemStats.activeExams}</h3>
                  <p>Active Exams</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{systemStats.totalStudents}</h3>
                  <p>Total Students</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚠️</div>
                <div className="stat-info">
                  <h3>{systemStats.flaggedCases}</h3>
                  <p>Flagged Cases</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                  <h3>{systemStats.systemUptime}</h3>
                  <p>System Uptime</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🚀</div>
                <div className="stat-info">
                  <h3>{systemStats.avgResponseTime}</h3>
                  <p>Avg Response</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-right">
          <div className="recent-activities-section">
            <div className="section-header">
              <h2>📋 Recent Activities</h2>
              <Link to="/admin/logs" className="view-all-link">View All</Link>
            </div>
            <div className="activities-list">
              {recentActivities.map(activity => (
                <div key={activity.id} className="activity-card">
                  <div className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="activity-content">
                    <h4>{activity.action}</h4>
                    <p>{activity.target}</p>
                    <div className="activity-meta">
                      <span className="timestamp">{activity.timestamp}</span>
                      <span 
                        className="severity-indicator"
                        style={{ color: getSeverityColor(activity.severity) }}
                      >
                        ● {activity.severity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="permissions-section">
            <div className="section-header">
              <h2>🔐 Access Permissions</h2>
            </div>
            <div className="permissions-list">
              {permissions.map((category, index) => (
                <div key={index} className="permission-category">
                  <h4>{category.category}</h4>
                  <div className="permission-items">
                    {category.permissions.map((permission, permIndex) => (
                      <div key={permIndex} className="permission-item">
                        <span className="permission-check">✅</span>
                        <span className="permission-text">{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;

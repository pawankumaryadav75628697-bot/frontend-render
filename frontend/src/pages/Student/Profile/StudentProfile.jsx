import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './StudentProfile.css';

const StudentProfile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    studentId: user?.studentId || '',
    course: user?.course || '',
    semester: user?.semester || '',
    phone: user?.phone || '',
    address: user?.address || '',
    emergencyContact: user?.emergencyContact || '',
    profileImage: user?.profileImage || ''
  });

  const [examHistory] = useState([
    {
      id: 1,
      title: 'Computer Networks Final',
      course: 'CS 401',
      date: '2024-01-05',
      score: 92,
      duration: '2 hours',
      status: 'completed',
      incidentsCount: 0
    },
    {
      id: 2,
      title: 'Database Management Quiz',
      course: 'CS 302',
      date: '2024-01-03',
      score: 88,
      duration: '1 hour',
      status: 'completed',
      incidentsCount: 1
    },
    {
      id: 3,
      title: 'Software Engineering Test',
      course: 'CS 350',
      date: '2023-12-20',
      score: 76,
      duration: '90 minutes',
      status: 'completed',
      incidentsCount: 0
    },
    {
      id: 4,
      title: 'Web Development Midterm',
      course: 'CS 280',
      date: '2023-12-15',
      score: 94,
      duration: '2.5 hours',
      status: 'completed',
      incidentsCount: 0
    }
  ]);

  const [achievements] = useState([
    {
      id: 1,
      title: 'Perfect Score',
      description: 'Achieved 100% in Algorithm Analysis',
      icon: '🏆',
      date: '2024-01-10',
      type: 'academic'
    },
    {
      id: 2,
      title: 'Consistent Performer',
      description: 'Maintained 90+ average for 5 consecutive exams',
      icon: '📈',
      date: '2024-01-08',
      type: 'performance'
    },
    {
      id: 3,
      title: 'Zero Violations',
      description: 'Completed 10 exams with zero academic violations',
      icon: '✅',
      date: '2024-01-05',
      type: 'integrity'
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
      studentId: user?.studentId || '',
      course: user?.course || '',
      semester: user?.semester || '',
      phone: user?.phone || '',
      address: user?.address || '',
      emergencyContact: user?.emergencyContact || '',
      profileImage: user?.profileImage || ''
    });
    setIsEditing(false);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#f59e0b';
    if (score >= 70) return '#ef4444';
    return '#6b7280';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateAverageScore = () => {
    const total = examHistory.reduce((sum, exam) => sum + exam.score, 0);
    return (total / examHistory.length).toFixed(1);
  };

  const getAchievementColor = (type) => {
    switch (type) {
      case 'academic': return '#f59e0b';
      case 'performance': return '#10b981';
      case 'integrity': return '#2563eb';
      default: return '#6b7280';
    }
  };

  return (
    <div className="student-profile">
      <div className="profile-header">
        <Link to="/student/dashboard" className="back-btn">
          <span className="icon">←</span>
          Back to Dashboard
        </Link>
        <h1>My Profile</h1>
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
              <h2>👤 Personal Information</h2>
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
                  <label>Student ID</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <span>{formData.studentId}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Course</label>
                  {isEditing ? (
                    <select
                      name="course"
                      value={formData.course}
                      onChange={handleInputChange}
                    >
                      <option value="computer-science">Computer Science</option>
                      <option value="engineering">Engineering</option>
                      <option value="business">Business Administration</option>
                      <option value="medicine">Medicine</option>
                      <option value="arts">Arts & Humanities</option>
                    </select>
                  ) : (
                    <span>{formData.course}</span>
                  )}
                </div>
                
                <div className="info-item">
                  <label>Semester</label>
                  {isEditing ? (
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                    >
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                      <option value="4">Semester 4</option>
                      <option value="5">Semester 5</option>
                      <option value="6">Semester 6</option>
                      <option value="7">Semester 7</option>
                      <option value="8">Semester 8</option>
                    </select>
                  ) : (
                    <span>Semester {formData.semester}</span>
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

          <div className="academic-stats-section">
            <div className="section-header">
              <h2>📊 Academic Statistics</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <h3>{examHistory.length}</h3>
                  <p>Total Exams</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <h3>{calculateAverageScore()}%</h3>
                  <p>Average Score</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏆</div>
                <div className="stat-info">
                  <h3>{achievements.length}</h3>
                  <p>Achievements</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h3>{examHistory.filter(exam => exam.incidentsCount === 0).length}</h3>
                  <p>Clean Records</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-right">
          <div className="exam-history-section">
            <div className="section-header">
              <h2>📚 Exam History</h2>
              <Link to="/student/exams" className="view-all-link">View All</Link>
            </div>
            <div className="exam-history-list">
              {examHistory.map(exam => (
                <div key={exam.id} className="exam-history-card">
                  <div className="exam-header">
                    <h4>{exam.title}</h4>
                    <span 
                      className="exam-score" 
                      style={{ color: getScoreColor(exam.score) }}
                    >
                      {exam.score}%
                    </span>
                  </div>
                  <div className="exam-details">
                    <span className="course">{exam.course}</span>
                    <span className="date">{formatDate(exam.date)}</span>
                  </div>
                  <div className="exam-meta">
                    <span className="duration">Duration: {exam.duration}</span>
                    <span className={`incidents ${exam.incidentsCount === 0 ? 'clean' : 'flagged'}`}>
                      {exam.incidentsCount === 0 ? '✅ Clean' : `⚠️ ${exam.incidentsCount} incident(s)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="achievements-section">
            <div className="section-header">
              <h2>🏆 Achievements</h2>
            </div>
            <div className="achievements-list">
              {achievements.map(achievement => (
                <div key={achievement.id} className="achievement-card">
                  <div className="achievement-icon" style={{ backgroundColor: getAchievementColor(achievement.type) }}>
                    {achievement.icon}
                  </div>
                  <div className="achievement-content">
                    <h4>{achievement.title}</h4>
                    <p>{achievement.description}</p>
                    <span className="achievement-date">{formatDate(achievement.date)}</span>
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

export default StudentProfile;

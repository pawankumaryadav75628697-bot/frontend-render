import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingExams: 0,
    completedExams: 0,
    averageScore: 0
  });

  const [upcomingExams, setUpcomingExams] = useState([]);
  const [codingExams, setCodingExams] = useState([]);
  const [recentExams, setRecentExams] = useState([]);

  useEffect(() => {
    if (token && user) {
      fetchDashboardData();
    } else if (!token) {
      console.warn('No authentication token found');
      setLoading(false);
    } else if (!user) {
      console.warn('No user data found');
      setLoading(false);
    }
  }, [token, user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch data with individual error handling to prevent one failure from breaking all
      const promises = [
        fetchAvailableExams().catch(err => {
          console.error('Available exams fetch failed:', err);
          return null;
        }),
        fetchCodingExams().catch(err => {
          console.error('Coding exams fetch failed:', err);
          return null;
        }),
        fetchStudentStats().catch(err => {
          console.error('Student stats fetch failed:', err);
          return null;
        })
      ];
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Some dashboard data could not be loaded. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableExams = async () => {
    try {
      const response = await fetch('/api/v1/exams/available/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        // Process exams for display with error handling
        const processedExams = exams.map(exam => {
          try {
            return {
              id: exam._id,
              title: exam.title || 'Untitled Exam',
              course: exam.courseCode || 'N/A',
              courseName: exam.course || 'No Course',
              startDate: exam.scheduling?.startDate || new Date().toISOString(),
              endDate: exam.scheduling?.endDate || new Date().toISOString(),
              duration: `${exam.settings?.duration || 60} minutes`,
              type: exam.proctoring?.enabled ? 'Proctored' : 'Standard',
              status: exam.status || 'draft',
              canAttempt: exam.canAttempt !== undefined ? exam.canAttempt : true,
              attemptsMade: exam.studentAttempts || 0,
              maxAttempts: exam.settings?.maxAttempts || 3,
              instructor: exam.instructor?.fullName || 'Unknown Instructor'
            };
          } catch (procError) {
            console.warn('Error processing exam:', exam._id, procError.message);
            return null;
          }
        }).filter(Boolean);
        
        setUpcomingExams(processedExams);
        
        // Update stats
        setStats(prev => ({
          ...prev,
          upcomingExams: processedExams.length
        }));
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to fetch available exams:', response.status, errorData.message);
        if (response.status === 401) {
          toast.error('Session expired. Please login again.');
        } else if (response.status === 403) {
          toast.error('Access denied. Please check your permissions.');
        } else {
          toast.error('Unable to load exams. Please try again later.');
        }
        setUpcomingExams([]);
      }
    } catch (error) {
      console.error('Error fetching available exams:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error('Unable to load exams. Please refresh the page.');
      }
      setUpcomingExams([]);
    }
  };

  const fetchCodingExams = async () => {
    try {
      const response = await fetch('/api/v1/coding-exams', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        // Process coding exams for display with error handling
        const processedExams = exams.map(exam => {
          try {
            return {
              id: exam._id,
              title: exam.title || 'Untitled Coding Challenge',
              course: exam.courseCode || 'N/A',
              courseName: exam.course || 'No Course',
              startDate: exam.scheduling?.startDate || null,
              endDate: exam.scheduling?.endDate || null,
              duration: `${exam.settings?.duration || 60} minutes`,
              type: 'Coding Challenge',
              status: exam.status || 'draft',
              canStart: exam.studentStatus?.canStart || false,
              hasAttempted: exam.studentStatus?.hasAttempted || false,
              attemptStatus: exam.studentStatus?.attemptStatus || 'not_started',
              timeRemaining: exam.studentStatus?.timeRemaining || 0,
              instructor: exam.instructor?.fullName || 'Unknown Instructor',
              difficulty: exam.codingQuestion?.difficulty || 'medium',
              category: exam.codingQuestion?.category || 'General',
              allowedLanguages: exam.settings?.allowedLanguages || ['javascript'],
              totalPoints: exam.settings?.totalPoints || 100
            };
          } catch (procError) {
            console.warn('Error processing coding exam:', exam._id, procError.message);
            return null;
          }
        }).filter(Boolean);
        
        setCodingExams(processedExams);
        
        // Update stats to include coding exams
        setStats(prev => ({
          ...prev,
          upcomingExams: prev.upcomingExams + processedExams.filter(exam => 
            exam.status === 'active' || exam.status === 'published'
          ).length
        }));
      } else if (response.status === 404) {
        // Coding exams endpoint might not exist yet, that's ok
        console.log('Coding exams endpoint not found, skipping...');
        setCodingExams([]);
      } else {
        // Try to read JSON, then text, to get meaningful diagnostics
        let errorPayload = { message: 'Unknown error' };
        try {
          errorPayload = await response.json();
        } catch (_) {
          try {
            const text = await response.text();
            errorPayload = { message: text };
          } catch (_) {}
        }
        console.error('[CodingExams] Fetch failed', {
          status: response.status,
          statusText: response.statusText,
          url: '/api/v1/coding-exams',
          payload: errorPayload
        });
        if (response.status === 401) {
          console.warn('Authentication issue with coding exams endpoint');
        }
        setCodingExams([]);
      }
    } catch (error) {
      console.error('Error fetching coding exams:', error);
      // Don't show error toast for coding exams as they might not be implemented yet
      setCodingExams([]);
    }
  };

  const fetchStudentStats = async () => {
    try {
      // Since we don't have a specific student stats endpoint, 
      // we'll calculate from available data
      const response = await fetch('/api/v1/exams/available/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const exams = data.data || [];
        
        let completedAttempts = 0;
        let totalScore = 0;
        
        exams.forEach(exam => {
          try {
            if (exam.lastAttempt && exam.lastAttempt.status === 'completed') {
              completedAttempts++;
              totalScore += exam.lastAttempt.score?.percentage || 0;
            }
          } catch (examError) {
            console.warn('Error processing exam stats:', exam._id, examError.message);
          }
        });
        
        const averageScore = completedAttempts > 0 ? totalScore / completedAttempts : 0;
        
        setStats(prev => ({
          ...prev,
          completedExams: completedAttempts,
          averageScore: parseFloat(averageScore.toFixed(1))
        }));
        
        // Set recent completed exams with error handling
        try {
          const recentCompletedExams = exams
            .filter(exam => exam.lastAttempt && exam.lastAttempt.status === 'completed')
            .sort((a, b) => {
              const dateA = new Date(a.lastAttempt?.submittedAt || 0);
              const dateB = new Date(b.lastAttempt?.submittedAt || 0);
              return dateB - dateA;
            })
            .slice(0, 5)
            .map(exam => {
              try {
                return {
                  id: exam._id,
                  title: exam.title || 'Untitled Exam',
                  course: exam.courseCode || 'N/A',
                  date: exam.lastAttempt?.submittedAt || new Date().toISOString(),
                  score: exam.lastAttempt?.score?.percentage || 0,
                  status: 'completed'
                };
              } catch (mapError) {
                console.warn('Error processing recent exam:', exam._id, mapError.message);
                return null;
              }
            })
            .filter(Boolean);
          
          setRecentExams(recentCompletedExams);
        } catch (recentError) {
          console.warn('Error processing recent exams:', recentError.message);
          setRecentExams([]);
        }
      } else {
        console.error('Failed to fetch student stats:', response.status);
        // Set default values on API failure
        setStats(prev => ({
          ...prev,
          completedExams: 0,
          averageScore: 0
        }));
        setRecentExams([]);
      }
    } catch (error) {
      console.error('Error fetching student stats:', error);
      // Set default values on error
      setStats(prev => ({
        ...prev,
        completedExams: 0,
        averageScore: 0
      }));
      setRecentExams([]);
    }
  };

  const handleStartExam = async (examId) => {
    try {
      const response = await fetch(`/api/v1/exams/${examId}/attempt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInfo: {
            screen: {
              width: window.screen.width,
              height: window.screen.height
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store exam data for ExamInterface
        const examData = {
          exam: data.data.exam,
          attemptId: data.data.attemptId,
          timeRemaining: data.data.exam.settings.duration * 60, // Convert minutes to seconds
          startTime: new Date().toISOString()
        };
        
        localStorage.setItem('examData', JSON.stringify(examData));
        localStorage.setItem('examToken', token); // Store auth token for exam interface
        
        console.log('Exam data stored successfully:', {
          examTitle: data.data.exam.title,
          attemptId: data.data.attemptId,
          duration: data.data.exam.settings.duration,
          questions: data.data.exam.questions.length
        });
        
        // Navigate to exam taking interface
        toast.success('Exam started successfully!');
        window.location.href = `/student/exam/${data.data.attemptId}`;
      } else {
        toast.error(data.message || 'Failed to start exam');
      }
    } catch (error) {
      console.error('Error starting exam:', error);
      toast.error('Error starting exam. Please try again.');
    }
  };

  const handleStartCodingExam = async (examId) => {
    try {
      const response = await fetch(`/api/v1/coding-exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInfo: {
            screen: {
              width: window.screen.width,
              height: window.screen.height
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text().catch(() => '');
        console.error('[CodingExams] Start parse error', { status: response.status, statusText: response.statusText, body: text });
        data = { message: text || 'Failed to start coding exam' };
      }

      if (response.ok) {
        // Navigate to coding exam interface
        toast.success('Coding exam started successfully!');
        window.location.href = `/student/coding-exam/${data.data._id}`;
      } else {
        console.error('[CodingExams] Start failed', { status: response.status, statusText: response.statusText, data });
        toast.error(data.message || 'Failed to start coding exam');
      }
    } catch (error) {
      console.error('Error starting coding exam:', error);
      toast.error('Error starting exam. Please try again.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExamAvailable = (exam) => {
    const now = new Date();
    const startDate = new Date(exam.startDate);
    const endDate = new Date(exam.endDate);
    return now >= startDate && now <= endDate;
  };

  const isCodingExamWithinWindow = (exam) => {
    try {
      const now = new Date();
      const start = new Date(exam.startDate);
      const end = new Date(exam.endDate);
      return now >= start && now <= end;
    } catch (_) {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="student-dashboard">
        <div className="loading-dashboard">
          <div className="loading-spinner">⏳</div>
          <h2>Loading Dashboard...</h2>
          <p>Fetching your exam data...</p>
          {process.env.NODE_ENV === 'development' && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
              <p>Debug Info:</p>
              <p>User: {user?.fullName || 'Not loaded'}</p>
              <p>Token: {token ? 'Present' : 'Missing'}</p>
              <p>User Type: {user?.userType || 'Unknown'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{getGreeting()}, {user?.fullName}! 👋</h1>
          <p>Ready to excel in your upcoming exams?</p>
        </div>
        <div className="quick-actions">
          <Link to="/student/profile" className="action-btn profile-btn">
            <span className="icon">👤</span>
            Profile
          </Link>
          <Link to="/student/exams" className="action-btn exam-btn">
            <span className="icon">📝</span>
            View All Exams
          </Link>
          <Link to="/student/code-compiler" className="action-btn compiler-btn">
            <span className="icon">💻</span>
            Code Compiler
          </Link>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <h3>{stats.upcomingExams}</h3>
            <p>Upcoming Exams</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.completedExams}</h3>
            <p>Completed Exams</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.averageScore}%</h3>
            <p>Average Score</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="content-left">
          <div className="upcoming-exams-section">
            <div className="section-header">
              <h2>📅 Upcoming Exams</h2>
              <Link to="/student/exams" className="view-all-link">View All</Link>
            </div>
            <div className="exams-list">
              {upcomingExams.length === 0 ? (
                <div className="empty-exams">
                  <div className="empty-icon">📝</div>
                  <h3>No Available Exams</h3>
                  <p>You don't have any upcoming exams at the moment.</p>
                </div>
              ) : (
                upcomingExams.map(exam => (
                  <div key={exam.id} className="exam-card">
                    <div className="exam-header">
                      <h3>{exam.title}</h3>
                      <span className="exam-type">{exam.type}</span>
                      <span className={`exam-status ${exam.status}`}>{exam.status.toUpperCase()}</span>
                    </div>
                    <div className="exam-details">
                      <div className="exam-info">
                        <span className="course">{exam.course} - {exam.courseName}</span>
                        <span className="date">
                          Starts: {formatDateTime(exam.startDate)}
                        </span>
                        <span className="date">
                          Ends: {formatDateTime(exam.endDate)}
                        </span>
                        <span className="duration">{exam.duration}</span>
                        <span className="attempts">
                          Attempts: {exam.attemptsMade}/{exam.maxAttempts}
                        </span>
                        {exam.instructor && (
                          <span className="instructor">Instructor: {exam.instructor}</span>
                        )}
                      </div>
                      <div className="exam-actions">
                        {isExamAvailable(exam) && exam.canAttempt ? (
                          <button 
                            className="join-btn available"
                            onClick={() => handleStartExam(exam.id)}
                          >
                            <span className="icon">🚀</span>
                            Start Exam
                          </button>
                        ) : !isExamAvailable(exam) ? (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">⏰</span>
                            Not Available
                          </button>
                        ) : !exam.canAttempt ? (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">🚫</span>
                            No Attempts Left
                          </button>
                        ) : (
                          <Link to={`/student/exam/${exam.id}`} className="join-btn">
                            <span className="icon">👁️</span>
                            View Details
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coding Exams Section */}
          <div className="coding-exams-section">
            <div className="section-header">
              <h2>💻 Coding Challenges</h2>
              <Link to="/student/coding-exams" className="view-all-link">View All</Link>
            </div>
            <div className="exams-list">
              {codingExams.length === 0 ? (
                <div className="empty-exams">
                  <div className="empty-icon">💻</div>
                  <h3>No Coding Challenges</h3>
                  <p>No coding challenges are available at the moment.</p>
                </div>
              ) : (
                codingExams.map(exam => (
                  <div key={exam.id} className="exam-card coding-exam">
                    <div className="exam-header">
                      <h3>{exam.title}</h3>
                      <span className="exam-type coding">{exam.type}</span>
                      <span className={`exam-status ${exam.status}`}>{exam.status.toUpperCase()}</span>
                    </div>
                    <div className="exam-details">
                      <div className="exam-info">
                        <span className="course">{exam.course} - {exam.courseName}</span>
                        {exam.difficulty && (
                          <span className={`difficulty-badge ${exam.difficulty}`}>
                            {exam.difficulty.toUpperCase()}
                          </span>
                        )}
                        {exam.category && (
                          <span className="category-badge">{exam.category}</span>
                        )}
                        <span className="date">
                          Starts: {formatDateTime(exam.startDate)}
                        </span>
                        <span className="date">
                          Ends: {formatDateTime(exam.endDate)}
                        </span>
                        <span className="duration">{exam.duration}</span>
                        <span className="points">{exam.totalPoints} points</span>
                        {exam.allowedLanguages && (
                          <span className="languages">
                            Languages: {exam.allowedLanguages.join(', ').toUpperCase()}
                          </span>
                        )}
                        {exam.instructor && (
                          <span className="instructor">Instructor: {exam.instructor}</span>
                        )}
                      </div>
                      <div className="exam-actions">
                        {exam.hasAttempted && exam.attemptStatus === 'in_progress' ? (
                          <button 
                            className="join-btn in-progress"
                            onClick={() => window.location.href = `/student/coding-exam/${exam.id}`}
                          >
                            <span className="icon">▶️</span>
                            Continue ({Math.floor(exam.timeRemaining / 60)}m left)
                          </button>
                        ) : (exam.canStart && isCodingExamWithinWindow(exam)) ? (
                          <button 
                            className="join-btn available coding"
                            onClick={() => handleStartCodingExam(exam.id)}
                          >
                            <span className="icon">🚀</span>
                            Start Challenge
                          </button>
                        ) : (!isCodingExamWithinWindow(exam) && exam.endDate && new Date() > new Date(exam.endDate)) ? (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">⏰</span>
                            Exam time is over. You can no longer attempt this challenge.
                          </button>
                        ) : exam.hasAttempted ? (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">✅</span>
                            Completed
                          </button>
                        ) : !isExamAvailable(exam) ? (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">⏰</span>
                            Not Available
                          </button>
                        ) : (
                          <button className="join-btn disabled" disabled>
                            <span className="icon">🔒</span>
                            Access Restricted
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="system-check-section">
            <div className="section-header">
              <h2>🔧 System Check</h2>
            </div>
            <div className="system-check-card">
              <div className="check-items">
                <div className="check-item">
                  <span className="check-icon success">✅</span>
                  <span>Camera Access</span>
                </div>
                <div className="check-item">
                  <span className="check-icon success">✅</span>
                  <span>Microphone Access</span>
                </div>
                <div className="check-item">
                  <span className="check-icon success">✅</span>
                  <span>Screen Recording</span>
                </div>
                <div className="check-item">
                  <span className="check-icon warning">⚠️</span>
                  <span>Browser Security</span>
                </div>
              </div>
              <button className="run-check-btn">Run Full System Check</button>
            </div>
          </div>
        </div>

        <div className="content-right">
          <div className="recent-exams-section">
            <div className="section-header">
              <h2>📈 Recent Exam Results</h2>
              <Link to="/student/results" className="view-all-link">View All</Link>
            </div>
            <div className="recent-exams-list">
              {recentExams && recentExams.length > 0 ? (
                recentExams.map(exam => (
                  <div key={exam.id} className="recent-exam-card">
                    <div className="exam-info">
                      <h4>{exam.title}</h4>
                      <span className="course">{exam.course}</span>
                      <span className="date">{formatDate(exam.date)}</span>
                    </div>
                    <div className="exam-score" style={{ color: getScoreColor(exam.score) }}>
                      {exam.score}%
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-exams">
                  <div className="empty-icon">📈</div>
                  <p>No completed exams yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="announcements-section">
            <div className="section-header">
              <h2>📢 Announcements</h2>
            </div>
            <div className="announcements-list">
              <div className="announcement-card">
                <div className="announcement-icon">🎯</div>
                <div className="announcement-content">
                  <h4>Exam Schedule Update</h4>
                  <p>New proctoring guidelines for final exams</p>
                  <span className="announcement-time">2 hours ago</span>
                </div>
              </div>
              <div className="announcement-card">
                <div className="announcement-icon">🔧</div>
                <div className="announcement-content">
                  <h4>System Maintenance</h4>
                  <p>Scheduled maintenance on Jan 25, 2024</p>
                  <span className="announcement-time">1 day ago</span>
                </div>
              </div>
            </div>
          </div>

          <div className="tips-section">
            <div className="section-header">
              <h2>💡 Exam Tips</h2>
            </div>
            <div className="tips-card">
              <h4>🎯 Today's Tip</h4>
              <p>Ensure good lighting and a quiet environment before starting your proctored exam. Test your camera and microphone in advance!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;

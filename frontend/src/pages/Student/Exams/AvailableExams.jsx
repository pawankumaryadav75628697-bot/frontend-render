import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import './AvailableExams.css';

const AvailableExams = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingExam, setStartingExam] = useState(null);

  useEffect(() => {
    fetchAvailableExams();
  }, []);

  const fetchAvailableExams = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/exams/available/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setExams(data.data);
      } else {
        toast.error(data.message || 'Error fetching available exams');
      }
    } catch (error) {
      console.error('Error fetching available exams:', error);
      toast.error('Error fetching available exams');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (examId) => {
    setStartingExam(examId);
    
    try {
      const response = await fetch(`/api/v1/exams/${examId}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          systemInfo: {
            browser: {
              name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other',
              version: navigator.userAgent
            },
            os: {
              name: navigator.platform
            },
            screenResolution: {
              width: window.screen.width,
              height: window.screen.height
            }
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
        
        toast.success('Exam started! Good luck!');
        navigate(`/student/exam/${data.data.attemptId}`);
      } else {
        if (data.data && data.data.attemptId) {
          // Resume existing attempt - need to fetch exam data
          console.log('Resuming existing attempt:', data.data.attemptId);
          navigate(`/student/exam/${data.data.attemptId}`);
        } else {
          toast.error(data.message || 'Error starting exam');
        }
      }
    } catch (error) {
      console.error('Error starting exam:', error);
      toast.error('Error starting exam');
    } finally {
      setStartingExam(null);
    }
  };

  const getExamStatus = (exam) => {
    if (!exam.canAttempt) {
      if (exam.studentAttempts >= exam.settings.maxAttempts) {
        return { text: 'Max Attempts Reached', color: '#dc3545', canStart: false };
      }
    }

    const now = new Date();
    const startDate = new Date(exam.scheduling.startDate);
    const endDate = new Date(exam.scheduling.endDate);

    if (now < startDate) {
      return { text: 'Upcoming', color: '#ffc107', canStart: false };
    }

    if (now > endDate) {
      return { text: 'Expired', color: '#6c757d', canStart: false };
    }

    if (exam.lastAttempt && exam.lastAttempt.status === 'in_progress') {
      return { text: 'Resume', color: '#28a745', canStart: true, isResume: true };
    }

    return { text: 'Available', color: '#28a745', canStart: true };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  if (loading) {
    return (
      <div className="available-exams">
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <p>Loading available exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="available-exams">
      <div className="available-exams-header">
        <div className="header-content">
          <h1>📝 Available Exams</h1>
          <p>Welcome back, {user?.fullName}! Here are your available exams.</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{exams.filter(e => getExamStatus(e).canStart).length}</span>
            <span className="stat-label">Available</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{exams.filter(e => e.lastAttempt?.status === 'in_progress').length}</span>
            <span className="stat-label">In Progress</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{exams.filter(e => e.studentAttempts >= e.settings.maxAttempts).length}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>No exams available</h3>
          <p>You don't have any exams scheduled at the moment. Check back later or contact your instructor.</p>
        </div>
      ) : (
        <div className="exams-grid">
          {exams.map((exam) => {
            const status = getExamStatus(exam);
            const timeRemaining = getTimeRemaining(exam.scheduling.endDate);
            
            return (
              <div key={exam._id} className="exam-card">
                <div className="exam-card-header">
                  <div className="exam-title-section">
                    <h3>{exam.title}</h3>
                    <div className="exam-meta">
                      <span className="course-info">{exam.course} • {exam.courseCode}</span>
                      <span className="instructor">by {exam.instructor.fullName}</span>
                    </div>
                  </div>
                  <div 
                    className="exam-status-badge"
                    style={{ backgroundColor: status.color }}
                  >
                    {status.text}
                  </div>
                </div>

                <div className="exam-card-body">
                  {exam.description && (
                    <div className="exam-description">
                      <p>{exam.description}</p>
                    </div>
                  )}

                  <div className="exam-details">
                    <div className="detail-row">
                      <div className="detail-item">
                        <span className="detail-label">Questions</span>
                        <span className="detail-value">{exam.questions.length}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Duration</span>
                        <span className="detail-value">{exam.settings.duration} min</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Points</span>
                        <span className="detail-value">{exam.settings.totalPoints}</span>
                      </div>
                    </div>
                    
                    <div className="detail-row">
                      <div className="detail-item">
                        <span className="detail-label">Passing Score</span>
                        <span className="detail-value">{exam.settings.passingScore}%</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Attempts</span>
                        <span className="detail-value">{exam.studentAttempts}/{exam.settings.maxAttempts}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Time Left</span>
                        <span className="detail-value">{timeRemaining}</span>
                      </div>
                    </div>
                  </div>

                  <div className="exam-schedule-info">
                    <div className="schedule-item">
                      <span className="schedule-icon">🕐</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Available From</span>
                        <span className="schedule-time">{formatDate(exam.scheduling.startDate)}</span>
                      </div>
                    </div>
                    <div className="schedule-item">
                      <span className="schedule-icon">⏰</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Available Until</span>
                        <span className="schedule-time">{formatDate(exam.scheduling.endDate)}</span>
                      </div>
                    </div>
                  </div>

                  {exam.proctoring.enabled && (
                    <div className="proctoring-notice">
                      <span className="proctoring-icon">👁️</span>
                      <div className="proctoring-info">
                        <strong>Proctoring Enabled</strong>
                        <p>This exam will be monitored. Ensure you have a working camera and microphone.</p>
                      </div>
                    </div>
                  )}

                  {exam.lastAttempt && exam.lastAttempt.status === 'completed' && (
                    <div className="last-attempt-info">
                      <h4>Last Attempt Result</h4>
                      <div className="attempt-result">
                        <div className="result-item">
                          <span className="result-label">Score</span>
                          <span className="result-value">{exam.lastAttempt.score.percentage}%</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Grade</span>
                          <span className="result-value">{exam.lastAttempt.score.grade}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Status</span>
                          <span className={`result-value ${exam.lastAttempt.passed ? 'passed' : 'failed'}`}>
                            {exam.lastAttempt.passed ? '✅ Passed' : '❌ Failed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="exam-card-footer">
                  {status.canStart ? (
                    <button
                      className={`start-exam-btn ${status.isResume ? 'resume' : ''}`}
                      onClick={() => handleStartExam(exam._id)}
                      disabled={startingExam === exam._id}
                    >
                      {startingExam === exam._id ? (
                        <>
                          <span className="loading-spinner-small">⏳</span>
                          Starting...
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">{status.isResume ? '▶️' : '🚀'}</span>
                          {status.isResume ? 'Resume Exam' : 'Start Exam'}
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="exam-unavailable">
                      <span className="unavailable-icon">🚫</span>
                      <span className="unavailable-text">{status.text}</span>
                    </div>
                  )}
                  
                  <div className="exam-actions">
                    <Link 
                      to={`/student/exams/${exam._id}/details`}
                      className="action-link view-details"
                    >
                      📋 View Details
                    </Link>
                    {exam.studentAttempts > 0 && (
                      <Link 
                        to={`/student/exams/${exam._id}/attempts`}
                        className="action-link view-attempts"
                      >
                        📊 View Attempts
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableExams;
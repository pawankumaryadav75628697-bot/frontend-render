import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { examService, APIError } from '../../../services/examService';
import './ExamList.css';

const ExamList = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  // Debug function to test the API
  const debugApiCall = async () => {
    console.log('🐞 Debug API Call - Testing ExamList endpoint');
    console.log('🔑 Token:', token ? 'Present' : 'Missing');
    
    try {
      const response = await fetch('/api/v1/exams/debug/exam-list-test?page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('✅ Debug API Response:', { status: response.status, data });
    } catch (error) {
      console.log('❌ Debug API Error:', error);
    }
  };
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    course: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  useEffect(() => {
    fetchExams();
  }, [filters, pagination.current]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const result = await examService.getExams(filters, pagination);
      
      setExams(result.exams);
      setPagination(result.pagination);
      
    } catch (error) {
      console.error('❌ Error fetching exams:', error);
      
      if (error instanceof APIError) {
        const errorMessage = error.getErrorMessage();
        toast.error(errorMessage);
        
        // Handle authentication errors
        if (error.isAuthenticationError()) {
          navigate('/login');
        }
      } else {
        // Handle non-API errors (like network issues)
        if (error.message === 'Authentication token not found. Please login again.') {
          toast.error('Authentication required. Please login again.');
          navigate('/login');
        } else {
          toast.error(error.message || 'An unexpected error occurred');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (examId, newStatus, examTitle = '') => {
    try {
      console.log(`Attempting to change exam status: ${examId} -> ${newStatus}`);
      
      // Show loading toast
      const loadingToast = toast.loading(`${getStatusVerb(newStatus)} exam...`);
      
      const response = await fetch(`/api/v1/exams/${examId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      const data = await response.json();
      console.log('Status change response:', data);

      if (response.ok) {
        const successMessage = getStatusSuccessMessage(newStatus, examTitle);
        toast.success(successMessage);
        fetchExams(); // Refresh the list
      } else {
        // Handle specific error cases
        if (response.status === 400) {
          toast.error(data.message || 'Cannot change exam status - validation failed');
        } else if (response.status === 403) {
          toast.error('You are not authorized to modify this exam');
        } else if (response.status === 404) {
          toast.error('Exam not found');
        } else {
          toast.error(data.message || 'Error updating exam status');
        }
      }
    } catch (error) {
      console.error('Error updating exam status:', error);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('Unable to connect to server. Please check if the backend is running.');
      } else {
        toast.error('Network error. Please try again.');
      }
    }
  };
  
  const getStatusVerb = (status) => {
    switch (status) {
      case 'published': return 'Publishing';
      case 'active': return 'Activating';
      case 'cancelled': return 'Cancelling';
      case 'completed': return 'Completing';
      default: return 'Updating';
    }
  };
  
  const getStatusSuccessMessage = (status, examTitle) => {
    const title = examTitle ? `"${examTitle}"` : 'Exam';
    switch (status) {
      case 'published': return `${title} published successfully! Students can now see it.`;
      case 'active': return `${title} activated successfully! Students can now take it.`;
      case 'cancelled': return `${title} cancelled successfully.`;
      case 'completed': return `${title} marked as completed.`;
      default: return `${title} status updated to ${status} successfully!`;
    }
  };

  const handleDeleteExam = async (examId, examTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${examTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/exams/${examId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Exam deleted successfully!');
        fetchExams(); // Refresh the list
      } else {
        toast.error(data.message || 'Error deleting exam');
      }
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error('Error deleting exam');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#6c757d';
      case 'published': return '#007bff';
      case 'active': return '#28a745';
      case 'completed': return '#ffc107';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft': return '📝';
      case 'published': return '📢';
      case 'active': return '🔴';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      default: return '📄';
    }
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

  const isExamActive = (exam) => {
    if (!exam.scheduling?.startDate || !exam.scheduling?.endDate) {
      return false;
    }
    
    const now = new Date();
    const startDate = new Date(exam.scheduling.startDate);
    const endDate = new Date(exam.scheduling.endDate);
    return exam.status === 'published' && now >= startDate && now <= endDate;
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, current: page }));
  };

  return (
    <div className="exam-list">
      <div className="exam-list-header">
        <div className="header-title">
          <h1>📚 Exam Management</h1>
          <p>Create, manage, and monitor your exams</p>
        </div>
        <Link to="/admin/exams/create" className="create-exam-btn">
          <span className="icon">➕</span>
          Create New Exam
        </Link>
      </div>

      <div className="exam-filters">
        <div className="filters-row">
          <div className="filter-group">
            <label>Status:</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Course:</label>
            <input
              type="text"
              name="course"
              placeholder="Filter by course..."
              value={filters.course}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              name="search"
              placeholder="Search exams..."
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <p>Loading exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No exams found</h3>
          <p>Get started by creating your first exam</p>
          <Link to="/admin/exams/create" className="create-first-exam-btn">
            Create Your First Exam
          </Link>
        </div>
      ) : (
        <>
          <div className="exams-grid">
            {exams.map((exam) => {
              try {
                return (
              <div key={exam._id || Math.random()} className="exam-card">
                <div className="exam-card-header">
                  <div className="exam-title">
                    <h3>{exam.title}</h3>
                    <span className="course-code">{exam.courseCode}</span>
                  </div>
                  <div 
                    className="exam-status"
                    style={{ backgroundColor: getStatusColor(exam.status) }}
                  >
                    {getStatusIcon(exam.status)} {exam.status}
                  </div>
                </div>

                <div className="exam-card-body">
                  <div className="exam-info">
                    <div className="info-item">
                      <span className="label">Course:</span>
                      <span className="value">{exam.course}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Questions:</span>
                      <span className="value">{exam.questions?.length || 0}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Duration:</span>
                      <span className="value">{exam.settings?.duration || 'N/A'}min</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Points:</span>
                      <span className="value">{exam.settings?.totalPoints || 0}</span>
                    </div>
                  </div>

                  <div className="exam-schedule">
                    <div className="schedule-item">
                      <span className="schedule-label">Start:</span>
                      <span className="schedule-value">
                        {exam.scheduling?.startDate ? formatDate(exam.scheduling.startDate) : 'Not set'}
                      </span>
                    </div>
                    <div className="schedule-item">
                      <span className="schedule-label">End:</span>
                      <span className="schedule-value">
                        {exam.scheduling?.endDate ? formatDate(exam.scheduling.endDate) : 'Not set'}
                      </span>
                    </div>
                  </div>

                  <div className="exam-stats">
                    <div className="stat-item">
                      <span className="stat-value">{exam.analytics?.totalAttempts || 0}</span>
                      <span className="stat-label">Attempts</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{exam.analytics?.completedAttempts || 0}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        {exam.analytics?.averageScore ? exam.analytics.averageScore.toFixed(1) : 0}%
                      </span>
                      <span className="stat-label">Avg Score</span>
                    </div>
                  </div>
                </div>

                <div className="exam-card-footer">
                  <div className="exam-actions">
                    <Link
                      to={`/admin/exams/${exam._id}`}
                      className="action-btn view-btn"
                      title="View Details"
                    >
                      👁️ View
                    </Link>
                    
                    <Link
                      to={`/admin/exams/${exam._id}/edit`}
                      className="action-btn edit-btn"
                      title="Edit Exam"
                    >
                      ✏️ Edit
                    </Link>

                    {exam.status === 'draft' && (
                      <button
                        className="action-btn publish-btn"
                        onClick={() => handleStatusChange(exam._id, 'published', exam.title)}
                        title="Publish Exam"
                      >
                        📢 Publish
                      </button>
                    )}

                    {exam.status === 'published' && (
                      <button
                        className="action-btn activate-btn"
                        onClick={() => handleStatusChange(exam._id, 'active', exam.title)}
                        title="Activate Exam"
                      >
                        🚀 Activate
                      </button>
                    )}

                    {(exam.status === 'active' || exam.status === 'published') && (
                      <button
                        className="action-btn cancel-btn"
                        onClick={() => handleStatusChange(exam._id, 'cancelled', exam.title)}
                        title="Cancel Exam"
                      >
                        ❌ Cancel
                      </button>
                    )}

                    <Link
                      to={`/admin/exams/${exam._id}/attempts`}
                      className="action-btn attempts-btn"
                      title="View Attempts"
                    >
                      📊 Attempts
                    </Link>

                    {(exam.analytics?.totalAttempts || 0) === 0 && (
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteExam(exam._id, exam.title)}
                        title="Delete Exam"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>

                {isExamActive(exam) && (
                  <div className="exam-live-indicator">
                    <span className="live-dot"></span>
                    LIVE NOW
                  </div>
                )}
              </div>
                );
              } catch (error) {
                console.error('Error rendering exam card:', error, exam);
                return (
                  <div key={exam._id || Math.random()} className="exam-card error-card">
                    <div className="exam-card-header">
                      <div className="exam-title">
                        <h3>{exam?.title || 'Error Loading Exam'}</h3>
                        <span className="course-code">ERROR</span>
                      </div>
                    </div>
                    <div className="exam-card-body">
                      <p>Error loading exam data. Please refresh the page.</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(pagination.current - 1)}
                disabled={pagination.current === 1}
                className="pagination-btn"
              >
                ← Previous
              </button>
              
              <div className="pagination-info">
                Page {pagination.current} of {pagination.pages} 
                ({pagination.total} total exams)
              </div>
              
              <button
                onClick={() => handlePageChange(pagination.current + 1)}
                disabled={pagination.current === pagination.pages}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExamList;
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './ExamResultsCheck.css';

const ExamResultsCheck = () => {
  const [studentId, setStudentId] = useState('');
  const [examKey, setExamKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentId.trim() || !examKey.trim()) {
      toast.error('Please enter both Student ID and Exam Key');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/exam-access/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          examKey: examKey.toUpperCase().trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.data);
        setShowResults(true);
        toast.success('Results found!');
      } else {
        toast.error(data.error || 'No results found for the provided credentials');
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.error('Failed to fetch results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSearch = () => {
    setShowResults(false);
    setResults(null);
    setStudentId('');
    setExamKey('');
  };

  const handleBackToExamAccess = () => {
    navigate('/exam');
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 90) return '#059669'; // Green
    if (percentage >= 80) return '#0891b2'; // Blue
    if (percentage >= 70) return '#f59e0b'; // Yellow
    if (percentage >= 60) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const getGradeLetter = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (showResults && results) {
    return (
      <div className="results-container">
        <div className="results-header">
          <button onClick={handleBackToSearch} className="back-btn">
            ← Back to Search
          </button>
          <h1>📊 Exam Results</h1>
        </div>

        <div className="results-card">
          {/* Student & Exam Info */}
          <div className="info-section">
            <div className="student-info">
              <h2>Student Information</h2>
              <div className="info-item">
                <span className="label">Name:</span>
                <span className="value">{results.student.fullName}</span>
              </div>
              <div className="info-item">
                <span className="label">Student ID:</span>
                <span className="value">{results.student.studentId}</span>
              </div>
            </div>

            <div className="exam-info">
              <h2>Exam Information</h2>
              <div className="info-item">
                <span className="label">Title:</span>
                <span className="value">{results.exam.title}</span>
              </div>
              <div className="info-item">
                <span className="label">Course:</span>
                <span className="value">
                  {results.exam.course} ({results.exam.courseCode})
                </span>
              </div>
              <div className="info-item">
                <span className="label">Total Points:</span>
                <span className="value">{results.exam.totalPoints}</span>
              </div>
              <div className="info-item">
                <span className="label">Passing Score:</span>
                <span className="value">{results.exam.passingScore}%</span>
              </div>
            </div>
          </div>

          {/* Main Results */}
          <div className="main-results">
            <div className="score-display">
              <div className="score-circle" style={{ borderColor: getGradeColor(results.result.percentage) }}>
                <div className="score-value">
                  <span className="percentage">{results.result.percentage}%</span>
                  <span className="grade-letter" style={{ color: getGradeColor(results.result.percentage) }}>
                    {getGradeLetter(results.result.percentage)}
                  </span>
                </div>
              </div>

              <div className="score-details">
                <div className="detail-item">
                  <span className="label">Your Score:</span>
                  <span className="value">
                    {results.result.score} / {results.result.totalPoints}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Percentage:</span>
                  <span className="value">{results.result.percentage}%</span>
                </div>
                <div className="detail-item">
                  <span className="label">Result:</span>
                  <span className={`value status ${results.result.passed ? 'passed' : 'failed'}`}>
                    {results.result.passed ? '✅ PASSED' : '❌ FAILED'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Time Taken:</span>
                  <span className="value">{results.result.timeSpent} minutes</span>
                </div>
                <div className="detail-item">
                  <span className="label">Submitted:</span>
                  <span className="value">{formatDateTime(results.result.submittedAt)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Attempt:</span>
                  <span className="value">#{results.result.attemptNumber}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Alert */}
          <div className={`status-alert ${results.result.passed ? 'success' : 'failure'}`}>
            <div className="status-icon">
              {results.result.passed ? '🎉' : '💔'}
            </div>
            <div className="status-message">
              {results.result.passed ? (
                <div>
                  <h3>Congratulations!</h3>
                  <p>You have successfully passed this exam with a score of {results.result.percentage}%.</p>
                </div>
              ) : (
                <div>
                  <h3>Keep Trying!</h3>
                  <p>You need {results.exam.passingScore}% to pass. Your current score is {results.result.percentage}%.</p>
                </div>
              )}
            </div>
          </div>

          {/* All Attempts History */}
          {results.allAttempts.length > 1 && (
            <div className="attempts-history">
              <h3>Attempt History</h3>
              <div className="attempts-list">
                {results.allAttempts.map((attempt, index) => (
                  <div key={index} className={`attempt-item ${index === 0 ? 'latest' : ''}`}>
                    <div className="attempt-number">
                      Attempt #{results.allAttempts.length - index}
                      {index === 0 && <span className="latest-badge">Latest</span>}
                    </div>
                    <div className="attempt-score">
                      <span className="score">{attempt.percentage}%</span>
                      <span className={`status ${attempt.percentage >= results.exam.passingScore ? 'passed' : 'failed'}`}>
                        {attempt.percentage >= results.exam.passingScore ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                    <div className="attempt-meta">
                      <span className="time">{attempt.timeSpent} min</span>
                      <span className="date">{formatDateTime(attempt.submittedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Analysis */}
          <div className="performance-analysis">
            <h3>Performance Analysis</h3>
            <div className="analysis-grid">
              <div className="analysis-item">
                <div className="analysis-label">Score Range</div>
                <div className="analysis-value">
                  {results.result.percentage >= 90 ? 'Excellent (90-100%)' :
                   results.result.percentage >= 80 ? 'Good (80-89%)' :
                   results.result.percentage >= 70 ? 'Average (70-79%)' :
                   results.result.percentage >= 60 ? 'Below Average (60-69%)' :
                   'Poor (Below 60%)'}
                </div>
              </div>
              <div className="analysis-item">
                <div className="analysis-label">Time Efficiency</div>
                <div className="analysis-value">
                  {results.result.timeSpent < 30 ? 'Very Fast' :
                   results.result.timeSpent < 45 ? 'Fast' :
                   results.result.timeSpent < 60 ? 'Moderate' :
                   'Thorough'}
                </div>
              </div>
            </div>
          </div>

          <div className="actions-section">
            <button onClick={handleBackToExamAccess} className="primary-btn">
              🎓 Take Another Exam
            </button>
            <button onClick={handleBackToSearch} className="secondary-btn">
              📊 Check Other Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-check-container">
      <div className="check-header">
        <button onClick={handleBackToExamAccess} className="back-btn">
          ← Back to Exam Access
        </button>
        <h1>📊 Check Exam Results</h1>
        <p>Enter your credentials to view your exam results</p>
      </div>

      <div className="check-form-card">
        <div className="form-header">
          <h2>Student Result Lookup</h2>
          <p>Enter your Student ID and Exam Key to view your results</p>
        </div>

        <form onSubmit={handleSubmit} className="check-form">
          <div className="input-group">
            <label htmlFor="studentId">Student ID</label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter your student ID"
              className="form-input"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="examKey">Exam Key</label>
            <input
              type="text"
              id="examKey"
              value={examKey}
              onChange={(e) => setExamKey(e.target.value.toUpperCase())}
              placeholder="Enter the exam key"
              className="form-input exam-key"
              maxLength="8"
              required
            />
            <small className="input-help">
              The exam key provided by your instructor
            </small>
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Searching...
              </>
            ) : (
              <>
                🔍 View Results
              </>
            )}
          </button>
        </form>

        <div className="help-section">
          <h4>Need Help?</h4>
          <ul>
            <li>Make sure you have the correct Student ID and Exam Key</li>
            <li>Results are available only after you've completed the exam</li>
            <li>Contact your instructor if you can't find your results</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExamResultsCheck;
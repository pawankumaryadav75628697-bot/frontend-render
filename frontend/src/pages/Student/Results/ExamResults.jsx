import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import './ExamResults.css';

const ExamResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    if (attemptId && token) {
      fetchExamResults();
    }
  }, [attemptId, token]);

  const fetchExamResults = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/exams/attempts/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAttempt(data.data);
        setExam(data.data.exam);
      } else {
        toast.error(data.message || 'Failed to load exam results');
        navigate('/student/dashboard');
      }
    } catch (error) {
      console.error('Error fetching exam results:', error);
      toast.error('Error loading exam results');
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    const colors = {
      'A+': '#10b981', 'A': '#10b981', 'A-': '#10b981',
      'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#3b82f6',
      'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#f59e0b',
      'D+': '#ef4444', 'D': '#ef4444',
      'F': '#dc2626'
    };
    return colors[grade] || '#6b7280';
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAnswerStatus = (answer, question) => {
    if (question.questionType === 'short-answer') {
      return answer.isCorrect ? 'correct' : 'incorrect';
    }
    
    if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
      return answer.isCorrect ? 'correct' : 'incorrect';
    }
    
    return 'unanswered';
  };

  const renderQuestionReview = (question, answer, index) => {
    const status = getAnswerStatus(answer, question);
    
    return (
      <div key={question._id} className={`question-review ${status}`}>
        <div className="question-header">
          <h3>Question {index + 1}</h3>
          <div className="question-score">
            <span className="points-earned">{answer.pointsEarned || 0}</span>
            <span className="points-total">/ {question.points}</span>
          </div>
          <div className={`status-indicator ${status}`}>
            {status === 'correct' ? '✅' : status === 'incorrect' ? '❌' : '⚪'}
          </div>
        </div>
        
        <div className="question-content">
          <div className="question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
          
          {question.questionType === 'multiple-choice' && (
            <div className="options-review">
              {question.options.map((option) => {
                const isSelected = answer.selectedOption === option._id;
                const isCorrect = option.isCorrect;
                
                return (
                  <div 
                    key={option._id} 
                    className={`option-review ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isSelected && !isCorrect ? 'incorrect' : ''}`}
                  >
                    <span className="option-indicator">
                      {isSelected ? (isCorrect ? '✅' : '❌') : (isCorrect ? '✅' : '⚪')}
                    </span>
                    <span className="option-text">{option.text}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {question.questionType === 'true-false' && (
            <div className="tf-review">
              <div className={`tf-option ${answer.selectedOption === 'true' ? 'selected' : ''} ${question.correctAnswer === 'true' ? 'correct' : ''}`}>
                <span className="tf-indicator">
                  {answer.selectedOption === 'true' ? (question.correctAnswer === 'true' ? '✅' : '❌') : (question.correctAnswer === 'true' ? '✅' : '⚪')}
                </span>
                <span>True</span>
              </div>
              <div className={`tf-option ${answer.selectedOption === 'false' ? 'selected' : ''} ${question.correctAnswer === 'false' ? 'correct' : ''}`}>
                <span className="tf-indicator">
                  {answer.selectedOption === 'false' ? (question.correctAnswer === 'false' ? '✅' : '❌') : (question.correctAnswer === 'false' ? '✅' : '⚪')}
                </span>
                <span>False</span>
              </div>
            </div>
          )}
          
          {question.questionType === 'short-answer' && (
            <div className="short-answer-review">
              <div className="student-answer">
                <strong>Your Answer:</strong>
                <div className={`answer-text ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                  {answer.textAnswer || 'No answer provided'}
                </div>
              </div>
              {exam.settings.showCorrectAnswers && (
                <div className="correct-answer">
                  <strong>Correct Answer:</strong>
                  <div className="answer-text correct">
                    {question.correctAnswer}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {question.explanation && exam.settings.showExplanations && (
            <div className="question-explanation">
              <strong>Explanation:</strong>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="exam-results">
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <h2>Loading Results...</h2>
          <p>Fetching your exam results...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="exam-results">
        <div className="error-state">
          <h2>Results Not Found</h2>
          <p>The exam results you're looking for could not be found.</p>
          <Link to="/student/dashboard" className="back-btn">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const answeredQuestions = attempt.answers.length;
  const totalQuestions = exam.questions.length;
  const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;

  return (
    <div className="exam-results">
      <div className="results-header">
        <div className="header-content">
          <h1>📊 Exam Results</h1>
          <div className="exam-info">
            <h2>{exam.title}</h2>
            <p>{exam.course} • {exam.courseCode}</p>
            <p className="instructor">Instructor: {exam.instructor?.fullName}</p>
          </div>
        </div>
        
        <div className="results-summary">
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: getGradeColor(attempt.score.grade) }}>
              <span className="percentage">{attempt.score.percentage}%</span>
              <span className="grade" style={{ color: getGradeColor(attempt.score.grade) }}>
                {attempt.score.grade}
              </span>
            </div>
          </div>
          
          <div className={`pass-status ${attempt.passed ? 'passed' : 'failed'}`}>
            <span className="status-icon">{attempt.passed ? '🎉' : '📝'}</span>
            <span className="status-text">
              {attempt.passed ? 'Congratulations! You Passed' : 'Not Passed - Try Again'}
            </span>
            <span className="pass-threshold">
              (Passing Score: {exam.settings.passingScore}%)
            </span>
          </div>
        </div>
      </div>

      <div className="results-stats">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{attempt.score.raw}</h3>
            <p>Points Earned</p>
            <small>out of {exam.settings.totalPoints}</small>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{correctAnswers}</h3>
            <p>Correct Answers</p>
            <small>out of {totalQuestions}</small>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <h3>{formatTime(attempt.timeSpent)}</h3>
            <p>Time Spent</p>
            <small>out of {exam.settings.duration} min</small>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{((answeredQuestions / totalQuestions) * 100).toFixed(0)}%</h3>
            <p>Completion Rate</p>
            <small>{answeredQuestions} of {totalQuestions}</small>
          </div>
        </div>
      </div>

      <div className="results-details">
        <div className="attempt-info">
          <h3>📋 Attempt Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Attempt Number:</span>
              <span className="value">#{attempt.attemptNumber}</span>
            </div>
            <div className="info-item">
              <span className="label">Started:</span>
              <span className="value">{formatDate(attempt.startTime)}</span>
            </div>
            <div className="info-item">
              <span className="label">Submitted:</span>
              <span className="value">{formatDate(attempt.submittedAt)}</span>
            </div>
            <div className="info-item">
              <span className="label">Status:</span>
              <span className={`value status-${attempt.status}`}>{attempt.status.replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>
        </div>

        {attempt.proctoring.enabled && (
          <div className="proctoring-info">
            <h3>👁️ Proctoring Summary</h3>
            <div className="proctoring-stats">
              <div className="proctoring-stat">
                <span className="stat-label">Risk Score:</span>
                <span className={`stat-value risk-${attempt.proctoring.riskScore < 30 ? 'low' : attempt.proctoring.riskScore < 70 ? 'medium' : 'high'}`}>
                  {attempt.proctoring.riskScore}/100
                </span>
              </div>
              <div className="proctoring-stat">
                <span className="stat-label">Events Detected:</span>
                <span className="stat-value">{attempt.proctoring.events.length}</span>
              </div>
              {attempt.proctoring.flaggedForReview && (
                <div className="review-notice">
                  <span className="review-icon">⚠️</span>
                  <span>This attempt has been flagged for review</span>
                </div>
              )}
            </div>
          </div>
        )}

        {(exam.settings.showResultsImmediately && (exam.settings.showCorrectAnswers || exam.settings.showExplanations)) && (
          <div className="answer-review-section">
            <div className="section-header">
              <h3>📝 Answer Review</h3>
              <button 
                className="toggle-answers-btn"
                onClick={() => setShowAnswers(!showAnswers)}
              >
                {showAnswers ? 'Hide Answers' : 'Show Answers'}
              </button>
            </div>
            
            {showAnswers && (
              <div className="questions-review">
                {exam.questions.map((question, index) => {
                  const answer = attempt.answers.find(a => a.questionId.toString() === question._id.toString()) || {};
                  return renderQuestionReview(question, answer, index);
                })}
              </div>
            )}
          </div>
        )}

        <div className="performance-analysis">
          <h3>📈 Performance Analysis</h3>
          <div className="analysis-grid">
            <div className="analysis-item">
              <span className="analysis-label">Accuracy:</span>
              <span className="analysis-value">{((correctAnswers / answeredQuestions) * 100 || 0).toFixed(1)}%</span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">Time Efficiency:</span>
              <span className="analysis-value">
                {(((exam.settings.duration * 60 - attempt.timeSpent) / (exam.settings.duration * 60)) * 100).toFixed(1)}% remaining
              </span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">Questions per Minute:</span>
              <span className="analysis-value">
                {(answeredQuestions / (attempt.timeSpent / 60)).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="results-actions">
        <Link to="/student/dashboard" className="action-btn primary">
          Return to Dashboard
        </Link>
        
        {attempt.attemptNumber < exam.settings.maxAttempts && !attempt.passed && (
          <Link to={`/student/exams`} className="action-btn secondary">
            Retake Exam
          </Link>
        )}
        
        <button 
          className="action-btn secondary"
          onClick={() => window.print()}
        >
          Print Results
        </button>
      </div>
    </div>
  );
};

export default ExamResults;
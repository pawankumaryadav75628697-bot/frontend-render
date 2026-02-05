import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import CodingQuestionComponent from '../../../components/Student/CodingQuestionComponent';
import './ExamInterface.css';

const ExamInterface = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [examData, setExamData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    // Load exam data from localStorage or API
    const storedExamData = localStorage.getItem('examData');
    if (storedExamData) {
      try {
        const data = JSON.parse(storedExamData);
        
        // Validate the exam data structure
        if (!data || !data.exam) {
          console.error('Invalid exam data structure:', data);
          toast.error('Invalid exam data. Please start the exam again.');
          navigate('/student/exams');
          return;
        }
        
        if (!data.exam.questions || !Array.isArray(data.exam.questions) || data.exam.questions.length === 0) {
          console.error('No questions found in exam data:', data);
          toast.error('No questions found in this exam. Please contact your instructor.');
          navigate('/student/exams');
          return;
        }
        
        console.log('Exam data loaded from localStorage:', {
          title: data.exam.title,
          questionCount: data.exam.questions.length,
          timeRemaining: data.timeRemaining
        });
        
        setExamData(data);
        setTimeRemaining(data.timeRemaining || data.exam.settings?.duration * 60 || 3600);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing exam data:', error);
        fetchExamDataFromAPI();
      }
    } else {
      console.log('No stored exam data found, fetching from API...');
      fetchExamDataFromAPI();
    }
  }, [attemptId, navigate]);
  
  const fetchExamDataFromAPI = async () => {
    if (!attemptId) {
      toast.error('No exam attempt ID provided.');
      navigate('/student/exams');
      return;
    }
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('examToken');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        navigate('/');
        return;
      }
      
      console.log('Fetching exam attempt data for:', attemptId);
      
      const response = await fetch(`/api/v1/exams/attempts/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const attempt = data.data;
        
        // Validate exam data structure
        if (!attempt.exam || !attempt.exam.questions || !Array.isArray(attempt.exam.questions) || attempt.exam.questions.length === 0) {
          console.error('Invalid exam data from API:', attempt);
          toast.error('No questions found in this exam. Please contact your instructor.');
          navigate('/student/exams');
          return;
        }
        
        // Calculate time remaining based on attempt start time and exam duration
        const startTime = new Date(attempt.startTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalDurationSeconds = attempt.exam.settings.duration * 60;
        const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
        
        const examData = {
          exam: attempt.exam,
          attemptId: attempt._id,
          timeRemaining: remainingSeconds,
          startTime: attempt.startTime
        };
        
        // Store for future use
        localStorage.setItem('examData', JSON.stringify(examData));
        localStorage.setItem('examToken', token);
        
        console.log('Exam data fetched from API:', {
          title: attempt.exam.title,
          attemptId: attempt._id,
          timeRemaining: remainingSeconds,
          questions: attempt.exam.questions ? attempt.exam.questions.length : 0
        });
        
        setExamData(examData);
        setTimeRemaining(remainingSeconds);
        setLoading(false);
      } else {
        throw new Error(data.message || 'Failed to fetch exam data');
      }
    } catch (error) {
      console.error('Error fetching exam data from API:', error);
      toast.error('Unable to load exam data. Please start the exam again.');
      navigate('/student/exams');
    }
  };

  useEffect(() => {
    // Only start timer and auto-submit logic when examData is loaded
    if (!examData || !examData.exam) {
      return;
    }
    
    if (timeRemaining <= 0 && !examCompleted) {
      handleSubmitExam(true); // Auto-submit when time runs out
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, examCompleted, examData]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitExam = async (isAutoSubmit = false) => {
    if (submitting) return;
    
    // Add null checks to prevent runtime errors
    if (!examData || !examData.exam || !examData.exam.questions) {
      console.error('Exam data not available for submission');
      toast.error('Exam data not available. Please refresh and try again.');
      return;
    }
    
    const unansweredQuestions = examData.exam.questions.length - Object.keys(answers).length;
    
    if (!isAutoSubmit && unansweredQuestions > 0) {
      if (!window.confirm(`You have ${unansweredQuestions} unanswered questions. Are you sure you want to submit?`)) {
        return;
      }
    }

    setSubmitting(true);
    
    try {
      const formattedAnswers = examData.exam.questions.map(question => ({
        questionId: question._id,
        selectedOption: question.questionType === 'multiple-choice' || question.questionType === 'true-false' 
          ? answers[question._id] : null,
        textAnswer: question.questionType === 'short-answer' ? answers[question._id] : null,
        codingAnswer: question.questionType === 'coding' ? answers[question._id] : null,
        timeSpent: 10 // Mock time spent per question
      }));

      const token = localStorage.getItem('token') || localStorage.getItem('examToken');
      const response = await fetch(`/api/v1/exams/attempts/${examData.attemptId}/submit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: formattedAnswers
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Exam submission successful:', data);
        
        // Extract results from response data
        const submissionResult = {
          score: data.data?.score?.points || 0,
          totalPoints: data.data?.score?.totalPoints || 0,
          percentage: Math.round(data.data?.score?.percentage || 0),
          passed: data.data?.passed || false,
          timeSpent: data.data?.timeSpent || 'N/A',
          passingScore: 70 // Default passing score, could be dynamic
        };
        
        setResults(submissionResult);
        setExamCompleted(true);
        localStorage.removeItem('examToken');
        localStorage.removeItem('examData');
        
        if (isAutoSubmit) {
          toast.info('Time expired! Exam submitted automatically.');
        } else {
          toast.success('Exam submitted successfully!');
        }
      } else {
        console.error('Exam submission failed:', data);
        toast.error(data.message || data.error || 'Failed to submit exam. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getProgressPercentage = () => {
    const answered = Object.keys(answers).length;
    const total = examData?.exam?.questions?.length || 1;
    return Math.round((answered / total) * 100);
  };

  if (loading) {
    return (
      <div className="exam-loading">
        <div className="loading-spinner"></div>
        <p>Loading exam...</p>
      </div>
    );
  }

  if (examCompleted && results) {
    return (
      <div className="exam-results">
        <div className="results-container">
          <div className="results-header">
            <div className="result-icon">
              {results.passed ? '🎉' : '📝'}
            </div>
            <h1>Exam Completed!</h1>
            <p className={`result-status ${results.passed ? 'passed' : 'failed'}`}>
              {results.passed ? 'Congratulations! You passed!' : 'Keep studying and try again!'}
            </p>
          </div>

          <div className="results-details">
            <div className="score-display">
              <div className="score-circle">
                <span className="percentage">{results.percentage}%</span>
              </div>
              <div className="score-info">
                <div className="score-item">
                  <span className="label">Score:</span>
                  <span className="value">{results.score}/{results.totalPoints}</span>
                </div>
                <div className="score-item">
                  <span className="label">Percentage:</span>
                  <span className="value">{results.percentage}%</span>
                </div>
                <div className="score-item">
                  <span className="label">Passing Score:</span>
                  <span className="value">{results.passingScore}%</span>
                </div>
                <div className="score-item">
                  <span className="label">Time Taken:</span>
                  <span className="value">{results.timeSpent} minutes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="results-actions">
            <button onClick={() => navigate('/results')} className="check-results-btn">
              📊 View Detailed Results
            </button>
            <button onClick={() => navigate('/exam')} className="take-another-btn">
              📝 Take Another Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!examData || !examData.exam || !examData.exam.questions || examData.exam.questions.length === 0) {
    return (
      <div className="exam-error">
        <p>Exam data not found. Please start the exam again.</p>
        <button onClick={() => navigate('/exam')}>Go Back</button>
      </div>
    );
  }

  // Ensure currentQuestion is within bounds
  if (currentQuestion >= examData.exam.questions.length) {
    setCurrentQuestion(0);
    return null;
  }

  const currentQuestionData = examData.exam.questions[currentQuestion];

  // Additional safety check for currentQuestionData
  if (!currentQuestionData) {
    return (
      <div className="exam-error">
        <p>Question data not found. Please refresh and try again.</p>
        <button onClick={() => navigate('/exam')}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="exam-interface">
      {/* Header with timer */}
      <div className="exam-header">
        <div className="exam-info">
          <h1>{examData.exam.title}</h1>
          <p>{examData.exam.course} ({examData.exam.courseCode})</p>
        </div>
        
        <div className="exam-timer">
          <div className={`timer ${timeRemaining < 300 ? 'warning' : ''} ${timeRemaining < 60 ? 'critical' : ''}`}>
            <span className="timer-icon">⏰</span>
            <span className="timer-text">{formatTime(timeRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>
        <div className="progress-info">
          <span>Progress: {getProgressPercentage()}% ({Object.keys(answers).length}/{examData.exam.questions.length} answered)</span>
        </div>
      </div>

      {/* Question Navigation */}
      <div className="question-navigation">
        <div className="question-numbers">
          {examData.exam.questions.map((_, index) => (
            <button
              key={index}
              className={`question-number ${
                index === currentQuestion ? 'current' : ''
              } ${answers[examData.exam.questions[index]._id] ? 'answered' : ''}`}
              onClick={() => setCurrentQuestion(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Current Question */}
      <div className="question-section">
        <div className="question-header">
          <span className="question-counter">
            Question {currentQuestion + 1} of {examData.exam.questions.length}
          </span>
          <span className="question-points">
            {currentQuestionData.points} point{currentQuestionData.points > 1 ? 's' : ''}
          </span>
        </div>

        <div className="question-content">
          <h2 className="question-text">{currentQuestionData.questionText}</h2>

          <div className="answer-section">
            {currentQuestionData.questionType === 'multiple-choice' && (
              <div className="multiple-choice">
                {currentQuestionData.options && currentQuestionData.options.map((option, index) => (
                  <label key={index} className="option-label">
                    <input
                      type="radio"
                      name={`question-${currentQuestionData._id}`}
                      value={option._id}
                      checked={answers[currentQuestionData._id] === option._id}
                      onChange={(e) => handleAnswerChange(currentQuestionData._id, e.target.value)}
                    />
                    <span className="option-text">{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestionData.questionType === 'true-false' && (
              <div className="true-false">
                {currentQuestionData.options && currentQuestionData.options.map((option, index) => (
                  <label key={index} className="option-label">
                    <input
                      type="radio"
                      name={`question-${currentQuestionData._id}`}
                      value={option._id}
                      checked={answers[currentQuestionData._id] === option._id}
                      onChange={(e) => handleAnswerChange(currentQuestionData._id, e.target.value)}
                    />
                    <span className="option-text">{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestionData.questionType === 'short-answer' && (
              <div className="short-answer">
                <textarea
                  placeholder="Enter your answer here..."
                  value={answers[currentQuestionData._id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestionData._id, e.target.value)}
                  rows="4"
                  className="answer-textarea"
                />
              </div>
            )}

            {currentQuestionData.questionType === 'coding' && (
              <CodingQuestionComponent
                question={currentQuestionData}
                answer={answers[currentQuestionData._id]}
                onAnswerChange={handleAnswerChange}
                disabled={submitting || examCompleted}
              />
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="question-controls">
        <button 
          className="nav-btn prev"
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
        >
          ← Previous
        </button>

        <div className="control-center">
          <button 
            className="submit-btn"
            onClick={() => handleSubmitExam(false)}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>

        <button 
          className="nav-btn next"
          onClick={() => setCurrentQuestion(Math.min(examData.exam.questions.length - 1, currentQuestion + 1))}
          disabled={currentQuestion === examData.exam.questions.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default ExamInterface;
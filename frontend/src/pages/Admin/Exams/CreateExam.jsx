import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import './CreateExam.css';

const CreateExam = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    course: '',
    courseCode: '',
    questions: [
      {
        questionText: '',
        questionType: 'multiple-choice',
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ],
        correctAnswer: '',
        points: 1,
        explanation: ''
      }
    ],
    settings: {
      duration: 60,
      passingScore: 60,
      shuffleQuestions: false,
      shuffleOptions: false,
      allowBackTracking: true,
      showResultsImmediately: false,
      maxAttempts: 1
    },
    scheduling: {
      startDate: '',
      endDate: '',
      timeZone: 'UTC'
    },
    eligibleStudents: [],
    status: 'draft',
    proctoring: {
      enabled: true,
      cameraRequired: true,
      microphoneRequired: true,
      screenRecording: true,
      lockdownBrowser: false
    }
  });

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Helpers to ensure proper local datetime formatting and feature detection
  const formatLocalDateTime = (date) => {
    const d = new Date(date);
    const pad = (n) => `${n}`.padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const isDatetimeLocalSupported = (() => {
    if (typeof document === 'undefined') return true;
    const input = document.createElement('input');
    input.setAttribute('type', 'datetime-local');
    return input.type === 'datetime-local';
  })();

  // Set default start and end dates
  useEffect(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
    
    setExamData(prev => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        startDate: formatLocalDateTime(startDate),
        endDate: formatLocalDateTime(endDate)
      }
    }));
  }, []);

  // For now, we'll skip fetching students since we don't have that endpoint yet
  // This can be implemented later when needed

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setExamData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
        }
      }));
    } else {
      setExamData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
      }));
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...examData.questions];
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value
    };
    
    setExamData(prev => ({
      ...prev,
      questions: newQuestions
    }));
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const newQuestions = [...examData.questions];
    newQuestions[questionIndex].options[optionIndex] = {
      ...newQuestions[questionIndex].options[optionIndex],
      [field]: value
    };
    
    // If this option is being marked as correct, unmark others for single-correct questions
    if (field === 'isCorrect' && value && newQuestions[questionIndex].questionType === 'multiple-choice') {
      newQuestions[questionIndex].options.forEach((opt, idx) => {
        if (idx !== optionIndex) {
          opt.isCorrect = false;
        }
      });
    }
    
    setExamData(prev => ({
      ...prev,
      questions: newQuestions
    }));
  };

  const addQuestion = () => {
    const newQuestion = {
      questionText: '',
      questionType: 'multiple-choice',
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      correctAnswer: '',
      points: 1,
      explanation: ''
    };
    
    setExamData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const removeQuestion = (index) => {
    if (examData.questions.length > 1) {
      setExamData(prev => ({
        ...prev,
        questions: prev.questions.filter((_, i) => i !== index)
      }));
    }
  };

  const addOption = (questionIndex) => {
    const newQuestions = [...examData.questions];
    newQuestions[questionIndex].options.push({ text: '', isCorrect: false });
    
    setExamData(prev => ({
      ...prev,
      questions: newQuestions
    }));
  };

  const removeOption = (questionIndex, optionIndex) => {
    const newQuestions = [...examData.questions];
    if (newQuestions[questionIndex].options.length > 2) {
      newQuestions[questionIndex].options.splice(optionIndex, 1);
      
      setExamData(prev => ({
        ...prev,
        questions: newQuestions
      }));
    }
  };

  const handleStudentSelection = (studentId, isSelected) => {
    setExamData(prev => ({
      ...prev,
      eligibleStudents: isSelected
        ? [...prev.eligibleStudents, studentId]
        : prev.eligibleStudents.filter(id => id !== studentId)
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!examData.title || !examData.course || !examData.courseCode) {
          toast.error('Please fill in all basic information fields');
          return false;
        }
        break;
      case 2:
        for (let i = 0; i < examData.questions.length; i++) {
          const question = examData.questions[i];
          if (!question.questionText || question.points <= 0) {
            toast.error(`Please complete question ${i + 1}`);
            return false;
          }
          
          if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
            // Filter out empty options
            const validOptions = question.options.filter(opt => opt.text.trim() !== '');
            
            if (validOptions.length < 2) {
              toast.error(`Question ${i + 1} must have at least 2 options with text`);
              return false;
            }
            
            const hasCorrectOption = validOptions.some(opt => opt.isCorrect);
            if (!hasCorrectOption) {
              toast.error(`Please mark the correct answer for question ${i + 1}`);
              return false;
            }
            
            // Update the question to only include valid options
            question.options = validOptions;
          } else if (question.questionType === 'short-answer' && !question.correctAnswer) {
            toast.error(`Please provide the correct answer for question ${i + 1}`);
            return false;
          }
        }
        break;
      case 3:
        if (examData.settings.duration <= 0 || examData.settings.passingScore < 0 || examData.settings.passingScore > 100) {
          toast.error('Please check exam settings');
          return false;
        }
        break;
      case 4:
        const startDate = new Date(examData.scheduling.startDate);
        const endDate = new Date(examData.scheduling.endDate);
        
        if (!examData.scheduling.startDate || !examData.scheduling.endDate) {
          toast.error('Please set both start and end dates');
          return false;
        }
        
        if (endDate <= startDate) {
          toast.error('End date must be after start date');
          return false;
        }
        
        if (startDate <= new Date()) {
          toast.error('Start date must be in the future');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (status = 'draft') => {
    if (!validateStep(4)) return;
    
    setLoading(true);
    
    try {
      // Clean and prepare data for submission
      const cleanedQuestions = examData.questions.map(question => {
        const cleanedQuestion = {
          ...question,
          questionText: question.questionText.trim()
        };
        
        // Clean options for multiple choice and true/false questions
        if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
          cleanedQuestion.options = question.options
            .filter(opt => opt.text.trim() !== '')
            .map(opt => ({
              ...opt,
              text: opt.text.trim()
            }));
          // Remove correctAnswer for multiple choice
          delete cleanedQuestion.correctAnswer;
        } else if (question.questionType === 'short-answer') {
          // For short answer, remove empty options and ensure correctAnswer exists
          cleanedQuestion.options = [];
          cleanedQuestion.correctAnswer = question.correctAnswer.trim();
        }
        
        return cleanedQuestion;
      });
      
      // Calculate total points
      const totalPoints = cleanedQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
      
      const submitData = {
        ...examData,
        questions: cleanedQuestions,
        settings: {
          ...examData.settings,
          totalPoints
        },
        status
      };
      
      const response = await fetch('/api/v1/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });
      
      // Check if response has content before parsing JSON
      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      }
      
      if (response.ok) {
        toast.success(`Exam ${status === 'published' ? 'published' : 'saved as draft'} successfully!`);
        navigate('/admin/exams');
      } else {
        // Handle different error scenarios
        if (response.status === 0 || !response.ok) {
          toast.error('Cannot connect to server. Please check if the backend is running on port 5000.');
        } else if (data && data.message) {
          toast.error(data.message);
        } else {
          toast.error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error creating exam:', error);
      if (error.name === 'SyntaxError') {
        toast.error('Server response error. Please ensure the backend server is running.');
      } else if (error.message.includes('fetch')) {
        toast.error('Cannot connect to server. Please start the backend server on port 5000.');
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h3>📝 Basic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Exam Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={examData.title}
                  onChange={handleInputChange}
                  placeholder="Enter exam title"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="courseCode">Course Code *</label>
                <input
                  type="text"
                  id="courseCode"
                  name="courseCode"
                  value={examData.courseCode}
                  onChange={handleInputChange}
                  placeholder="e.g., CS401"
                  required
                />
              </div>
              
              <div className="form-group full-width">
                <label htmlFor="course">Course Name *</label>
                <input
                  type="text"
                  id="course"
                  name="course"
                  value={examData.course}
                  onChange={handleInputChange}
                  placeholder="Enter course name"
                  required
                />
              </div>
              
              <div className="form-group full-width">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={examData.description}
                  onChange={handleInputChange}
                  placeholder="Enter exam description (optional)"
                  rows="3"
                />
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="step-content">
            <div className="step-header">
              <h3>❓ Questions</h3>
              <button type="button" className="add-question-btn" onClick={addQuestion}>
                <span className="icon">➕</span>
                Add Question
              </button>
            </div>
            
            <div className="questions-list">
              {examData.questions.map((question, qIndex) => (
                <div key={qIndex} className="question-card">
                  <div className="question-header">
                    <h4>Question {qIndex + 1}</h4>
                    {examData.questions.length > 1 && (
                      <button
                        type="button"
                        className="remove-question-btn"
                        onClick={() => removeQuestion(qIndex)}
                      >
                        ❌
                      </button>
                    )}
                  </div>
                  
                  <div className="question-form">
                    <div className="form-group">
                      <label>Question Text *</label>
                      <textarea
                        value={question.questionText}
                        onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                        placeholder="Enter your question"
                        rows="2"
                        required
                      />
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Question Type</label>
                        <select
                          value={question.questionType}
                          onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                        >
                          <option value="multiple-choice">Multiple Choice</option>
                          <option value="true-false">True/False</option>
                          <option value="short-answer">Short Answer</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label>Points *</label>
                        <input
                          type="number"
                          value={question.points}
                          onChange={(e) => handleQuestionChange(qIndex, 'points', Number(e.target.value))}
                          min="1"
                          required
                        />
                      </div>
                    </div>
                    
                    {(question.questionType === 'multiple-choice' || question.questionType === 'true-false') && (
                      <div className="options-section">
                        <div className="options-header">
                          <label>Options *</label>
                          {question.questionType === 'multiple-choice' && (
                            <button
                              type="button"
                              className="add-option-btn"
                              onClick={() => addOption(qIndex)}
                            >
                              Add Option
                            </button>
                          )}
                        </div>
                        
                        <div className="options-list">
                          {question.options.map((option, oIndex) => {
                            const isEmpty = !option.text || option.text.trim() === '';
                            return (
                              <div key={oIndex} className={`option-item ${isEmpty ? 'empty-option' : ''}`}>
                                <input
                                  type={question.questionType === 'true-false' ? 'radio' : 'checkbox'}
                                  name={`question-${qIndex}-correct`}
                                  checked={option.isCorrect}
                                  onChange={(e) => handleOptionChange(qIndex, oIndex, 'isCorrect', e.target.checked)}
                                  disabled={isEmpty}
                                />
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                                  placeholder={question.questionType === 'true-false' 
                                    ? (oIndex === 0 ? 'True' : 'False')
                                    : `Option ${oIndex + 1}`}
                                  className={isEmpty ? 'empty-field' : ''}
                                />
                                {question.questionType === 'multiple-choice' && question.options.length > 2 && (
                                  <button
                                    type="button"
                                    className="remove-option-btn"
                                    onClick={() => removeOption(qIndex, oIndex)}
                                  >
                                    ❌
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {question.questionType === 'short-answer' && (
                      <div className="form-group">
                        <label>Correct Answer *</label>
                        <input
                          type="text"
                          value={question.correctAnswer}
                          onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                          placeholder="Enter the correct answer"
                          required
                        />
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label>Explanation (Optional)</label>
                      <textarea
                        value={question.explanation}
                        onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                        placeholder="Provide explanation for the answer"
                        rows="2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="step-content">
            <h3>⚙️ Exam Settings</h3>
            <div className="settings-grid">
              <div className="settings-section">
                <h4>Time & Scoring</h4>
                <div className="form-group">
                  <label htmlFor="duration">Duration (minutes) *</label>
                  <input
                    type="number"
                    id="duration"
                    name="settings.duration"
                    value={examData.settings.duration}
                    onChange={handleInputChange}
                    min="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="passingScore">Passing Score (%) *</label>
                  <input
                    type="number"
                    id="passingScore"
                    name="settings.passingScore"
                    value={examData.settings.passingScore}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="maxAttempts">Maximum Attempts</label>
                  <input
                    type="number"
                    id="maxAttempts"
                    name="settings.maxAttempts"
                    value={examData.settings.maxAttempts}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
              </div>
              
              <div className="settings-section">
                <h4>Question Options</h4>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="settings.shuffleQuestions"
                      checked={examData.settings.shuffleQuestions}
                      onChange={handleInputChange}
                    />
                    <span>Shuffle Questions</span>
                  </label>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="settings.shuffleOptions"
                      checked={examData.settings.shuffleOptions}
                      onChange={handleInputChange}
                    />
                    <span>Shuffle Answer Options</span>
                  </label>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="settings.allowBackTracking"
                      checked={examData.settings.allowBackTracking}
                      onChange={handleInputChange}
                    />
                    <span>Allow Back Navigation</span>
                  </label>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="settings.showResultsImmediately"
                      checked={examData.settings.showResultsImmediately}
                      onChange={handleInputChange}
                    />
                    <span>Show Results Immediately</span>
                  </label>
                </div>
              </div>
              
              <div className="settings-section">
                <h4>Proctoring Settings</h4>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="proctoring.enabled"
                      checked={examData.proctoring.enabled}
                      onChange={handleInputChange}
                    />
                    <span>Enable Proctoring</span>
                  </label>
                  
                  {examData.proctoring.enabled && (
                    <>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="proctoring.cameraRequired"
                          checked={examData.proctoring.cameraRequired}
                          onChange={handleInputChange}
                        />
                        <span>Require Camera</span>
                      </label>
                      
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="proctoring.microphoneRequired"
                          checked={examData.proctoring.microphoneRequired}
                          onChange={handleInputChange}
                        />
                        <span>Require Microphone</span>
                      </label>
                      
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="proctoring.screenRecording"
                          checked={examData.proctoring.screenRecording}
                          onChange={handleInputChange}
                        />
                        <span>Screen Recording</span>
                      </label>
                      
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="proctoring.lockdownBrowser"
                          checked={examData.proctoring.lockdownBrowser}
                          onChange={handleInputChange}
                        />
                        <span>Lockdown Browser</span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="step-content">
            <h3>📅 Scheduling & Access</h3>
            <div className="scheduling-grid">
              <div className="form-section">
                <h4>Exam Schedule</h4>
                <div className="form-group">
                  <label htmlFor="startDate">Start Date & Time *</label>
                  {isDatetimeLocalSupported ? (
                    <input
                      type="datetime-local"
                      id="startDate"
                      name="scheduling.startDate"
                      value={examData.scheduling.startDate}
                      onChange={handleInputChange}
                      required
                    />
                  ) : (
                    <div className="fallback-datetime">
                      <input
                        type="date"
                        id="startDateDate"
                        value={(examData.scheduling.startDate || '').split('T')[0]}
                        onChange={(e) => {
                          const time = (examData.scheduling.startDate || 'T00:00').split('T')[1] || '00:00';
                          setExamData(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling, startDate: `${e.target.value}T${time}` }
                          }));
                        }}
                        required
                      />
                      <input
                        type="time"
                        id="startDateTime"
                        value={(examData.scheduling.startDate || '').split('T')[1] || '00:00'}
                        onChange={(e) => {
                          const date = (examData.scheduling.startDate || '1970-01-01').split('T')[0];
                          setExamData(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling, startDate: `${date}T${e.target.value}` }
                          }));
                        }}
                        required
                      />
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="endDate">End Date & Time *</label>
                  {isDatetimeLocalSupported ? (
                    <input
                      type="datetime-local"
                      id="endDate"
                      name="scheduling.endDate"
                      value={examData.scheduling.endDate}
                      onChange={handleInputChange}
                      required
                    />
                  ) : (
                    <div className="fallback-datetime">
                      <input
                        type="date"
                        id="endDateDate"
                        value={(examData.scheduling.endDate || '').split('T')[0]}
                        onChange={(e) => {
                          const time = (examData.scheduling.endDate || 'T00:00').split('T')[1] || '00:00';
                          setExamData(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling, endDate: `${e.target.value}T${time}` }
                          }));
                        }}
                        required
                      />
                      <input
                        type="time"
                        id="endDateTime"
                        value={(examData.scheduling.endDate || '').split('T')[1] || '00:00'}
                        onChange={(e) => {
                          const date = (examData.scheduling.endDate || '1970-01-01').split('T')[0];
                          setExamData(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling, endDate: `${date}T${e.target.value}` }
                          }));
                        }}
                        required
                      />
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="timeZone">Time Zone</label>
                  <select
                    id="timeZone"
                    name="scheduling.timeZone"
                    value={examData.scheduling.timeZone}
                    onChange={handleInputChange}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Student Access</h4>
                <p>Leave empty to allow all students, or select specific students:</p>
                
                <div className="students-list">
                  {students.map(student => (
                    <label key={student._id} className="student-checkbox">
                      <input
                        type="checkbox"
                        checked={examData.eligibleStudents.includes(student._id)}
                        onChange={(e) => handleStudentSelection(student._id, e.target.checked)}
                      />
                      <span>{student.fullName} ({student.studentId})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="step-content">
            <h3>📋 Review & Publish</h3>
            <div className="review-section">
              <div className="review-card">
                <h4>Exam Overview</h4>
                <div className="review-item">
                  <strong>Title:</strong> {examData.title}
                </div>
                <div className="review-item">
                  <strong>Course:</strong> {examData.course} ({examData.courseCode})
                </div>
                <div className="review-item">
                  <strong>Questions:</strong> {examData.questions.length}
                </div>
                <div className="review-item">
                  <strong>Total Points:</strong> {examData.questions.reduce((sum, q) => sum + q.points, 0)}
                </div>
                <div className="review-item">
                  <strong>Duration:</strong> {examData.settings.duration} minutes
                </div>
                <div className="review-item">
                  <strong>Passing Score:</strong> {examData.settings.passingScore}%
                </div>
                <div className="review-item">
                  <strong>Schedule:</strong> {new Date(examData.scheduling.startDate).toLocaleString()} - {new Date(examData.scheduling.endDate).toLocaleString()}
                </div>
                <div className="review-item">
                  <strong>Eligible Students:</strong> {examData.eligibleStudents.length === 0 ? 'All students' : `${examData.eligibleStudents.length} selected students`}
                </div>
                <div className="review-item">
                  <strong>Proctoring:</strong> {examData.proctoring.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              
              <div className="publish-actions">
                <button
                  type="button"
                  className="draft-btn"
                  onClick={() => handleSubmit('draft')}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                
                <button
                  type="button"
                  className="publish-btn"
                  onClick={() => handleSubmit('published')}
                  disabled={loading}
                >
                  {loading ? 'Publishing...' : 'Publish Exam'}
                </button>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="create-exam">
      <div className="create-exam-header">
        <button className="back-btn" onClick={() => navigate('/admin/exams')}>
          ← Back to Exams
        </button>
        <h1>Create New Exam</h1>
      </div>
      
      <div className="exam-wizard">
        <div className="wizard-steps">
          {[
            { number: 1, title: 'Basic Info', icon: '📝' },
            { number: 2, title: 'Questions', icon: '❓' },
            { number: 3, title: 'Settings', icon: '⚙️' },
            { number: 4, title: 'Schedule', icon: '📅' },
            { number: 5, title: 'Review', icon: '📋' }
          ].map((step) => (
            <div
              key={step.number}
              className={`wizard-step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
            >
              <div className="step-number">
                {currentStep > step.number ? '✅' : step.icon}
              </div>
              <div className="step-title">{step.title}</div>
            </div>
          ))}
        </div>
        
        <div className="wizard-content">
          {renderStepContent()}
        </div>
        
        <div className="wizard-navigation">
          {currentStep > 1 && (
            <button type="button" className="prev-btn" onClick={prevStep}>
              ← Previous
            </button>
          )}
          
          {currentStep < 5 && (
            <button type="button" className="next-btn" onClick={nextStep}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
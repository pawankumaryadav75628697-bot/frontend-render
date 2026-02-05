import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './CodingExamPublish.css';

const CodingExamPublish = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  
  // Helpers for local datetime formatting and feature detection
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

  const isDatetimeLocalSupported = useMemo(() => {
    if (typeof document === 'undefined') return true;
    const input = document.createElement('input');
    input.setAttribute('type', 'datetime-local');
    return input.type === 'datetime-local';
  }, []);

  const [examData, setExamData] = useState({
    title: '',
    description: '',
    course: '',
    courseCode: '',
    settings: {
      duration: 60, // in minutes
      totalPoints: 100,
      passingScore: 60,
      allowedLanguages: [],
      showResultsImmediately: false,
      maxAttempts: 1,
      autoSubmit: true
    },
    scheduling: {
      startDate: formatLocalDateTime(new Date()),
      endDate: formatLocalDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
    },
    proctoring: {
      enabled: true,
      cameraRequired: true,
      microphoneRequired: false,
      screenRecording: true,
      lockdownBrowser: false
    },
    eligibilityType: 'all', // 'all' or 'specific'
    notifyStudents: true
  });

  useEffect(() => {
    fetchQuestion();
    fetchStudents();
  }, [questionId]);

  const fetchQuestion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/coding-questions/${questionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch question');
      
      const data = await response.json();
      const questionData = data.data;
      setQuestion(questionData);
      
      // Auto-populate exam data based on question
      setExamData(prev => ({
        ...prev,
        title: `${questionData.title} - Coding Challenge`,
        description: `Coding challenge based on: ${questionData.title}`,
        settings: {
          ...prev.settings,
          totalPoints: questionData.totalPoints || 100,
          allowedLanguages: questionData.supportedLanguages || ['python']
        }
      }));
    } catch (error) {
      console.error('Error fetching question:', error);
      toast.error('Failed to load coding question');
      navigate('/admin/coding-questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/v1/admin/students', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStudents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleInputChange = (path, value) => {
    const keys = path.split('.');
    setExamData(prev => {
      const newData = { ...prev };
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleLanguageToggle = (language) => {
    const currentLanguages = examData.settings.allowedLanguages;
    if (currentLanguages.includes(language)) {
      handleInputChange('settings.allowedLanguages', 
        currentLanguages.filter(lang => lang !== language)
      );
    } else {
      handleInputChange('settings.allowedLanguages', [...currentLanguages, language]);
    }
  };

  const handleStudentToggle = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const handleSelectAllStudents = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(student => student._id));
    }
  };

  const handlePublishExam = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!examData.title.trim()) {
      toast.error('Please enter exam title');
      return;
    }
    
    if (!examData.course.trim() || !examData.courseCode.trim()) {
      toast.error('Please enter course and course code');
      return;
    }
    
    if (examData.settings.allowedLanguages.length === 0) {
      toast.error('Please select at least one programming language');
      return;
    }
    
    if (new Date(examData.scheduling.startDate) >= new Date(examData.scheduling.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setLoading(true);
      
      // Create coding exam
      const createResponse = await fetch('/api/v1/coding-exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...examData,
          codingQuestionId: questionId,
          eligibleStudents: examData.eligibilityType === 'specific' ? selectedStudents : []
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create exam');
      }

      const examResult = await createResponse.json();
      const createdExam = examResult.data;
      
      // Publish the exam
      const publishResponse = await fetch(`/api/v1/coding-exams/${createdExam._id}/publish`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          notifyStudents: examData.notifyStudents
        })
      });

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json();
        throw new Error(errorData.message || 'Failed to publish exam');
      }

      toast.success('Coding exam published successfully! Students will be notified.');
      navigate('/admin/coding-exams');
      
    } catch (error) {
      console.error('Error publishing exam:', error);
      toast.error(error.message || 'Failed to publish exam');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !question) {
    return (
      <div className="coding-exam-publish-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading coding question...</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="coding-exam-publish-container">
        <div className="error-message">
          <h2>Question not found</h2>
          <p>The requested coding question could not be loaded.</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/admin/coding-questions')}
          >
            Back to Questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-exam-publish-container">
      <div className="publish-header">
        <button 
          className="back-btn"
          onClick={() => navigate('/admin/coding-questions')}
        >
          ← Back to Questions
        </button>
        <h1>📅 Publish Coding Exam</h1>
      </div>

      <div className="question-preview">
        <div className="preview-header">
          <h2>🚀 Question Preview</h2>
        </div>
        <div className="preview-content">
          <div className="question-info">
            <h3>{question.title}</h3>
            <p>{question.description}</p>
            <div className="question-meta">
              <span className={`difficulty-badge ${question.difficulty}`}>
                {question.difficulty.toUpperCase()}
              </span>
              <span className="category-badge">{question.category}</span>
              <span className="points-badge">{question.totalPoints} points</span>
            </div>
            <div className="supported-languages">
              <strong>Supported Languages:</strong>
              {question.supportedLanguages.map(lang => (
                <span key={lang} className="language-tag">{lang.toUpperCase()}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handlePublishExam} className="publish-form">
        {/* Basic Information */}
        <div className="form-section">
          <h2>📝 Exam Information</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Exam Title *</label>
              <input
                type="text"
                value={examData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                placeholder="Enter exam title"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={3}
                value={examData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter exam description"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Course *</label>
              <input
                type="text"
                value={examData.course}
                onChange={(e) => handleInputChange('course', e.target.value)}
                required
                placeholder="e.g., Computer Science"
              />
            </div>
            
            <div className="form-group">
              <label>Course Code *</label>
              <input
                type="text"
                value={examData.courseCode}
                onChange={(e) => handleInputChange('courseCode', e.target.value)}
                required
                placeholder="e.g., CS101"
              />
            </div>
          </div>
        </div>

        {/* Exam Settings */}
        <div className="form-section">
          <h2>⚙️ Exam Settings</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                min="1"
                max="480"
                value={examData.settings.duration}
                onChange={(e) => handleInputChange('settings.duration', parseInt(e.target.value))}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Total Points *</label>
              <input
                type="number"
                min="1"
                value={examData.settings.totalPoints}
                onChange={(e) => handleInputChange('settings.totalPoints', parseInt(e.target.value))}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Passing Score (%) *</label>
              <input
                type="number"
                min="0"
                max="100"
                value={examData.settings.passingScore}
                onChange={(e) => handleInputChange('settings.passingScore', parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Maximum Attempts *</label>
              <input
                type="number"
                min="1"
                max="10"
                value={examData.settings.maxAttempts}
                onChange={(e) => handleInputChange('settings.maxAttempts', parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Allowed Programming Languages *</label>
            <div className="language-checkboxes">
              {question.supportedLanguages.map(language => (
                <label key={language} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={examData.settings.allowedLanguages.includes(language)}
                    onChange={() => handleLanguageToggle(language)}
                  />
                  <span>{language.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={examData.settings.showResultsImmediately}
                  onChange={(e) => handleInputChange('settings.showResultsImmediately', e.target.checked)}
                />
                <span>Show results immediately after submission</span>
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={examData.settings.autoSubmit}
                  onChange={(e) => handleInputChange('settings.autoSubmit', e.target.checked)}
                />
                <span>Auto-submit when time expires</span>
              </label>
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="form-section">
          <h2>📅 Scheduling</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Start Date & Time *</label>
              {isDatetimeLocalSupported ? (
                <input
                  type="datetime-local"
                  value={examData.scheduling.startDate}
                  onChange={(e) => handleInputChange('scheduling.startDate', e.target.value)}
                  required
                />
              ) : (
                <div className="fallback-datetime">
                  <input
                    type="date"
                    value={examData.scheduling.startDate.split('T')[0]}
                    onChange={(e) => {
                      const [, time='00:00'] = examData.scheduling.startDate.split('T');
                      handleInputChange('scheduling.startDate', `${e.target.value}T${time}`);
                    }}
                    required
                  />
                  <input
                    type="time"
                    value={examData.scheduling.startDate.split('T')[1] || '00:00'}
                    onChange={(e) => {
                      const [date] = examData.scheduling.startDate.split('T');
                      handleInputChange('scheduling.startDate', `${date}T${e.target.value}`);
                    }}
                    required
                  />
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>End Date & Time *</label>
              {isDatetimeLocalSupported ? (
                <input
                  type="datetime-local"
                  value={examData.scheduling.endDate}
                  onChange={(e) => handleInputChange('scheduling.endDate', e.target.value)}
                  required
                />
              ) : (
                <div className="fallback-datetime">
                  <input
                    type="date"
                    value={examData.scheduling.endDate.split('T')[0]}
                    onChange={(e) => {
                      const [, time='00:00'] = examData.scheduling.endDate.split('T');
                      handleInputChange('scheduling.endDate', `${e.target.value}T${time}`);
                    }}
                    required
                  />
                  <input
                    type="time"
                    value={examData.scheduling.endDate.split('T')[1] || '00:00'}
                    onChange={(e) => {
                      const [date] = examData.scheduling.endDate.split('T');
                      handleInputChange('scheduling.endDate', `${date}T${e.target.value}`);
                    }}
                    required
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Student Eligibility */}
        <div className="form-section">
          <h2>👥 Student Eligibility</h2>
          
          <div className="eligibility-options">
            <label className="radio-label">
              <input
                type="radio"
                name="eligibilityType"
                value="all"
                checked={examData.eligibilityType === 'all'}
                onChange={(e) => setExamData(prev => ({ ...prev, eligibilityType: e.target.value }))}
              />
              <span>All students can take this exam</span>
            </label>
            
            <label className="radio-label">
              <input
                type="radio"
                name="eligibilityType"
                value="specific"
                checked={examData.eligibilityType === 'specific'}
                onChange={(e) => setExamData(prev => ({ ...prev, eligibilityType: e.target.value }))}
              />
              <span>Only specific students can take this exam</span>
            </label>
          </div>

          {examData.eligibilityType === 'specific' && (
            <div className="student-selection">
              <div className="selection-controls">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAllStudents}
                >
                  {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="selection-count">
                  {selectedStudents.length} of {students.length} students selected
                </span>
              </div>
              
              <div className="student-list">
                {students.map(student => (
                  <label key={student._id} className="student-item">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student._id)}
                      onChange={() => handleStudentToggle(student._id)}
                    />
                    <div className="student-info">
                      <span className="student-name">{student.fullName}</span>
                      <span className="student-id">{student.studentId}</span>
                      <span className="student-course">{student.course}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Proctoring Settings */}
        <div className="form-section">
          <h2>👁️ Proctoring Settings</h2>
          
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={examData.proctoring.enabled}
                onChange={(e) => handleInputChange('proctoring.enabled', e.target.checked)}
              />
              <span>Enable proctoring</span>
            </label>
            
            {examData.proctoring.enabled && (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={examData.proctoring.cameraRequired}
                    onChange={(e) => handleInputChange('proctoring.cameraRequired', e.target.checked)}
                  />
                  <span>Require camera access</span>
                </label>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={examData.proctoring.microphoneRequired}
                    onChange={(e) => handleInputChange('proctoring.microphoneRequired', e.target.checked)}
                  />
                  <span>Require microphone access</span>
                </label>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={examData.proctoring.screenRecording}
                    onChange={(e) => handleInputChange('proctoring.screenRecording', e.target.checked)}
                  />
                  <span>Enable screen recording</span>
                </label>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={examData.proctoring.lockdownBrowser}
                    onChange={(e) => handleInputChange('proctoring.lockdownBrowser', e.target.checked)}
                  />
                  <span>Require lockdown browser mode</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="form-section">
          <h2>📧 Notifications</h2>
          
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={examData.notifyStudents}
                onChange={(e) => handleInputChange('notifyStudents', e.target.checked)}
              />
              <span>Send email/SMS notifications to eligible students</span>
            </label>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate('/admin/coding-questions')}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-success"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner-sm"></div>
                Publishing Exam...
              </>
            ) : (
              '🚀 Publish Exam'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CodingExamPublish;
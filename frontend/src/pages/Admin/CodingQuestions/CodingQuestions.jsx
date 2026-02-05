import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './CodingQuestions.css';

const CodingQuestions = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  
  const [stats, setStats] = useState({
    totalQuestions: 0,
    easyQuestions: 0,
    mediumQuestions: 0,
    hardQuestions: 0,
    mostUsedLanguage: 'Python'
  });

  const [newQuestion, setNewQuestion] = useState({
    title: '',
    description: '',
    difficulty: 'medium',
    category: 'Programming',
    tags: [],
    supportedLanguages: ['python'],
    starterCode: {
      c: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
      cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}',
      python: '# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()',
      java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}'
    },
    solutionCode: {
      c: '',
      cpp: '',
      python: '',
      java: ''
    },
    testCases: [
      { input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }
    ],
    constraints: {
      timeLimit: 2000,
      memoryLimit: 256,
      inputFormat: '',
      outputFormat: ''
    },
    notifyStudents: false
  });

  const [createExam, setCreateExam] = useState({
    enabled: false,
    title: '',
    description: '',
    course: '',
    courseCode: '',
    duration: 60,
    startDate: '',
    endDate: '',
  });

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const templates = [
    {
      name: 'Two Sum',
      description: 'Given an array of integers and a target, return indices of the two numbers such that they add up to target.',
      difficulty: 'easy',
      category: 'Algorithms',
      tags: ['array', 'hashmap'],
      testCases: [
        { input: '4\n2 7 11 15\n9', expectedOutput: '0 1', points: 2, isHidden: false, description: 'Basic case' },
        { input: '3\n3 2 4\n6', expectedOutput: '1 2', points: 2, isHidden: true, description: 'Hidden case' }
      ]
    },
    {
      name: 'Valid Parentheses',
      description: 'Given a string containing just the characters (){}[], determine if the input string is valid.',
      difficulty: 'easy',
      category: 'Data Structures',
      tags: ['stack'],
      testCases: [
        { input: '()[]{}', expectedOutput: 'true', points: 1, isHidden: false },
        { input: '(]', expectedOutput: 'false', points: 1, isHidden: false }
      ]
    },
    {
      name: 'Longest Substring Without Repeating Characters',
      description: 'Given a string s, find the length of the longest substring without repeating characters.',
      difficulty: 'medium',
      category: 'Algorithms',
      tags: ['sliding window'],
      testCases: [
        { input: 'abcabcbb', expectedOutput: '3', points: 2, isHidden: false },
        { input: 'bbbbb', expectedOutput: '1', points: 2, isHidden: true }
      ]
    }
  ];

  useEffect(() => {
    fetchCodingQuestions();
  }, []);

  const fetchCodingQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/coding-questions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const questions = data.data || [];
        setCodingQuestions(questions);
        
        setStats({
          totalQuestions: questions.length,
          easyQuestions: questions.filter(q => q.difficulty === 'easy').length,
          mediumQuestions: questions.filter(q => q.difficulty === 'medium').length,
          hardQuestions: questions.filter(q => q.difficulty === 'hard').length,
          mostUsedLanguage: 'Python'
        });
      } else {
        let payload = { message: 'Unknown error' };
        try {
          payload = await response.json();
        } catch (_) {
          try {
            const text = await response.text();
            payload = { message: text };
          } catch (_) {}
        }
        console.error('[Admin CodingQuestions] fetch failed', {
          status: response.status,
          statusText: response.statusText,
          url: '/api/v1/coding-questions',
          payload,
          headers: Object.fromEntries(response.headers.entries())
        });
        toast.error(payload.message || 'Failed to load coding questions');
        setCodingQuestions([]);
        setStats({
          totalQuestions: 0,
          easyQuestions: 0,
          mediumQuestions: 0,
          hardQuestions: 0,
          mostUsedLanguage: 'Python'
        });
      }
    } catch (error) {
      console.error('Error fetching coding questions:', error);
      toast.error('Error loading coding questions');
      setCodingQuestions([]);
      setStats({
        totalQuestions: 0,
        easyQuestions: 0,
        mediumQuestions: 0,
        hardQuestions: 0,
        mostUsedLanguage: 'Python'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (addAnother = false) => {
    try {
      if (!newQuestion.title.trim()) {
        toast.error('Question title is required');
        return;
      }
      
      if (!newQuestion.description.trim()) {
        toast.error('Question description is required');
        return;
      }
      
      if (newQuestion.testCases.length === 0 || !newQuestion.testCases[0].input || !newQuestion.testCases[0].expectedOutput) {
        toast.error('At least one test case with input and expected output is required');
        return;
      }

      const loadingToast = toast.loading('Creating coding question...');

      const response = await fetch('/api/v1/coding-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newQuestion.title.trim(),
          description: newQuestion.description.trim(),
          difficulty: newQuestion.difficulty,
          category: newQuestion.category,
          tags: newQuestion.tags,
          supportedLanguages: newQuestion.supportedLanguages,
          starterCode: newQuestion.starterCode,
          solutionCode: newQuestion.solutionCode,
          testCases: newQuestion.testCases.map(tc => ({
            input: (tc.input || '').toString(),
            expectedOutput: (tc.expectedOutput || '').toString(),
            points: Number.isFinite(tc.points) ? tc.points : 1,
            isHidden: !!tc.isHidden,
            description: tc.description || ''
          })),
          constraints: {
            timeLimit: Number.isFinite(newQuestion.constraints.timeLimit) ? newQuestion.constraints.timeLimit : 2000,
            memoryLimit: Number.isFinite(newQuestion.constraints.memoryLimit) ? newQuestion.constraints.memoryLimit : 256,
            inputFormat: newQuestion.constraints.inputFormat || '',
            outputFormat: newQuestion.constraints.outputFormat || ''
          },
          notifyStudents: !!newQuestion.notifyStudents
        })
      });

      toast.dismiss(loadingToast);

      if (response.ok) {
        const data = await response.json();
        toast.success('Coding question created successfully');
        
        if (newQuestion.notifyStudents) {
          toast.info('Sending notifications in the background...');
        }
        
        if (createExam.enabled) {
          try {
            if (!createExam.title.trim()) {
              toast.error('Exam title is required');
              return;
            }
            if (!createExam.course.trim() || !createExam.courseCode.trim()) {
              toast.error('Course and Course Code are required');
              return;
            }
            if (!createExam.startDate || !createExam.endDate) {
              toast.error('Start and end date/time are required');
              return;
            }
            const startIso = new Date(createExam.startDate).toISOString();
            const endIso = new Date(createExam.endDate).toISOString();
            if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
              toast.error('Invalid start or end date/time');
              return;
            }
            if (new Date(startIso) >= new Date(endIso)) {
              toast.error('End time must be after start time');
              return;
            }
            const duration = parseInt(createExam.duration, 10);
            if (!Number.isFinite(duration) || duration <= 0) {
              toast.error('Duration must be a positive number of minutes');
              return;
            }

            const scheduleToast = toast.loading('Scheduling coding exam...');
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const examResp = await fetch('/api/v1/coding-exams', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                title: createExam.title.trim(),
                description: createExam.description?.trim() || '',
                codingQuestionId: data.data?._id,
                course: createExam.course.trim(),
                courseCode: createExam.courseCode.trim(),
                settings: {
                  duration,
                },
                scheduling: {
                  startDate: startIso,
                  endDate: endIso,
                  timeZone: tz
                }
              })
            });
            toast.dismiss(scheduleToast);
            if (examResp.ok) {
              const examData = await examResp.json();
              toast.success('Coding exam scheduled');
              try {
                const publishResp = await fetch(`/api/v1/coding-exams/${examData.data._id}/publish`, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                if (publishResp.ok) {
                  toast.success('Exam published');
                }
              } catch (_) {}
            } else {
              const errData = await examResp.json().catch(() => ({}));
              toast.error(errData.message || 'Failed to schedule coding exam');
            }
          } catch (examErr) {
            console.error('Error creating coding exam:', examErr);
            toast.error('Error creating coding exam');
          }
        }

        if (addAnother) {
          resetForm();
          setCreateExam({ enabled: false, title: '', description: '', course: '', courseCode: '', duration: 60, startDate: '', endDate: '' });
          fetchCodingQuestions();
          toast.success('You can add another question now');
        } else {
          setShowCreateModal(false);
          fetchCodingQuestions();
          resetForm();
          setCreateExam({ enabled: false, title: '', description: '', course: '', courseCode: '', duration: 60, startDate: '', endDate: '' });
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to create coding question');
      }
    } catch (error) {
      console.error('Error creating coding question:', error);
      if (error.message === 'Failed to fetch') {
        toast.error('Unable to connect to server. Please check if the backend is running.');
      } else {
        toast.error('Network error. Please try again.');
      }
    }
  };
  
  const handlePublishQuestion = async (questionId) => {
    try {
      const loadingToast = toast.loading('Publishing question to students...');
      
      const response = await fetch(`/api/v1/coding-questions/${questionId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sendNotifications: true,
          includeEmail: true,
          includeSms: true
        })
      });
      
      toast.dismiss(loadingToast);
      
      if (response.ok) {
        const data = await response.json();
        toast.success('Question published to students successfully!');
        
        if (data.data?.notifications) {
          const { studentsNotified, emailSent, smsSent } = data.data.notifications;
          
          setTimeout(() => {
            toast.success(`📢 Notified ${studentsNotified} students (${emailSent} emails, ${smsSent} SMS)`);
          }, 1000);
        }
        
        fetchCodingQuestions();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to publish question');
      }
    } catch (error) {
      console.error('Error publishing question:', error);
      toast.error('Error publishing question to students');
    }
  };
  
  const addTestCase = () => {
    setNewQuestion(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }]
    }));
  };
  
  const removeTestCase = (index) => {
    setNewQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index)
    }));
  };

  const handleDeleteQuestion = async (questionId, questionTitle) => {
    // Show confirmation dialog
    const isConfirmed = window.confirm(
      `Are you sure you want to delete the coding question "${questionTitle}"?\n\nThis action cannot be undone.`
    );
    
    if (!isConfirmed) {
      return;
    }

    try {
      const loadingToast = toast.loading('Deleting coding question...');
      
      const response = await fetch(`/api/v1/coding-questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete coding question');
      }

      toast.dismiss(loadingToast);
      toast.success('Coding question deleted successfully!');
      
      // Refresh the questions list
      fetchCodingQuestions();
      
    } catch (error) {
      toast.dismiss();
      console.error('Error deleting coding question:', error);
      
      if (error.message.includes('Not authorized')) {
        toast.error('You are not authorized to delete this question');
      } else if (error.message.includes('not found')) {
        toast.error('Coding question not found');
      } else {
        toast.error(error.message || 'Failed to delete coding question');
      }
    }
  };

  const resetForm = () => {
    setNewQuestion({
      title: '',
      description: '',
      difficulty: 'medium',
      category: 'Programming',
      tags: [],
      supportedLanguages: ['python'],
      starterCode: {
        c: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}',
        python: '# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()',
        java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}'
      },
      solutionCode: {
        c: '',
        cpp: '',
        python: '',
        java: ''
      },
      testCases: [
        { input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }
      ],
      constraints: {
        timeLimit: 2000,
        memoryLimit: 256,
        inputFormat: '',
        outputFormat: ''
      },
      notifyStudents: true
    });
  };

  const filteredQuestions = codingQuestions.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDifficulty = filterDifficulty === 'all' || question.difficulty === filterDifficulty;
    
    const matchesLanguage = filterLanguage === 'all' || 
                          question.supportedLanguages?.includes(filterLanguage);
    
    return matchesSearch && matchesDifficulty && matchesLanguage;
  });

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'hard': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSuccessRateColor = (rate) => {
    if (rate >= 70) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="coding-questions">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h2>Loading Coding Questions...</h2>
          <p>Fetching your programming challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-questions">
      {/* Enhanced Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-text">
            <h1>💻 Coding Questions</h1>
            <p>Create and manage programming challenges and assessments</p>
          </div>
          <div className="header-stats">
            <div className="stat-box total">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <span className="stat-number">{stats.totalQuestions}</span>
                <span className="stat-label">Total Questions</span>
              </div>
            </div>
            <div className="stat-box easy">
              <div className="stat-icon">🟢</div>
              <div className="stat-info">
                <span className="stat-number">{stats.easyQuestions}</span>
                <span className="stat-label">Easy</span>
              </div>
            </div>
            <div className="stat-box medium">
              <div className="stat-icon">🟡</div>
              <div className="stat-info">
                <span className="stat-number">{stats.mediumQuestions}</span>
                <span className="stat-label">Medium</span>
              </div>
            </div>
            <div className="stat-box hard">
              <div className="stat-icon">🔴</div>
              <div className="stat-info">
                <span className="stat-number">{stats.hardQuestions}</span>
                <span className="stat-label">Hard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Boxes Grid */}
      <div className="action-boxes-section">
        <div className="action-boxes-grid">
          <div className="action-box create-question-box">
            <div className="action-box-icon">➕</div>
            <div className="action-box-content">
              <h3>Create Question</h3>
              <p>Design new coding challenges with test cases</p>
              <button 
                className="action-box-btn primary"
                onClick={() => setShowCreateModal(true)}
              >
                <span className="btn-icon">🔧</span>
                New Question
              </button>
            </div>
          </div>

          <div className="action-box templates-box">
            <div className="action-box-icon">📝</div>
            <div className="action-box-content">
              <h3>Templates</h3>
              <p>Use pre-built question templates</p>
              <button 
                className="action-box-btn secondary"
                onClick={() => setShowTemplatesModal(true)}
              >
                <span className="btn-icon">📋</span>
                Browse Templates
              </button>
            </div>
          </div>

          <div className="action-box import-box">
            <div className="action-box-icon">📁</div>
            <div className="action-box-content">
              <h3>Import Questions</h3>
              <p>Import from JSON or other platforms</p>
              <button className="action-box-btn success" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <span className="btn-icon">⬆️</span>
                {importing ? 'Importing...' : 'Import File'}
              </button>
            </div>
          </div>

          <div className="action-box analytics-box">
            <div className="action-box-icon">📈</div>
            <div className="action-box-content">
              <h3>Analytics</h3>
              <p>View question performance metrics</p>
              <button className="action-box-btn warning" onClick={() => setShowAnalyticsModal(true)}>
                <span className="btn-icon">📊</span>
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Section */}
      <div className="filters-section">
        <div className="filters-content">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search coding questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Languages</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="questions-section">
        {filteredQuestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💻</div>
            <h3>No Coding Questions Found</h3>
            <p>
              {searchTerm || filterDifficulty !== 'all' || filterLanguage !== 'all'
                ? 'Try adjusting your filters to see more questions.'
                : 'Start by creating your first coding question.'}
            </p>
            <button 
              className="create-first-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="btn-icon">➕</span>
              Create First Question
            </button>
          </div>
        ) : (
          <div className="questions-grid">
            {filteredQuestions.map(question => (
              <div key={question._id} className="question-card">
                <div className="question-header">
                  <h3>{question.title}</h3>
                  <div className="question-badges">
                    <span 
                      className={`difficulty-badge ${question.difficulty}`}
                      style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                    >
                      {question.difficulty.toUpperCase()}
                    </span>
                    <span className="category-badge">{question.category}</span>
                  </div>
                </div>
                
                <div className="question-description">
                  <p>{question.description}</p>
                </div>
                
                <div className="question-meta">
                  <div className="meta-row">
                    <span className="meta-item">
                      <span className="meta-icon">⏱️</span>
                      {question.constraints?.timeLimit || 2000}ms
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">💾</span>
                      {question.constraints?.memoryLimit || 256}MB
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">🧪</span>
                      {Array.isArray(question.testCases) ? question.testCases.length : (question.testCases || 0)} tests
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-item">
                      <span className="meta-icon">📝</span>
                      {question.submissions || 0} submissions
                    </span>
                    <span 
                      className="meta-item success-rate"
                      style={{ color: getSuccessRateColor(question.successRate || 0) }}
                    >
                      <span className="meta-icon">📈</span>
                      {question.successRate || 0}% success
                    </span>
                  </div>
                </div>
                
                <div className="question-languages">
                  {question.supportedLanguages?.map(lang => (
                    <span key={lang} className="language-tag">
                      {lang.toUpperCase()}
                    </span>
                  ))}
                </div>
                
                <div className="question-actions">
                  <button 
                    className="action-btn-small edit"
                    onClick={() => setSelectedQuestion(question)}
                  >
                    <span className="btn-icon">✏️</span>
                    Edit
                  </button>
                  <button 
                    className="action-btn-small schedule"
                    onClick={() => navigate(`/admin/coding-exam-publish/${question._id}`)}
                    title="Create and schedule an exam from this question"
                  >
                    <span className="btn-icon">📅</span>
                    Schedule Exam
                  </button>
                  <button 
                    className="action-btn-small publish"
                    onClick={() => handlePublishQuestion(question._id)}
                    title="Publish to students and send notifications"
                  >
                    <span className="btn-icon">📢</span>
                    Publish
                  </button>
                  <button className="action-btn-small test">
                    <span className="btn-icon">🧪</span>
                    Test
                  </button>
                  <button className="action-btn-small preview">
                    <span className="btn-icon">👁️</span>
                    Preview
                  </button>
                  <button 
                    className="action-btn-small delete"
                    onClick={() => handleDeleteQuestion(question._id, question.title)}
                  >
                    <span className="btn-icon">🗑️</span>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Question Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎨 Create New Coding Question</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="form-section">
                <h3>📝 Basic Information</h3>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Question Title *</label>
                    <input
                      type="text"
                      value={newQuestion.title}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Two Sum Problem"
                      className="form-input"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Difficulty *</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, difficulty: e.target.value }))}
                      className="form-select"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, category: e.target.value }))}
                      className="form-select"
                    >
                      <option value="Programming">Programming</option>
                      <option value="Data Structures">Data Structures</option>
                      <option value="Algorithms">Algorithms</option>
                      <option value="Database">Database</option>
                      <option value="Web Development">Web Development</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Programming Languages</label>
                    <div className="languages-grid">
                      {['python', 'java', 'cpp', 'c'].map(lang => (
                        <label key={lang} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={newQuestion.supportedLanguages.includes(lang)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewQuestion(prev => ({
                                  ...prev,
                                  supportedLanguages: [...prev.supportedLanguages, lang]
                                }));
                              } else {
                                setNewQuestion(prev => ({
                                  ...prev,
                                  supportedLanguages: prev.supportedLanguages.filter(l => l !== lang)
                                }));
                              }
                            }}
                          />
                          <span>{lang.toUpperCase()}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Problem Description *</label>
                    <textarea
                      value={newQuestion.description}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the problem statement clearly..."
                      className="form-textarea"
                      rows="6"
                      required
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Input Format</label>
                    <textarea
                      value={newQuestion.constraints.inputFormat}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, constraints: { ...prev.constraints, inputFormat: e.target.value } }))}
                      placeholder="Describe the input format"
                      className="form-textarea"
                      rows="3"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Output Format</label>
                    <textarea
                      value={newQuestion.constraints.outputFormat}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, constraints: { ...prev.constraints, outputFormat: e.target.value } }))}
                      placeholder="Describe the output format"
                      className="form-textarea"
                      rows="3"
                    />
                  </div>
                </div>
              </div>

              
              <div className="form-section">
                <h3>🧪 Test Cases</h3>
                {newQuestion.testCases.map((testCase, index) => (
                  <div key={index} className="test-case-card">
                    <div className="test-case-header">
                      <h4>Test Case {index + 1}</h4>
                      <div className="test-case-controls">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={!testCase.isHidden}
                            onChange={(e) => {
                              const updatedTestCases = [...newQuestion.testCases];
                              updatedTestCases[index].isHidden = !e.target.checked;
                              setNewQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                            }}
                          />
                          <span>Visible to students</span>
                        </label>
                        {index > 0 && (
                          <button 
                            type="button" 
                            onClick={() => removeTestCase(index)}
                            className="remove-btn"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="test-case-grid">
                      <div className="form-group">
                        <label>Input</label>
                        <textarea
                          value={testCase.input}
                          onChange={(e) => {
                            const updatedTestCases = [...newQuestion.testCases];
                            updatedTestCases[index].input = e.target.value;
                            setNewQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          className="form-textarea"
                          rows="3"
                          placeholder="Test case input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Expected Output</label>
                        <textarea
                          value={testCase.expectedOutput}
                          onChange={(e) => {
                            const updatedTestCases = [...newQuestion.testCases];
                            updatedTestCases[index].expectedOutput = e.target.value;
                            setNewQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          className="form-textarea"
                          rows="3"
                          placeholder="Expected output"
                        />
                      </div>
                      <div className="form-group">
                        <label>Points</label>
                        <input
                          type="number"
                          min="0"
                          value={testCase.points}
                          onChange={(e) => {
                            const updatedTestCases = [...newQuestion.testCases];
                            updatedTestCases[index].points = parseInt(e.target.value) || 0;
                            setNewQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          className="form-input"
                        />
                      </div>
                    </div>
                    <div className="form-group full-width">
                      <label>Description (optional)</label>
                      <input
                        type="text"
                        value={testCase.description}
                        onChange={(e) => {
                          const updatedTestCases = [...newQuestion.testCases];
                          updatedTestCases[index].description = e.target.value;
                          setNewQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                        }}
                        placeholder="Describe this test case"
                        className="form-input"
                      />
                    </div>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={addTestCase}
                  className="add-btn"
                >
                  ➕ Add Test Case
                </button>
              </div>
              
          {/* Bulk Import */}
          <div className="form-section">
            <h3>📥 Import Multiple Questions (JSON)</h3>
            <p>Upload a JSON file containing an array of coding questions.</p>
            <div>
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setImporting(true);
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
                    if (parsed.length === 0) throw new Error('No questions found in file');
                    const total = parsed.length;
                    let successCount = 0;
                    let failCount = 0;
                    const progress = toast.loading(`Importing 0/${total}...`);
                    for (let i = 0; i < total; i++) {
                      const q = parsed[i] || {};
                      try {
                        const resp = await fetch('/api/v1/coding-questions', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            title: (q.title || '').toString().trim(),
                            description: (q.description || '').toString().trim(),
                            difficulty: q.difficulty || 'medium',
                            category: q.category || 'Programming',
                            tags: Array.isArray(q.tags) ? q.tags : [],
                            supportedLanguages: Array.isArray(q.supportedLanguages) && q.supportedLanguages.length > 0 ? q.supportedLanguages : ['python'],
                            starterCode: q.starterCode || newQuestion.starterCode,
                            solutionCode: q.solutionCode || { c: '', cpp: '', python: '', java: '' },
                            testCases: (Array.isArray(q.testCases) ? q.testCases : []).map(tc => ({
                              input: (tc.input || '').toString(),
                              expectedOutput: (tc.expectedOutput || '').toString(),
                              points: Number.isFinite(tc.points) ? tc.points : 1,
                              isHidden: !!tc.isHidden,
                              description: tc.description || ''
                            })),
                            constraints: {
                              timeLimit: Number.isFinite(q?.constraints?.timeLimit) ? q.constraints.timeLimit : 2000,
                              memoryLimit: Number.isFinite(q?.constraints?.memoryLimit) ? q.constraints.memoryLimit : 256,
                              inputFormat: q?.constraints?.inputFormat || '',
                              outputFormat: q?.constraints?.outputFormat || ''
                            }
                          })
                        });
                        if (!resp.ok) {
                          failCount += 1;
                        } else {
                          successCount += 1;
                        }
                      } catch (_) {
                        failCount += 1;
                      }
                      toast.update(progress, { render: `Importing ${i + 1}/${total}...`, isLoading: true });
                    }
                    toast.dismiss();
                    toast.success(`Imported ${successCount}/${total} questions (${failCount} failed)`);
                    fetchCodingQuestions();
                  } catch (err) {
                    console.error('Import error:', err);
                    toast.error(err.message || 'Failed to import questions');
                  } finally {
                    setImporting(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
              />
              <button
                type="button"
                className="action-box-btn success"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <span className="btn-icon">⬆️</span>
                {importing ? 'Importing...' : 'Import File'}
              </button>
            </div>
          </div>

          {/* Optional: Schedule Coding Exam */}
          <div className="form-section">
            <h3>🗓️ Schedule Coding Exam (Optional)</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={createExam.enabled}
                    onChange={(e) => setCreateExam(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Create a scheduled exam from this question</span>
                </label>
              </div>

              {createExam.enabled && (
                <>
                  <div className="form-group full-width">
                    <label>Exam Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createExam.title}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Data Structures Coding Test"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Exam Description</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createExam.description}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="form-group">
                    <label>Course *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createExam.course}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, course: e.target.value }))}
                      placeholder="e.g., B.Tech CSE"
                    />
                  </div>
                  <div className="form-group">
                    <label>Course Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createExam.courseCode}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, courseCode: e.target.value }))}
                      placeholder="e.g., CSE301"
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration (minutes) *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={createExam.duration}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, duration: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={createExam.startDate}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={createExam.endDate}
                      onChange={(e) => setCreateExam(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
              </div>
              
              <div className="form-section">
                <h3>🚀 Starter Code (Optional)</h3>
                <div className="starter-code-tabs">
                  {newQuestion.supportedLanguages.map(lang => (
                    <div key={lang} className="starter-code-section">
                      <h4>{lang.toUpperCase()}</h4>
                      <textarea
                        value={newQuestion.starterCode[lang] || ''}
                        onChange={(e) => {
                          setNewQuestion(prev => ({
                            ...prev,
                            starterCode: {
                              ...prev.starterCode,
                              [lang]: e.target.value
                            }
                          }));
                        }}
                        className="code-textarea"
                        rows="8"
                        placeholder={`Starter code for ${lang.toUpperCase()}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="notification-settings">
                <h3>📧 Notification Settings</h3>
                <div className="notification-info">
                  <p>📌 When you create this question, notifications can be sent to students:</p>
                  <ul>
                    <li>✉️ Email notifications</li>
                    <li>📱 SMS notifications (if configured)</li>
                  </ul>
                  <div className="notification-preview">
                    <strong>Preview:</strong> "New coding question '{newQuestion.title || 'Untitled Question'}' is now available!"
                  </div>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newQuestion.notifyStudents}
                        onChange={(e) => setNewQuestion(prev => ({ ...prev, notifyStudents: e.target.checked }))}
                      />
                      Send notifications to students
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                ❌ Cancel
              </button>
              <button 
                className="btn-create"
                onClick={() => handleCreateQuestion(false)}
                disabled={!newQuestion.title.trim() || !newQuestion.description.trim()}
              >
                🚀 Create Question
              </button>
              <button 
                className="btn-create"
                onClick={() => handleCreateQuestion(true)}
                disabled={!newQuestion.title.trim() || !newQuestion.description.trim()}
                style={{ marginLeft: '8px' }}
              >
                ➕ Create & Add Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Question Templates</h2>
              <button className="close-btn" onClick={() => setShowTemplatesModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="templates-grid">
                {templates.map((t) => (
                  <div key={t.name} className="template-card">
                    <h4>{t.name}</h4>
                    <p>{t.description}</p>
                    <div className="template-meta">
                      <span className="badge">{t.difficulty.toUpperCase()}</span>
                      <span className="badge">{t.category}</span>
                      <span className="badge">{t.tags.join(', ')}</span>
                    </div>
                    <button
                      className="action-box-btn primary"
                      onClick={() => {
                        setNewQuestion(prev => ({
                          ...prev,
                          title: t.name,
                          description: t.description,
                          difficulty: t.difficulty,
                          category: t.category,
                          tags: t.tags,
                          testCases: t.testCases
                        }));
                        setShowTemplatesModal(false);
                        setShowCreateModal(true);
                      }}
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && (
        <div className="modal-overlay" onClick={() => setShowAnalyticsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Coding Questions Analytics</h2>
              <button className="close-btn" onClick={() => setShowAnalyticsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {(() => {
                const total = codingQuestions.length;
                const byDifficulty = codingQuestions.reduce((acc, q) => { acc[q.difficulty] = (acc[q.difficulty] || 0) + 1; return acc; }, {});
                const byCategory = codingQuestions.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc; }, {});
                return (
                  <div>
                    <p>Total Questions: <strong>{total}</strong></p>
                    <h4>By Difficulty</h4>
                    <ul>
                      {Object.entries(byDifficulty).map(([k, v]) => (<li key={k}>{k}: {v}</li>))}
                    </ul>
                    <h4>By Category</h4>
                    <ul>
                      {Object.entries(byCategory).map(([k, v]) => (<li key={k}>{k}: {v}</li>))}
                    </ul>
                    <p style={{ marginTop: '8px' }}>Tip: Open a question card to review test counts and constraints.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingQuestions;
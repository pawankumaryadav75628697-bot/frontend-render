import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './CodingQuestions.css';

const CodingQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  
  // Filters
  const [filters, setFilters] = useState({
    difficulty: '',
    category: '',
    language: '',
    search: ''
  });

  // Form state
  const [formData, setFormData] = useState({
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
    testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }],
    constraints: {
      timeLimit: 2000,
      memoryLimit: 256,
      inputFormat: '',
      outputFormat: ''
    },
    notifyStudents: true
  });

  // Language options
  const languages = [
    { value: 'c', label: 'C', extension: 'c' },
    { value: 'cpp', label: 'C++', extension: 'cpp' },
    { value: 'python', label: 'Python', extension: 'py' },
    { value: 'java', label: 'Java', extension: 'java' }
  ];

  // Difficulty options
  const difficulties = [
    { value: 'easy', label: 'Easy', color: '#22c55e' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'hard', label: 'Hard', color: '#ef4444' },
    { value: 'expert', label: 'Expert', color: '#8b5cf6' }
  ];

  // Category options
  const categories = [
    'Programming',
    'Data Structures',
    'Algorithms',
    'Database',
    'Web Development',
    'Other'
  ];

  useEffect(() => {
    fetchQuestions();
  }, [filters]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/v1/coding-questions?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch questions');
      
      const data = await response.json();
      setQuestions(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const response = await fetch('/api/v1/coding-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(t => t.trim()) : formData.tags
        })
      });

      if (!response.ok) throw new Error('Failed to create question');
      
      const data = await response.json();
      setQuestions([data.data, ...questions]);
      setShowCreateForm(false);
      resetForm();
      
      // Show success message
      alert('Coding question created successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`/api/v1/coding-questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete question');
      
      setQuestions(questions.filter(q => q._id !== questionId));
      alert('Question deleted successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTestCode = async (questionId, code, language) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/v1/coding-questions/${questionId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code, language })
      });

      if (!response.ok) throw new Error('Failed to test code');
      
      const data = await response.json();
      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
      testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }],
      constraints: {
        timeLimit: 2000,
        memoryLimit: 256,
        inputFormat: '',
        outputFormat: ''
      },
      notifyStudents: true
    });
  };

  const addTestCase = () => {
    setFormData({
      ...formData,
      testCases: [...formData.testCases, { input: '', expectedOutput: '', points: 1, isHidden: false, description: '' }]
    });
  };

  const removeTestCase = (index) => {
    const newTestCases = formData.testCases.filter((_, i) => i !== index);
    setFormData({ ...formData, testCases: newTestCases });
  };

  const updateTestCase = (index, field, value) => {
    const newTestCases = [...formData.testCases];
    newTestCases[index] = { ...newTestCases[index], [field]: value };
    setFormData({ ...formData, testCases: newTestCases });
  };

  const updateLanguageCode = (language, codeType, value) => {
    setFormData({
      ...formData,
      [codeType]: {
        ...formData[codeType],
        [language]: value
      }
    });
  };

  return (
    <div className="coding-questions-container">
      <div className="coding-questions-header">
        <h1>🚀 Coding Questions Management</h1>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            ➕ Create New Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search questions..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          
          <div className="filter-group">
            <label>Difficulty:</label>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            >
              <option value="">All Difficulties</option>
              {difficulties.map(diff => (
                <option key={diff.value} value={diff.value}>{diff.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Category:</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Language:</label>
            <select
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            >
              <option value="">All Languages</option>
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={() => setError(null)}>✖</button>
        </div>
      )}

      {/* Questions List */}
      <div className="questions-list">
        {loading && <div className="loading">Loading questions...</div>}
        
        {!loading && questions.length === 0 && (
          <div className="no-questions">
            <h3>No coding questions found</h3>
            <p>Create your first coding question to get started!</p>
          </div>
        )}

        {questions.map(question => (
          <QuestionCard
            key={question._id}
            question={question}
            onDelete={handleDeleteQuestion}
            onTest={handleTestCode}
          />
        ))}
      </div>

      {/* Create Question Modal */}
      {showCreateForm && (
        <CreateQuestionModal
          formData={formData}
          setFormData={setFormData}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          languages={languages}
          difficulties={difficulties}
          categories={categories}
          onSubmit={handleCreateQuestion}
          onClose={() => setShowCreateForm(false)}
          loading={loading}
          addTestCase={addTestCase}
          removeTestCase={removeTestCase}
          updateTestCase={updateTestCase}
          updateLanguageCode={updateLanguageCode}
        />
      )}
    </div>
  );
};

// Question Card Component
const QuestionCard = ({ question, onDelete, onTest }) => {
  const [expanded, setExpanded] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testCode, setTestCode] = useState('');
  const [testLanguage, setTestLanguage] = useState(question.supportedLanguages[0] || 'python');

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#22c55e',
      medium: '#f59e0b',
      hard: '#ef4444',
      expert: '#8b5cf6'
    };
    return colors[difficulty] || '#64748b';
  };

  const handleTest = async () => {
    try {
      if (!testCode.trim()) {
        alert('Please enter code to test');
        return;
      }

      const results = await onTest(question._id, testCode, testLanguage);
      setTestResults(results);
    } catch (err) {
      console.error('Test failed:', err);
    }
  };

  return (
    <div className="question-card">
      <div className="question-header">
        <div className="question-info">
          <h3>{question.title}</h3>
          <div className="question-meta">
            <span 
              className="difficulty-badge"
              style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
            >
              {question.difficulty.toUpperCase()}
            </span>
            <span className="category-badge">{question.category}</span>
            <span className="points-badge">{question.totalPoints} points</span>
          </div>
        </div>
        
        <div className="question-actions">
          <button 
            className="btn btn-success btn-sm"
            onClick={() => window.location.href = `/admin/coding-exam-publish/${question._id}`}
            title="Publish this question as an exam"
          >
            📅 Publish as Exam
          </button>
          <button 
            className="btn btn-info btn-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '🔼' : '🔽'} {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button 
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(question._id)}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="question-details">
          <div className="description-section">
            <h4>📝 Description</h4>
            <p>{question.description}</p>
          </div>

          <div className="languages-section">
            <h4>💻 Supported Languages</h4>
            <div className="language-tags">
              {question.supportedLanguages.map(lang => (
                <span key={lang} className="language-tag">
                  {lang.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <div className="test-cases-section">
            <h4>🧪 Test Cases ({question.testCases?.length || 0})</h4>
            <div className="test-cases-grid">
              {question.testCases?.map((testCase, index) => (
                <div key={index} className="test-case">
                  <div className="test-case-header">
                    <span>Test Case {index + 1}</span>
                    <span className={`visibility ${testCase.isHidden ? 'hidden' : 'visible'}`}>
                      {testCase.isHidden ? '🔒 Hidden' : '👁️ Visible'}
                    </span>
                  </div>
                  <div className="test-case-io">
                    <div>
                      <strong>Input:</strong>
                      <pre>{testCase.input || 'No input'}</pre>
                    </div>
                    <div>
                      <strong>Expected Output:</strong>
                      <pre>{testCase.expectedOutput}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="code-test-section">
            <h4>🧪 Test Your Solution</h4>
            <div className="test-controls">
              <select
                value={testLanguage}
                onChange={(e) => setTestLanguage(e.target.value)}
                className="language-select"
              >
                {question.supportedLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-success"
                onClick={handleTest}
              >
                ▶️ Run Tests
              </button>
            </div>
            
            <div className="code-editor-container">
              <Editor
                height="300px"
                language={testLanguage === 'cpp' ? 'cpp' : testLanguage}
                value={testCode}
                onChange={(value) => setTestCode(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on'
                }}
              />
            </div>

            {testResults && (
              <div className="test-results">
                <h5>📊 Test Results</h5>
                <div className="results-summary">
                  <span>Tests Passed: {testResults.summary.passedTests}/{testResults.summary.totalTests}</span>
                  <span>Score: {testResults.summary.scorePercentage.toFixed(1)}%</span>
                </div>
                <div className="results-details">
                  {testResults.results.map((result, index) => (
                    <div key={index} className={`result-item ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="result-header">
                        <span>Test {index + 1}</span>
                        <span className={`result-status ${result.passed ? 'passed' : 'failed'}`}>
                          {result.passed ? '✅ PASSED' : '❌ FAILED'}
                        </span>
                      </div>
                      {!result.passed && (
                        <div className="result-details-expanded">
                          <div>Expected: <code>{result.expectedOutput}</code></div>
                          <div>Got: <code>{result.actualOutput}</code></div>
                          {result.error && <div>Error: <code>{result.error}</code></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Create Question Modal Component
const CreateQuestionModal = ({
  formData,
  setFormData,
  selectedLanguage,
  setSelectedLanguage,
  languages,
  difficulties,
  categories,
  onSubmit,
  onClose,
  loading,
  addTestCase,
  removeTestCase,
  updateTestCase,
  updateLanguageCode
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-container create-question-modal">
        <div className="modal-header">
          <h2>➕ Create New Coding Question</h2>
          <button className="close-btn" onClick={onClose}>✖</button>
        </div>

        <form onSubmit={onSubmit} className="create-form">
          <div className="form-section">
            <h3>📝 Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter question title"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the problem..."
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  {difficulties.map(diff => (
                    <option key={diff.value} value={diff.value}>{diff.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  value={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="arrays, sorting, dynamic-programming"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>💻 Programming Languages</h3>
            <div className="languages-checkboxes">
              {languages.map(lang => (
                <label key={lang.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.supportedLanguages.includes(lang.value)}
                    onChange={(e) => {
                      const newLanguages = e.target.checked
                        ? [...formData.supportedLanguages, lang.value]
                        : formData.supportedLanguages.filter(l => l !== lang.value);
                      setFormData({ ...formData, supportedLanguages: newLanguages });
                    }}
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>📝 Code Templates</h3>
            <div className="code-section">
              <div className="language-tabs">
                {formData.supportedLanguages.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    className={`tab ${selectedLanguage === lang ? 'active' : ''}`}
                    onClick={() => setSelectedLanguage(lang)}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              {formData.supportedLanguages.includes(selectedLanguage) && (
                <div className="code-editors">
                  <div className="editor-group">
                    <h4>Starter Code (for students)</h4>
                    <Editor
                      height="200px"
                      language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
                      value={formData.starterCode[selectedLanguage]}
                      onChange={(value) => updateLanguageCode(selectedLanguage, 'starterCode', value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on'
                      }}
                    />
                  </div>

                  <div className="editor-group">
                    <h4>Solution Code (for reference)</h4>
                    <Editor
                      height="200px"
                      language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
                      value={formData.solutionCode[selectedLanguage]}
                      onChange={(value) => updateLanguageCode(selectedLanguage, 'solutionCode', value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>🧪 Test Cases</h3>
            {formData.testCases.map((testCase, index) => (
              <div key={index} className="test-case-form">
                <div className="test-case-header">
                  <h4>Test Case {index + 1}</h4>
                  {formData.testCases.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeTestCase(index)}
                    >
                      🗑️ Remove
                    </button>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Input</label>
                    <textarea
                      rows={3}
                      value={testCase.input}
                      onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                      placeholder="Enter test input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Expected Output *</label>
                    <textarea
                      required
                      rows={3}
                      value={testCase.expectedOutput}
                      onChange={(e) => updateTestCase(index, 'expectedOutput', e.target.value)}
                      placeholder="Enter expected output"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Points</label>
                    <input
                      type="number"
                      min="1"
                      value={testCase.points}
                      onChange={(e) => updateTestCase(index, 'points', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={testCase.isHidden}
                        onChange={(e) => updateTestCase(index, 'isHidden', e.target.checked)}
                      />
                      Hidden from students
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Description (optional)</label>
                    <input
                      type="text"
                      value={testCase.description}
                      onChange={(e) => updateTestCase(index, 'description', e.target.value)}
                      placeholder="Describe this test case"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addTestCase}
            >
              ➕ Add Test Case
            </button>
          </div>

          <div className="form-section">
            <h3>⚙️ Constraints</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Time Limit (ms)</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  value={formData.constraints.timeLimit}
                  onChange={(e) => setFormData({
                    ...formData,
                    constraints: {
                      ...formData.constraints,
                      timeLimit: parseInt(e.target.value) || 2000
                    }
                  })}
                />
              </div>

              <div className="form-group">
                <label>Memory Limit (MB)</label>
                <input
                  type="number"
                  min="64"
                  max="512"
                  value={formData.constraints.memoryLimit}
                  onChange={(e) => setFormData({
                    ...formData,
                    constraints: {
                      ...formData.constraints,
                      memoryLimit: parseInt(e.target.value) || 256
                    }
                  })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Input Format</label>
                <textarea
                  rows={2}
                  value={formData.constraints.inputFormat}
                  onChange={(e) => setFormData({
                    ...formData,
                    constraints: {
                      ...formData.constraints,
                      inputFormat: e.target.value
                    }
                  })}
                  placeholder="Describe the input format"
                />
              </div>

              <div className="form-group">
                <label>Output Format</label>
                <textarea
                  rows={2}
                  value={formData.constraints.outputFormat}
                  onChange={(e) => setFormData({
                    ...formData,
                    constraints: {
                      ...formData.constraints,
                      outputFormat: e.target.value
                    }
                  })}
                  placeholder="Describe the output format"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>📢 Notifications</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.notifyStudents}
                onChange={(e) => setFormData({ ...formData, notifyStudents: e.target.checked })}
              />
              Send notification to all students about this new coding question
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : '🚀 Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CodingQuestions;
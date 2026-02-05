import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './CodingQuestionComponent.css';

const CodingQuestionComponent = ({ question, answer, onAnswerChange, disabled }) => {
  const [selectedLanguage, setSelectedLanguage] = useState(question.supportedLanguages[0] || 'python');
  const [code, setCode] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showTestCases, setShowTestCases] = useState(false);

  // Language configurations
  const getLanguageConfig = (lang) => {
    const configs = {
      'python': { label: 'Python', monacoLanguage: 'python' },
      'java': { label: 'Java', monacoLanguage: 'java' },
      'cpp': { label: 'C++', monacoLanguage: 'cpp' },
      'c': { label: 'C', monacoLanguage: 'c' }
    };
    return configs[lang] || { label: lang.toUpperCase(), monacoLanguage: 'text' };
  };

  // Initialize code from answer or starter code
  useEffect(() => {
    if (answer && answer.code && answer.language === selectedLanguage) {
      setCode(answer.code);
    } else if (question.starterCode && question.starterCode[selectedLanguage]) {
      setCode(question.starterCode[selectedLanguage]);
    } else {
      // Default starter code if none provided
      const defaultStarters = {
        python: '# Write your Python code here\nprint("Hello, World!")',
        java: 'public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
        c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'
      };
      setCode(defaultStarters[selectedLanguage] || '// Write your code here');
    }
  }, [selectedLanguage, question.starterCode]);

  // Update answer when code or language changes
  useEffect(() => {
    if (onAnswerChange && !disabled) {
      onAnswerChange(question._id, {
        code: code,
        language: selectedLanguage,
        testResults: testResults
      });
    }
  }, [code, selectedLanguage, testResults, onAnswerChange, question._id, disabled]);

  const handleLanguageChange = (newLanguage) => {
    setSelectedLanguage(newLanguage);
    setTestResults(null);
  };

  const handleTestCode = async () => {
    if (!code.trim()) {
      alert('Please write some code before testing');
      return;
    }

    setTesting(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('examToken');
      const response = await fetch(`/api/v1/coding-questions/${question.codingQuestion}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code,
          language: selectedLanguage
        })
      });

      if (!response.ok) {
        throw new Error('Failed to test code');
      }

      const data = await response.json();
      setTestResults(data.data);
    } catch (error) {
      console.error('Error testing code:', error);
      alert('Failed to test code. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="coding-question-component">
      <div className="coding-question-header">
        <h3 className="problem-title">💻 Coding Problem</h3>
        <div className="language-selector">
          <label>Programming Language:</label>
          <select 
            value={selectedLanguage} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={disabled}
          >
            {question.supportedLanguages.map(lang => (
              <option key={lang} value={lang}>
                {getLanguageConfig(lang).label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="problem-description">
        <div className="description-content">
          <h4>📋 Problem Description</h4>
          <p>{question.description}</p>
        </div>

        {question.constraints && (
          <div className="constraints-info">
            <h4>⚙️ Constraints</h4>
            <div className="constraints-grid">
              {question.constraints.timeLimit && (
                <div className="constraint-item">
                  <span className="constraint-label">Time Limit:</span>
                  <span className="constraint-value">{question.constraints.timeLimit}ms</span>
                </div>
              )}
              {question.constraints.memoryLimit && (
                <div className="constraint-item">
                  <span className="constraint-label">Memory Limit:</span>
                  <span className="constraint-value">{question.constraints.memoryLimit}MB</span>
                </div>
              )}
            </div>
            
            {question.constraints.inputFormat && (
              <div className="format-info">
                <strong>Input Format:</strong>
                <p>{question.constraints.inputFormat}</p>
              </div>
            )}
            
            {question.constraints.outputFormat && (
              <div className="format-info">
                <strong>Output Format:</strong>
                <p>{question.constraints.outputFormat}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Cases Preview */}
      {question.testCases && question.testCases.length > 0 && (
        <div className="test-cases-section">
          <div className="test-cases-header">
            <h4>🧪 Sample Test Cases</h4>
            <button 
              className="toggle-test-cases"
              onClick={() => setShowTestCases(!showTestCases)}
            >
              {showTestCases ? 'Hide' : 'Show'} Test Cases
            </button>
          </div>
          
          {showTestCases && (
            <div className="test-cases-list">
              {question.testCases.map((testCase, index) => (
                <div key={index} className="test-case">
                  <div className="test-case-header">
                    <span className="test-case-title">Test Case {index + 1}</span>
                    {testCase.description && (
                      <span className="test-case-desc">{testCase.description}</span>
                    )}
                  </div>
                  <div className="test-case-content">
                    <div className="test-input">
                      <strong>Input:</strong>
                      <pre>{testCase.input || 'No input'}</pre>
                    </div>
                    <div className="test-output">
                      <strong>Expected Output:</strong>
                      <pre>{testCase.expectedOutput}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code Editor */}
      <div className="code-editor-section">
        <div className="editor-header">
          <h4>💡 Your Solution</h4>
          <button 
            className="test-code-btn"
            onClick={handleTestCode}
            disabled={testing || disabled}
          >
            {testing ? '🔄 Testing...' : '▶️ Test Code'}
          </button>
        </div>
        
        <div className="code-editor-container">
          <Editor
            height="400px"
            language={getLanguageConfig(selectedLanguage).monacoLanguage}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              readOnly: disabled
            }}
          />
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="test-results-section">
          <h4>📊 Test Results</h4>
          <div className="results-summary">
            <div className="summary-stats">
              <span className="stat">
                Tests Passed: <strong>{testResults.summary.passedTests}/{testResults.summary.totalTests}</strong>
              </span>
              <span className="stat">
                Score: <strong>{testResults.summary.scorePercentage.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
          
          <div className="individual-results">
            {testResults.results.map((result, index) => (
              <div key={index} className={`result-item ${result.passed ? 'passed' : 'failed'}`}>
                <div className="result-header">
                  <span className="result-title">Test {index + 1}</span>
                  <span className={`result-status ${result.passed ? 'passed' : 'failed'}`}>
                    {result.passed ? '✅ PASSED' : '❌ FAILED'}
                  </span>
                </div>
                {!result.passed && (
                  <div className="result-details">
                    <div className="result-io">
                      <div>
                        <strong>Expected:</strong>
                        <code>{result.expectedOutput}</code>
                      </div>
                      <div>
                        <strong>Your Output:</strong>
                        <code>{result.actualOutput}</code>
                      </div>
                    </div>
                    {result.error && (
                      <div className="result-error">
                        <strong>Error:</strong>
                        <code>{result.error}</code>
                      </div>
                    )}
                  </div>
                )}
                <div className="result-meta">
                  Execution Time: {result.executionTime}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {disabled && (
        <div className="disabled-overlay">
          <p>⏰ Exam has ended. Code editor is now read-only.</p>
        </div>
      )}
    </div>
  );
};

export default CodingQuestionComponent;
import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './CodeCompiler.css';

function CodeCompiler() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [theme, setTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [codeHistory, setCodeHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const editorRef = useRef(null);

  // Language configurations with icons
  const languages = [
    { 
      value: 'python', 
      label: 'Python', 
      icon: '🐍',
      defaultCode: '# Write your Python code here\nprint("Hello, World!")',
      monacoLanguage: 'python'
    },
    { 
      value: 'java', 
      label: 'Java', 
      icon: '☕',
      defaultCode: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
      monacoLanguage: 'java'
    },
    { 
      value: 'cpp', 
      label: 'C++', 
      icon: '⚡',
      defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
      monacoLanguage: 'cpp'
    },
    { 
      value: 'c', 
      label: 'C', 
      icon: '🔧',
      defaultCode: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
      monacoLanguage: 'c'
    }
  ];

  // Editor themes
  const editorThemes = [
    { value: 'vs-dark', label: 'Dark' },
    { value: 'vs-light', label: 'Light' },
    { value: 'hc-black', label: 'High Contrast' }
  ];

  // Font sizes
  const fontSizes = [12, 14, 16, 18, 20];

  // Set default code when language changes
  useEffect(() => {
    const selectedLang = languages.find(lang => lang.value === language);
    if (selectedLang && !code) {
      setCode(selectedLang.defaultCode);
      // Reset history when changing language
      setCodeHistory([selectedLang.defaultCode]);
      setHistoryIndex(0);
    }
  }, [language]);

  // Initialize with default Python code
  useEffect(() => {
    if (!code) {
      setCode(languages[0].defaultCode);
      setCodeHistory([languages[0].defaultCode]);
      setHistoryIndex(0);
    }
  }, []);

  // Auto-save code
  useEffect(() => {
    if (autoSave && code) {
      const timer = setTimeout(() => {
        localStorage.setItem(`code_${language}`, code);
        setLastSaved(new Date());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [code, language, autoSave]);

  // Load saved code on language change
  useEffect(() => {
    const savedCode = localStorage.getItem(`code_${language}`);
    if (savedCode) {
      setCode(savedCode);
      // Add to history
      setCodeHistory(prev => [...prev, savedCode]);
      setHistoryIndex(prev => prev + 1);
    }
  }, [language]);

  // Scroll to output when it changes
  useEffect(() => {
    if (outputRef.current && (output || error)) {
      outputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, error]);

  const handleRunCode = async () => {
    if (!code.trim()) {
      setError('Please enter some code to execute');
      return;
    }

    setLoading(true);
    setError(null);
    setOutput('');
    setExecutionTime(0);

    try {
      // Using the coding-questions/execute endpoint for code execution
      const response = await fetch('/api/v1/coding-questions/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          code: code,
          language: language,
          input: input
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute code');
      }

      const data = await response.json();
      const result = data.data;

      setOutput(result.output || '');
      setExecutionTime(result.executionTime || 0);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    const selectedLang = languages.find(lang => lang.value === newLanguage);
    setLanguage(newLanguage);
    
    // Check if there's saved code for this language
    const savedCode = localStorage.getItem(`code_${newLanguage}`);
    if (savedCode) {
      setCode(savedCode);
    } else {
      setCode(selectedLang.defaultCode);
    }
    
    setOutput('');
    setError(null);
    setInput('');
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleRunCode);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      localStorage.setItem(`code_${language}`, code);
      setLastSaved(new Date());
    });
    
    // Undo/Redo history management
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, handleUndo);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, handleRedo);
    
    // Focus the editor
    editor.focus();
  };

  const handleCodeChange = (value) => {
    setCode(value || '');
    
    // Add to history if significantly different
    if (value && (codeHistory.length === 0 || value !== codeHistory[historyIndex])) {
      // Truncate history if we're not at the end
      const newHistory = codeHistory.slice(0, historyIndex + 1);
      setCodeHistory([...newHistory, value]);
      setHistoryIndex(newHistory.length);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCode(codeHistory[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < codeHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCode(codeHistory[historyIndex + 1]);
    }
  };

  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  const clearCode = () => {
    const selectedLang = languages.find(lang => lang.value === language);
    setCode(selectedLang.defaultCode);
  };

  const getCurrentLanguageConfig = () => {
    return languages.find(lang => lang.value === language) || languages[0];
  };

  const toggleKeyboardShortcuts = () => {
    setShowKeyboardShortcuts(!showKeyboardShortcuts);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="modern-code-compiler">
      <div className="compiler-header">
        <div className="compiler-title">
          <h1><span className="code-icon">⌨️</span> Code Compiler Pro</h1>
          <p>Professional code execution environment</p>
        </div>
        <div className="compiler-actions">
          <button 
            className="action-button"
            onClick={formatCode}
            title="Format Code"
          >
            📝
          </button>
          <button 
            className="action-button"
            onClick={clearCode}
            title="Reset Code"
          >
            🔄
          </button>
          <button 
            className="keyboard-shortcuts-btn"
            onClick={toggleKeyboardShortcuts}
            title="Keyboard Shortcuts"
          >
            ⌨️
          </button>
        </div>
      </div>

      {showKeyboardShortcuts && (
        <div className="keyboard-shortcuts-panel">
          <div className="shortcuts-header">
            <h3>Keyboard Shortcuts</h3>
            <button onClick={toggleKeyboardShortcuts}>×</button>
          </div>
          <div className="shortcuts-content">
            <div className="shortcut-item">
              <span className="shortcut-keys">Ctrl + Enter</span>
              <span className="shortcut-desc">Run Code</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-keys">Ctrl + S</span>
              <span className="shortcut-desc">Save Code</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-keys">Ctrl + Z</span>
              <span className="shortcut-desc">Undo</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-keys">Ctrl + Y</span>
              <span className="shortcut-desc">Redo</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-keys">Ctrl + Space</span>
              <span className="shortcut-desc">Code Completion</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-keys">F1</span>
              <span className="shortcut-desc">Command Palette</span>
            </div>
          </div>
        </div>
      )}

      <div className="compiler-layout">
        <div className="compiler-sidebar">
          <div className="sidebar-section language-section">
            <h3>Language</h3>
            <div className="language-buttons">
              {languages.map(lang => (
                <button
                  key={lang.value}
                  className={`language-button ${language === lang.value ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.value)}
                  title={lang.label}
                >
                  <span className="lang-icon">{lang.icon}</span>
                  <span className="lang-name">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="sidebar-section editor-settings">
            <h3>Editor Settings</h3>
            <div className="setting-group">
              <label>Theme</label>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                className="setting-select"
              >
                {editorThemes.map(themeOption => (
                  <option key={themeOption.value} value={themeOption.value}>
                    {themeOption.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="setting-group">
              <label>Font Size</label>
              <select 
                value={fontSize} 
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="setting-select"
              >
                {fontSizes.map(size => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
            
            <div className="setting-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={autoSave} 
                  onChange={() => setAutoSave(!autoSave)}
                />
                Auto-save code
              </label>
              {lastSaved && autoSave && (
                <div className="last-saved">
                  Last saved: {formatTime(lastSaved)}
                </div>
              )}
            </div>
          </div>
          
          <div className="sidebar-section run-section">
            <div className="keyboard-shortcut-hint">
              Press Ctrl+Enter to run
            </div>
          </div>
        </div>
        
        <div className="compiler-main">
          <div className="editor-container">
            <div className="editor-header">
              <div className="editor-title">
                <span className="editor-title-icon">{getCurrentLanguageConfig().icon}</span>
                {getCurrentLanguageConfig().label} Editor
              </div>
            </div>
            <Editor
              height="100%"
              language={getCurrentLanguageConfig().monacoLanguage}
              value={code}
              theme={theme}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: fontSize,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                lineNumbers: 'on',
                folding: true,
                renderLineHighlight: 'all',
              }}
            />
          </div>
          
          <div className="io-container">
            <div className="io-console">
              <div className="console-header">
                <div className="console-title">
                  <span className="console-icon">💻</span>
                  Console
                </div>
                {executionTime > 0 && !loading && !error && (
                  <div className="execution-badge execution-time">
                    <span>⏱️</span>
                    <span>{executionTime} ms</span>
                  </div>
                )}
                {error && (
                  <div className="execution-badge execution-error">
                    <span>⚠️</span>
                    <span>Error</span>
                  </div>
                )}
              </div>
              
              <div className="console-content">
                <div className="input-console">
                  <div className="console-label">Input:</div>
                  <textarea
                    className="console-textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter your input here..."
                    spellCheck="false"
                  />
                </div>
                
                <div className="run-button-container">
                  <button 
                    className="console-run-button"
                    onClick={handleRunCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner"></span>
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <span className="run-icon">▶</span>
                        <span>Run Code</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="output-console" ref={outputRef}>
                  <div className="console-label">Output:</div>
                  {loading ? (
                    <div className="loading-output">
                      <div className="loading-spinner"></div>
                      <div className="loading-text">Executing code...</div>
                    </div>
                  ) : error ? (
                    <pre className="console-output error">{error}</pre>
                  ) : output ? (
                    <pre className="console-output">{output}</pre>
                  ) : (
                    <div className="empty-output">
                      <p>No output to display. Run your code to see results.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="compiler-footer">
        <div>Code Compiler Pro v2.0</div>
        <div className="footer-links">
          <a href="#documentation">Documentation</a>
          <a href="#examples">Examples</a>
          <a href="#about">About</a>
        </div>
      </div>
    </div>
  );
}

export default CodeCompiler;
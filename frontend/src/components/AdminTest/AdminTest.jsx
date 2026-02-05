import React, { useState } from 'react';
import './AdminTest.css';

const AdminTest = () => {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const createTestQuestion = async () => {
    setLoading(true);
    setResult('Creating test question...');
    
    try {
      const testQuestion = {
        title: "Test Question - Sum of Two Numbers",
        description: "Write a program that reads two integers and outputs their sum.",
        difficulty: "easy",
        category: "Programming",
        tags: ["basics", "arithmetic"],
        supportedLanguages: ["python", "java", "cpp"],
        starterCode: {
          python: "# Read two integers and print their sum\na = int(input())\nb = int(input())\nprint(a + b)",
          java: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        System.out.println(a + b);\n    }\n}",
          cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}"
        },
        solutionCode: {
          python: "a = int(input())\nb = int(input())\nprint(a + b)",
          java: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        System.out.println(a + b);\n    }\n}",
          cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}"
        },
        testCases: [
          {
            input: "5\n3",
            expectedOutput: "8",
            points: 1,
            isHidden: false,
            description: "Basic addition test"
          },
          {
            input: "10\n-5",
            expectedOutput: "5", 
            points: 1,
            isHidden: false,
            description: "Addition with negative number"
          }
        ],
        constraints: {
          timeLimit: 2000,
          memoryLimit: 256,
          inputFormat: "Two integers on separate lines",
          outputFormat: "Single integer (sum of the two numbers)"
        },
        notifyStudents: true
      };

      const response = await fetch('/api/v1/coding-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(testQuestion)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(`✅ Success! Question created with ID: ${data.data._id}\n\nCheck the backend console for notification logs.`);
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testEmailService = async () => {
    setLoading(true);
    setResult('Testing email service...');

    try {
      const response = await fetch('/api/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setResult('✅ Backend is running and accessible');
      } else {
        setResult('❌ Backend health check failed');
      }
    } catch (error) {
      setResult(`❌ Error connecting to backend: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-test-container">
      <h1>🧪 Admin Test Panel</h1>
      <p>Use this panel to test the coding questions functionality and email notifications.</p>
      
      <div className="result-container">
        <h2>Test Actions</h2>
        <div className="test-actions">
          <button 
            onClick={testEmailService}
            disabled={loading}
            className="test-button primary"
          >
            Test Backend Connection
          </button>
          <button 
            onClick={createTestQuestion}
            disabled={loading}
            className="test-button success"
          >
            Create Test Question (with notifications)
          </button>
        </div>
      </div>

      <div className="result-container">
        <h2>Result</h2>
        <pre className="result-pre">
          {loading ? 'Loading...' : result || 'No test run yet. Click a button above to test.'}
        </pre>
      </div>

      <div className="instructions-container">
        <h2>📝 Instructions</h2>
        <ol>
          <li>Make sure you're logged in as an admin</li>
          <li>Click "Test Backend Connection" to verify the API is working</li>
          <li>Click "Create Test Question" to create a question with notifications enabled</li>
          <li>Check the backend console logs for notification details</li>
          <li>Check student email inboxes for the notification</li>
        </ol>
      </div>

      <div className="troubleshooting-container">
        <h2>🔍 Troubleshooting</h2>
        <p><strong>If coding questions section is not visible:</strong></p>
        <ul>
          <li>Make sure you're on the admin dashboard: <code>/admin/dashboard</code></li>
          <li>Look for "💻 Coding Questions" button in the Quick Actions section</li>
          <li>Try refreshing the page</li>
          <li>Check browser console for any JavaScript errors</li>
        </ul>
        
        <p><strong>If emails are not being sent:</strong></p>
        <ul>
          <li>Verify the "Notify Students" checkbox is checked when creating questions</li>
          <li>Check the backend console for detailed logs</li>
          <li>Verify students exist in the database with valid email addresses</li>
          <li>Check email configuration in backend/.env file</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminTest;
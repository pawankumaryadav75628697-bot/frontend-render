import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminDebugTest = () => {
  const { token, user } = useAuth();
  const [debugResult, setDebugResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testAdminAccess = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing admin access...');
      console.log('Current user:', user);
      console.log('Token:', token ? token.substring(0, 20) + '...' : 'None');
      
      const response = await fetch('/api/v1/exams/debug/admin-test', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      console.log('Debug test response:', {
        status: response.status,
        ok: response.ok,
        data
      });
      
      setDebugResult({
        status: response.status,
        ok: response.ok,
        data
      });
      
    } catch (error) {
      console.error('Debug test error:', error);
      setDebugResult({
        error: error.message,
        status: 'Error'
      });
    } finally {
      setLoading(false);
    }
  };

  const testExamListAPI = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing exam list API...');
      
      const response = await fetch('/api/v1/exams?page=1&limit=10&status=all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      console.log('Exam list API response:', {
        status: response.status,
        ok: response.ok,
        data
      });
      
      setDebugResult({
        status: response.status,
        ok: response.ok,
        data,
        apiType: 'Exam List'
      });
      
    } catch (error) {
      console.error('Exam list test error:', error);
      setDebugResult({
        error: error.message,
        status: 'Error',
        apiType: 'Exam List'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.userType !== 'admin') {
    return (
      <div style={{ padding: '20px', backgroundColor: '#ffe6e6', border: '1px solid #ffcccc', borderRadius: '5px', margin: '20px' }}>
        <h3>🔒 Admin Debug Test</h3>
        <p>This component is only available for admin users.</p>
        <p>Current user: {user ? `${user.fullName} (${user.userType})` : 'Not logged in'}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f8ff', border: '1px solid #cce7ff', borderRadius: '5px', margin: '20px' }}>
      <h3>🔧 Admin API Debug Test</h3>
      <p>Current admin: {user.fullName} ({user.userType})</p>
      
      <div style={{ marginTop: '15px' }}>
        <button 
          onClick={testAdminAccess} 
          disabled={loading}
          style={{ 
            padding: '10px 15px', 
            marginRight: '10px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Testing...' : '🧪 Test Admin Debug Endpoint'}
        </button>
        
        <button 
          onClick={testExamListAPI} 
          disabled={loading}
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Testing...' : '📝 Test Exam List API'}
        </button>
      </div>

      {debugResult && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '5px' }}>
          <h4>🔍 Test Result {debugResult.apiType ? `(${debugResult.apiType})` : ''}</h4>
          <p><strong>Status:</strong> <span style={{ color: debugResult.ok ? 'green' : 'red' }}>{debugResult.status}</span></p>
          {debugResult.error && (
            <p><strong>Error:</strong> <span style={{ color: 'red' }}>{debugResult.error}</span></p>
          )}
          {debugResult.data && (
            <div>
              <strong>Response Data:</strong>
              <pre style={{ backgroundColor: '#e9ecef', padding: '10px', marginTop: '10px', borderRadius: '3px', fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(debugResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDebugTest;
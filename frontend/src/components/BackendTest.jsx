import React, { useState, useEffect } from 'react';
import { testBackendConnection } from '../services/apiTest';

const BackendTest = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setTestResults(null);
    
    const results = await testBackendConnection();
    setTestResults(results);
    setLoading(false);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '20px', 
      right: '20px', 
      background: '#f0f0f0', 
      color: 'white', 
      padding: '15px', 
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>🔍 Backend Connection Test</h3>
      
      <button 
        onClick={runTest}
        disabled={loading}
        style={{
          background: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test Backend Connection'}
      </button>

      {testResults && (
        <div style={{ marginTop: '15px', fontSize: '12px' }}>
          <div><strong>Health Check:</strong></div>
          <div style={{ 
            background: testResults.health?.success ? '#d4edda' : '#f8d7da',
            padding: '8px',
            borderRadius: '4px',
            marginTop: '5px'
          }}>
            {testResults.health?.success ? '✅ Connected' : '❌ Failed'}
          </div>
          
          <div style={{ marginTop: '10px' }}>
            <strong>Auth Test:</strong>
          </div>
          <div style={{ 
            background: testResults.auth?.success ? '#d4edda' : '#f8d7da',
            padding: '8px',
            borderRadius: '4px',
            marginTop: '5px'
          }}>
            {testResults.auth?.success ? '✅ Working' : '❌ Failed'}
          </div>
          
          {testResults.error && (
            <div style={{ 
              background: '#f8d7da', 
              padding: '8px', 
              borderRadius: '4px',
              marginTop: '10px',
              fontSize: '11px'
            }}>
              <strong>Error:</strong> {testResults.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BackendTest;

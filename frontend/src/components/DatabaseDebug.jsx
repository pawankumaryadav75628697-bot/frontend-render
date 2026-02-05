import React, { useState } from 'react';

const DatabaseDebug = () => {
  const [debugInfo, setDebugInfo] = useState({
    mongoURI: 'mongodb+srv://pkthenexgenexam:pkthenexgenexam@exammonitoring.dufim9x.mongodb.net/exammonitor?retryWrites=true&w=majority',
    status: 'unknown',
    suggestions: []
  });

  const checkConnection = async () => {
    try {
      // Test backend database endpoint
      const response = await fetch('https://frontend-render-lbix.onrender.com/api/health');
      const data = await response.json();
      
      setDebugInfo(prev => ({
        ...prev,
        status: data.success ? 'connected' : 'failed',
        lastCheck: new Date().toISOString(),
        backendResponse: data,
        error: null
      }));
      
      // Add suggestions based on common issues
      const suggestions = [];
      if (!data.success) {
        if (data.message?.includes('ECONNREFUSED')) {
          suggestions.push('Check if MongoDB is running');
          suggestions.push('Verify connection string format');
          suggestions.push('Check MongoDB Atlas IP whitelist');
        }
        if (data.message?.includes('authentication failed')) {
          suggestions.push('Verify MongoDB username/password');
          suggestions.push('Check database user permissions');
        }
      }
      
      setDebugInfo(prev => ({ ...prev, suggestions }));
      
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message,
        suggestions: ['Check network connectivity', 'Verify backend deployment status']
      }));
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '20px', 
      right: '20px', 
      background: '#1a1a1a', 
      color: 'white', 
      padding: '15px', 
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>🗄️ Database Connection Debug</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <div><strong>Connection String:</strong></div>
        <div style={{ 
          background: '#333', 
          padding: '8px', 
          borderRadius: '4px', 
          fontSize: '11px',
          wordBreak: 'break-all'
        }}>
          {debugInfo.mongoURI}
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <strong>Status:</strong> 
          <span style={{ 
            color: debugInfo.status === 'connected' ? '#4CAF50' : '#f44336',
            fontWeight: 'bold'
          }}>
            {debugInfo.status.toUpperCase()}
          </span>
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <strong>Last Check:</strong> {debugInfo.lastCheck}
        </div>
        
        {debugInfo.backendResponse && (
          <div style={{ marginTop: '10px' }}>
            <strong>Backend Response:</strong>
            <pre style={{ 
              background: '#333', 
              padding: '8px', 
              borderRadius: '4px', 
              fontSize: '10px',
              overflow: 'auto'
            }}>
              {JSON.stringify(debugInfo.backendResponse, null, 2)}
            </pre>
          </div>
        )}
        
        {debugInfo.error && (
          <div style={{ marginTop: '10px' }}>
            <strong>Error:</strong> 
            <span style={{ color: '#f44336' }}>{debugInfo.error}</span>
          </div>
        )}
        
        {debugInfo.suggestions.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <strong>Suggestions:</strong>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              {debugInfo.suggestions.map((suggestion, index) => (
                <li key={index} style={{ marginBottom: '5px' }}>🔧 {suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={checkConnection}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Check Connection
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseDebug;

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import './RealTimeMonitoring.css';

const RealTimeMonitoring = ({ examId }) => {
  const [activeStudents, setActiveStudents] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({
    totalActive: 0,
    flaggedStudents: 0,
    highRiskEvents: 0,
    averageRiskScore: 0
  });
  const [filters, setFilters] = useState({
    riskLevel: 'all',
    eventType: 'all',
    timeRange: '5'
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (examId) {
      startMonitoring();
    }
    return () => stopMonitoring();
  }, [examId]);

  const startMonitoring = async () => {
    setIsMonitoring(true);
    await fetchRealTimeData();
    
    // Set up real-time updates every 5 seconds
    intervalRef.current = setInterval(fetchRealTimeData, 5000);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const fetchRealTimeData = async () => {
    try {
      const response = await fetch(`/api/v1/proctoring/realtime/${examId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActiveStudents(data.data.attempts);
        setRecentEvents(data.data.recentEvents);
        setStats({
          totalActive: data.data.activeAttempts,
          flaggedStudents: data.data.attempts.filter(student => student.riskScore > 50).length,
          highRiskEvents: data.data.recentEvents.filter(event => 
            event.event.severity === 'high' || event.event.severity === 'critical'
          ).length,
          averageRiskScore: data.data.attempts.reduce((sum, student) => 
            sum + student.riskScore, 0) / (data.data.attempts.length || 1)
        });
      }
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      toast.error('Failed to fetch monitoring data');
    }
  };

  const getRiskLevelClass = (score) => {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  };

  const getRiskLevelText = (score) => {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Medium';
    return 'Low';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  const getEventTypeDescription = (eventType) => {
    const descriptions = {
      'tab_switch': 'Switched browser tabs',
      'window_blur': 'Left exam window',
      'copy_paste': 'Copy/paste attempted',
      'right_click': 'Right-click detected',
      'full_screen_exit': 'Exited fullscreen',
      'camera_disabled': 'Camera disabled',
      'microphone_disabled': 'Microphone disabled',
      'multiple_faces': 'Multiple faces detected',
      'no_face_detected': 'No face visible',
      'suspicious_noise': 'Suspicious audio detected',
      'screen_share_detected': 'Screen sharing detected',
      'face_mismatch': 'Face verification failed'
    };
    return descriptions[eventType] || eventType;
  };

  const flagStudent = async (studentId, reason) => {
    try {
      const response = await fetch(`/api/v1/proctoring/flag-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ studentId, examId, reason })
      });

      if (response.ok) {
        toast.success('Student flagged for review');
        await fetchRealTimeData();
      }
    } catch (error) {
      console.error('Error flagging student:', error);
      toast.error('Failed to flag student');
    }
  };

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/v1/reports/proctoring/${examId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proctoring-report-${examId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Report exported successfully');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="real-time-monitoring">
      <div className="monitoring-header">
        <div className="header-info">
          <h2>Real-Time Proctoring Monitor</h2>
          <div className="monitoring-status">
            <span className={`status-indicator ${isMonitoring ? 'active' : 'inactive'}`}></span>
            {isMonitoring ? 'Live Monitoring' : 'Monitoring Stopped'}
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${isMonitoring ? 'btn-danger' : 'btn-success'}`}
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
          <button className="btn btn-primary" onClick={exportReport}>
            Export Report
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalActive}</h3>
            <p>Active Students</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚩</div>
          <div className="stat-content">
            <h3>{stats.flaggedStudents}</h3>
            <p>High Risk Students</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{stats.highRiskEvents}</h3>
            <p>Critical Events</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{Math.round(stats.averageRiskScore)}</h3>
            <p>Avg Risk Score</p>
          </div>
        </div>
      </div>

      <div className="monitoring-content">
        {/* Active Students Panel */}
        <div className="monitoring-panel">
          <div className="panel-header">
            <h3>Active Students ({activeStudents.length})</h3>
            <div className="panel-filters">
              <select 
                value={filters.riskLevel} 
                onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical (75+)</option>
                <option value="high">High (50-74)</option>
                <option value="medium">Medium (25-49)</option>
                <option value="low">Low (0-24)</option>
              </select>
            </div>
          </div>
          <div className="students-grid">
            {activeStudents
              .filter(student => {
                if (filters.riskLevel === 'all') return true;
                const level = getRiskLevelClass(student.riskScore);
                return level === filters.riskLevel;
              })
              .map(student => (
                <div key={student._id} className={`student-card ${getRiskLevelClass(student.riskScore)}`}>
                  <div className="student-info">
                    <div className="student-avatar">
                      {student.student?.fullName?.charAt(0) || 'S'}
                    </div>
                    <div className="student-details">
                      <h4>{student.student?.fullName || 'Unknown Student'}</h4>
                      <p>ID: {student.student?.studentId || 'N/A'}</p>
                      <p>Started: {new Date(student.startTime).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="student-metrics">
                    <div className="risk-score">
                      <span className={`risk-badge ${getRiskLevelClass(student.riskScore)}`}>
                        {Math.round(student.riskScore)}
                      </span>
                      <span className="risk-label">{getRiskLevelText(student.riskScore)} Risk</span>
                    </div>
                    <div className="system-info">
                      <p>OS: {student.systemInfo?.os || 'Unknown'}</p>
                      <p>Browser: {student.systemInfo?.browser || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="student-actions">
                    <button 
                      className="btn btn-warning btn-sm"
                      onClick={() => flagStudent(student.student._id, 'Manual review requested')}
                    >
                      Flag for Review
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Events Panel */}
        <div className="monitoring-panel">
          <div className="panel-header">
            <h3>Recent Events</h3>
            <div className="panel-filters">
              <select 
                value={filters.eventType} 
                onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              >
                <option value="all">All Events</option>
                <option value="tab_switch">Tab Switch</option>
                <option value="camera_disabled">Camera Issues</option>
                <option value="multiple_faces">Face Detection</option>
                <option value="copy_paste">Copy/Paste</option>
                <option value="suspicious_noise">Audio Issues</option>
              </select>
              <select 
                value={filters.timeRange} 
                onChange={(e) => setFilters({...filters, timeRange: e.target.value})}
              >
                <option value="5">Last 5 minutes</option>
                <option value="15">Last 15 minutes</option>
                <option value="30">Last 30 minutes</option>
                <option value="60">Last hour</option>
              </select>
            </div>
          </div>
          <div className="events-list">
            {recentEvents
              .filter(event => {
                if (filters.eventType === 'all') return true;
                return event.event.eventType === filters.eventType;
              })
              .map((event, index) => (
                <div key={index} className={`event-item ${event.event.severity}`}>
                  <div className="event-icon">
                    {getSeverityIcon(event.event.severity)}
                  </div>
                  <div className="event-content">
                    <div className="event-header">
                      <h4>{event.student.name}</h4>
                      <span className="event-time">
                        {new Date(event.event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="event-description">
                      {getEventTypeDescription(event.event.eventType)}
                    </p>
                    {event.event.description && (
                      <p className="event-details">{event.event.description}</p>
                    )}
                  </div>
                  <div className="event-metrics">
                    <span className={`severity-badge ${event.event.severity}`}>
                      {event.event.severity.toUpperCase()}
                    </span>
                    <span className="risk-score">Risk: {Math.round(event.riskScore)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitoring;
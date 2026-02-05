import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import './Settings.css';

const Settings = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    // System Settings
    systemName: 'Exam Monitor Pro',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    language: 'en',
    
    // Exam Settings
    defaultExamDuration: 60,
    maxExamDuration: 180,
    autoSubmitEnabled: true,
    allowLateSubmissions: false,
    lateSubmissionGracePeriod: 5,
    
    // Security Settings
    sessionTimeout: 30,
    maxLoginAttempts: 3,
    passwordMinLength: 8,
    requirePasswordComplexity: true,
    enableTwoFactorAuth: false,
    
    // Notification Settings
    emailNotifications: true,
    smsNotifications: true,
    notifyExamStart: true,
    notifyExamEnd: true,
    notifyIncidents: true,
    
    // Proctoring Settings
    enableFaceDetection: true,
    enableTabSwitching: true,
    enableScreenRecording: false,
    suspiciousActivityThreshold: 3,
    autoFlagIncidents: true,
    
    // Email Configuration
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    emailFromAddress: '',
    emailFromName: 'Exam Monitor',
    
    // SMS Configuration
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/v1/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(prevSettings => ({
          ...prevSettings,
          ...data.data
        }));
      } else if (response.status === 404) {
        console.warn('⚠️ Settings API endpoint not available. Using default settings.');
        // Use default settings - no error toast since this is expected
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (error.message === 'Failed to fetch' || error.message.includes('404')) {
        console.warn('⚠️ Settings API endpoint not available. Using default settings.');
        // Don't show error for missing endpoint
      } else {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const testEmailConfiguration = async () => {
    setTestingEmail(true);
    try {
      const response = await fetch('/api/v1/admin/settings/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPassword: settings.smtpPassword,
          emailFromAddress: settings.emailFromAddress
        })
      });

      if (response.ok) {
        toast.success('Test email sent successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Error testing email:', error);
      toast.error('Error testing email configuration');
    } finally {
      setTestingEmail(false);
    }
  };

  const testSMSConfiguration = async () => {
    setTestingSMS(true);
    try {
      const response = await fetch('/api/v1/admin/settings/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          twilioAccountSid: settings.twilioAccountSid,
          twilioAuthToken: settings.twilioAuthToken,
          twilioPhoneNumber: settings.twilioPhoneNumber
        })
      });

      if (response.ok) {
        toast.success('Test SMS sent successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to send test SMS');
      }
    } catch (error) {
      console.error('Error testing SMS:', error);
      toast.error('Error testing SMS configuration');
    } finally {
      setTestingSMS(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="settings loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'exam', label: 'Exam Settings', icon: '📝' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'proctoring', label: 'Proctoring', icon: '👁️' },
    { id: 'email', label: 'Email Config', icon: '📧' },
    { id: 'sms', label: 'SMS Config', icon: '📱' }
  ];

  return (
    <div className="settings">
      <div className="page-header">
        <div>
          <h1>System Settings</h1>
          <p>Configure system-wide settings and preferences</p>
        </div>
        <div className="header-actions">
          <Link to="/admin/dashboard" className="btn btn-secondary">
            <span className="icon">←</span>
            Back to Dashboard
          </Link>
          <button
            className="btn btn-primary"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="loading-spinner"></span>
                Saving...
              </>
            ) : (
              <>
                <span className="icon">💾</span>
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      <div className="settings-container">
        <div className="settings-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h3>General Settings</h3>
              <div className="form-group">
                <label>System Name</label>
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={(e) => handleInputChange('systemName', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  className="form-select"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date Format</label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                  className="form-select"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label>Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                  className="form-select"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'exam' && (
            <div className="settings-section">
              <h3>Exam Settings</h3>
              <div className="form-group">
                <label>Default Exam Duration (minutes)</label>
                <input
                  type="number"
                  value={settings.defaultExamDuration}
                  onChange={(e) => handleInputChange('defaultExamDuration', parseInt(e.target.value))}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Maximum Exam Duration (minutes)</label>
                <input
                  type="number"
                  value={settings.maxExamDuration}
                  onChange={(e) => handleInputChange('maxExamDuration', parseInt(e.target.value))}
                  className="form-input"
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.autoSubmitEnabled}
                    onChange={(e) => handleInputChange('autoSubmitEnabled', e.target.checked)}
                  />
                  Auto-submit exams when time expires
                </label>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.allowLateSubmissions}
                    onChange={(e) => handleInputChange('allowLateSubmissions', e.target.checked)}
                  />
                  Allow late submissions
                </label>
              </div>
              {settings.allowLateSubmissions && (
                <div className="form-group">
                  <label>Late Submission Grace Period (minutes)</label>
                  <input
                    type="number"
                    value={settings.lateSubmissionGracePeriod}
                    onChange={(e) => handleInputChange('lateSubmissionGracePeriod', parseInt(e.target.value))}
                    className="form-input"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h3>Notification Settings</h3>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                  />
                  Enable email notifications
                </label>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.smsNotifications}
                    onChange={(e) => handleInputChange('smsNotifications', e.target.checked)}
                  />
                  Enable SMS notifications
                </label>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifyExamStart}
                    onChange={(e) => handleInputChange('notifyExamStart', e.target.checked)}
                  />
                  Notify when exam starts
                </label>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifyExamEnd}
                    onChange={(e) => handleInputChange('notifyExamEnd', e.target.checked)}
                  />
                  Notify when exam ends
                </label>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifyIncidents}
                    onChange={(e) => handleInputChange('notifyIncidents', e.target.checked)}
                  />
                  Notify about suspicious incidents
                </label>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="settings-section">
              <h3>Email Configuration</h3>
              <div className="form-group">
                <label>SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtpHost}
                  onChange={(e) => handleInputChange('smtpHost', e.target.value)}
                  className="form-input"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="form-group">
                <label>SMTP Port</label>
                <input
                  type="number"
                  value={settings.smtpPort}
                  onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value))}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={settings.smtpUser}
                  onChange={(e) => handleInputChange('smtpUser', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Email Password</label>
                <input
                  type="password"
                  value={settings.smtpPassword}
                  onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>From Address</label>
                <input
                  type="email"
                  value={settings.emailFromAddress}
                  onChange={(e) => handleInputChange('emailFromAddress', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>From Name</label>
                <input
                  type="text"
                  value={settings.emailFromName}
                  onChange={(e) => handleInputChange('emailFromName', e.target.value)}
                  className="form-input"
                />
              </div>
              <button
                className="btn btn-outline"
                onClick={testEmailConfiguration}
                disabled={testingEmail}
              >
                {testingEmail ? 'Testing...' : 'Test Email Configuration'}
              </button>
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="settings-section">
              <h3>SMS Configuration</h3>
              <p className="section-note">Configure Twilio settings for SMS notifications</p>
              <div className="form-group">
                <label>Twilio Account SID</label>
                <input
                  type="text"
                  value={settings.twilioAccountSid}
                  onChange={(e) => handleInputChange('twilioAccountSid', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Twilio Auth Token</label>
                <input
                  type="password"
                  value={settings.twilioAuthToken}
                  onChange={(e) => handleInputChange('twilioAuthToken', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Twilio Phone Number</label>
                <input
                  type="text"
                  value={settings.twilioPhoneNumber}
                  onChange={(e) => handleInputChange('twilioPhoneNumber', e.target.value)}
                  className="form-input"
                  placeholder="+1234567890"
                />
              </div>
              <button
                className="btn btn-outline"
                onClick={testSMSConfiguration}
                disabled={testingSMS}
              >
                {testingSMS ? 'Testing...' : 'Test SMS Configuration'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AuthModal.css';
import AdminRegister from '../AdminRegister/AdminRegister';
import AdminLogin from '../AdminLogin/AdminLogin';
import { authService } from '../../services/authService';
import { toast } from 'react-toastify';

const AuthModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  if (!isOpen) return null;

  const handleAuthSuccess = (data) => {
    authLogin(data);
    const userType = data.user.userType;
    const welcomeMessage = userType === 'admin' ? 
      `Welcome, Admin ${data.user.fullName}!` : 
      `Welcome, ${data.user.fullName}!`;
    
    toast.success(welcomeMessage);
    onClose();
    
    // Navigate based on user type
    if (userType === 'admin') {
      navigate('/admin/dashboard');
    } else if (userType === 'student') {
      navigate('/student/dashboard');
    } else {
      navigate('/');
    }
  };

  const handleAuthError = (error) => {
    const message = error.response?.data?.message || 'Authentication failed';
    toast.error(message);
  };

  const handleRegister = async (formData) => {
    setIsLoading(true);
    try {
      const data = await authService.registerAdmin(formData);
      handleAuthSuccess(data);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authService.login(credentials);
      handleAuthSuccess(data);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        
        <div className="auth-header">
          <h3>Authentication</h3>
          <p>Login as student or register as admin</p>
        </div>
        
        <div className="auth-tabs">
          <button 
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register Admin
          </button>
          <button 
            className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
        </div>

        <div className="auth-content">
          {activeTab === 'register' && (
            <AdminRegister 
              onSubmit={handleRegister} 
              isLoading={isLoading} 
            />
          )}
          {activeTab === 'login' && (
            <AdminLogin 
              onSubmit={handleLogin} 
              isLoading={isLoading} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
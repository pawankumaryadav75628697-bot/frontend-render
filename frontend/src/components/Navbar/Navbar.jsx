import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import AuthModal from '../AuthModal/AuthModal';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (user?.userType === 'admin') {
      return '/admin/dashboard';
    } else if (user?.userType === 'student') {
      return '/student/dashboard';
    }
    return '/';
  };

  const getProfileLink = () => {
    if (user?.userType === 'admin') {
      return '/admin/profile';
    } else if (user?.userType === 'student') {
      return '/student/profile';
    }
    return '/';
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/" className="brand-link" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img 
                src="/logo2.png" 
                alt="Logo" 
                style={{ 
                  height: '70px',
                  width: 'auto',
                  maxWidth: '250px',
                  objectFit: 'contain',
                  padding: '8px 0',
                  transition: 'all 0.3s ease',
                  display: 'block'  
                }}
                onError={(e) => {
                  console.log('Error loading logo:', e);
                  e.target.style.display = 'none'; 
                }}
                className="navbar-logo"
              />
            </Link>
          </div>
          <div className="navbar-menu">
            {isAuthenticated ? (
              <div className="auth-menu">
                <span className="welcome-text">
                  Welcome, {user?.userType === 'admin' ? 'Admin' : 'Student'} {user?.fullName}
                </span>
                <Link to={getDashboardLink()} className="nav-link">
                  {user?.userType === 'admin' ? 'Admin Dashboard' : 'Student Dashboard'}
                </Link>
                {user?.userType === 'student' && (
                  <Link to="/student/exams" className="nav-link">My Exams</Link>
                )}
                <Link to={getProfileLink()} className="nav-link">Profile</Link>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <button 
                  className="auth-button"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  Login
                </button>
                <Link to="/exam" className="nav-link exam-access-link">
                  Exam Access
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
};

export default Navbar;
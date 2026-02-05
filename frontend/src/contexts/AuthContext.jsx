import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const storedUser = authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    setUser(userData.user);
    setIsAuthenticated(true);
    authService.setUserData(userData);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    authService.removeUserData();
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      localStorage.setItem('user', JSON.stringify(updatedUserData));
    }
  };

  const value = {
    user,
    token: localStorage.getItem('token'),
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    isAdmin: user?.userType === 'admin',
    isStudent: user?.userType === 'student'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

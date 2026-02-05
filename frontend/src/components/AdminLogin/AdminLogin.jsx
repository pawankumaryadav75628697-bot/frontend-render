import { useState } from 'react';
import './AdminLogin.css';

const AdminLogin = ({ onSubmit, isLoading }) => {
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(loginData);
  };

  return (
    <form className="admin-login-form" onSubmit={handleSubmit}>
      <h3>Admin Login</h3>
      
      <div className="form-group">
        <label htmlFor="adminEmail">Email</label>
        <input
          type="email"
          id="adminEmail"
          name="email"
          value={loginData.email}
          onChange={handleChange}
          required
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="adminPassword">Password</label>
        <input
          type="password"
          id="adminPassword"
          name="password"
          value={loginData.password}
          onChange={handleChange}
          required
          disabled={isLoading}
        />
      </div>

      <div className="form-options">
        <label className="remember-me">
          <input type="checkbox" disabled={isLoading} />
          Remember me
        </label>
        <a href="#forgot-password" className="forgot-password">
          Forgot password?
        </a>
      </div>

      <button 
        type="submit" 
        className="submit-btn"
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Login as Admin'}
      </button>
    </form>
  );
};

export default AdminLogin;
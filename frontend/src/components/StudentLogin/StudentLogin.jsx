import { useState } from 'react';
import './StudentLogin.css';

const StudentLogin = ({ onSubmit, isLoading = false }) => {
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
    if (onSubmit) {
      onSubmit(loginData);
    }
  };

  return (
    <form className="student-login-form" onSubmit={handleSubmit}>
      <h3>Student Login</h3>
      
      <div className="form-group">
        <label htmlFor="studentEmail">Email or Student ID</label>
        <input
          type="text"
          id="studentEmail"
          name="email"
          value={loginData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="studentPassword">Password</label>
        <input
          type="password"
          id="studentPassword"
          name="password"
          value={loginData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-options">
        <label className="remember-me">
          <input type="checkbox" />
          Remember me
        </label>
        <a href="#forgot-password" className="forgot-password">
          Forgot password?
        </a>
      </div>

      <button type="submit" className="submit-btn" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login as Student'}
      </button>

      <div className="login-help">
        <p>Need help logging in? <a href="#support">Contact support</a></p>
      </div>
    </form>
  );
};

export default StudentLogin;
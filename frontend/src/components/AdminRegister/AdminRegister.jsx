import { useState } from 'react';
import './AdminRegister.css';

const AdminRegister = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    institution: '',
    department: '',
    employeeId: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (onSubmit) {
      // Remove confirmPassword before sending to API
      const { confirmPassword, ...registrationData } = formData;
      onSubmit(registrationData, true); // true indicates this is an admin
    }
  };

  return (
    <form className="admin-register-form" onSubmit={handleSubmit}>
      <h3>Admin Registration</h3>
      
      <div className="form-group">
        <label htmlFor="fullName">Full Name</label>
        <input
          type="text"
          id="fullName"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="institution">Institution</label>
        <input
          type="text"
          id="institution"
          name="institution"
          value={formData.institution}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="department">Department</label>
        <input
          type="text"
          id="department"
          name="department"
          value={formData.department}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="employeeId">Employee ID</label>
        <input
          type="text"
          id="employeeId"
          name="employeeId"
          value={formData.employeeId}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>

      <button type="submit" className="submit-btn" disabled={isLoading}>
        {isLoading ? 'Registering...' : 'Register as Admin'}
      </button>
    </form>
  );
};

export default AdminRegister;
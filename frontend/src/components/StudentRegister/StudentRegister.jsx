import { useState } from 'react';
import './StudentRegister.css';

const StudentRegister = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    studentId: '',
    course: '',
    semester: '',
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
      onSubmit(registrationData, false); // false indicates this is not an admin
    }
  };

  return (
    <form className="student-register-form" onSubmit={handleSubmit}>
      <h3>Student Registration</h3>
      
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
        <label htmlFor="studentId">Student ID</label>
        <input
          type="text"
          id="studentId"
          name="studentId"
          value={formData.studentId}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="course">Course/Program</label>
        <select
          id="course"
          name="course"
          value={formData.course}
          onChange={handleChange}
          required
        >
          <option value="">Select Course</option>
          <option value="computer-science">Computer Science</option>
          <option value="engineering">Engineering</option>
          <option value="business">Business Administration</option>
          <option value="medicine">Medicine</option>
          <option value="arts">Arts & Humanities</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="semester">Semester</label>
        <select
          id="semester"
          name="semester"
          value={formData.semester}
          onChange={handleChange}
          required
        >
          <option value="">Select Semester</option>
          <option value="1">Semester 1</option>
          <option value="2">Semester 2</option>
          <option value="3">Semester 3</option>
          <option value="4">Semester 4</option>
          <option value="5">Semester 5</option>
          <option value="6">Semester 6</option>
          <option value="7">Semester 7</option>
          <option value="8">Semester 8</option>
        </select>
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
        {isLoading ? 'Registering...' : 'Register as Student'}
      </button>
    </form>
  );
};

export default StudentRegister;
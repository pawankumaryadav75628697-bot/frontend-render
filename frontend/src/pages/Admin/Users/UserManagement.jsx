import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import './UserManagement.css';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userType: 'all',
    search: '',
    college: '',
    department: '',
    semester: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    hasMore: false
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [filters, pagination.currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.currentPage,
        limit: 10,
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value))
      });

      const response = await api.get(`/admin/users?${queryParams}`);
      
      setUsers(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.warning('Please select users first');
      return;
    }

    const confirmMessage = action === 'delete' 
      ? `Are you sure you want to delete ${selectedUsers.length} users?`
      : `Are you sure you want to ${action} ${selectedUsers.length} users?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Implement bulk actions here
      for (const userId of selectedUsers) {
        if (action === 'delete') {
          await api.delete(`/admin/users/${userId}`);
        }
        // Add other bulk actions as needed
      }
      
      toast.success(`Successfully ${action}d ${selectedUsers.length} users`);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error(`Error during bulk ${action}:`, error);
      toast.error(`Failed to ${action} users`);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      setUploadProgress(0);
      const response = await api.post('/admin/users/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      toast.success(response.data.message);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadProgress(0);
      fetchUsers();

      // Show detailed results
      if (response.data.data.errors.length > 0) {
        console.log('Upload errors:', response.data.data.errors);
        toast.warning(`${response.data.data.errors.length} records had errors. Check console for details.`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload users');
      setUploadProgress(0);
    }
  };

  const UserCard = ({ user: userData }) => (
    <div className="user-card">
      <div className="user-card__header">
        <input
          type="checkbox"
          checked={selectedUsers.includes(userData._id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedUsers(prev => [...prev, userData._id]);
            } else {
              setSelectedUsers(prev => prev.filter(id => id !== userData._id));
            }
          }}
        />
        <div className="user-card__avatar">
          {userData.profilePicture ? (
            <img src={userData.profilePicture} alt={userData.fullName} />
          ) : (
            <div className="avatar-placeholder">
              {userData.fullName?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-card__info">
          <h4>{userData.fullName}</h4>
          <p>{userData.email}</p>
          <span className={`user-type-badge user-type-badge--${userData.userType}`}>
            {userData.userType}
          </span>
        </div>
      </div>
      
      <div className="user-card__details">
        {userData.userType === 'student' && (
          <>
            <div className="detail-item">
              <label>Student ID:</label>
              <span>{userData.studentId || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Course:</label>
              <span>{userData.course || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Semester:</label>
              <span>{userData.semester || 'N/A'}</span>
            </div>
          </>
        )}
        
        {(userData.userType === 'teacher' || userData.userType === 'admin') && (
          <>
            <div className="detail-item">
              <label>Employee ID:</label>
              <span>{userData.employeeId || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Department:</label>
              <span>{userData.department || 'N/A'}</span>
            </div>
          </>
        )}
        
        <div className="detail-item">
          <label>College:</label>
          <span>{userData.college || userData.institution || 'N/A'}</span>
        </div>
        
        <div className="detail-item">
          <label>Status:</label>
          <span className={`status-badge ${userData.isActive ? 'active' : 'inactive'}`}>
            {userData.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div className="detail-item">
          <label>Last Login:</label>
          <span>{userData.lastLogin ? new Date(userData.lastLogin).toLocaleDateString() : 'Never'}</span>
        </div>
      </div>
      
      <div className="user-card__actions">
        <button 
          className="btn btn--sm btn--secondary"
          onClick={() => {/* Implement edit functionality */}}
        >
          Edit
        </button>
        <button 
          className="btn btn--sm btn--danger"
          onClick={() => handleDeleteUser(userData._id)}
        >
          Delete
        </button>
      </div>
    </div>
  );

  const UploadModal = () => (
    <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload Users</h3>
          <button 
            className="modal-close"
            onClick={() => setShowUploadModal(false)}
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="upload-instructions">
            <h4>Instructions:</h4>
            <ul>
              <li>Upload CSV or Excel file with user data</li>
              <li>Required columns: name/fullName, email, userType</li>
              <li>Optional columns: studentId, course, semester, department, college, phoneNumber</li>
              <li>Maximum file size: 5MB</li>
            </ul>
          </div>
          
          <div className="file-upload-area">
            <input
              type="file"
              id="user-file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="file-input"
            />
            <label htmlFor="user-file" className="file-label">
              {uploadFile ? uploadFile.name : 'Choose File'}
            </label>
          </div>
          
          {uploadProgress > 0 && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span>{uploadProgress}%</span>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn--secondary"
            onClick={() => setShowUploadModal(false)}
          >
            Cancel
          </button>
          <button 
            className="btn btn--primary"
            onClick={handleFileUpload}
            disabled={!uploadFile || uploadProgress > 0}
          >
            {uploadProgress > 0 ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="user-management">
      <header className="user-management__header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage students, teachers, and administrators</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn--secondary"
            onClick={() => setShowUploadModal(true)}
          >
            <i className="fas fa-upload"></i>
            Upload Users
          </button>
          <button 
            className="btn btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="fas fa-plus"></i>
            Add User
          </button>
        </div>
      </header>

      <div className="user-management__filters">
        <div className="filters-row">
          <div className="filter-group">
            <label>User Type:</label>
            <select 
              value={filters.userType}
              onChange={(e) => handleFilterChange('userType', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by name, email, or ID"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>College:</label>
            <input
              type="text"
              placeholder="Filter by college"
              value={filters.college}
              onChange={(e) => handleFilterChange('college', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Department:</label>
            <input
              type="text"
              placeholder="Filter by department"
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
            />
          </div>
        </div>
        
        {selectedUsers.length > 0 && (
          <div className="bulk-actions">
            <span>{selectedUsers.length} users selected</span>
            <button 
              className="btn btn--sm btn--danger"
              onClick={() => handleBulkAction('delete')}
            >
              Delete Selected
            </button>
          </div>
        )}
      </div>

      <div className="user-management__content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-users"></i>
            <h3>No users found</h3>
            <p>No users match your current filters</p>
          </div>
        ) : (
          <>
            <div className="users-grid">
              {users.map(user => (
                <UserCard key={user._id} user={user} />
              ))}
            </div>
            
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="btn btn--sm btn--secondary"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  Previous
                </button>
                
                <span className="pagination-info">
                  Page {pagination.currentPage} of {pagination.totalPages} 
                  ({pagination.totalUsers} total users)
                </span>
                
                <button 
                  className="btn btn--sm btn--secondary"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasMore}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showUploadModal && <UploadModal />}
    </div>
  );
};

export default UserManagement;
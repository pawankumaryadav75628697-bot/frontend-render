import { useState, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import './BulkUpload.css';

const BulkUpload = () => {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);

  const sampleCsvData = `fullName,email,studentId,phoneNumber,courseCode,batch
John Doe,john.doe@example.com,STU001,+1234567890,CS101,2024-A
Jane Smith,jane.smith@example.com,STU002,+1234567891,CS101,2024-A
Mike Johnson,mike.johnson@example.com,STU003,+1234567892,IT101,2024-B`;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    previewFileContent(file);
  };

  const previewFileContent = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const lines = content.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',');
      const rows = lines.slice(1, 6).map(line => line.split(',')); // Preview first 5 rows
      
      setPreviewData({ headers, rows });
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('sendCredentials', true); // Option to send credentials via SMS/Email

    try {
      const response = await fetch('/api/v1/admin/students/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResults(result.data);
        toast.success(`Successfully uploaded ${result.data.successful} students`);
        if (result.data.failed > 0) {
          toast.warning(`${result.data.failed} records failed to upload`);
        }
      } else {
        toast.error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadSampleFile = () => {
    const blob = new Blob([sampleCsvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_upload_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setUploadResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bulk-upload">
      <div className="page-header">
        <div>
          <h1>Bulk Student Upload</h1>
          <p>Upload multiple student records using CSV or Excel files</p>
        </div>
        <Link to="/admin/students" className="btn btn-secondary">
          <span className="icon">←</span>
          Back to Students
        </Link>
      </div>

      <div className="upload-container">
        <div className="upload-section">
          <div className="instructions-card">
            <h3>📋 Instructions</h3>
            <ul>
              <li>Supported formats: CSV, XLS, XLSX</li>
              <li>Maximum file size: 5MB</li>
              <li>Required columns: fullName, email, studentId, courseCode, batch</li>
              <li>Optional columns: phoneNumber</li>
              <li>First row should contain column headers</li>
              <li>Student credentials will be automatically generated and sent</li>
            </ul>
            <button 
              className="btn btn-outline"
              onClick={downloadSampleFile}
            >
              <span className="icon">📥</span>
              Download Sample File
            </button>
          </div>

          <div 
            className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".csv,.xls,.xlsx"
              className="file-input"
            />
            
            {selectedFile ? (
              <div className="file-selected">
                <div className="file-info">
                  <span className="file-icon">📄</span>
                  <div className="file-details">
                    <h4>{selectedFile.name}</h4>
                    <p>{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button 
                  className="btn-icon delete"
                  onClick={clearFile}
                  title="Remove file"
                >
                  🗑️
                </button>
              </div>
            ) : (
              <div className="upload-prompt">
                <span className="upload-icon">📁</span>
                <h3>Drag and drop your file here</h3>
                <p>or</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </button>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="upload-actions">
              <button 
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <span className="icon">⬆️</span>
                    Upload Students
                  </>
                )}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={clearFile}
                disabled={uploading}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {previewData.length > 0 && (
          <div className="preview-section">
            <h3>📊 File Preview</h3>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    {previewData.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="preview-note">
              Showing first 5 rows. Total rows in file: {previewData.rows.length}
            </p>
          </div>
        )}

        {uploadResults && (
          <div className="results-section">
            <h3>📈 Upload Results</h3>
            <div className="results-grid">
              <div className="result-card success">
                <div className="result-icon">✅</div>
                <div className="result-info">
                  <h4>Successful</h4>
                  <p>{uploadResults.successful} students</p>
                </div>
              </div>
              <div className="result-card error">
                <div className="result-icon">❌</div>
                <div className="result-info">
                  <h4>Failed</h4>
                  <p>{uploadResults.failed} records</p>
                </div>
              </div>
              <div className="result-card info">
                <div className="result-icon">📧</div>
                <div className="result-info">
                  <h4>Credentials Sent</h4>
                  <p>{uploadResults.credentialsSent || 0} students</p>
                </div>
              </div>
            </div>

            {uploadResults.errors && uploadResults.errors.length > 0 && (
              <div className="error-details">
                <h4>Error Details</h4>
                <div className="error-list">
                  {uploadResults.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="error-item">
                      <span className="error-line">Row {error.row}:</span>
                      <span className="error-message">{error.message}</span>
                    </div>
                  ))}
                  {uploadResults.errors.length > 10 && (
                    <p className="more-errors">
                      ... and {uploadResults.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="results-actions">
              <button 
                className="btn btn-primary"
                onClick={() => window.location.href = '/admin/students'}
              >
                View All Students
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setUploadResults(null);
                  clearFile();
                }}
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUpload;
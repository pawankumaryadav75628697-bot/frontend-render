import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import './Reports.css';

const Reports = () => {
  const { token } = useAuth();
  const [reportType, setReportType] = useState('student-performance');
  const [dateRange, setDateRange] = useState('last-30-days');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchExams();
    fetchCourses();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/v1/exams?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setExams(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/v1/admin/courses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCourses(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        dateRange: dateRange === 'custom' ? 'custom' : dateRange,
        ...(dateRange === 'custom' && {
          startDate: customDateRange.startDate,
          endDate: customDateRange.endDate
        }),
        ...(selectedExam && { examId: selectedExam }),
        ...(selectedCourse && { courseCode: selectedCourse })
      });

      const response = await fetch(`/api/v1/admin/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data.data);
        toast.success('Report generated successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (format = 'pdf') => {
    if (!reportData) return;

    try {
      const params = new URLSearchParams({
        type: reportType,
        format: format,
        dateRange: dateRange === 'custom' ? 'custom' : dateRange,
        ...(dateRange === 'custom' && {
          startDate: customDateRange.startDate,
          endDate: customDateRange.endDate
        }),
        ...(selectedExam && { examId: selectedExam }),
        ...(selectedCourse && { courseCode: selectedCourse })
      });

      const response = await fetch(`/api/v1/admin/reports/download?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Report downloaded as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Error downloading report');
    }
  };

  const reportTypes = [
    { value: 'student-performance', label: 'Student Performance Report' },
    { value: 'exam-analytics', label: 'Exam Analytics Report' },
    { value: 'attendance-report', label: 'Attendance Report' },
    { value: 'cheating-incidents', label: 'Cheating Incidents Report' },
    { value: 'system-usage', label: 'System Usage Report' }
  ];

  const dateRanges = [
    { value: 'last-7-days', label: 'Last 7 Days' },
    { value: 'last-30-days', label: 'Last 30 Days' },
    { value: 'last-90-days', label: 'Last 90 Days' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  return (
    <div className="reports">
      <div className="page-header">
        <div>
          <h1>Generate Reports</h1>
          <p>Create comprehensive reports on student performance, exam analytics, and system usage</p>
        </div>
        <Link to="/admin/dashboard" className="btn btn-secondary">
          <span className="icon">←</span>
          Back to Dashboard
        </Link>
      </div>

      <div className="report-container">
        <div className="report-form">
          <div className="form-section">
            <h3>Report Configuration</h3>
            
            <div className="form-group">
              <label>Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="form-select"
              >
                {reportTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="form-select"
              >
                {dateRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {dateRange === 'custom' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Filter by Exam (Optional)</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="form-select"
              >
                <option value="">All Exams</option>
                {exams.map(exam => (
                  <option key={exam._id} value={exam._id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Filter by Course (Optional)</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="form-select"
              >
                <option value="">All Courses</option>
                {courses.map(course => (
                  <option key={course.code} value={course.code}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={generateReport}
              disabled={generating}
            >
              {generating ? (
                <>
                  <span className="loading-spinner"></span>
                  Generating Report...
                </>
              ) : (
                <>
                  <span className="icon">📊</span>
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {reportData && (
          <div className="report-preview">
            <div className="preview-header">
              <h3>📈 Report Preview</h3>
              <div className="download-options">
                <button
                  className="btn btn-outline"
                  onClick={() => downloadReport('pdf')}
                >
                  <span className="icon">📄</span>
                  Download PDF
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => downloadReport('excel')}
                >
                  <span className="icon">📊</span>
                  Download Excel
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => downloadReport('csv')}
                >
                  <span className="icon">📋</span>
                  Download CSV
                </button>
              </div>
            </div>

            <div className="report-summary">
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-icon">👨‍🎓</div>
                  <div className="card-content">
                    <h4>Total Students</h4>
                    <p>{reportData.totalStudents || 0}</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">📝</div>
                  <div className="card-content">
                    <h4>Total Exams</h4>
                    <p>{reportData.totalExams || 0}</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <h4>Average Score</h4>
                    <p>{reportData.averageScore || 0}%</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">⚠️</div>
                  <div className="card-content">
                    <h4>Incidents</h4>
                    <p>{reportData.totalIncidents || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="report-charts">
              <div className="chart-section">
                <h4>Performance Trends</h4>
                <div className="chart-placeholder">
                  <p>📈 Chart visualization would appear here</p>
                  <p>Performance data over time</p>
                </div>
              </div>
            </div>

            <div className="report-data">
              <h4>Detailed Data</h4>
              {reportData.details && reportData.details.length > 0 ? (
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(reportData.details[0]).map(key => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.details.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reportData.details.length > 10 && (
                    <p className="table-note">
                      Showing first 10 rows. Download report for complete data.
                    </p>
                  )}
                </div>
              ) : (
                <p className="no-data">No detailed data available for this report.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
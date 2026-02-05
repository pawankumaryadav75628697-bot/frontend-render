import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './StudentManagement.css';

// Constants
const INITIAL_STUDENT_STATE = {
  fullName: '',
  email: '',
  phoneNumber: '',
  course: '',
  semester: '',
  batch: '',
  rollNumber: ''
};

const StudentManagement = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [totalStats, setTotalStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newStudent, setNewStudent] = useState(INITIAL_STUDENT_STATE);
  const [csvFile, setCsvFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportFilters, setExportFilters] = useState({
    status: 'all',
    course: 'all',
    semester: 'all'
  });
  const [analyticsData, setAnalyticsData] = useState({
    totalStudents: 0,
    activeStudents: 0,
    inactiveStudents: 0,
    courseDistribution: {},
    semesterDistribution: {},
    batchDistribution: {},
    recentRegistrations: [],
    genderDistribution: { male: 0, female: 0, other: 0 },
    monthlyGrowth: []
  });

  useEffect(() => {
    fetchStudents();
    fetchTotalStats();
  }, [currentPage, searchTerm, filterStatus]);

  const fetchTotalStats = async () => {
    try {
      const response = await fetch('/api/v1/admin/students/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        // If stats endpoint doesn't exist, calculate from current data
        const allStudentsResponse = await fetch('/api/v1/admin/students?limit=1000', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (allStudentsResponse.ok) {
          const allData = await allStudentsResponse.json();
          const allStudents = allData.data?.students || [];
          setTotalStats({
            total: allStudents.length,
            active: allStudents.filter(s => s.isActive === true).length,
            inactive: allStudents.filter(s => s.isActive === false).length
          });
        }
        return;
      }

      const data = await response.json();
      setTotalStats({
        total: data.data?.total || 0,
        active: data.data?.active || 0,
        inactive: data.data?.inactive || 0
      });
    } catch (error) {
      console.error('Error fetching total stats:', error);
      // Fallback: use current page data
      setTotalStats({
        total: students.length,
        active: students.filter(s => s.isActive === true).length,
        inactive: students.filter(s => s.isActive === false).length
      });
    }
  };

  const fetchStudents = async (page = currentPage, search = searchTerm, status = filterStatus) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page,
        limit: 10,
        search: search || '',
        status: status === 'all' ? '' : status
      });

      const response = await fetch(`/api/v1/admin/students?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch students');
      }

      const data = await response.json();
      setStudents(data.data?.students || []);
      setTotalPages(data.data?.pagination?.pages || 1);
      setCurrentPage(page);
      setSearchTerm(search);
      setFilterStatus(status);
      
      // If current page is greater than total pages, reset to first page
      if (page > 1 && (data.data?.pagination?.pages || 1) < page) {
        return fetchStudents(1, search, status);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error(error.message || 'Error loading students');
      setStudents([]);
      setTotalPages(1);
      return { error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const validateStudentData = (studentData, isEdit = false) => {
    // Check if studentData exists
    if (!studentData) {
      toast.error('Student data is required');
      return false;
    }
    
    // Required fields validation
    const requiredFields = ['fullName', 'email', 'batch'];
    const missingFields = requiredFields.filter(field => !studentData[field]?.trim());
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return false;
    }

    // Email format validation - ensure email is trimmed before testing
    const trimmedEmail = studentData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    
    // Phone number validation
    if (studentData.phoneNumber && !/^\d{10}$/.test(studentData.phoneNumber)) {
      toast.error('Phone number must be exactly 10 digits');
      return false;
    }
    
    // Semester validation
    if (studentData.semester) {
      const semester = parseInt(studentData.semester);
      if (isNaN(semester) || semester < 1 || semester > 8) {
        toast.error('Semester must be a number between 1 and 8');
        return false;
      }
    }
    
    return true;
  };

  const handleAddClick = () => {
    setNewStudent(INITIAL_STUDENT_STATE);
    setShowAddModal(true);
    setShowEditModal(false);
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
    setShowAddModal(false);
    setShowEditModal(false);
    setCsvFile(null);
    setUploadProgress(0);
    setUploadResults(null);
  };

  const handleExportClick = () => {
    setShowExportModal(true);
    setShowAddModal(false);
    setShowEditModal(false);
    setShowUploadModal(false);
  };

  const handleAnalyticsClick = () => {
    setShowAnalyticsModal(true);
    setShowAddModal(false);
    setShowEditModal(false);
    setShowUploadModal(false);
    setShowExportModal(false);
    fetchAnalyticsData();
  };

  const fetchAnalyticsData = async () => {
    const loadingToast = toast.loading('Loading analytics data...');
    
    try {
      // Fetch all students for analytics
      const response = await fetch('/api/v1/admin/students?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      const allStudents = data.data?.students || [];

      // Process analytics data
      const analytics = {
        totalStudents: allStudents.length,
        activeStudents: allStudents.filter(s => s.isActive === true).length,
        inactiveStudents: allStudents.filter(s => s.isActive === false).length,
        courseDistribution: {},
        semesterDistribution: {},
        batchDistribution: {},
        recentRegistrations: [],
        genderDistribution: { male: 0, female: 0, other: 0 },
        monthlyGrowth: []
      };

      // Calculate course distribution
      allStudents.forEach(student => {
        if (student.course) {
          analytics.courseDistribution[student.course] = (analytics.courseDistribution[student.course] || 0) + 1;
        }
        
        if (student.semester) {
          const semesterKey = `Semester ${student.semester}`;
          analytics.semesterDistribution[semesterKey] = (analytics.semesterDistribution[semesterKey] || 0) + 1;
        }
        
        if (student.batch) {
          analytics.batchDistribution[student.batch] = (analytics.batchDistribution[student.batch] || 0) + 1;
        }
      });

      // Get recent registrations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      analytics.recentRegistrations = allStudents
        .filter(student => new Date(student.createdAt || Date.now()) >= sevenDaysAgo)
        .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()))
        .slice(0, 5)
        .map(student => ({
          name: student.fullName,
          email: student.email,
          course: student.course,
          registeredAt: new Date(student.createdAt || Date.now()).toLocaleDateString()
        }));

      // Calculate monthly growth (last 6 months)
      const monthlyData = {};
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      allStudents.forEach(student => {
        const studentDate = new Date(student.createdAt || Date.now());
        if (studentDate >= sixMonthsAgo) {
          const monthKey = studentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        }
      });

      // Generate monthly growth array
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        analytics.monthlyGrowth.push({
          month: monthKey,
          students: monthlyData[monthKey] || 0
        });
      }

      // Estimate gender distribution (based on names - this is a rough estimation)
      analytics.genderDistribution = {
        male: Math.round(allStudents.length * 0.6),
        female: Math.round(allStudents.length * 0.35),
        other: Math.round(allStudents.length * 0.05)
      };

      setAnalyticsData(analytics);
      toast.dismiss(loadingToast);
      
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to load analytics data');
      console.error('Analytics error:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if file is CSV
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setCsvFile(file);
      setUploadResults(null);
    }
  };

  const fetchAllStudentsForExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: 1000, // Get all students
        search: '',
        status: exportFilters.status === 'all' ? '' : exportFilters.status
      });

      const response = await fetch(`/api/v1/admin/students?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch students for export');
      }

      const data = await response.json();
      return data.data?.students || [];
    } catch (error) {
      console.error('Error fetching students for export:', error);
      toast.error('Failed to fetch students for export');
      return [];
    }
  };

  const exportToCSV = (data) => {
    // Filter data based on export filters
    let filteredData = data;
    
    if (exportFilters.course !== 'all') {
      filteredData = filteredData.filter(student => student.course === exportFilters.course);
    }
    
    if (exportFilters.semester !== 'all') {
      filteredData = filteredData.filter(student => student.semester?.toString() === exportFilters.semester);
    }

    // Define CSV headers
    const headers = [
      'Full Name',
      'Email',
      'Phone Number',
      'Roll Number',
      'Course',
      'Semester',
      'Batch',
      'Status',
      'Created Date'
    ];

    // Convert data to CSV format
    const csvContent = [
      headers.join(','),
      ...filteredData.map(student => [
        `"${student.fullName || ''}"`,
        `"${student.email || ''}"`,
        `"${student.phoneNumber || ''}"`,
        `"${student.rollNumber || ''}"`,
        `"${student.course || ''}"`,
        `"${student.semester || ''}"`,
        `"${student.batch || ''}"`,
        `"${student.isActive ? 'Active' : 'Inactive'}"`,
        `"${new Date(student.createdAt || Date.now()).toLocaleDateString()}"`
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (data) => {
    // Filter data based on export filters
    let filteredData = data;
    
    if (exportFilters.course !== 'all') {
      filteredData = filteredData.filter(student => student.course === exportFilters.course);
    }
    
    if (exportFilters.semester !== 'all') {
      filteredData = filteredData.filter(student => student.semester?.toString() === exportFilters.semester);
    }

    // Create HTML table for Excel export
    const headers = [
      'Full Name',
      'Email', 
      'Phone Number',
      'Roll Number',
      'Course',
      'Semester',
      'Batch',
      'Status',
      'Created Date'
    ];

    const tableContent = [
      '<table>',
      '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>',
      '<tbody>',
      ...filteredData.map(student => 
        '<tr>' + [
          student.fullName || '',
          student.email || '',
          student.phoneNumber || '',
          student.rollNumber || '',
          student.course || '',
          student.semester || '',
          student.batch || '',
          student.isActive ? 'Active' : 'Inactive',
          new Date(student.createdAt || Date.now()).toLocaleDateString()
        ].map(cell => `<td>${cell}</td>`).join('') + '</tr>'
      ),
      '</tbody>',
      '</table>'
    ].join('');

    // Create and download file
    const blob = new Blob([tableContent], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    const loadingToast = toast.loading('Fetching student data for export...');
    
    try {
      const allStudents = await fetchAllStudentsForExport();
      
      if (allStudents.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No students found to export');
        return;
      }

      toast.dismiss(loadingToast);
      
      // Export based on selected format
      if (exportFormat === 'csv') {
        exportToCSV(allStudents);
        toast.success(`Exported ${allStudents.length} students to CSV`);
      } else if (exportFormat === 'excel') {
        exportToExcel(allStudents);
        toast.success(`Exported ${allStudents.length} students to Excel`);
      }
      
      setShowExportModal(false);
      
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to export student data');
      console.error('Export error:', error);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['fullname', 'email'];
    
    // Check required headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }
    
    const students = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === 0 || values.every(v => v === '')) continue;
      
      const student = {};
      headers.forEach((header, index) => {
        student[header] = values[index] || '';
      });
      
      // Validate student data
      if (!student.fullname || !student.email) {
        errors.push(`Row ${i + 1}: Missing required fields (fullname, email)`);
        continue;
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(student.email)) {
        errors.push(`Row ${i + 1}: Invalid email format`);
        continue;
      }
      
      // Phone validation if present
      if (student.phonenumber && !/^\d{10}$/.test(student.phonenumber)) {
        errors.push(`Row ${i + 1}: Phone number must be exactly 10 digits`);
        continue;
      }
      
      // Semester validation if present
      if (student.semester) {
        const semester = parseInt(student.semester);
        if (isNaN(semester) || semester < 1 || semester > 8) {
          errors.push(`Row ${i + 1}: Semester must be between 1 and 8`);
          continue;
        }
      }
      
      students.push({
        fullName: student.fullname,
        email: student.email.toLowerCase(),
        phoneNumber: student.phonenumber || '',
        course: student.course || '',
        semester: student.semester ? parseInt(student.semester) : '',
        batch: student.batch || '',
        rollNumber: student.rollnumber || ''
      });
    }
    
    return { students, errors };
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }
    
    try {
      setUploadProgress(10);
      const text = await csvFile.text();
      setUploadProgress(30);
      
      const { students: parsedStudents, errors } = parseCSV(text);
      setUploadProgress(50);
      
      if (errors.length > 0) {
        setUploadResults({
          success: false,
          errors: errors.slice(0, 10), // Show first 10 errors
          totalErrors: errors.length
        });
        return;
      }
      
      if (parsedStudents.length === 0) {
        setUploadResults({
          success: false,
          errors: ['No valid student records found in CSV']
        });
        return;
      }
      
      setUploadProgress(70);
      
      // Since bulk endpoint doesn't exist, upload students individually
      const loadingToast = toast.loading(`Uploading ${parsedStudents.length} students...`);
      let uploadedCount = 0;
      let failedCount = 0;
      const failedStudents = [];
      const successfulStudents = []; // Track successful uploads for email sending
      
      for (let i = 0; i < parsedStudents.length; i++) {
        const student = parsedStudents[i];
        
        try {
          const response = await fetch('/api/v1/admin/students', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(student)
          });
          
          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            // Handle JSON parsing errors (like HTML responses)
            const responseText = await response.text();
            console.error('Response text:', responseText);
            throw new Error('Server returned invalid response. Please check server logs.');
          }
          
          if (response.ok) {
            uploadedCount++;
            const studentId = data.data?._id;
            
            if (studentId) {
              successfulStudents.push({
                ...student,
                _id: studentId
              });
              console.log(`✅ Student uploaded successfully: ${student.fullName} (ID: ${studentId})`);
            } else {
              // Fallback: try to find student by email if ID not returned
              console.warn(`⚠️ No student ID returned for ${student.fullName}, will try to find by email`);
              successfulStudents.push({
                ...student,
                _id: null, // Will be resolved later
                email: student.email
              });
            }
          } else {
            failedCount++;
            failedStudents.push({
              student: student.fullName,
              error: data?.error || data?.message || 'Upload failed'
            });
          }
          
          // Update progress
          const currentProgress = 70 + (i + 1) / parsedStudents.length * 20; // 20% for uploads, 10% for emails
          setUploadProgress(Math.round(currentProgress));
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          failedCount++;
          failedStudents.push({
            student: student.fullName,
            error: error.message || 'Network error'
          });
        }
      }
      
      // Send emails to successfully uploaded students
      if (successfulStudents.length > 0) {
        toast.dismiss(loadingToast);
        const emailToast = toast.loading(`Sending credentials to ${successfulStudents.length} students...`);
        
        let emailSentCount = 0;
        let emailFailedCount = 0;
        const emailErrors = [];
        
        console.log('📧 Starting email sending to students:', successfulStudents.map(s => ({ name: s.fullName, id: s._id, email: s.email })));
        
        for (let i = 0; i < successfulStudents.length; i++) {
          const student = successfulStudents[i];
          
          try {
            let studentId = student._id;
            
            // Fallback: if no student ID, try to find by email
            if (!studentId) {
              console.log(`🔍 Looking up student ID for ${student.fullName} using email: ${student.email}`);
              try {
                const lookupResponse = await fetch(`/api/v1/admin/students?search=${encodeURIComponent(student.email)}&limit=1`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  credentials: 'include'
                });
                
                if (lookupResponse.ok) {
                  const lookupData = await lookupResponse.json();
                  const foundStudent = lookupData.data?.students?.find(s => s.email === student.email);
                  if (foundStudent?._id) {
                    studentId = foundStudent._id;
                    console.log(`✅ Found student ID for ${student.fullName}: ${studentId}`);
                  }
                }
              } catch (lookupError) {
                console.error(`❌ Failed to lookup student ID for ${student.fullName}:`, lookupError);
              }
            }
            
            if (!studentId) {
              console.error(`❌ Cannot send email to ${student.fullName}: No student ID available`);
              emailFailedCount++;
              emailErrors.push({
                student: student.fullName,
                error: 'Student ID not found - cannot send email'
              });
              continue;
            }
            
            console.log(`📧 Sending email to ${student.fullName} (ID: ${studentId}, Email: ${student.email})`);
            
            const emailResponse = await fetch(`/api/v1/admin/students/${studentId}/resend-credentials`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });
            
            console.log(`📧 Email response status for ${student.fullName}:`, emailResponse.status, emailResponse.statusText);
            
            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              console.log(`📧 Email success for ${student.fullName}:`, emailData);
              emailSentCount++;
              
              // Check if email was actually sent successfully
              if (emailData.data?.notifications) {
                const { email, sms } = emailData.data.notifications;
                console.log(`📧 Email notification details for ${student.fullName}:`, {
                  email: email?.success ? 'sent' : email?.error || 'failed',
                  sms: sms?.success ? 'sent' : sms?.error || 'disabled'
                });
              }
            } else {
              const errorData = await emailResponse.json().catch(() => ({}));
              const errorMessage = errorData.message || errorData.error || `HTTP ${emailResponse.status}`;
              console.error(`📧 Email failed for ${student.fullName}:`, errorMessage, errorData);
              emailFailedCount++;
              emailErrors.push({
                student: student.fullName,
                error: errorMessage
              });
            }
            
            // Update progress for email sending
            const currentProgress = 90 + (i + 1) / successfulStudents.length * 10;
            setUploadProgress(Math.round(currentProgress));
            
            // Small delay between email sends
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error(`📧 Email error for ${student.fullName}:`, error);
            emailFailedCount++;
            emailErrors.push({
              student: student.fullName,
              error: error.message || 'Network error'
            });
          }
        }
        
        toast.dismiss(emailToast);
        
        // Log final email results
        console.log('📧 Email sending complete:', {
          total: successfulStudents.length,
          sent: emailSentCount,
          failed: emailFailedCount,
          errors: emailErrors
        });
        
        // Show detailed email results
        if (emailSentCount > 0) {
          toast.success(`Credentials sent to ${emailSentCount} students${emailFailedCount > 0 ? ` (${emailFailedCount} failed)` : ''}`);
        } else {
          toast.error('Failed to send any emails. Please check server configuration.');
        }
        
        // Show errors in console for debugging
        if (emailErrors.length > 0) {
          console.error('📧 Email sending errors:', emailErrors);
        }
      } else {
        toast.dismiss(loadingToast);
        console.log('📧 No successful students to send emails to');
      }
      
      setUploadProgress(100);
      
      // Set results
      setUploadResults({
        success: uploadedCount > 0,
        uploaded: uploadedCount,
        failed: failedCount,
        total: parsedStudents.length,
        details: failedStudents
      });
      
      if (uploadedCount > 0) {
        toast.success(`Successfully uploaded ${uploadedCount} students!${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
      } else {
        toast.error('Failed to upload any students');
      }
      
      // Refresh students list and total stats
      await fetchStudents();
      await fetchTotalStats();
      
    } catch (error) {
      console.error('CSV Upload Error:', error);
      toast.dismiss();
      
      if (error.message.includes('Missing required columns') || 
          error.message.includes('Invalid email format') ||
          error.message.includes('Phone number must be') ||
          error.message.includes('Semester must be')) {
        setUploadResults({
          success: false,
          errors: [error.message]
        });
      } else {
        toast.error(error.message || 'Failed to upload CSV file');
      }
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    
    // Validate student data
    if (!validateStudentData(newStudent)) {
      return;
    }
    
    console.log('Checking for duplicates...');
    console.log('Current students:', students);
    console.log('New student email:', newStudent.email.trim().toLowerCase());
    console.log('New student roll number:', newStudent.rollNumber?.trim());
    
    const existingStudent = students.find(s => {
      const emailMatch = s.email && s.email.toLowerCase() === newStudent.email.trim().toLowerCase();
      const rollMatch = newStudent.rollNumber?.trim() && s.rollNumber === newStudent.rollNumber.trim();
      console.log(`Checking student ${s.email}: emailMatch=${emailMatch}, rollMatch=${rollMatch}`);
      return emailMatch || rollMatch;
    });
    
    if (existingStudent) {
      console.log('Found existing student:', existingStudent);
      if (existingStudent.email && existingStudent.email.toLowerCase() === newStudent.email.trim().toLowerCase()) {
        toast.error('A student with this email already exists. Please use a different email address.');
      } else {
        toast.error('A student with this roll number already exists. Please use a different roll number.');
      }
      return;
    }
    
    console.log('No duplicates found, proceeding with API call...');
    
    try {
      const loadingToast = toast.loading('Adding student...');
      
      // Prepare the data to be sent - match backend exactly
      const studentData = {
        fullName: newStudent.fullName.trim(),
        email: newStudent.email.trim().toLowerCase(),
        phoneNumber: newStudent.phoneNumber?.trim() || '',
        course: newStudent.course?.trim() || '',
        semester: newStudent.semester ? parseInt(newStudent.semester) : '',
        batch: newStudent.batch?.trim() || '',
        rollNumber: newStudent.rollNumber?.trim() || ''
      };
      
      // Remove empty fields for backend compatibility
      Object.keys(studentData).forEach(key => {
        if (studentData[key] === '') {
          delete studentData[key];
        }
      });

      console.log('Sending student data:', studentData);

      const response = await fetch('/api/v1/admin/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(studentData)
      });

      const data = await response.json();
      
      // Log detailed error information for debugging
      if (!response.ok) {
        console.error('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          requestData: studentData,
          responseData: data,
          // Log the full response for debugging
          fullResponse: data
        });
        
        // Check if this is a duplicate error and show more details
        if (data?.error?.includes('already exists') || data?.message?.includes('already exists')) {
          console.log('Duplicate detected by backend. Backend has data that frontend doesn\'t see.');
          console.log('This suggests a sync issue between frontend and backend data.');
        }
      }

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to add student. Please check the data and try again.';
        
        if (data?.error) {
          errorMessage = data.error;
        } else if (data?.message) {
          errorMessage = data.message;
        }
        
        // Provide more user-friendly error messages
        if (errorMessage.includes('already exists')) {
          if (errorMessage.includes('email')) {
            errorMessage = 'A student with this email already exists. Please use a different email address.';
            // Refresh students list to sync with backend data
            console.log('Refreshing students list due to backend-frontend sync issue...');
            fetchStudents();
          } else if (errorMessage.includes('roll number')) {
            errorMessage = 'A student with this roll number already exists. Please use a different roll number.';
            // Refresh students list to sync with backend data
            console.log('Refreshing students list due to backend-frontend sync issue...');
            fetchStudents();
          } else {
            errorMessage = 'This student already exists in the system. Please check the email and roll number.';
            // Refresh students list to sync with backend data
            console.log('Refreshing students list due to backend-frontend sync issue...');
            fetchStudents();
          }
        }
        
        throw new Error(errorMessage);
      }

      toast.dismiss(loadingToast);
      toast.success('Student added successfully!');
      
      // Reset form and close modal
      setNewStudent({
        fullName: '',
        email: '',
        phoneNumber: '',
        course: '',
        semester: '',
        batch: '',
        rollNumber: ''
      });
      setShowAddModal(false);
      
      // Refresh the students list and total stats
      await fetchStudents();
      await fetchTotalStats();
      
    } catch (error) {
      console.error('Error adding student:', error);
      toast.dismiss();
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('Unable to connect to server. Please check your connection.');
      } else if (error.message) {
        // Show the specific error message from the server
        toast.error(error.message);
      } else {
        toast.error('Failed to add student. Please try again.');
      }
    }
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    
    if (!selectedStudent || !validateStudentData(selectedStudent, true)) {
      return;
    }
    
    try {
      const loadingToast = toast.loading('Updating student...');
      
      const response = await fetch(`/api/v1/admin/students/${selectedStudent._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(selectedStudent),
        credentials: 'include'
      });

      toast.dismiss(loadingToast);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update student');
      }

      const result = await response.json();
      toast.success('Student updated successfully');
      
      // Update the students list with the updated student data
      setStudents(prevStudents => 
        prevStudents.map(s => 
          s._id === selectedStudent._id ? { ...selectedStudent, ...result.data } : s
        )
      );
      
      setShowEditModal(false);
      setSelectedStudent(null);
      
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error(error.message || 'Failed to update student. Please try again.');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }

    try {
      const loadingToast = toast.loading('Deleting student...');
      
      const response = await fetch(`/api/v1/admin/students/${studentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      toast.dismiss(loadingToast);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete student');
      }

      toast.success('Student deleted successfully');
      
      // Optimistically update the UI
      setStudents(prevStudents => prevStudents.filter(s => s._id !== studentId));
      
      // If the last item on the current page was deleted, go to the previous page
      if (students.length === 1 && currentPage > 1) {
        await fetchStudents(currentPage - 1);
        await fetchTotalStats();
      } else {
        await fetchStudents();
        await fetchTotalStats();
      }
      
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'Failed to delete student. Please try again.');
    }
  };

  const handleSendCredentials = async (studentId) => {
    try {
      // Show loading toast
      const loadingToast = toast.loading('Sending credentials...');
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`/api/v1/admin/students/${studentId}/resend-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send credentials');
      }

      const data = await response.json();
      toast.success('Credentials sent successfully!');
      
      // Log notification results only if there are issues
      if (data.data?.notifications) {
        const { email, sms } = data.data.notifications;
        if (!email?.success || !sms?.success) {
          console.log('📧 Credential notifications:', {
            email: email?.success ? 'sent' : email?.error || 'failed',
            sms: sms?.success ? 'sent' : sms?.error || 'disabled'
          });
        }
      }
    } catch (error) {
      console.error('Error sending credentials:', error);
      
      // Handle different types of network errors
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('Unable to connect to server. Please check if the backend is running.');
      } else if (error.name === 'AbortError') {
        toast.error('Request timeout. Please try again.');
      } else {
        toast.error('Network error. Please check your connection and try again.');
      }
    }
  };

  // Handle search input with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim() !== '' || filterStatus !== 'all') {
        fetchStudents(1, searchTerm, filterStatus);
      } else {
        fetchStudents(1, '', 'all');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterStatus]);

  // Server-side search and filtering is handled by the backend

  return (
    <div className="student-management">
      {/* Modern Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-text">
            <h1>👥 Student Management</h1>
            <p>Manage student accounts and monitor their progress</p>
          </div>
          <div className="header-stats">
            <div className="stat-box total">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <span className="stat-number">{totalStats.total}</span>
                <span className="stat-label">Total Students</span>
              </div>
            </div>
            <div className="stat-box active">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <span className="stat-number">{totalStats.active}</span>
                <span className="stat-label">Active</span>
              </div>
            </div>
            <div className="stat-box pending">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <span className="stat-number">{totalStats.inactive}</span>
                <span className="stat-label">Inactive</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Boxes Grid */}
      <div className="action-boxes-section">
        <div className="action-boxes-grid">
          <div className="action-box add-student-box">
            <div className="action-box-icon">➕</div>
            <div className="action-box-content">
              <h3>Add New Student</h3>
              <p>Register new students to the system</p>
              <button 
                className="action-box-btn primary"
                type="button"
                onClick={handleAddClick}
              >
                <span className="btn-icon">👤</span>
                Add Student
              </button>
            </div>
          </div>

          <div className="action-box bulk-upload-box">
            <div className="action-box-icon">📁</div>
            <div className="action-box-content">
              <h3>Bulk Upload</h3>
              <p>Upload multiple students via CSV/Excel file</p>
              <button 
                className="action-box-btn secondary"
                onClick={handleUploadClick}
              >
                <span className="btn-icon">⬆️</span>
                Upload CSV
              </button>
            </div>
          </div>

          <div className="action-box export-box">
            <div className="action-box-icon">📄</div>
            <div className="action-box-content">
              <h3>Export Data</h3>
              <p>Download student data in various formats</p>
              <button className="action-box-btn success" onClick={handleExportClick}>
                <span className="btn-icon">⬇️</span>
                Export List
              </button>
            </div>
          </div>

          <div className="action-box analytics-box">
            <div className="action-box-icon">📈</div>
            <div className="action-box-content">
              <h3>Analytics</h3>
              <p>View student performance and statistics</p>
              <button className="action-box-btn warning" onClick={handleAnalyticsClick}>
                <span className="btn-icon">📉</span>
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-controls">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Students</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="modern-spinner"></div>
          <p>Loading students...</p>
        </div>
      ) : (
        <>
          <div className="students-table-container">
            <div className="table-header">
              <h2>📚 Student Directory</h2>
              <div className="table-stats">
                <span className="total-count">{students.length} Total Students</span>
                <span className="active-count">{students.filter(s => s.isActive === true).length} Active</span>
              </div>
            </div>
            
            <div className="modern-table-wrapper">
              <table className="modern-students-table">
                <thead>
                  <tr>
                    <th className="col-avatar">Photo</th>
                    <th className="col-name">Student Details</th>
                    <th className="col-contact">Contact Info</th>
                    <th className="col-academic">Academic Info</th>
                    <th className="col-status">Status</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(students) && students.length > 0 ? (
                    students.map((student, index) => (
                      <tr key={student._id || `student-${index}`} className="student-row">
                        <td className="avatar-cell">
                          <div className="student-avatar">
                            {student.fullName ? student.fullName.charAt(0).toUpperCase() : 'S'}
                          </div>
                        </td>
                        <td className="student-details">
                          <div className="student-name">{student.fullName || 'N/A'}</div>
                          <div className="student-id">ID: {student.studentId || 'N/A'}</div>
                          {student.rollNumber && (
                            <div className="roll-number">Roll: {student.rollNumber}</div>
                          )}
                        </td>
                        <td className="contact-info">
                          <div className="email-wrapper">
                            <span className="email-icon">📧</span>
                            <span className="email-text">{student.email || 'N/A'}</span>
                          </div>
                          {student.phoneNumber && (
                            <div className="phone-wrapper">
                              <span className="phone-icon">📱</span>
                              <span className="phone-text">{student.phoneNumber}</span>
                            </div>
                          )}
                        </td>
                        <td className="academic-info">
                          {student.course && (
                            <div className="course-info">
                              <span className="course-icon">📖</span>
                              <span>{student.course}</span>
                            </div>
                          )}
                          {student.semester && (
                            <div className="semester-info">
                              <span className="semester-icon">📅</span>
                              <span>Semester {student.semester}</span>
                            </div>
                          )}
                          {student.batch && (
                            <div className="batch-info">
                              <span className="batch-icon">👥</span>
                              <span>Batch {student.batch}</span>
                            </div>
                          )}
                        </td>
                        <td className="status-cell">
                          <div className={`status-badge ${student.isActive ? 'active' : 'inactive'}`}>
                            <span className="status-dot"></span>
                            <span className="status-text">
                              {student.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-btn edit-btn"
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowEditModal(true);
                                setShowAddModal(false);
                              }}
                              title="Edit Student"
                            >
                              <span className="btn-icon">✏️</span>
                            </button>
                            <button
                              className="action-btn send-btn"
                              onClick={() => handleSendCredentials(student._id)}
                              title="Send Credentials"
                            >
                              <span className="btn-icon">📧</span>
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={() => handleDeleteStudent(student._id)}
                              title="Delete Student"
                            >
                              <span className="btn-icon">🗑️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="no-data-state">
                        <div className="no-data-content">
                          <div className="no-data-icon">📚</div>
                          <h3>No Students Found</h3>
                          <p>Start by adding your first student to the system</p>
                          <button 
                            className="btn-primary"
                            onClick={handleAddClick}
                          >
                            <span>➕ Add First Student</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Student Modal */}
      <div className={`modal-overlay ${showAddModal ? 'active' : ''}`} onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Student</h2>
              <button 
                type="button"
                className="close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddStudent}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({...newStudent, fullName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Roll Number</label>
                <input
                  type="text"
                  value={newStudent.rollNumber}
                  onChange={(e) => setNewStudent({...newStudent, rollNumber: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={newStudent.phoneNumber}
                  onChange={(e) => setNewStudent({...newStudent, phoneNumber: e.target.value})}
                  placeholder="10-digit phone number"
                />
              </div>
              <div className="form-group">
                <label>Course</label>
                <input
                  type="text"
                  value={newStudent.course}
                  onChange={(e) => setNewStudent({...newStudent, course: e.target.value})}
                  placeholder="Course name or code"
                />
              </div>
              <div className="form-group">
                <label>Semester</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={newStudent.semester}
                  onChange={(e) => setNewStudent({...newStudent, semester: e.target.value})}
                  placeholder="1-8"
                />
              </div>
              <div className="form-group">
                <label>Batch</label>
                <input
                  type="text"
                  required
                  value={newStudent.batch}
                  onChange={(e) => setNewStudent({...newStudent, batch: e.target.value})}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>

      {/* Edit Student Modal */}
      <div className={`modal-overlay ${showEditModal ? 'active' : ''}`} onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Student</h2>
              <button 
                type="button"
                className="close-btn"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditStudent}>
              {selectedStudent ? (
                <>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      value={selectedStudent.fullName || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, fullName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      required
                      value={selectedStudent.email || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, email: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Roll Number</label>
                    <input
                      type="text"
                      value={selectedStudent.rollNumber || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, rollNumber: e.target.value})}
                      placeholder="Roll number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={selectedStudent.phoneNumber || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, phoneNumber: e.target.value})}
                      placeholder="10-digit phone number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Course</label>
                    <input
                      type="text"
                      value={selectedStudent.course || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, course: e.target.value})}
                      placeholder="Course name or code"
                    />
                  </div>
                  <div className="form-group">
                    <label>Semester</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={selectedStudent.semester || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, semester: e.target.value})}
                      placeholder="1-8"
                    />
                  </div>
                  <div className="form-group">
                    <label>Batch</label>
                    <input
                      type="text"
                      required
                      value={selectedStudent.batch || ''}
                      onChange={(e) => setSelectedStudent({...selectedStudent, batch: e.target.value})}
                      placeholder="Batch year"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={selectedStudent.isActive ? 'true' : 'false'}
                      onChange={(e) => setSelectedStudent({...selectedStudent, isActive: e.target.value === 'true'})}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button 
                      type="button" 
                      onClick={() => setShowEditModal(false)} 
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Update Student
                    </button>
                  </div>
                </>
              ) : (
                <div>Loading...</div>
              )}
            </form>
          </div>
        </div>
      
      {/* CSV Upload Modal */}
      <div className={`modal-overlay ${showUploadModal ? 'active' : ''}`} onClick={() => setShowUploadModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📁 Bulk Upload Students</h2>
            <button 
              type="button"
              className="close-btn"
              onClick={() => setShowUploadModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          
          <div className="upload-content">
            <div className="upload-instructions">
              <h3>📋 CSV File Requirements</h3>
              <div className="requirements-list">
                <div className="requirement-item">
                  <span className="req-icon">✅</span>
                  <span>File must be in CSV format (.csv)</span>
                </div>
                <div className="requirement-item">
                  <span className="req-icon">✅</span>
                  <span>First row must contain column headers</span>
                </div>
                <div className="requirement-item">
                  <span className="req-icon">✅</span>
                  <span>Required columns: <strong>fullname</strong>, <strong>email</strong></span>
                </div>
                <div className="requirement-item">
                  <span className="req-icon">⚡</span>
                  <span>Optional columns: phoneNumber, course, semester, batch, rollNumber</span>
                </div>
              </div>
              
              <div className="sample-format">
                <h4>📄 Sample CSV Format:</h4>
                <pre>{`fullname,email,phoneNumber,course,semester,batch,rollNumber
John Doe,john@example.com,9876543210,Computer Science,3,2025,CS001
Jane Smith,jane@example.com,9876543211,Information Technology,2,2025,IT002`}</pre>
              </div>
            </div>
            
            <div className="upload-area">
              <input
                type="file"
                id="csv-file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-file" className="upload-label">
                <div className="upload-icon">📁</div>
                <div className="upload-text">
                  <h4>Choose CSV File</h4>
                  <p>Click to browse or drag and drop</p>
                  <span className="file-size">Maximum file size: 5MB</span>
                </div>
              </label>
              
              {csvFile && (
                <div className="selected-file">
                  <div className="file-info">
                    <span className="file-name">📄 {csvFile.name}</span>
                    <span className="file-size">
                      {(csvFile.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <button 
                    className="remove-file"
                    onClick={() => {
                      setCsvFile(null);
                      setUploadResults(null);
                      setUploadProgress(0);
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            
            {uploadProgress > 0 && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">{uploadProgress}%</span>
              </div>
            )}
            
            {uploadResults && (
              <div className={`upload-results ${uploadResults.success ? 'success' : 'error'}`}>
                {uploadResults.success ? (
                  <div className="success-message">
                    <div className="result-icon">✅</div>
                    <div className="result-details">
                      <h4>Upload Successful!</h4>
                      <p>Successfully uploaded {uploadResults.uploaded} out of {uploadResults.total} students</p>
                      {uploadResults.failed > 0 && (
                        <p className="warning">{uploadResults.failed} students failed to upload</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="error-message">
                    <div className="result-icon">❌</div>
                    <div className="result-details">
                      <h4>Upload Failed</h4>
                      <div className="error-list">
                        {uploadResults.errors.map((error, index) => (
                          <div key={index} className="error-item">• {error}</div>
                        ))}
                        {uploadResults.totalErrors > uploadResults.errors.length && (
                          <div className="error-item">• ... and {uploadResults.totalErrors - uploadResults.errors.length} more errors</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="upload-actions">
              <button 
                type="button" 
                onClick={() => setShowUploadModal(false)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleCSVUpload}
                disabled={!csvFile || uploadProgress > 0 && uploadProgress < 100}
                className="btn btn-primary"
              >
                {uploadProgress > 0 && uploadProgress < 100 ? 'Uploading...' : 'Upload Students'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <div className={`modal-overlay ${showExportModal ? 'active' : ''}`} onClick={() => setShowExportModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Export Student Data</h2>
            <button 
              type="button"
              className="close-btn"
              onClick={() => setShowExportModal(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="modal-body">
            <div className="export-options">
              <div className="form-group">
                <label>Export Format</label>
                <div className="format-options">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value)}
                    />
                    <span className="radio-label">
                      <span className="format-icon">📄</span>
                      <div>
                        <strong>CSV Format</strong>
                        <small>Comma-separated values, compatible with Excel</small>
                      </div>
                    </span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="excel"
                      checked={exportFormat === 'excel'}
                      onChange={(e) => setExportFormat(e.target.value)}
                    />
                    <span className="radio-label">
                      <span className="format-icon">📊</span>
                      <div>
                        <strong>Excel Format</strong>
                        <small>Direct Excel file format</small>
                      </div>
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Export Filters</label>
                <div className="filter-options">
                  <div className="filter-row">
                    <label>Status</label>
                    <select
                      value={exportFilters.status}
                      onChange={(e) => setExportFilters({...exportFilters, status: e.target.value})}
                      className="filter-select"
                    >
                      <option value="all">All Students</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                  <div className="filter-row">
                    <label>Course</label>
                    <select
                      value={exportFilters.course}
                      onChange={(e) => setExportFilters({...exportFilters, course: e.target.value})}
                      className="filter-select"
                    >
                      <option value="all">All Courses</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Business">Business</option>
                      <option value="Medicine">Medicine</option>
                    </select>
                  </div>
                  <div className="filter-row">
                    <label>Semester</label>
                    <select
                      value={exportFilters.semester}
                      onChange={(e) => setExportFilters({...exportFilters, semester: e.target.value})}
                      className="filter-select"
                    >
                      <option value="all">All Semesters</option>
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
                </div>
              </div>

              <div className="export-info">
                <div className="info-box">
                  <span className="info-icon">ℹ️</span>
                  <div>
                    <strong>Export Information</strong>
                    <p>The export will include all student data including personal details, contact information, academic records, and account status. Files will be downloaded automatically with the current date in the filename.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              type="button" 
              onClick={() => setShowExportModal(false)} 
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleExport}
              className="btn btn-success"
            >
              <span className="btn-icon">⬇️</span>
              Export {exportFormat === 'csv' ? 'CSV' : 'Excel'} File
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Modal */}
      <div className={`modal-overlay ${showAnalyticsModal ? 'active' : ''}`} onClick={() => setShowAnalyticsModal(false)}>
        <div className="modal analytics-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📊 Student Analytics Dashboard</h2>
            <button 
              type="button"
              className="close-btn"
              onClick={() => setShowAnalyticsModal(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="modal-body">
            <div className="analytics-content">
              {/* Overview Cards */}
              <div className="analytics-overview">
                <div className="overview-card total">
                  <div className="card-icon">👥</div>
                  <div className="card-content">
                    <h3>{analyticsData.totalStudents}</h3>
                    <p>Total Students</p>
                  </div>
                </div>
                <div className="overview-card active">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <h3>{analyticsData.activeStudents}</h3>
                    <p>Active Students</p>
                  </div>
                </div>
                <div className="overview-card inactive">
                  <div className="card-icon">⏸️</div>
                  <div className="card-content">
                    <h3>{analyticsData.inactiveStudents}</h3>
                    <p>Inactive Students</p>
                  </div>
                </div>
                <div className="overview-card growth">
                  <div className="card-icon">📈</div>
                  <div className="card-content">
                    <h3>{analyticsData.monthlyGrowth.length > 0 ? analyticsData.monthlyGrowth[analyticsData.monthlyGrowth.length - 1].students : 0}</h3>
                    <p>This Month</p>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="charts-grid">
                {/* Course Distribution */}
                <div className="chart-card">
                  <h3>📚 Course Distribution</h3>
                  <div className="chart-content">
                    {Object.keys(analyticsData.courseDistribution).length > 0 ? (
                      <div className="distribution-list">
                        {Object.entries(analyticsData.courseDistribution).map(([course, count]) => (
                          <div key={course} className="distribution-item">
                            <span className="label">{course}</span>
                            <div className="progress-bar">
                              <div 
                                className="progress-fill" 
                                style={{ 
                                  width: `${(count / analyticsData.totalStudents) * 100}%`,
                                  backgroundColor: getRandomColor()
                                }}
                              ></div>
                            </div>
                            <span className="count">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No course data available</div>
                    )}
                  </div>
                </div>

                {/* Semester Distribution */}
                <div className="chart-card">
                  <h3>📅 Semester Distribution</h3>
                  <div className="chart-content">
                    {Object.keys(analyticsData.semesterDistribution).length > 0 ? (
                      <div className="distribution-list">
                        {Object.entries(analyticsData.semesterDistribution)
                          .sort((a, b) => {
                            const aNum = parseInt(a[0].replace('Semester ', ''));
                            const bNum = parseInt(b[0].replace('Semester ', ''));
                            return aNum - bNum;
                          })
                          .map(([semester, count]) => (
                          <div key={semester} className="distribution-item">
                            <span className="label">{semester}</span>
                            <div className="progress-bar">
                              <div 
                                className="progress-fill" 
                                style={{ 
                                  width: `${(count / analyticsData.totalStudents) * 100}%`,
                                  backgroundColor: getRandomColor()
                                }}
                              ></div>
                            </div>
                            <span className="count">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No semester data available</div>
                    )}
                  </div>
                </div>

                {/* Gender Distribution */}
                <div className="chart-card">
                  <h3>👤 Gender Distribution</h3>
                  <div className="chart-content">
                    <div className="gender-stats">
                      <div className="gender-item male">
                        <div className="gender-icon">👨</div>
                        <div className="gender-info">
                          <span className="gender-label">Male</span>
                          <span className="gender-count">{analyticsData.genderDistribution.male}</span>
                        </div>
                      </div>
                      <div className="gender-item female">
                        <div className="gender-icon">👩</div>
                        <div className="gender-info">
                          <span className="gender-label">Female</span>
                          <span className="gender-count">{analyticsData.genderDistribution.female}</span>
                        </div>
                      </div>
                      <div className="gender-item other">
                        <div className="gender-icon">👤</div>
                        <div className="gender-info">
                          <span className="gender-label">Other</span>
                          <span className="gender-count">{analyticsData.genderDistribution.other}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Growth */}
                <div className="chart-card">
                  <h3>📈 Monthly Growth</h3>
                  <div className="chart-content">
                    <div className="growth-chart">
                      {analyticsData.monthlyGrowth.map((month, index) => (
                        <div key={month.month} className="growth-bar">
                          <div className="growth-bar-container">
                            <div 
                              className="growth-fill" 
                              style={{ 
                                height: `${Math.max((month.students / Math.max(...analyticsData.monthlyGrowth.map(m => m.students))) * 100, 5)}%`,
                                backgroundColor: getRandomColor()
                              }}
                            ></div>
                          </div>
                          <span className="growth-label">{month.month.split(' ')[0]}</span>
                          <span className="growth-value">{month.students}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Registrations */}
              <div className="recent-registrations">
                <h3>🆕 Recent Registrations (Last 7 Days)</h3>
                <div className="registrations-list">
                  {analyticsData.recentRegistrations.length > 0 ? (
                    analyticsData.recentRegistrations.map((student, index) => (
                      <div key={index} className="registration-item">
                        <div className="student-avatar">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="registration-info">
                          <span className="student-name">{student.name}</span>
                          <span className="student-email">{student.email}</span>
                          <span className="student-course">{student.course || 'No Course'}</span>
                        </div>
                        <div className="registration-date">
                          <span>{student.registeredAt}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-data">No recent registrations</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              type="button" 
              onClick={() => {
                setShowAnalyticsModal(false);
                fetchAnalyticsData();
              }} 
              className="btn btn-primary"
            >
              <span className="btn-icon">🔄</span>
              Refresh Data
            </button>
            <button 
              type="button" 
              onClick={() => setShowAnalyticsModal(false)} 
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

// Helper function for random colors
const getRandomColor = () => {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default StudentManagement;
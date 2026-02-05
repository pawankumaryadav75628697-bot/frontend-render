import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home/Home';
import EnhancedAdminDashboard from './pages/Admin/Dashboard/EnhancedAdminDashboard';
import AdminProfile from './pages/Admin/Profile/AdminProfile';
import CreateExam from './pages/Admin/Exams/CreateExam';
import ExamList from './pages/Admin/Exams/ExamList';
import ExamAccess from './pages/Student/ExamAccess/ExamAccess';
import ExamResultsCheck from './pages/Student/ExamResults/ExamResultsCheck';
import ExamInterface from './pages/Student/ExamInterface/ExamInterface';
import StudentDashboard from './pages/Student/Dashboard/StudentDashboard';
import AvailableExams from './pages/Student/Exams/AvailableExams';
import StudentProfile from './pages/Student/Profile/StudentProfile';
import LiveMonitoring from './pages/Admin/Monitoring/LiveMonitoring';
import LiveMonitoringList from './pages/Admin/Monitoring/LiveMonitoringList';
import StudentManagement from './pages/Admin/Students/StudentManagement';
import BulkUpload from './pages/Admin/Students/BulkUpload';
import Reports from './pages/Admin/Reports/Reports';
import Settings from './pages/Admin/Settings/Settings';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import CodingQuestions from './pages/Admin/CodingQuestions/CodingQuestions';
import CodingExamPublish from './components/CodingExamPublish/CodingExamPublish';
import StudentCodingExam from './components/StudentCodingExam/StudentCodingExam';
import CodeCompiler from './components/CodeCompiler/CodeCompiler';
import AdminTest from './components/AdminTest/AdminTest';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<><Navbar /><Home /></>} />
            <Route path="/exam" element={<ExamAccess />} />
            <Route path="/results" element={<ExamResultsCheck />} />
            <Route path="/exam-interface/:attemptId" element={<ExamInterface />} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute requiredRole="admin">
                <Routes>
                  <Route path="dashboard" element={<EnhancedAdminDashboard />} />
                  <Route path="profile" element={<AdminProfile />} />
                  <Route path="exams" element={<ExamList />} />
                  <Route path="exams/create" element={<CreateExam />} />
                  <Route path="students" element={<StudentManagement />} />
                  <Route path="students/bulk-upload" element={<BulkUpload />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="monitoring" element={<LiveMonitoringList />} />
                  <Route path="monitoring/:examId" element={<LiveMonitoring />} />
                  <Route path="coding-questions" element={<CodingQuestions />} />
                  <Route path="coding-exam-publish/:questionId" element={<CodingExamPublish />} />
                  <Route path="test" element={<AdminTest />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </ProtectedRoute>
            } />
            
            {/* Protected Student Routes */}
            <Route path="/student/*" element={
              <ProtectedRoute requiredRole="student">
                <Routes>
                  <Route path="dashboard" element={<StudentDashboard />} />
                  <Route path="profile" element={<StudentProfile />} />
                  <Route path="exams" element={<AvailableExams />} />
                  <Route path="exam/:attemptId" element={<ExamInterface />} />
                  <Route path="coding-exam/:attemptId" element={<StudentCodingExam />} />
                  <Route path="code-compiler" element={<CodeCompiler />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </ProtectedRoute>
            } />
            
            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

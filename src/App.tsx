import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Certificates from "./pages/Certificates";
import VerifyCertificate from "./pages/VerifyCertificate";
import Jobs from "./pages/Jobs";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminJobs from "./pages/admin/Jobs";
import AdminRoles from "./pages/admin/Roles";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminEnrollments from "./pages/admin/Enrollments";
import AdminReports from "./pages/admin/Reports";
import TrainerCourses from "./pages/trainer/Courses";
import TrainerLearners from "./pages/trainer/Learners";
import ValidatorDashboard from "./pages/validator/Dashboard";
import ValidatorSubmissions from "./pages/validator/Submissions";
import SubmissionReview from "./pages/validator/SubmissionReview";
import ProgressDashboard from "./pages/ProgressDashboard";
import EmployerJobs from "./pages/employer/Jobs";
import EmployerCandidates from "./pages/employer/Candidates";
import NotFound from "./pages/NotFound";
import { initializeMockData } from "@/services/mockData";

// Create QueryClient with better configuration for hot reload and error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: 1,
    },
  },
});

// Initialize mock data on app start
initializeMockData();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/courses" element={<Courses />} />
            <Route
              path="/courses/:id"
              element={
                <ProtectedRoute>
                  <CourseDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
            <Route
              path="/certificates"
              element={
                <ProtectedRoute>
                  <Certificates />
                </ProtectedRoute>
              }
            />
            <Route path="/jobs" element={<Jobs />} />
            
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminCourses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/jobs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminRoles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/enrollments"
              element={
                <ProtectedRoute allowedRoles={["admin", "trainer", "spd"]}>
                  <AdminEnrollments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            
            {/* Trainer/SPD Routes */}
            <Route
              path="/trainer/courses"
              element={
                <ProtectedRoute allowedRoles={["trainer", "spd"]}>
                  <TrainerCourses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/learners"
              element={
                <ProtectedRoute allowedRoles={["trainer", "spd"]}>
                  <TrainerLearners />
                </ProtectedRoute>
              }
            />
            
            {/* Validator Routes */}
            <Route
              path="/validator/dashboard"
              element={
                <ProtectedRoute allowedRoles={["validator", "admin"]}>
                  <ValidatorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/validator/submissions"
              element={
                <ProtectedRoute allowedRoles={["validator", "admin"]}>
                  <ValidatorSubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/validator/submissions/:id"
              element={
                <ProtectedRoute allowedRoles={["validator", "admin"]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <ProgressDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Employer Routes */}
            <Route
              path="/employer/jobs"
              element={
                <ProtectedRoute allowedRoles={["employer"]}>
                  <EmployerJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employer/candidates"
              element={
                <ProtectedRoute allowedRoles={["employer"]}>
                  <EmployerCandidates />
                </ProtectedRoute>
              }
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

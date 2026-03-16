import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ThemePreferenceProvider } from "@/contexts/ThemePreferenceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Certificates from "./pages/Certificates";
import CertificateView from "./pages/CertificateView";
import VerifyCertificate from "./pages/VerifyCertificate";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import AdminDashboardPlaceholder from "./pages/admin/DashboardPlaceholder";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminRoles from "./pages/admin/Roles";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminEnrollments from "./pages/admin/Enrollments";
import AdminEnrollmentProgressPage from "./pages/admin/EnrollmentProgressPage";
import AdminReports from "./pages/admin/Reports";
import TrainerDashboardPlaceholder from "./pages/trainer/DashboardPlaceholder";
import TrainerCourses from "./pages/trainer/Courses";
import TrainerLearners from "./pages/trainer/Learners";
import LearnerProgressPage from "./pages/trainer/LearnerProgressPage";
import ManageModules from "@/pages/trainer/ManageModules";
import CourseAssessmentEditorPage from "@/pages/trainer/CourseAssessmentEditorPage";
import ModuleEditorPage from "@/pages/trainer/ModuleEditorPage";
import TaxonomyManagement from "@/pages/TaxonomyManagement";
import TraineeVerification from "@/pages/TraineeVerification";
import ProgressDashboard from "./pages/ProgressDashboard";
import AssessmentReviewPage from "./pages/AssessmentReviewPage";
import PracticeQuizModuleReviewPage from "./pages/PracticeQuizModuleReviewPage";
import NotFound from "./pages/NotFound";
import StaffCertificatesPage from "./pages/StaffCertificatesPage";
import { initializeMockData } from "@/services/mockData";
import { initializeDashboardRoutes } from "@/lib/roles";

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

// Initialize dashboard routes cache from database
initializeDashboardRoutes().catch((error) => {
  console.warn("Failed to initialize dashboard routes cache:", error);
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="peso-theme-preference">
      <AuthProvider>
        <ThemePreferenceProvider>
          <LocaleProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/preview/:id" element={<CourseDetail />} />
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
            <Route
              path="/certificates/view/:id"
              element={
                <ProtectedRoute>
                  <CertificateView />
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes - Permissions checked dynamically from database */}
            <Route
              path="/verification"
              element={
                <ProtectedRoute allowedRoles={["admin"]} requiredPermissions={["users.view", "training.manage"]}>
                  <TraineeVerification />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboardPlaceholder />
                </ProtectedRoute>
              }
            />
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
              path="/admin/courses/:courseId/modules"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ManageModules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/assessments"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CourseAssessmentEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/modules/new"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/modules/:moduleId/edit"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/taxonomy"
              element={
                <ProtectedRoute allowedRoles={["admin", "trainer"]}>
                  <TaxonomyManagement />
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
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminEnrollments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/learners"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <TrainerLearners />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/learners/:learnerId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LearnerProgressPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/certificates"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <StaffCertificatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/enrollments/:enrollmentId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminEnrollmentProgressPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/assessment-reviews"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AssessmentReviewPage portal="admin" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/assessment-reviews/:attemptId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AssessmentReviewPage portal="admin" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/module-reviews/:enrollmentId/:moduleId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PracticeQuizModuleReviewPage portal="admin" />
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
            
            {/* Trainer Routes - Permissions checked dynamically */}
            <Route
              path="/trainer/dashboard"
              element={
                <ProtectedRoute allowedRoles={["trainer"]}>
                  <TrainerDashboardPlaceholder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <TrainerCourses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/learners"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <TrainerLearners />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/certificates"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <StaffCertificatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/learners/:learnerId"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <LearnerProgressPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/assessment-reviews"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <AssessmentReviewPage portal="trainer" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/assessment-reviews/:attemptId"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <AssessmentReviewPage portal="trainer" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/module-reviews/:enrollmentId/:moduleId"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <PracticeQuizModuleReviewPage portal="trainer" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/modules"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <ManageModules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/assessments"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <CourseAssessmentEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/modules/new"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/modules/:moduleId/edit"
              element={
                <ProtectedRoute allowedRoles={["trainer", "admin"]}>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/trainer/taxonomy"
              element={
                <ProtectedRoute allowedRoles={["admin", "trainer"]}>
                  <TaxonomyManagement />
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
            
            <Route path="*" element={<NotFound />} />
            </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </LocaleProvider>
        </ThemePreferenceProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

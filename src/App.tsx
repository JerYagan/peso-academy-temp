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
import CertificateView from "./pages/CertificateView";
import VerifyCertificate from "./pages/VerifyCertificate";
import Profile from "./pages/Profile";
import AdminDashboardPlaceholder from "./pages/admin/DashboardPlaceholder";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminRoles from "./pages/admin/Roles";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminEnrollments from "./pages/admin/Enrollments";
import AdminReports from "./pages/admin/Reports";
import TrainerDashboardPlaceholder from "./pages/trainer/DashboardPlaceholder";
import TrainerCourses from "./pages/trainer/Courses";
import TrainerLearners from "./pages/trainer/Learners";
import ManageModules from "@/pages/trainer/ManageModules";
import ModuleEditorPage from "@/pages/trainer/ModuleEditorPage";
import ProgressDashboard from "./pages/ProgressDashboard";
import NotFound from "./pages/NotFound";
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
            
            {/* Admin Routes - Permissions checked dynamically from database */}
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
                <ProtectedRoute>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute>
                  <AdminCourses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/modules"
              element={
                <ProtectedRoute>
                  <ManageModules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/modules/new"
              element={
                <ProtectedRoute>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:courseId/modules/:moduleId/edit"
              element={
                <ProtectedRoute>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <ProtectedRoute>
                  <AdminRoles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute>
                  <AdminAuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/enrollments"
              element={
                <ProtectedRoute>
                  <AdminEnrollments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
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
              path="/trainer/courses/:courseId/modules"
              element={
                <ProtectedRoute>
                  <ManageModules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/modules/new"
              element={
                <ProtectedRoute>
                  <ModuleEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/courses/:courseId/modules/:moduleId/edit"
              element={
                <ProtectedRoute>
                  <ModuleEditorPage />
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
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

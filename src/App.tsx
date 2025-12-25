import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Jobs from "./pages/Jobs";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminJobs from "./pages/admin/Jobs";
import TrainerCourses from "./pages/trainer/Courses";
import TrainerLearners from "./pages/trainer/Learners";
import EmployerJobs from "./pages/employer/Jobs";
import EmployerCandidates from "./pages/employer/Candidates";
import NotFound from "./pages/NotFound";
import { initializeMockData } from "@/services/mockData";

const queryClient = new QueryClient();

// Initialize mock data on app start
initializeMockData();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            
            {/* Trainer Routes */}
            <Route
              path="/trainer/courses"
              element={
                <ProtectedRoute allowedRoles={["trainer"]}>
                  <TrainerCourses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainer/learners"
              element={
                <ProtectedRoute allowedRoles={["trainer"]}>
                  <TrainerLearners />
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
  </QueryClientProvider>
);

export default App;

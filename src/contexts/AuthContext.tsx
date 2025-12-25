import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthState } from "@/types/auth";
import { authService } from "@/services/authService";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check if user is logged in from localStorage
    const user = authService.getCurrentUser();
    if (user) {
      setAuthState({
        user,
        isAuthenticated: true,
      });
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const user = authService.login(email, password);
    if (user) {
      setAuthState({
        user,
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    authService.logout();
    setAuthState({
      user: null,
      isAuthenticated: false,
    });
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<boolean> => {
    const user = authService.signup(email, password, name, role);
    if (user) {
      setAuthState({
        user,
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  };

  const updateUser = (updates: Partial<User>) => {
    if (authState.user) {
      const updatedUser = { ...authState.user, ...updates };
      authService.updateUser(updatedUser);
      setAuthState({
        user: updatedUser,
        isAuthenticated: true,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        signup,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};


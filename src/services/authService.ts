import { User } from "@/types/auth";
import type { UserRole } from "@/types/auth";

const STORAGE_KEY = "peso_academy_auth";
const USERS_STORAGE_KEY = "peso_academy_users";

// Default users with credentials
const DEFAULT_USERS: User[] = [
  {
    id: "1",
    email: "trainee@peso.academy",
    name: "Juan Dela Cruz",
    role: "trainee",
    phone: "+63 912 345 6789",
    address: "Manila, Philippines",
    skills: ["Basic Computer Skills", "Communication"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    email: "admin@peso.academy",
    name: "Admin User",
    role: "admin",
    phone: "+63 912 345 6788",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    email: "trainer@peso.academy",
    name: "Trainer Maria",
    role: "trainer",
    phone: "+63 912 345 6787",
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    email: "trainee2@peso.academy",
    name: "Trainee User",
    role: "trainee",
    phone: "+63 912 345 6786",
    createdAt: new Date().toISOString(),
  },
];

// Default passwords (email prefix before @)
const DEFAULT_PASSWORDS: Record<string, string> = {
  "trainee@peso.academy": "password123",
  "admin@peso.academy": "admin123",
  "trainer@peso.academy": "trainer123",
  "trainee2@peso.academy": "trainee2123",
};

// Initialize users in localStorage if not exists
const initializeUsers = () => {
  if (!localStorage.getItem(USERS_STORAGE_KEY)) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  }
};

// Get all users from storage
const getUsers = (): User[] => {
  initializeUsers();
  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_USERS;
};

// Save users to storage
const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const authService = {
  // Login with email and password
  login: (email: string, password: string): User | null => {
    initializeUsers();
    const users = getUsers();
    const user = users.find((u) => u.email === email);

    if (!user) {
      return null;
    }

    // Check password (default passwords or any password for demo)
    const defaultPassword = DEFAULT_PASSWORDS[email];
    if (defaultPassword && password === defaultPassword) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return user;
    }

    // For demo purposes, accept any password if user exists
    // In production, you'd check against hashed passwords
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  // Signup new user
  signup: (email: string, password: string, name: string, role: UserRole): User | null => {
    initializeUsers();
    const users = getUsers();

    // Check if user already exists
    if (users.find((u) => u.email === email)) {
      return null;
    }

    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  },

  // Logout
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Get current user
  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  // Update user
  updateUser: (updatedUser: User) => {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      saveUsers(users);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    }
  },
};


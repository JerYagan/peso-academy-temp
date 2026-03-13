import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import type { AppThemePreference } from "@/types/auth";

type ThemePreferenceContextValue = {
  themePreference: AppThemePreference;
  resolvedTheme: "light" | "dark" | undefined;
  setThemePreference: (theme: AppThemePreference) => Promise<void>;
  isPersisting: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

const isSupportedThemePreference = (value: unknown): value is AppThemePreference => {
  return value === "system" || value === "light" || value === "dark";
};

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isPersisting, setIsPersisting] = useState(false);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const lastResolvedUserThemeRef = useRef<AppThemePreference | null>(null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const nextUserTheme = isSupportedThemePreference(user?.themePreference) ? user.themePreference : null;
    const userChanged = nextUserId !== lastResolvedUserIdRef.current;
    const userThemeChanged = nextUserTheme !== lastResolvedUserThemeRef.current;

    if (!userChanged && !userThemeChanged) {
      return;
    }

    lastResolvedUserIdRef.current = nextUserId;
    lastResolvedUserThemeRef.current = nextUserTheme;

    if (nextUserTheme && nextUserTheme !== theme) {
      setTheme(nextUserTheme);
    }
  }, [setTheme, theme, user?.id, user?.themePreference]);

  const setThemePreference = useCallback(async (nextTheme: AppThemePreference) => {
    if (!isSupportedThemePreference(nextTheme)) {
      return;
    }

    setTheme(nextTheme);

    if (!user || user.themePreference === nextTheme) {
      return;
    }

    setIsPersisting(true);
    try {
      await updateUser({ themePreference: nextTheme });
    } catch (error) {
      console.warn("Failed to persist theme preference:", error);
    } finally {
      setIsPersisting(false);
    }
  }, [setTheme, updateUser, user]);

  const value = useMemo<ThemePreferenceContextValue>(() => ({
    themePreference: isSupportedThemePreference(theme) ? theme : "system",
    resolvedTheme: resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : undefined,
    setThemePreference,
    isPersisting,
  }), [isPersisting, resolvedTheme, setThemePreference, theme]);

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within a ThemePreferenceProvider");
  }

  return context;
}
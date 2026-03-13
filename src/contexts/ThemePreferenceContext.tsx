import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import type { AppThemePreference } from "@/types/auth";

const THEME_PREFERENCE_STORAGE_KEY = "peso-theme-preference";

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

const getStoredThemePreference = (): AppThemePreference | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  return isSupportedThemePreference(storedValue) ? storedValue : null;
};

const storeThemePreference = (themePreference: AppThemePreference) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, themePreference);
  }
};

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themePreference, setThemePreferenceState] = useState<AppThemePreference>(() => {
    const storedThemePreference = getStoredThemePreference();
    return storedThemePreference || (isSupportedThemePreference(theme) ? theme : "system");
  });
  const [isPersisting, setIsPersisting] = useState(false);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const pendingThemePreferenceRef = useRef<AppThemePreference | null>(null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const nextUserTheme = isSupportedThemePreference(user?.themePreference) ? user.themePreference : null;
    const userChanged = nextUserId !== lastResolvedUserIdRef.current;

    if (userChanged) {
      lastResolvedUserIdRef.current = nextUserId;
      pendingThemePreferenceRef.current = null;

      const nextThemePreference = nextUserTheme || getStoredThemePreference() || (isSupportedThemePreference(theme) ? theme : "system");
      setThemePreferenceState(nextThemePreference);
      return;
    }

    if (!nextUserTheme) {
      return;
    }

    if (pendingThemePreferenceRef.current && nextUserTheme !== pendingThemePreferenceRef.current) {
      return;
    }

    if (pendingThemePreferenceRef.current === nextUserTheme) {
      pendingThemePreferenceRef.current = null;
    }

    if (nextUserTheme !== themePreference) {
      setThemePreferenceState(nextUserTheme);
    }
  }, [theme, themePreference, user?.id, user?.themePreference]);

  useEffect(() => {
    storeThemePreference(themePreference);

    if (themePreference !== theme) {
      setTheme(themePreference);
    }
  }, [setTheme, theme, themePreference]);

  const setThemePreference = useCallback(async (nextTheme: AppThemePreference) => {
    if (!isSupportedThemePreference(nextTheme) || nextTheme === themePreference) {
      return;
    }

    pendingThemePreferenceRef.current = user ? nextTheme : null;
    setThemePreferenceState(nextTheme);
    storeThemePreference(nextTheme);

    if (!user || user.themePreference === nextTheme) {
      pendingThemePreferenceRef.current = null;
      return;
    }

    setIsPersisting(true);
    try {
      await updateUser({ themePreference: nextTheme });
    } catch (error) {
      console.warn("Failed to persist theme preference:", error);
    } finally {
      if (user.themePreference === nextTheme) {
        pendingThemePreferenceRef.current = null;
      }
      setIsPersisting(false);
    }
  }, [themePreference, updateUser, user]);

  const value = useMemo<ThemePreferenceContextValue>(() => ({
    themePreference,
    resolvedTheme: resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : undefined,
    setThemePreference,
    isPersisting,
  }), [isPersisting, resolvedTheme, setThemePreference, themePreference]);

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within a ThemePreferenceProvider");
  }

  return context;
}
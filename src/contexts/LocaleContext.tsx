import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { translationResources } from "@/i18n/resources";
import {
  DEFAULT_LANGUAGE,
  INTL_LOCALES,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from "@/i18n/types";

type TranslationVariables = Record<string, string | number>;

type LocaleContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, variables?: TranslationVariables) => string;
  getMessage: <T>(key: string) => T;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  isPersisting: boolean;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const isSupportedLanguage = (value: unknown): value is AppLanguage => {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
};

const getStoredLanguage = (): AppLanguage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguage(storedValue) ? storedValue : null;
};

const storeLanguage = (language: AppLanguage) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
};

const resolveBrowserLanguage = (): AppLanguage => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  return browserLanguage.startsWith("tl") || browserLanguage.startsWith("fil") ? "tl" : DEFAULT_LANGUAGE;
};

const getNestedValue = (source: unknown, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
};

const interpolate = (template: string, variables?: TranslationVariables) => {
  if (!variables) {
    return template;
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined ? "" : String(value);
  });
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>(() => getStoredLanguage() || resolveBrowserLanguage());
  const [isPersisting, setIsPersisting] = useState(false);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const lastResolvedUserLanguageRef = useRef<AppLanguage | null>(null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const nextUserLanguage = isSupportedLanguage(user?.languagePreference) ? user.languagePreference : null;
    const userChanged = nextUserId !== lastResolvedUserIdRef.current;
    const userLanguageChanged = nextUserLanguage !== lastResolvedUserLanguageRef.current;

    if (!userChanged && !userLanguageChanged) {
      return;
    }

    lastResolvedUserIdRef.current = nextUserId;
    lastResolvedUserLanguageRef.current = nextUserLanguage;

    const nextLanguage = nextUserLanguage || getStoredLanguage() || resolveBrowserLanguage();
    if (isSupportedLanguage(nextLanguage) && nextLanguage !== language) {
      setLanguageState(nextLanguage);
    }
  }, [language, user?.id, user?.languagePreference]);

  useEffect(() => {
    storeLanguage(language);
  }, [language]);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) {
      return;
    }

    setLanguageState(nextLanguage);
    storeLanguage(nextLanguage);

    if (!user || user.languagePreference === nextLanguage) {
      return;
    }

    setIsPersisting(true);
    try {
      await updateUser({ languagePreference: nextLanguage });
    } catch (error) {
      console.warn("Failed to persist language preference:", error);
    } finally {
      setIsPersisting(false);
    }
  }, [language, updateUser, user]);

  const value = useMemo<LocaleContextValue>(() => {
    const locale = INTL_LOCALES[language];

    const getMessage = <T,>(key: string): T => {
      const localizedValue = getNestedValue(translationResources[language], key);
      const fallbackValue = getNestedValue(translationResources[DEFAULT_LANGUAGE], key);
      return (localizedValue ?? fallbackValue) as T;
    };

    return {
      language,
      setLanguage,
      t: (key: string, variables?: TranslationVariables) => {
        const message = getMessage<string>(key);
        return typeof message === "string" ? interpolate(message, variables) : key;
      },
      getMessage,
      formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
          return String(value);
        }

        return new Intl.DateTimeFormat(locale, options).format(date);
      },
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(locale, options).format(value);
      },
      isPersisting,
    };
  }, [isPersisting, language, setLanguage]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }

  return context;
}
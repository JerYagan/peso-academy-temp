export const SUPPORTED_LANGUAGES = ["en", "tl"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  tl: "Tagalog",
};

export const INTL_LOCALES: Record<AppLanguage, string> = {
  en: "en-PH",
  tl: "tl-PH",
};

export const LANGUAGE_STORAGE_KEY = "peso-language-preference";
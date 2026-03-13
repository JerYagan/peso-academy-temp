import { en } from "@/i18n/locales/en";
import { tl } from "@/i18n/locales/tl";
import type { AppLanguage } from "@/i18n/types";

export const translationResources: Record<AppLanguage, typeof en> = {
  en,
  tl,
};

export type TranslationSchema = typeof en;
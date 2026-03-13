import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/contexts/LocaleContext";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n/types";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { language, setLanguage, t } = useLocale();

  return (
    <div className={compact ? "w-[140px]" : "w-[180px]"}>
      <Select value={language} onValueChange={(value) => void setLanguage(value as AppLanguage)}>
        <SelectTrigger aria-label={t("languageSwitcher.label")} className={compact ? "h-10" : "h-10 rounded-full"}>
          <SelectValue placeholder={t("languageSwitcher.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((item) => (
            <SelectItem key={item} value={item}>
              {LANGUAGE_LABELS[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcher;
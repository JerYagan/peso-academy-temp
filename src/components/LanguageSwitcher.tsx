import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/contexts/LocaleContext";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n/types";
import { Loader2 } from "lucide-react";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { language, setLanguage, t, isPersisting } = useLocale();

  return (
    <div className={compact ? "w-[140px]" : "w-[180px]"}>
      <Select value={language} onValueChange={(value) => void setLanguage(value as AppLanguage)}>
        <SelectTrigger aria-label={t("languageSwitcher.label")} className={compact ? "h-10" : "h-10 rounded-full"}>
          <SelectValue placeholder={t("languageSwitcher.placeholder")} />
          {isPersisting ? <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" /> : null}
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
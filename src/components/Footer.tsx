import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

const Footer = () => {
  const { t } = useLocale();
  const { resolvedTheme } = useThemePreference();
  const logoSrc = resolvedTheme === "dark" ? "/images/logo.png" : "/images/logo_dark.png";

  return (
    <footer className="bg-primary py-10 text-primary-foreground sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 border-b border-white/15 pb-8 sm:gap-10 sm:pb-10 md:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center">
              <img
                src={logoSrc}
                alt="PESO Academy"
                className="h-8 w-auto object-contain sm:h-12"
              />
            </Link>
            <p className="max-w-xs text-xs leading-6 text-primary-foreground/75 sm:text-sm sm:leading-7">
              {t("footer.summary")}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary-foreground sm:mb-4 sm:text-sm">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-xs text-primary-foreground/75 sm:space-y-3 sm:text-sm">
              <li><a href="#features" className="transition-colors hover:text-white">{t("header.nav.features")}</a></li>
              <li><a href="#how-it-works" className="transition-colors hover:text-white">{t("header.nav.howItWorks")}</a></li>
              <li><Link to="/courses" className="transition-colors hover:text-white">{t("common.courses")}</Link></li>
              <li><a href="#about" className="transition-colors hover:text-white">{t("header.nav.about")}</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-5 text-center text-[11px] text-primary-foreground/65 sm:pt-6 sm:text-sm">
          <p>{t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

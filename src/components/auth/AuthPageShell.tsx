import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useLocale } from "@/contexts/LocaleContext";

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  switchPrompt: ReactNode;
  maxWidthClass?: string;
};

const AuthPageShell = ({
  title,
  subtitle,
  children,
  switchPrompt,
  maxWidthClass = "max-w-xl",
}: AuthPageShellProps) => {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-muted/35 dark:bg-background">
      <Header />

      <main className="overflow-hidden pt-24 sm:pt-28">
        <section className="relative px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <div className="absolute inset-x-0 top-10 -z-10 mx-auto h-64 max-w-5xl rounded-full bg-primary/10 blur-3xl" />

          <div className="mx-auto max-w-6xl">
            <div className="mx-auto text-center">
              <img
                src="/images/logo_dark.png"
                alt="PESO Academy"
                className="mx-auto h-20 w-auto object-contain sm:h-24"
              />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">
                {t("authShell.brand")}
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {subtitle}
              </p>
            </div>

            <div className={`mx-auto mt-8 w-full ${maxWidthClass}`}>
              <div className="rounded-[28px] border border-border/70 bg-background/95 p-6 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8 lg:p-10">
                {children}
              </div>
              <div className="mt-5 text-center text-sm text-muted-foreground">{switchPrompt}</div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AuthPageShell;
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  FileSearch,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartHandshake,
  Home,
  LayoutPanelTop,
  SearchCheck,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const featureCards = [
  {
    title: "Learning Management",
    description:
      "Access modular courses in employability, technical, digital skills, and entrepreneurship.",
    icon: BookOpen,
    iconStyle: { background: "linear-gradient(135deg, #e11d48 0%, #ec4899 100%)" },
  },
  {
    title: "Assessment",
    description:
      "Validate your learning progress and your newly acquired skills and knowledge.",
    icon: LayoutPanelTop,
    iconStyle: { background: "linear-gradient(135deg, #4f46e5 0%, #334155 100%)" },
  },
  {
    title: "Digital Certifications",
    description:
      "Earn TESDA-supported certificates and digital badges to showcase your achievements.",
    icon: Award,
    iconStyle: { background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)" },
  },
  {
    title: "Data Privacy",
    description:
      "Your data is protected under the Data Privacy Act of 2012. Learn with confidence.",
    icon: ShieldCheck,
    iconStyle: { background: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)" },
  },
];

const processSteps = [
  {
    step: "01",
    title: "Register & Build Profile",
    description:
      "Sign up with your PESO ID or create a new account. Complete your profile with your learning interests and goals.",
    icon: UserRoundPlus,
    badgeClassName: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900",
  },
  {
    step: "02",
    title: "Learn & Complete Assessments",
    description:
      "Access learning modules, engage with interactive content, and complete assessments to validate your learning.",
    icon: GraduationCap,
    badgeClassName: "bg-rose-600 text-white dark:bg-rose-500 dark:text-white",
  },
  {
    step: "03",
    title: "Earn Certifications",
    description:
      "Receive TESDA-supported certificates and digital badges to showcase your newly acquired skills and knowledge.",
    icon: BadgeCheck,
    badgeClassName: "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
  },
];

const audiences = [
  {
    title: "Jobseekers",
    description:
      "Access skills training, certifications, and job matching to advance your career.",
    icon: SearchCheck,
    iconClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  },
  {
    title: "Employers",
    description:
      "Find skilled candidates and collaborate on workforce development programs.",
    icon: Briefcase,
    iconClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  },
  {
    title: "Students",
    description:
      "Enhance your academic learning with practical skills and industry certifications.",
    icon: GraduationCap,
    iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  {
    title: "Out-of-School Youth",
    description:
      "Build foundational and technical skills to enter the workforce with confidence.",
    icon: Users,
    iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  {
    title: "Migratory Workers",
    description:
      "Upskill for employment opportunities both locally and internationally.",
    icon: Globe,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  {
    title: "Planners",
    description:
      "Access labor market data to inform policy and workforce development strategies.",
    icon: FileSearch,
    iconClass: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  },
  {
    title: "Researchers",
    description:
      "Utilize employment and skills data for academic and policy research initiatives.",
    icon: FlaskConical,
    iconClass: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  },
  {
    title: "Labor Market Information Users",
    description:
      "Leverage workforce trends and insights for decision-making and planning.",
    icon: LayoutPanelTop,
    iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  },
  {
    title: "Persons with Disabilities (PWDs)",
    description:
      "Access inclusive learning programs designed for diverse abilities and needs.",
    icon: HeartHandshake,
    iconClass: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  },
  {
    title: "Returning Overseas Filipino Workers",
    description:
      "Transition back to the local workforce with reskilling and reintegration support.",
    icon: Home,
    iconClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  },
  {
    title: "Displaced Workers",
    description:
      "Reskill and find new opportunities after job displacement or industry changes.",
    icon: Users,
    iconClass: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="overflow-x-hidden">
        <section className="relative border-b border-border bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] pt-14 dark:bg-[linear-gradient(180deg,hsl(237_28%_11%)_0%,hsl(237_20%_14%)_100%)] sm:pt-16 lg:pt-[74px]">
          <div className="mx-auto grid min-h-[auto] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:min-h-[620px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:px-8 lg:py-10">
            <div className="max-w-2xl space-y-5 animate-fade-up sm:space-y-6">
              <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold leading-5 text-primary dark:border-primary/25 dark:bg-primary/10 sm:px-4 sm:text-sm">
                Free skills training and certifications for learners.
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-[2.45rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-[4.75rem] lg:leading-[0.95]">
                  Find Your Career Path with <span className="text-primary">PESO Academy</span>
                </h1>
                <p className="max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-xl sm:leading-9">
                  Bridge the skills gap and unlock your potential through continuous learning, practical assessments, and digital certification.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Button asChild size="lg" className="h-12 w-full rounded-2xl px-6 text-sm font-semibold card-shadow sm:h-14 sm:w-auto sm:px-7 sm:text-base">
                  <Link to="/signup">
                    Start Learning Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-2xl border-primary/30 bg-background/80 px-6 text-sm font-semibold backdrop-blur hover:bg-muted dark:bg-card/70 sm:h-14 sm:w-auto sm:px-7 sm:text-base">
                  <Link to="/courses">Browse Courses</Link>
                </Button>
              </div>
            </div>

            <div className="relative order-first flex items-center justify-center animate-scale-in lg:order-none">
              <div className="absolute inset-x-2 top-6 h-40 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20 sm:inset-x-0 sm:top-10 sm:h-80" />
              <div className="relative flex w-full max-w-[240px] items-center justify-center px-2 py-6 sm:max-w-[360px] sm:p-8 lg:max-w-[560px] lg:p-10">
                <img
                  src="/images/logo.png"
                  alt="PESO Academy"
                  className="h-auto w-full max-w-[220px] object-contain sm:max-w-[320px] lg:max-w-[420px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-background py-14 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-[2rem] font-extrabold tracking-[-0.03em] text-foreground sm:text-5xl">
                Everything You Need to Succeed
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:mt-4 sm:text-lg sm:leading-8">
                PESO Academy offers a structured learning and certification platform designed to support your skills development.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map(({ title, description, icon: Icon, iconStyle }) => (
                <article
                  key={title}
                  className="group rounded-[1.5rem] border border-border bg-card p-5 card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover dark:bg-card/85 sm:rounded-[1.75rem] sm:p-7"
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg sm:mb-6 sm:h-12 sm:w-12 sm:rounded-2xl"
                    style={iconStyle}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground sm:text-xl">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base sm:leading-7">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-muted/55 py-14 dark:bg-muted/30 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary sm:text-sm">How It Works</p>
              <h2 className="mt-2 text-[2rem] font-extrabold tracking-[-0.03em] text-foreground sm:mt-3 sm:text-5xl">
                Your Path to Upskilling
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:mt-4 sm:text-lg sm:leading-8">
                Follow our simple 3-step process to upskill and achieve your learning goals.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 lg:grid-cols-3">
              {processSteps.map(({ step, title, description, icon: Icon, badgeClassName }) => (
                <article
                  key={step}
                  className="rounded-[1.5rem] border border-border bg-card p-5 card-shadow dark:bg-card/85 sm:rounded-[1.9rem] sm:p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex min-w-10 items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.2em] sm:min-w-12 sm:px-3 sm:text-xs ${badgeClassName}`}>
                      {step}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-primary dark:bg-slate-800/80 sm:h-12 sm:w-12 sm:rounded-2xl">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-xl font-bold leading-tight text-foreground sm:mt-8 sm:text-2xl">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground sm:mt-4 sm:text-base sm:leading-7">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="bg-background py-14 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary sm:text-sm">PESO Clients</p>
              <h2 className="mt-2 text-[2rem] font-extrabold tracking-[-0.03em] text-foreground sm:mt-3 sm:text-5xl">
                Who We Serve
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:mt-4 sm:text-lg sm:leading-8">
                PESO Academy provides learning opportunities for diverse client groups across the Filipino workforce.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {audiences.map(({ title, description, icon: Icon, iconClass }) => (
                <article
                  key={title}
                  className="rounded-[1.35rem] border border-border bg-card px-4 py-4 transition-all duration-300 hover:-translate-y-1 hover:card-shadow dark:bg-card/85 sm:rounded-[1.5rem] sm:px-6 sm:py-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass} sm:mt-1 sm:h-11 sm:w-11 sm:rounded-2xl`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold leading-snug text-foreground sm:text-lg">{title}</h3>
                      <p className="mt-1.5 text-xs leading-6 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-7">{description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background py-14 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.5rem] border border-primary/10 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(237_45%_35%)_45%,hsl(228_54%_30%)_100%)] px-4 py-8 text-center text-primary-foreground shadow-[0_30px_90px_-35px_rgba(31,41,95,0.55)] sm:rounded-[2rem] sm:px-10 sm:py-12 lg:px-16 lg:py-16">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-[1.8rem] font-extrabold tracking-[-0.03em] leading-tight sm:text-5xl">
                  Ready to Start Your Journey?
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-primary-foreground/80 sm:mt-5 sm:text-lg sm:leading-8">
                  Join thousands of individuals who have found success through PESO Academy. Create your account today and take the first step towards your dream career.
                </p>
              </div>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
                <Button asChild size="lg" variant="secondary" className="h-11 w-full rounded-2xl bg-white px-6 text-sm font-semibold text-primary hover:bg-white/90 sm:h-12 sm:w-auto sm:px-8 sm:text-base">
                  <Link to="/signup">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 w-full rounded-2xl border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur hover:bg-white/15 sm:h-12 sm:w-auto sm:px-8 sm:text-base">
                  <Link to="/courses">Explore Courses</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

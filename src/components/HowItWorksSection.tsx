import { UserPlus, ClipboardList, GraduationCap, Briefcase } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Register & Build Profile",
    description: "Sign up with your PESO ID or create a new account. Complete your skills profile, education, and career interests.",
  },
  {
    number: "02",
    icon: ClipboardList,
    title: "Take Skills Assessment",
    description: "Complete diagnostic assessments to identify your current skill level and discover areas for improvement.",
  },
  {
    number: "03",
    icon: GraduationCap,
    title: "Learn & Get Certified",
    description: "Follow personalized learning pathways, complete courses, and earn TESDA-accredited certifications.",
  },
  {
    number: "04",
    icon: Briefcase,
    title: "Match & Get Hired",
    description: "Get matched with relevant job opportunities from PESO and partner employers based on your new skills.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Your Path to{" "}
            <span className="text-gradient">Employment</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Follow our proven 4-step process to transform your skills and land your dream job.
          </p>
        </div>
        
        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-20 -translate-y-1/2" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Step Card */}
                <div className="bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 h-full">
                  {/* Number Badge */}
                  <div className="absolute -top-4 left-6 w-12 h-12 rounded-xl hero-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                    {step.number}
                  </div>
                  
                  <div className="pt-8">
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-5">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
                
                {/* Arrow (for desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-8 -translate-y-1/2 z-10">
                    <div className="w-full h-full rounded-full bg-card card-shadow flex items-center justify-center">
                      <span className="text-primary font-bold">→</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

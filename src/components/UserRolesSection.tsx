import { Button } from "@/components/ui/button";
import { Building2, GraduationCap, ArrowRight, User } from "lucide-react";
import { Link } from "react-router-dom";

const roles = [
  // {
  //   icon: Users,
  //   title: "Job Seekers",
  //   subtitle: "Students, Graduates & Career Shifters",
  //   description: "Access free training, build your skills portfolio, and earn certifications through structured learning.",
  //   features: ["Free courses & certifications", "Skills assessment", "Learning management"],
  //   cta: "Start Learning",
  //   gradient: "from-primary to-primary/80",
  // },
  {
    icon: User,
    title: "Trainees",
    subtitle: "Learners and Job Seekers",
    description: "Access training, track progress, and earn certificates through guided learning and personalized recommendations.",
    features: [],
    cta: "Start Learning",
    gradient: "from-primary to-primary/80",
  },
  {
    icon: Building2,
    title: "PESO Staff",
    subtitle: "Administrators & Managers",
    description: "Manage users, monitor training outcomes, and generate compliance reports for DOLE and LGUs.",
    // features: ["User management", "Analytics dashboard", "Compliance reports", "Program oversight"],
    features: [],
    cta: "Admin Portal",
    gradient: "from-accent to-accent/80",
  },
  {
    icon: GraduationCap,
    title: "Trainers",
    subtitle: "TESDA, Universities & NGOs",
    description: "Create and manage training content, track learner progress, and contribute to workforce development in your community.",
    // features: ["Content management", "Learner analytics", "Certification issuance", "Partner dashboard"],
    features: [],
    cta: "Trainer Portal",
    gradient: "from-primary to-primary/80",
  },
  // {
  //   icon: Briefcase,
  //   title: "Employers",
  //   subtitle: "Hiring Partners",
  //   description: "Access a pool of skill-verified candidates, suggest training needs, and find workers who match your requirements.",
  //   features: ["Skill-ready candidates", "Training suggestions", "Direct hiring", "Workforce insights"],
  //   cta: "Partner With Us",
  //   gradient: "from-accent to-accent/80",
  // },
];

const UserRolesSection = () => {
  return (
    <section id="about" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            For Everyone
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Built for the{" "}
            <span className="text-gradient">Entire Ecosystem</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you're a trainee, trainer, or administrator, PESO Academy has the tools you need.
          </p>
        </div>
        
        {/* Roles Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {roles.map((role) => (
            <div
              key={role.title}
              className="group bg-card rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                  <role.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-1">
                    {role.title}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mb-3">
                    {role.subtitle}
                  </p>
                  <p className="text-muted-foreground mb-5">
                    {role.description}
                  </p>
                  
                  {/* Features */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {role.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="group/btn" asChild>
                    <Link to="/signup">
                      {role.cta}
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UserRolesSection;

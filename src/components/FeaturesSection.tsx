import { 
  ClipboardCheck, 
  BookOpen, 
  Award, 
  Shield
} from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "Skills Assessment",
    description: "Evaluate your current skills with our comprehensive diagnostic tools and discover your strengths.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: BookOpen,
    title: "Learning Management",
    description: "Access modular courses in employability, technical, digital skills, and entrepreneurship.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Award,
    title: "Digital Certifications",
    description: "Earn TESDA-supported certificates and digital badges to showcase your achievements.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Shield,
    title: "Data Privacy",
    description: "Your data is protected under the Data Privacy Act of 2012. Learn with confidence.",
    color: "bg-accent/10 text-accent",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-muted/30" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Platform Features
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Everything You Need to{" "}
            <span className="text-primary">Succeed</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            From skills assessment to certification, PESO Academy provides a complete 
            training and learning management ecosystem for your development.
          </p>
        </div>
        
        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

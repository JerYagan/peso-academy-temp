import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 hero-gradient" />
      
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-primary-foreground/10 rounded-full blur-2xl" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm font-medium mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            100% Free for Filipino Workers
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Ready to Start Learning?
          </h2>
          
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Join thousands of Filipinos who have upskilled and earned certifications 
            through PESO Academy&apos;s free training and learning management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="accent" size="xl" className="group" asChild>
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/courses">Browse Courses</Link>
            </Button>
          </div>
          
          {/* Trust badges */}
          <div className="mt-12 pt-8 border-t border-primary-foreground/20">
            <p className="text-sm text-primary-foreground/60 mb-4">Trusted & Supported By</p>
            <div className="flex flex-wrap justify-center gap-8 items-center">
              <span className="text-primary-foreground/80 font-semibold">DOLE</span>
              <span className="text-primary-foreground/40">•</span>
              <span className="text-primary-foreground/80 font-semibold">TESDA</span>
              <span className="text-primary-foreground/40">•</span>
              <span className="text-primary-foreground/80 font-semibold">LGU Partners</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;

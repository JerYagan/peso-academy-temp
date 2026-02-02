import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, BookOpen, Award } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 hero-gradient opacity-[0.03]" />
      
      {/* Decorative Elements */}
      <div className="absolute top-32 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-up">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Powered by PESO & DOLE
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Upskill Your Career with{" "}
              <span className="text-gradient">PESO Academy</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl animate-fade-up" style={{ animationDelay: "0.2s" }}>
              Free skills training and certifications for Filipino workers. 
              Bridge the skills gap through quality learning and training.
            </p>
            
            <div className="flex flex-wrap gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <Button variant="hero" size="xl" asChild>
                <Link to="/signup">
                  Start Learning Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" className="gap-2" asChild>
                <Link to="/courses">
                  <Play className="w-5 h-5" />
                  Browse Courses
                </Link>
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <Users className="w-5 h-5" />
                  <span className="text-2xl md:text-3xl font-bold">50K+</span>
                </div>
                <p className="text-sm text-muted-foreground">Active Learners</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <BookOpen className="w-5 h-5" />
                  <span className="text-2xl md:text-3xl font-bold">200+</span>
                </div>
                <p className="text-sm text-muted-foreground">Free Courses</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <Award className="w-5 h-5" />
                  <span className="text-2xl md:text-3xl font-bold">50K+</span>
                </div>
                <p className="text-sm text-muted-foreground">Certifications Earned</p>
              </div>
            </div>
          </div>
          
          {/* Right Content - Hero Illustration */}
          <div className="relative hidden lg:block">
            <div className="relative z-10 animate-float">
              {/* Main Card */}
              <div className="bg-card rounded-2xl card-shadow p-6 max-w-md ml-auto">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl hero-gradient flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Digital Skills Fundamentals</h3>
                    <p className="text-sm text-muted-foreground">TESDA Supported</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-primary">75%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-3/4 hero-gradient rounded-full" />
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -left-8 top-20 bg-accent text-accent-foreground rounded-xl p-4 card-shadow animate-fade-in" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8" />
                  <div>
                    <p className="font-bold">Certificate Earned!</p>
                    <p className="text-sm opacity-90">Basic IT Skills</p>
                  </div>
                </div>
              </div>
              
              {/* Bottom Card */}
              <div className="absolute -bottom-8 left-8 bg-card rounded-xl card-shadow p-4 animate-fade-in" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card" />
                    <div className="w-8 h-8 rounded-full bg-accent/20 border-2 border-card" />
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-medium">+5K</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Joined this week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

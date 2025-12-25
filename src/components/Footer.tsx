import { GraduationCap, Facebook, Twitter, Youtube, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <a href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">
                PESO <span className="text-primary">Academy</span>
              </span>
            </a>
            <p className="text-background/60 text-sm leading-relaxed">
              Empowering Filipino workers with free skills training, 
              certifications, and job matching services.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Courses</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Skills Assessment</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Certifications</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Job Matching</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Career Guidance</a></li>
            </ul>
          </div>
          
          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Training Partners</a></li>
              <li><a href="#" className="hover:text-background transition-colors">For Employers</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Success Stories</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Blog</a></li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Data Protection</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Accessibility</a></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/40">
          <p>© 2025 PESO Academy. A DOLE-PESO Initiative.</p>
          <p>Supporting RA 8759 & RA 10691 | Powered by TESDA</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

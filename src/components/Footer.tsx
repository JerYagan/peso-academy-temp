import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-primary py-10 text-primary-foreground sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 border-b border-white/15 pb-8 sm:gap-10 sm:pb-10 md:grid-cols-[1.3fr_0.8fr_1fr]">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center">
              <img
                src="/images/logo.png"
                alt="PESO Academy"
                className="h-8 w-auto object-contain brightness-0 invert sm:h-12"
              />
            </Link>
            <p className="max-w-xs text-xs leading-6 text-primary-foreground/75 sm:text-sm sm:leading-7">
              Empowering individuals through quality employment services and training programs.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary-foreground sm:mb-4 sm:text-sm">Quick Links</h4>
            <ul className="space-y-2 text-xs text-primary-foreground/75 sm:space-y-3 sm:text-sm">
              <li><a href="#features" className="transition-colors hover:text-white">Features</a></li>
              <li><a href="#how-it-works" className="transition-colors hover:text-white">How It Works</a></li>
              <li><Link to="/courses" className="transition-colors hover:text-white">Courses</Link></li>
              <li><a href="#about" className="transition-colors hover:text-white">About</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary-foreground sm:mb-4 sm:text-sm">Contact</h4>
            <ul className="space-y-1.5 text-xs leading-6 text-primary-foreground/75 sm:space-y-2 sm:text-sm sm:leading-7">
              <li>City Government of Tacurong</li>
              <li>Tacurong City, Philippines</li>
            </ul>
          </div>
        </div>

        <div className="pt-5 text-center text-[11px] text-primary-foreground/65 sm:pt-6 sm:text-sm">
          <p>© 2026 PESO Academy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

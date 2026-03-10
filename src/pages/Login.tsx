import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getDashboardRouteAsync } from "@/lib/roles";
import AuthPageShell from "@/components/auth/AuthPageShell";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem("pesoRememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // When already authenticated (e.g. returned from Google OAuth), redirect to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      toast.info("You are already logged in", {
        description: `Welcome back, ${user.name || user.email}!`,
      });
      getDashboardRouteAsync(user.role).then((route) => {
        navigate(route, { replace: true });
      });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Login form submitted for:", email);
      const result = await login(email, password);
      console.log("Login result:", result);
      
      if (result.success && result.user) {
        if (rememberMe) {
          window.localStorage.setItem("pesoRememberedEmail", email);
        } else {
          window.localStorage.removeItem("pesoRememberedEmail");
        }
        console.log("Login successful");
        setLoading(false);
        toast.success("Login successful!", {
          description: `Welcome back, ${result.user.name || result.user.email}!`,
        });
        // Redirect to dashboard after showing toast
        const dashboardRoute = result.user.role 
          ? await getDashboardRouteAsync(result.user.role) 
          : "/dashboard";
        setTimeout(() => {
          navigate(dashboardRoute, { replace: true });
        }, 500); // Small delay to let user see the toast
      } else {
        console.error("Login failed:", result.error);
        setError(result.error || "Invalid email or password");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login form error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred. Please try again.";
      setError(errorMessage);
      setLoading(false);
    } finally {
      // Ensure loading is always reset, even if something unexpected happens
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };

  return (
    <AuthPageShell
      title="Login"
      subtitle="Continue your PESO Academy training journey with your registered account credentials."
      switchPrompt={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold text-primary transition-colors hover:text-primary/80">
            Create one here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Use your email and password to access your dashboard.</p>
        </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@peso.academy"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl border-border/80 bg-muted/30 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl border-border/80 bg-muted/30 px-4 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label htmlFor="remember-me" className="flex items-center gap-2 text-muted-foreground">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <span>Remember me</span>
          </label>
          <button
            type="button"
            className="font-medium text-primary transition-colors hover:text-primary/80"
            onClick={() => {
              toast.info("Password recovery is not configured yet.", {
                description: "Please contact an administrator if you need help resetting your password.",
              });
            }}
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </Button>

      </form>
    </AuthPageShell>
  );
};

export default Login;


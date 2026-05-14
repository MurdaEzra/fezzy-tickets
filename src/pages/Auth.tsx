import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Ticket } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const plan = params.get("plan");
  const redirect = params.get("redirect") || "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const destination = plan ? `${redirect}${redirect.includes("?") ? "&" : "?"}plan=${encodeURIComponent(plan)}` : redirect;

  useEffect(() => {
    if (user) navigate(destination, { replace: true });
  }, [user, navigate, destination]);

  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    params.set("mode", m);
    setParams(params, { replace: true });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination}`,
            data: { full_name: fullName, country, plan: plan ?? undefined },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: plan ? `${plan} plan selected. Check your inbox to verify.` : "Check your inbox to verify your email." });
        navigate(destination);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate(destination);
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Something went wrong", { description: e.message ?? "Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/account` });
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Google sign-in failed", { description: e.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-12 py-12 md:grid-cols-2 md:items-center md:py-16">
          {/* Left: editorial */}
          <div className="hidden md:block">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <h1 className="display mt-10 text-5xl text-foreground sm:text-6xl">
              Live happens{" "}
              <span className="script font-normal text-primary text-[1.2em]">once</span>.
              <br />Be there.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Join fans across Kenya and the world. One account for every event,
              every ticket, every memory.
            </p>
            <ul className="mt-10 space-y-3 text-sm text-foreground">
              {["Pay with M-Pesa, card or Apple Pay", "QR tickets, even offline", "Refunds & transfers, no fuss"].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: form */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-border bg-card p-7 shadow-soft md:p-9">
              <div
            className="flex items gap-2 cursor-pointer"
            onClick={() => navigate('landing')}>
              <img
              src="https://res.cloudinary.com/dgfmhyebp/image/upload/v1777102601/Untitled_design_8_-Photoroom_jkvjqm.png"
              alt="Lashawn Driving & Computer College"
              className="h-16 md:h-36 lg:h-56 w-auto object-contain" />
          </div>  

              <h2 className="font-display text-3xl font-bold text-foreground">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to access your tickets." : "Free forever for attendees."}
              </p>
              {plan && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <Ticket className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">Selected plan: <span className="font-bold">{plan}</span> — we'll set it up after sign-up.</span>
                </div>
              )}

              <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleGoogle} disabled={loading}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Continue with Google
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmail} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Wanjiku Mwangi" />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} required />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                {mode === "signup" && (
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      required
                    />
                    <span>
                      I agree to the{" "}
                      <Link to="/terms" target="_blank" className="font-semibold text-primary hover:underline">Terms and Conditions</Link>
                      {" "}and{" "}
                      <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
                    </span>
                  </label>
                )}
                <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={loading || (mode === "signup" && !acceptedTerms)}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New to Fezzy? " : "Already have an account? "}
                <button onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-primary hover:underline">
                  {mode === "signin" ? "Create account" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;

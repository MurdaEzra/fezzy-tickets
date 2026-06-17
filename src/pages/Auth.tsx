import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/hooks/useAuth";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";

const Auth = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const redirect = params.get("redirect") || "/dashboard";
  const pendingOrgName = params.get("org")?.trim() || sessionStorage.getItem("pendingOrgName")?.trim() || "";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "signup" && !pendingOrgName) {
      navigate("/start-selling", { replace: true });
    }
  }, [mode, pendingOrgName, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roleList = (roles ?? []).map((r) => r.role);
      if (roleList.includes("super_admin") || roleList.includes("admin")) {
        navigate(redirect === "/dashboard" ? "/admin" : redirect, { replace: true });
        return;
      }
      const access = await getOrganizerAccessStatus(user.id);
      if (access === "approved") {
        navigate("/dashboard", { replace: true });
      } else if (access === "pending") {
        navigate("/application-pending", { replace: true });
      } else if (access === "rejected") {
        navigate("/application-pending", { replace: true });
      } else {
        navigate("/start-selling", { replace: true });
      }
    })();
  }, [user, navigate, redirect]);

  useEffect(() => {
    if (pendingOrgName) sessionStorage.setItem("pendingOrgName", pendingOrgName);
  }, [pendingOrgName]);

  const switchMode = (m: "signin" | "signup") => {
    if (m === "signup" && !pendingOrgName) {
      navigate("/start-selling");
      return;
    }
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
        const { data, error } = await supabase.functions.invoke("send-account-verification-email", {
          body: {
            email,
            password,
            fullName,
            country,
            marketingOptIn,
            orgName: pendingOrgName,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        sessionStorage.removeItem("pendingOrgName");
        await logActivity("organizer.application.submitted", { message: pendingOrgName, metadata: { email } });
        toast.success("Application submitted! We'll email you once approved.");
        navigate("/application-pending?submitted=1");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
    } catch (err) {
      const e = err as { message?: string; code?: string };
      const message = e.message ?? "Try again.";
      const isWeakPassword = e.code === "weak_password" || /weak|pwned|easy to guess/i.test(message);
      toast.error(isWeakPassword ? "Choose a stronger password" : "Something went wrong", {
        description: isWeakPassword
          ? "Use a unique password that hasn't appeared in data breaches before."
          : message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (mode === "signup") {
      toast.error("Organizer signup requires email", {
        description: "Complete the form above to apply as an organizer.",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Google sign-in failed", { description: e.message ?? "Try again." });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-12 py-12 md:grid-cols-2 md:items-center md:py-16">
          <div className="hidden md:block">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <h1 className="display mt-10 text-5xl text-foreground sm:text-6xl">
              Sell tickets{" "}
              <span className="script font-normal text-primary text-[1.2em]">your way</span>.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Organizers apply for access. Attendees buy tickets as guests — no account needed.
            </p>
            <ul className="mt-10 space-y-3 text-sm text-foreground">
              {["M-Pesa, card & Apple Pay checkout", "QR tickets emailed instantly", "Payouts & event management"].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-border bg-card p-7 shadow-soft md:p-9">
              <h2 className="font-display text-3xl font-bold text-foreground">
                {mode === "signin" ? "Organizer sign in" : "Apply as organizer"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to your approved organizer account."
                  : pendingOrgName
                    ? `Submit your application for ${pendingOrgName}. Admin approval required.`
                    : "Start at organization setup to apply."}
              </p>

              {mode === "signin" && (
                <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleGoogle} disabled={loading}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Continue with Google
                </Button>
              )}

              {mode === "signin" && (
                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
                </div>
              )}

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
                  {mode === "signup" && (
                    <p className="mt-1 text-xs text-muted-foreground">Use 8+ characters and avoid common or previously used passwords.</p>
                  )}
                </div>
                {mode === "signup" && (
                  <>
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
                    <label className="flex items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                        checked={marketingOptIn}
                        onChange={(e) => setMarketingOptIn(e.target.checked)}
                      />
                      <span>Send me occasional updates about new features (optional).</span>
                    </label>
                  </>
                )}
                <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={loading || (mode === "signup" && !acceptedTerms)}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Submit application"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    Want to sell tickets?{" "}
                    <Link to="/start-selling" className="font-semibold text-primary hover:underline">Apply as organizer</Link>
                  </>
                ) : (
                  <>
                    Already approved?{" "}
                    <button onClick={() => switchMode("signin")} className="font-semibold text-primary hover:underline">
                      Sign in
                    </button>
                  </>
                )}
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

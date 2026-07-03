import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/hooks/useAuth";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import TurnstileWidget from "@/components/TurnstileWidget";

const readPendingOrganizerApplication = () => {
  const raw = sessionStorage.getItem("pendingOrganizerApplication");
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const Auth = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check for recovery type in query params (from password reset link)
  const isRecovery = params.get("type") === "recovery";
  const initialMode = isRecovery 
    ? "reset-password" 
    : params.get("mode") === "signup" 
      ? "signup" 
      : params.get("mode") === "forgot-password" 
        ? "forgot-password" 
        : "signin";
        
  const redirect = params.get("redirect") || "/dashboard";
  const pendingOrgName = params.get("org")?.trim() || sessionStorage.getItem("pendingOrgName")?.trim() || "";
  const inviteToken = sessionStorage.getItem("inviteToken");
  const inviteEmail = sessionStorage.getItem("inviteEmail") || "";
  const isInviteSignup = !!inviteToken;

  const [mode, setMode] = useState<"signin" | "signup" | "forgot-password" | "reset-password">(initialMode);
  const [email, setEmail] = useState(inviteEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // For reset password
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    if (mode === "signup" && !pendingOrgName && !isInviteSignup) {
      navigate("/start-selling", { replace: true });
    }
  }, [mode, pendingOrgName, isInviteSignup, navigate]);

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

  const switchMode = (m: "signin" | "signup" | "forgot-password") => {
    if (m === "signup" && !pendingOrgName && !isInviteSignup) {
      navigate("/start-selling");
      return;
    }
    setMode(m);
    setResetEmailSent(false);
    params.set("mode", m);
    setParams(params, { replace: true });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!turnstileToken) {
        toast.error("Please complete the security check");
        setLoading(false);
        return;
      }
      const verifyResponse = await fetch(import.meta.env.VITE_TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        toast.error("Security check failed, please try again");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Something went wrong", { description: e.message ?? "Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    setLoading(true);
    try {
      // Use Supabase's updateUser to set new password
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      switchMode("signin");
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Something went wrong", { description: e.message ?? "Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      // Verify Turnstile token
      if (!turnstileToken) {
        toast.error("Please complete the security check");
        setLoading(false);
        return;
      }

      const verifyResponse = await fetch(import.meta.env.VITE_TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        toast.error("Security check failed, please try again");
        setLoading(false);
        return;
      }

      if (mode === "signup" && isInviteSignup) {
        // Handle invite signup
        const { data, error } = await supabase.functions.invoke("accept-invite-signup", {
          body: {
            email,
            password,
            fullName,
            country,
            marketingOptIn,
            inviteToken,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Now sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        toast.success("Welcome! You are now an admin.");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.functions.invoke("send-account-verification-email", {
          body: {
            email,
            password,
            fullName,
            country,
            marketingOptIn,
            orgName: pendingOrgName,
            applicationDetails: readPendingOrganizerApplication(),
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        sessionStorage.removeItem("pendingOrgName");
        sessionStorage.removeItem("pendingOrganizerApplication");
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
    if (mode === "signup" && !isInviteSignup) {
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
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-1440 gap-12 px-5 py-12 md:grid-cols-2 md:items-center md:py-16 lg:px-8">
          <div className="hidden md:block">
            <Link to="/" className="inline-flex items-center gap-2 font-mono-label text-cream-dim hover:text-cream">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <h1 className="mt-10 font-display text-5xl text-cream sm:text-6xl">
              Sell tickets your way.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-cream-dim">
              Organizers apply for access. Attendees buy tickets as guests — no account needed.
            </p>
            <ul className="mt-10 space-y-3 text-sm text-cream">
              {["M-Pesa, card & Apple Pay checkout", "QR tickets emailed instantly", "Payouts & event management"].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center bg-fezzy/15 text-fezzy">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="border border-cream/10 bg-ink-card p-7 md:p-9">
              <h2 className="font-display text-3xl text-cream">
                {mode === "signin"
                  ? "Organizer sign in"
                  : mode === "forgot-password"
                    ? "Reset your password"
                    : mode === "reset-password"
                      ? "Set a new password"
                      : isInviteSignup
                        ? "Join the team"
                        : "Apply as organizer"}
              </h2>
              <p className="mt-1 text-sm text-cream-dim">
                {mode === "signin"
                  ? "Sign in to your approved organizer account."
                  : mode === "forgot-password"
                    ? "Enter your email and we'll send you a password reset link."
                    : mode === "reset-password"
                      ? "Enter your new password below."
                      : isInviteSignup
                        ? "Create your account to join the team."
                        : pendingOrgName
                          ? `Submit your application for ${pendingOrgName}. Admin approval required.`
                          : "Start at organization setup to apply."}
              </p>

              {mode === "signin" && (
                <button type="button" className="btn-outline-editorial mt-6 w-full justify-center" onClick={handleGoogle} disabled={loading}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Continue with Google
                </button>
              )}

              {mode === "signin" && (
                <div className="my-6 flex items-center gap-3 font-mono-label text-ash">
                  <div className="h-px flex-1 bg-cream/10" /> or with email <div className="h-px flex-1 bg-cream/10" />
                </div>
              )}
              {(mode === "forgot-password" || mode === "reset-password") && <div className="my-6" />}

              {resetEmailSent ? (
                <div className="text-center py-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fezzy/15 text-fezzy">✉️</div>
                  <p className="text-cream">Password reset email sent!</p>
                  <p className="mt-2 text-sm text-cream-dim">
                    Check your inbox for a link to reset your password.
                  </p>
                  <button
                    onClick={() => switchMode("signin")}
                    className="btn-outline-editorial mt-6 w-full justify-center"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <form 
                    onSubmit={
                      mode === "forgot-password" 
                        ? handleForgotPassword 
                        : mode === "reset-password" 
                          ? handleResetPassword 
                          : handleEmail
                    } 
                    className="space-y-4"
                  >
                    {mode === "signup" && (
                      <>
                        <div>
                          <label className="mb-1.5 block font-mono-label text-cream-dim">Full name</label>
                          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Wanjiku Mwangi" className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash" />
                        </div>
                        <div>
                          <label className="mb-1.5 block font-mono-label text-cream-dim">Country</label>
                          <input value={country} onChange={(e) => setCountry(e.target.value)} required className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash" />
                        </div>
                      </>
                    )}
                    {mode !== "reset-password" && (
                      <div>
                        <label className="mb-1.5 block font-mono-label text-cream-dim">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash" disabled={isInviteSignup && !!inviteEmail} />
                      </div>
                    )}
                    {mode !== "forgot-password" && (
                      <div>
                        <label className="mb-1.5 block font-mono-label text-cream-dim">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash" />
                        {mode === "signup" && (
                          <p className="mt-1 font-mono-label text-ash">Use 8+ characters and avoid common or previously used passwords.</p>
                        )}
                      </div>
                    )}
                    {mode === "reset-password" && (
                      <div>
                        <label className="mb-1.5 block font-mono-label text-cream-dim">Confirm password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash" />
                      </div>
                    )}
                    {mode === "signup" && (
                      <>
                        <label className="flex items-start gap-2 text-xs text-cream-dim">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-fezzy"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            required
                          />
                          <span>
                            I agree to the{" "}
                            <Link to="/terms" target="_blank" className="font-semibold text-fezzy hover:text-lime">Terms and Conditions</Link>
                            {" "}and{" "}
                            <Link to="/privacy" target="_blank" className="font-semibold text-fezzy hover:text-lime">Privacy Policy</Link>.
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-xs text-cream-dim">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-fezzy"
                            checked={marketingOptIn}
                            onChange={(e) => setMarketingOptIn(e.target.checked)}
                          />
                          <span>Send me occasional updates about new features (optional).</span>
                        </label>
                      </>
                    )}
                    {mode !== "reset-password" && (
                      <TurnstileWidget
                        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                        onVerify={(token) => setTurnstileToken(token)}
                        onExpire={() => setTurnstileToken(null)}
                      />
                    )}
                    <button 
                      type="submit" 
                      className="btn-ember w-full justify-center" 
                      disabled={loading || (mode === "signup" && !acceptedTerms)}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {mode === "signin" 
                        ? "Sign in" 
                        : mode === "forgot-password" 
                          ? "Send reset link" 
                          : mode === "reset-password" 
                            ? "Update password" 
                            : isInviteSignup 
                              ? "Create account" 
                              : "Submit application"}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-sm text-cream-dim">
                    {mode === "signin" ? (
                      <>
                        Forgot your password?{" "}
                        <button onClick={() => switchMode("forgot-password")} className="font-semibold text-fezzy hover:text-lime">
                          Reset password
                        </button>
                        <br />
                        Want to sell tickets?{" "}
                        <Link to="/start-selling" className="font-semibold text-fezzy hover:text-lime">Apply as organizer</Link>
                      </>
                    ) : mode === "forgot-password" || mode === "reset-password" ? (
                      <>
                        Remember your password?{" "}
                        <button onClick={() => switchMode("signin")} className="font-semibold text-fezzy hover:text-lime">
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button onClick={() => switchMode("signin")} className="font-semibold text-fezzy hover:text-lime">
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;

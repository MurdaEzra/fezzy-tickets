import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Loader2, MailCheck, Users, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { toast } from "sonner";
import TurnstileWidget from "@/components/TurnstileWidget";

const StartSelling = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [eventCategory, setEventCategory] = useState("");
  const [eventFrequency, setEventFrequency] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [website, setWebsite] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [firstEventPlan, setFirstEventPlan] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const steps = useMemo(
    () => [
      { num: "01", title: "Organization", tag: "Who's selling", icon: Building2, hint: "Tell us who you are." },
      { num: "02", title: "Events", tag: "What you make", icon: CalendarDays, hint: "Shape the kind of nights you throw." },
      { num: "03", title: "Audience", tag: "Who shows up", icon: Users, hint: "How big does your crowd get?" },
      { num: "04", title: "Review", tag: "Final touch", icon: MailCheck, hint: "One last look before we make it real." },
    ],
    []
  );

  useEffect(() => {
    if (user) {
      getOrganizerAccessStatus(user.id).then((access) => {
        if (access === "approved") navigate("/dashboard", { replace: true });
        else if (access === "pending" || access === "rejected") navigate("/application-pending", { replace: true });
      });
    }
  }, [user, navigate]);

  const canContinue =
    (step === 0 && orgName.trim()) ||
    (step === 1 && orgType && eventCategory && eventFrequency) ||
    (step === 2 && audienceSize && firstEventPlan) ||
    step === 3;

  const applicationDetails = {
    orgType, eventCategory, eventFrequency, audienceSize,
    website: website.trim(), contactPhone: contactPhone.trim(), firstEventPlan,
  };

  const move = (delta: 1 | -1) => {
    if (delta === 1 && !canContinue) {
      toast.error("Complete this step to continue.");
      return;
    }
    setDirection(delta);
    setTransitioning(true);
    window.setTimeout(() => {
      setStep((c) => Math.max(0, Math.min(steps.length - 1, c + delta)));
      setTransitioning(false);
    }, 650);
  };

  const submit = async () => {
    const name = orgName.trim();
    if (!name) return;
    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }
    setVerifying(true);
    try {
      const verifyResponse = await fetch(import.meta.env.VITE_TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        toast.error("Security check failed, please try again");
        return;
      }
      sessionStorage.setItem("pendingOrgName", name);
      sessionStorage.setItem("pendingOrganizerApplication", JSON.stringify(applicationDetails));
      navigate(`/auth?mode=signup&redirect=/dashboard&org=${encodeURIComponent(name)}`);
    } finally {
      setVerifying(false);
    }
  };

  const progressPct = ((step + 1) / steps.length) * 100;

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="relative mx-auto max-w-1440 px-5 py-14 lg:px-8">
          {/* Header */}
          <div className="mx-auto max-w-4xl">
            <span className="inline-flex items-center gap-2 border border-fezzy/50 bg-fezzy/10 px-3 py-1 font-mono-label text-fezzy">
              <Sparkles className="h-3.5 w-3.5" /> Become an organizer
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[0.95] text-cream sm:text-7xl">
              Four steps to your <span className="text-fezzy">first drop</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-cream-dim">
              Build the version of Fezzy your crowd will remember. This takes about 90 seconds.
            </p>
          </div>

          {/* Horizontal card stepper */}
          <div className="mx-auto mt-12 max-w-5xl">
            <div className="relative">
              {/* Progress rail */}
              <div className="absolute left-4 right-4 top-8 h-px bg-cream/10 md:left-8 md:right-8" />
              <div
                className="absolute left-4 top-8 h-px bg-fezzy transition-all duration-700 ease-out md:left-8"
                style={{ width: `calc(${progressPct}% - 2rem)` }}
              />
              <ol className="relative grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {steps.map((s, i) => {
                  const active = i === step;
                  const done = i < step;
                  const Icon = s.icon;
                  return (
                    <li key={s.title} className="relative">
                      <div
                        className={`relative flex flex-col gap-3 border p-4 transition-all duration-500 ${
                          active
                            ? "border-fezzy bg-fezzy/[0.07] shadow-[0_0_0_1px_theme(colors.fezzy.DEFAULT)/40] -translate-y-1"
                            : done
                              ? "border-lime/40 bg-lime/[0.05]"
                              : "border-cream/10 bg-ink-card/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`grid h-11 w-11 place-items-center rounded-full border transition-all ${
                              active
                                ? "border-fezzy bg-fezzy text-ink"
                                : done
                                  ? "border-lime bg-lime/20 text-lime"
                                  : "border-cream/20 text-ash"
                            }`}
                          >
                            {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                          </span>
                          <span className={`font-mono text-xs tracking-widest ${active ? "text-fezzy" : "text-ash"}`}>
                            {s.num}
                          </span>
                        </div>
                        <div>
                          <p className={`font-mono-label ${active ? "text-cream" : done ? "text-lime" : "text-cream-dim"}`}>
                            {s.tag}
                          </p>
                          <p className={`mt-1 font-display text-lg ${active ? "text-cream" : "text-cream-dim"}`}>
                            {s.title}
                          </p>
                        </div>
                        {active && (
                          <span className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-fezzy animate-[shimmer_1.4s_ease-in-out_infinite]" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Loading curtain between steps */}
          <div className="relative mx-auto mt-10 max-w-4xl">
            {transitioning && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-ink/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-14 w-14">
                    <div className="absolute inset-0 rounded-full border-2 border-cream/10" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-fezzy" />
                    <div className="absolute inset-2 rounded-full bg-fezzy/10" />
                  </div>
                  <p className="font-mono-label tracking-widest text-fezzy">
                    {direction === 1 ? "Loading next step" : "Going back"}
                  </p>
                  <div className="h-px w-40 overflow-hidden bg-cream/10">
                    <div className="h-full w-full origin-left animate-[slideRail_.65s_ease-in-out] bg-fezzy" />
                  </div>
                </div>
              </div>
            )}

            <div
              className={`border border-cream/10 bg-ink-card p-7 transition-all duration-500 md:p-10 ${
                transitioning
                  ? direction === 1
                    ? "translate-x-6 opacity-0"
                    : "-translate-x-6 opacity-0"
                  : "translate-x-0 opacity-100"
              }`}
              key={step}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="font-mono-label text-ash">Step {step + 1} of {steps.length}</p>
                  <h2 className="mt-1 font-display text-3xl text-cream">{steps[step].title}</h2>
                  <p className="mt-1 text-sm text-cream-dim">{steps[step].hint}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-mono text-4xl text-fezzy">{steps[step].num}</p>
                  <p className="mt-1 font-mono-label text-ash">{steps[step].tag}</p>
                </div>
              </div>

              <div className="space-y-5">
                {step === 0 && (
                  <div>
                    <label className="mb-1.5 block font-mono-label text-cream-dim">Organization name</label>
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Solstice Collective"
                      required
                      className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-lg text-cream outline-none focus:border-fezzy placeholder:text-ash"
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldSelect label="Organizer type" value={orgType} onChange={setOrgType} options={["Promoter", "Venue", "Festival", "Artist or collective", "Community organization", "Corporate"]} />
                    <FieldSelect label="Primary event category" value={eventCategory} onChange={setEventCategory} options={["Concerts", "Festivals", "Nightlife", "Sports", "Comedy", "Workshops", "Conferences", "Community"]} />
                    <FieldSelect label="How often will you host events?" value={eventFrequency} onChange={setEventFrequency} options={["Weekly", "Monthly", "Quarterly", "A few times a year", "One-time event"]} />
                    <div>
                      <label className="mb-1.5 block font-mono-label text-cream-dim">Website or social page</label>
                      <input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://instagram.com/yourbrand"
                        className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none focus:border-fezzy placeholder:text-ash"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldSelect label="Typical audience size" value={audienceSize} onChange={setAudienceSize} options={["Under 100", "100-500", "500-1,500", "1,500-5,000", "5,000+"]} />
                    <FieldSelect label="First event readiness" value={firstEventPlan} onChange={setFirstEventPlan} options={["Date and venue confirmed", "Venue confirmed, date pending", "Planning within 30 days", "Still exploring"]} />
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block font-mono-label text-cream-dim">Contact phone</label>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+254 700 000 000"
                        className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none focus:border-fezzy placeholder:text-ash"
                      />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Organization", orgName],
                        ["Type", orgType],
                        ["Category", eventCategory],
                        ["Frequency", eventFrequency],
                        ["Audience", audienceSize],
                        ["First event", firstEventPlan],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-cream/10 bg-ink-soft px-4 py-3">
                          <p className="font-mono-label text-ash">{label}</p>
                          <p className="mt-1 text-sm text-cream">{value || <span className="text-ash">Not set</span>}</p>
                        </div>
                      ))}
                    </div>
                    <TurnstileWidget
                      siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                      onVerify={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken(null)}
                    />
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    className="btn-outline-editorial justify-center"
                    onClick={() => move(-1)}
                    disabled={step === 0 || verifying || transitioning}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  {step < steps.length - 1 ? (
                    <button
                      type="button"
                      className="btn-ember justify-center"
                      onClick={() => move(1)}
                      disabled={transitioning}
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ember justify-center"
                      onClick={submit}
                      disabled={loading || verifying || transitioning}
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Continue to account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; transform: scaleX(0.6); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes slideRail {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

const FieldSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div>
    <label className="mb-1.5 block font-mono-label text-cream-dim">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none focus:border-fezzy"
    >
      <option value="">Choose one</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default StartSelling;

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Loader2, MailCheck, Users } from "lucide-react";
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
      { title: "Organization", icon: Building2 },
      { title: "Events", icon: CalendarDays },
      { title: "Audience", icon: Users },
      { title: "Review", icon: MailCheck },
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
    orgType,
    eventCategory,
    eventFrequency,
    audienceSize,
    website: website.trim(),
    contactPhone: contactPhone.trim(),
    firstEventPlan,
  };

  const next = () => {
    if (!canContinue) {
      toast.error("Complete this step to continue.");
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async () => {
    const name = orgName.trim();
    if (!name) return;

    // Verify Turnstile token
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

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-1440 place-items-center px-5 py-12 lg:px-8">
          <div className="w-full max-w-3xl border border-cream/10 bg-ink-card p-7 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 border border-cream/20 px-3 py-1 font-mono-label text-fezzy">
                Organizer setup
              </span>
              <span className="font-mono-label text-ash">Step {step + 1} of {steps.length}</span>
            </div>
            <h1 className="mt-4 font-display text-4xl text-cream sm:text-5xl">
              Build your organizer profile
            </h1>
            <p className="mt-3 max-w-2xl text-cream-dim">
              Tell us how you plan to sell tickets on Fezzy. After this guided setup, you'll create your login and your details will be sent for review.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-4">
              {steps.map(({ title, icon: Icon }, index) => (
                <div key={title} className={`border px-3 py-3 ${index === step ? "border-fezzy bg-fezzy/10 text-cream" : index < step ? "border-lime/40 bg-lime/10 text-lime" : "border-cream/10 text-ash"}`}>
                  <div className="flex items-center gap-2">
                    {index < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    <span className="font-mono-label">{title}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 space-y-5">
              {step === 0 && (
                <div>
                  <label className="mb-1.5 block font-mono-label text-cream-dim">Organization name</label>
                  <input
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                    placeholder="e.g. Solstice Collective"
                    required
                    className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
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
                      onChange={(event) => setWebsite(event.target.value)}
                      placeholder="https://instagram.com/yourbrand"
                      className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
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
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+254 700 000 000"
                      className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
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
                        <p className="mt-1 text-sm text-cream">{value}</p>
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
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0 || verifying}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {step < steps.length - 1 ? (
                  <button type="button" className="btn-ember justify-center" onClick={next}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" className="btn-ember justify-center" onClick={submit} disabled={loading || verifying}>
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Continue to account
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const FieldSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => (
  <div>
    <label className="mb-1.5 block font-mono-label text-cream-dim">{label}</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy"
    >
      <option value="">Choose one</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

export default StartSelling;

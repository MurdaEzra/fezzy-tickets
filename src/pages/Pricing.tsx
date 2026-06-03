import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tiers = [
  {
    name: "Starter",
    headline: "First event on us",
    price: { amount: "0%", suffix: "on your first event" },
    ctaLabel: "Start free",
    accent: false,
    features: [
      "First event — zero platform fee",
      "Free to list unlimited events",
      "Buyers pay zero service fees — ever",
      "M-Pesa, card & wallet payments",
      "QR-code mobile tickets, emailed instantly",
      "Door scanning + check-in app",
    ],
  },
  {
    name: "Pro",
    headline: "After your first event",
    price: { amount: "5%", suffix: "deducted from your payout" },
    ctaLabel: "Create an event",
    accent: true,
    badge: "Most popular",
    features: [
      "Everything in Starter",
      "Buyers see no fees — you cover the 5%",
      "Customisable ticket design + poster studio",
      "Live event map (OpenStreetMap)",
      "SMS announcements + promo codes",
      "Multi-staff accounts & roles",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    headline: "Stadiums & festivals",
    price: { amount: "Custom", suffix: "volume pricing" },
    ctaLabel: "Contact us",
    accent: false,
    features: [
      "Everything in Pro",
      "Negotiated platform fee",
      "Dedicated account manager",
      "API & widget embeds",
      "On-site staffing partnerships",
      "SLA & 24/7 support",
    ],
  },
];

const faqs = [
  { q: "Is the first event really free?", a: "Yes — your very first published event has a 0% platform fee. From your second event onward, your platform fee is locked at 5% per ticket sold (paid by you, not the buyer)." },
  { q: "Do buyers pay any fees?", a: "Never. Buyers pay exactly the ticket price you set — no service fees, no hidden charges. The platform fee is taken from your share at the moment of payment." },
  { q: "How fast do I get paid?", a: "Instantly. Every successful payment is split right then and there — your share lands in your bank, the platform fee comes to us. No withdrawals, no holding period." },
  { q: "Which payment methods do attendees have?", a: "M-Pesa, all major cards, and Apple Pay — all processed securely through Paystack on the checkout page." },
  { q: "Which countries do you support?", a: "We're built in Kenya and serve organizers worldwide. M-Pesa and KES are first-class; card payments work globally." },
  { q: "Can I refund attendees?", a: "Yes — set your own refund window per event. We process refunds via Paystack." },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingTier, setPendingTier] = useState<string | null>(null);

  const handleSelectPlan = async (planName: string) => {
    const orgName = sessionStorage.getItem("pendingOrgName") || "";
    sessionStorage.setItem("pendingPlan", planName);

    // Not signed in → send to signup; org name and plan will be picked up on Auth.
    if (!user) {
      navigate(`/auth?mode=signup&plan=${encodeURIComponent(planName)}&redirect=/dashboard`);
      return;
    }

    setPendingTier(planName);
    try {
      // Persist plan on user metadata
      await supabase.auth.updateUser({
        data: { plan: planName, ...(orgName ? { org_name: orgName } : {}) },
      });

      // Ensure organizer profile exists
      const { data: existing } = await supabase
        .from("organizer_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const finalName =
          orgName ||
          (user.user_metadata?.org_name as string) ||
          (user.user_metadata?.full_name as string) ||
          user.email?.split("@")[0] ||
          "My organization";
        const { error } = await supabase
          .from("organizer_profiles")
          .insert({ user_id: user.id, org_name: finalName, contact_email: user.email });
        if (error) throw error;
      }

      sessionStorage.removeItem("pendingOrgName");
      sessionStorage.removeItem("pendingPlan");
      toast.success(`${planName} plan selected`, { description: "Welcome to your organizer dashboard." });
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Could not set up organizer profile", { description: msg });
    } finally {
      setPendingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="border-b border-border bg-mesh">
          <div className="container-px mx-auto max-w-7xl py-16 text-center md:py-24">
            <p className="eyebrow mb-3">Pricing</p>
            <h1 className="display mx-auto max-w-3xl text-5xl text-foreground sm:text-6xl md:text-7xl">
              Simple. Transparent.<br />
              <span className="script font-normal text-primary text-[1.2em]">Fair</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Free to list. Pay only when you sell. No setup fees, no monthly minimums, no surprises.
            </p>
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl py-16 md:py-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-[2rem] border p-7 shadow-card-soft transition-all hover:-translate-y-1 md:p-8 ${
                  t.accent ? "border-foreground bg-foreground text-background" : "border-border bg-card"
                }`}
              >
                {t.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-sun">
                    {t.badge}
                  </span>
                )}
                <p className={`text-sm font-semibold ${t.accent ? "text-background/70" : "text-muted-foreground"}`}>{t.headline}</p>
                <h3 className={`font-display mt-1 text-2xl font-bold ${t.accent ? "text-background" : "text-foreground"}`}>{t.name}</h3>
                <div className="mt-5 flex items-baseline gap-2">
                  <p className={`font-display text-5xl font-bold ${t.accent ? "text-background" : "text-foreground"}`}>{t.price.amount}</p>
                </div>
                <p className={`mt-1 text-sm ${t.accent ? "text-background/70" : "text-muted-foreground"}`}>{t.price.suffix}</p>

                <ul className="mt-7 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${t.accent ? "text-background" : "text-foreground"}`}>
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${t.accent ? "text-accent" : "text-primary"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={t.accent ? "sun" : "acacia"}
                  size="lg"
                  className="mt-8 w-full"
                  onClick={() => handleSelectPlan(t.name)}
                  disabled={pendingTier !== null}
                >
                  {pendingTier === t.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t.ctaLabel} <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            ))}
          </div>
        </section>


        {/* FAQ */}
        <section className="border-t border-border bg-cream-deep">
          <div className="container-px mx-auto max-w-3xl py-20 md:py-28">
            <p className="eyebrow mb-3 text-center">Questions</p>
            <h2 className="display text-center text-4xl text-foreground sm:text-5xl">
              Good to <span className="script font-normal text-primary text-[1.2em]">know</span>
            </h2>
            <div className="mt-12 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-border bg-card p-5 shadow-card-soft">
                  <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground">
                    {f.q}
                    <span className="ml-4 text-2xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;

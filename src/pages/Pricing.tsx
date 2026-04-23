import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    headline: "For first-timers",
    price: { amount: "5%", suffix: "+ KES 30 / ticket" },
    cta: { label: "Start free", to: "/start-selling" },
    accent: false,
    features: [
      "Free to list events",
      "Unlimited free events",
      "M-Pesa, card & wallet payments",
      "QR-code mobile tickets",
      "Door scanning app",
      "Email support",
    ],
  },
  {
    name: "Pro",
    headline: "For serious organizers",
    price: { amount: "3.5%", suffix: "+ KES 20 / ticket" },
    cta: { label: "Talk to sales", to: "/start-selling" },
    accent: true,
    badge: "Most popular",
    features: [
      "Everything in Starter",
      "Lower per-ticket fee",
      "SMS announcements",
      "Custom event URLs & branding",
      "Multi-staff accounts & roles",
      "Promo codes & waitlists",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    headline: "Stadiums & festivals",
    price: { amount: "Custom", suffix: "volume pricing" },
    cta: { label: "Contact us", to: "/start-selling" },
    accent: false,
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "Custom payout schedule",
      "API & widget embeds",
      "On-site staffing partnerships",
      "SLA & 24/7 support",
    ],
  },
];

const faqs = [
  { q: "Are free events really free?", a: "Yes. If you sell zero-cost tickets, you pay zero fees. We only earn when you do." },
  { q: "What does the buyer pay?", a: "The buyer pays the ticket price plus the platform fee. You set your own ticket price; we're transparent at checkout." },
  { q: "How fast do I get paid?", a: "Payouts land 2 business days after your event ends, via M-Pesa, bank transfer or international wire." },
  { q: "Which countries do you support?", a: "We're built in Kenya and serve organizers worldwide. Multi-currency is supported, with M-Pesa for Kenya and card payments globally." },
  { q: "Can I refund attendees?", a: "Absolutely. Set your own refund window per event. We handle full or partial refunds in one click." },
];

const Pricing = () => {
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
                  asChild
                >
                  <Link to={t.cta.to}>{t.cta.label} <ArrowRight className="h-4 w-4" /></Link>
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

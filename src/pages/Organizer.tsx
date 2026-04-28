import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CreditCard, QrCode, Megaphone, Users, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import organizer from "@/assets/scene-organizer.jpg";

const features = [
  { icon: Zap, title: "Launch in minutes", body: "A guided event wizard — title to tickets to publish in five steps. No code." },
  { icon: CreditCard, title: "Get paid your way", body: "M-Pesa, bank, Stripe, Wise. Multi-currency. T+2 payouts after the event." },
  { icon: QrCode, title: "Door-ready check-in", body: "Mobile check-in app with offline mode. Scan, search, sync. Real-time stats." },
  { icon: BarChart3, title: "Sales dashboard", body: "Tickets sold, revenue, conversion, traffic — live. Export anytime." },
  { icon: Megaphone, title: "Talk to your fans", body: "Bulk email and SMS to ticket holders. Promo codes, early access, waitlists." },
  { icon: Users, title: "Built for teams", body: "Invite collaborators with roles. Door staff, marketers, finance — all sorted." },
];

const Organizer = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden bg-mesh">
          <div className="container-px mx-auto grid max-w-7xl gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:py-24">
            <div className="animate-fade-up">
              <span className="chip">For organizers</span>
              <h1 className="display mt-5 text-5xl text-foreground sm:text-6xl md:text-7xl">
                Run the event.<br />
                We'll run the{" "}
                <span className="script font-normal text-primary text-[1.2em]">tickets</span>.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                From a 60-seat poetry night to a 30,000-strong stadium show Fezzy gives you
                a beautiful storefront, fast check-in, and money in your account on time.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="acacia" size="lg" asChild>
                  <Link to="/start-selling">Start selling free <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/pricing">See pricing</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">No setup fees · Cancel anytime · Free for free events</p>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-[2rem] border border-border shadow-soft">
                <img src={"https://res.cloudinary.com/dgfmhyebp/image/upload/v1777186589/platform_kcb0sg.png"} alt="Event organizer using Fezzy dashboard" loading="lazy" width={1280} height={960} className="h-full w-full object-cover" />
              </div>
              <div className="absolute -right-4 top-8 hidden rounded-2xl border border-border bg-card p-4 shadow-soft md:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">412 tickets</p>
                <p className="text-xs text-primary font-semibold">+18% vs yesterday</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
          <div className="mb-12 max-w-2xl">
            <p className="eyebrow mb-3">Everything you need</p>
            <h2 className="display text-4xl text-foreground sm:text-5xl">
              The full <span className="script font-normal text-primary text-[1.2em]">toolkit</span>
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-3xl border border-border bg-card p-6 shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats banner */}
        <section className="border-y border-border bg-cream-deep">
          <div className="container-px mx-auto max-w-7xl py-16">
            <div className="grid gap-8 md:grid-cols-4">
              {[
                { k: "1.2M+", v: "Tickets processed" },
                { k: "KES 480M", v: "Paid to organizers" },
                { k: "97%", v: "Day-of check-in rate" },
                { k: "T+2", v: "Average payout" },
              ].map((s) => (
                <div key={s.v}>
                  <p className="font-display text-4xl font-bold text-foreground">{s.k}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
          <div className="rounded-[2rem] bg-gradient-acacia p-10 text-center text-primary-foreground shadow-acacia md:p-16">
            <h2 className="display text-4xl sm:text-5xl">
              Your next sold-out night<br />starts <span className="script font-normal text-[1.2em] text-accent">here</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base text-primary-foreground/85">
              Join hundreds of organizers across Kenya, Nigeria, Rwanda and beyond.
            </p>
            <Button variant="hero" size="xl" className="mt-8" asChild>
              <Link to="/start-selling">Start selling free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Organizer;

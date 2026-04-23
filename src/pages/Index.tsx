import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import EventCard from "@/components/EventCard";
import { events, categories } from "@/data/events";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";

const Index = () => {
  const featured = events.filter((e) => e.featured);
  const trending = events.filter((e) => e.trending);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />

        {/* Categories marquee strip */}
        <section className="border-y border-border/60 bg-navy-deep py-5">
          <div className="container-px mx-auto max-w-7xl">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <span className="eyebrow">Browse by</span>
              {categories.map((c) => (
                <Link
                  key={c.name}
                  to={`/events?cat=${encodeURIComponent(c.name)}`}
                  className="group flex items-baseline gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary">
                    {c.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured */}
        <section className="container-px mx-auto max-w-7xl py-24 md:py-32">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">Editor's pick</p>
              <h2 className="display text-4xl font-medium text-foreground sm:text-5xl md:text-6xl">
                Featured this season
              </h2>
            </div>
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/events">
                View all events <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>

        {/* Editorial promo strip */}
        <section className="relative overflow-hidden border-y border-border/60 bg-navy">
          <div className="container-px mx-auto grid max-w-7xl gap-12 py-24 md:grid-cols-2 md:py-32">
            <div className="animate-fade-up">
              <p className="eyebrow mb-4">For organizers</p>
              <h2 className="display text-4xl font-medium text-foreground sm:text-5xl md:text-6xl">
                Sell tickets like the
                <span className="italic text-primary"> cover story</span>.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Launch in minutes. Tier your pricing, scan tickets at the door,
                and pay out anywhere — from M-Pesa to a US bank, in one
                dashboard.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/organizer">Start selling <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="glass" size="lg">See pricing</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 self-center">
              {[
                { k: "5%", v: "Flat platform fee" },
                { k: "T+2", v: "Payouts after event" },
                { k: "32", v: "Currencies supported" },
                { k: "0", v: "Setup fees, ever" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur-sm transition-colors hover:border-primary/40"
                >
                  <p className="font-display text-4xl font-medium text-foreground">{s.k}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending */}
        <section className="container-px mx-auto max-w-7xl py-24 md:py-32">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-4">On the rise</p>
              <h2 className="display text-4xl font-medium text-foreground sm:text-5xl md:text-6xl">
                Trending now
              </h2>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

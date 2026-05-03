import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import EventCard from "@/components/EventCard";
import { events, categories } from "@/data/events";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import organizerImg from "@/assets/scene-organizer.jpg";

const Row = ({
  eyebrow, title, items, href = "/events",
}: { eyebrow: string; title: string; items: typeof events; href?: string }) => (
  <section className="container-px mx-auto max-w-7xl py-10 md:py-14">
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="display text-2xl text-foreground sm:text-3xl md:text-4xl">{title}</h2>
      </div>
      <Button variant="ghost" size="sm" asChild className="gap-1 text-primary hover:text-primary">
        <Link to={href}>View all <ChevronRight className="h-4 w-4" /></Link>
      </Button>
    </div>
    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.slice(0, 4).map((e, i) => (
        <EventCard key={e.id} event={e} index={i} />
      ))}
    </div>
  </section>
);

const Index = () => {
  const upcoming = [...events].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const trending = events.filter((e) => e.trending);
  const featured = events.filter((e) => e.featured);
  const thisWeekend = upcoming.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />

        {/* Categories strip */}
        <section className="border-y border-border bg-card">
          <div className="container-px mx-auto max-w-7xl overflow-x-auto py-5">
            <div className="flex items-center gap-2 md:gap-3">
              <Link
                to="/events"
                className="flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background"
              >
                All Events
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.name}
                  to={`/events?cat=${c.name}`}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <span>{c.emoji}</span> {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <Row eyebrow="On stage soon" title="Upcoming Events" items={upcoming} />
        <Row eyebrow="Burning up the charts" title="Trending Now" items={trending} />
        <Row eyebrow="Don't miss" title="This Weekend" items={thisWeekend} />
        <Row eyebrow="Editor's pick" title="Featured" items={featured} />

        {/* Organizer promo */}
        <section className="relative overflow-hidden border-y border-border bg-cream-deep">
          <div className="container-px mx-auto grid max-w-7xl gap-12 py-16 md:grid-cols-2 md:py-24 md:items-center">
            <div className="animate-fade-up">
              <p className="eyebrow mb-3">For organizers</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl">
                Sell tickets like a <span className="script font-normal text-primary text-[1.2em]">pro</span>.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                Launch in minutes. Tier your pricing, scan tickets at the door, and get paid via M-Pesa or bank — all from one dashboard.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button variant="acacia" size="lg" asChild className="rounded-full">
                  <Link to="/organizer">Sell Your Event <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="rounded-full">
                  <Link to="/pricing">See pricing</Link>
                </Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  { k: "1st", v: "event free" },
                  { k: "T+2", v: "M-Pesa payouts" },
                  { k: "5%", v: "fee, paid by organizer" },
                ].map((s) => (
                  <div key={s.v}>
                    <p className="font-display text-2xl font-bold text-foreground">{s.k}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-[2rem] border border-border shadow-soft">
                <img src={organizerImg} alt="Event organizer" loading="lazy" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

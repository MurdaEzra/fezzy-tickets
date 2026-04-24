import { Link } from "react-router-dom";
import { ArrowRight, Quote, Star } from "lucide-react";
import EventCard from "@/components/EventCard";
import { events, categories } from "@/data/events";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/HeroSlideshow";
import organizerImg from "@/assets/scene-organizer.jpg";

const Index = () => {
  const featured = events.filter((e) => e.featured);
  const trending = events.filter((e) => e.trending);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />

        {/* Categories chips */}
        <section className="border-y border-border bg-card">
          <div className="container-px mx-auto max-w-7xl py-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-2">Browse</span>
              {categories.map((c) => (
                <Link
                  key={c.name}
                  to={`/events?cat=${encodeURIComponent(c.name)}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-foreground hover:text-background"
                >
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured */}
        <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-3">Editor's pick</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
                Featured this <span className="script font-normal text-primary text-[1.2em]">season</span>
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

        {/* Organizer promo */}
        <section className="relative overflow-hidden border-y border-border bg-cream-deep">
          <div className="container-px mx-auto grid max-w-7xl gap-12 py-20 md:grid-cols-2 md:py-28 md:items-center">
            <div className="animate-fade-up">
              <p className="eyebrow mb-3">For organizers</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
                Sell tickets like a{" "}
                <span className="script font-normal text-primary text-[1.2em]">pro</span>.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Launch in minutes. Tier your pricing, scan tickets at the door, get paid out
                via M-Pesa, bank transfer or international wire — all in one dashboard.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="acacia" size="lg" asChild>
                  <Link to="/start-selling">Start selling <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/pricing">See pricing</Link>
                </Button>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  { k: "1st", v: "event free" },
                  { k: "T+2", v: "M-Pesa payouts" },
                  { k: "5%", v: "fee — paid by you, not buyers" },
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
                <img src={organizerImg} alt="Event organizer" loading="lazy" width={1280} height={960} className="h-full w-full object-cover" />
              </div>
              <div className="absolute -left-4 bottom-6 hidden rounded-2xl bg-card border border-border p-4 shadow-soft md:block">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-acacia font-bold text-primary-foreground">JM</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">+KES 1.2M</p>
                    <p className="text-[11px] text-muted-foreground">Sold this week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trending */}
        <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-3">On the rise</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
                Trending <span className="script font-normal text-primary text-[1.2em]">now</span>
              </h2>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-border bg-cream-deep">
          <div className="container-px mx-auto max-w-7xl py-20 md:py-28">
            <div className="mb-12 max-w-2xl">
              <p className="eyebrow mb-3">Loved across the continent</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl">
                What people are <span className="script font-normal text-primary text-[1.2em]">saying</span>
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                { name: "Wanjiku M.", role: "Attendee · Nairobi", body: "Bought my Sol Fest pass on M-Pesa in under 30 seconds. The QR ticket loaded even with bad reception at the gate.", rating: 5 },
                { name: "Kelvin O.", role: "Organizer · Kisumu", body: "Switched from spreadsheets to Fezzy. We tripled ticket sales and the payout hit our bank in two days.", rating: 5 },
                { name: "Amina H.", role: "Attendee · Mombasa", body: "Beautiful app, real events, no scams. I trust nothing else for live shows now.", rating: 5 },
              ].map((t) => (
                <figure key={t.name} className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                  <Quote className="h-6 w-6 text-primary" />
                  <blockquote className="mt-4 text-base leading-relaxed text-foreground">"{t.body}"</blockquote>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <figcaption>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </figcaption>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                      ))}
                    </div>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

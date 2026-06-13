import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Quote, Star } from "lucide-react";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/HeroSlideshow";
import organizerImg from "@/assets/scene-organizer.jpg";
import {
  fetchPublishedEventsWithTiers,
  type DbEventWithTiers,
} from "@/lib/eventsApi";

const Index = () => {
  const [events, setEvents] = useState<DbEventWithTiers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedEventsWithTiers({ limit: 6 })
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => events.slice(0, 3), [events]);
  const nextUp = useMemo(() => events.slice(3, 6), [events]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />

        <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-3">Upcoming</p>
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

          {loading ? (
            <div className="grid min-h-48 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : featured.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <p className="font-display text-2xl text-foreground">No published events yet</p>
              <Button variant="acacia" className="mt-6" asChild>
                <Link to="/start-selling">Create an event</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden border-y border-border bg-cream-deep">
          <div className="container-px mx-auto grid max-w-7xl gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
            <div className="animate-fade-up">
              <p className="eyebrow mb-3">For organizers</p>
              <h2 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
                Sell tickets like a{" "}
                <span className="script font-normal text-primary text-[1.2em]">pro</span>.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Launch in minutes. Tier your pricing, scan tickets at the door, and let buyers
                cover the 3.5% service fee at checkout.
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
                  { k: "3.5%", v: "buyer service fee" },
                ].map((stat) => (
                  <div key={stat.v}>
                    <p className="font-display text-2xl font-bold text-foreground">{stat.k}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{stat.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-[2rem] border border-border shadow-soft">
                <img src={organizerImg} alt="Event organizer" loading="lazy" width={1280} height={960} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>

        {nextUp.length > 0 && (
          <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
            <div className="mb-12 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow mb-3">Next up</p>
                <h2 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
                  More live <span className="script font-normal text-primary text-[1.2em]">events</span>
                </h2>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {nextUp.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          </section>
        )}

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
                { name: "Wanjiku M.", role: "Attendee, Nairobi", body: "Bought my pass on M-Pesa in under 30 seconds. The QR ticket loaded even with bad reception at the gate.", rating: 5 },
                { name: "Kelvin O.", role: "Organizer, Kisumu", body: "Switched from spreadsheets to Fezzy. We tripled ticket sales and the payout hit our bank in two days.", rating: 5 },
                { name: "Amina H.", role: "Attendee, Mombasa", body: "Beautiful app, real events, no scams. I trust nothing else for live shows now.", rating: 5 },
              ].map((testimonial) => (
                <figure key={testimonial.name} className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                  <Quote className="h-6 w-6 text-primary" />
                  <blockquote className="mt-4 text-base leading-relaxed text-foreground">"{testimonial.body}"</blockquote>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <figcaption>
                      <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </figcaption>
                    <div className="flex gap-0.5">
                      {Array.from({ length: testimonial.rating }).map((_, index) => (
                        <Star key={index} className="h-3.5 w-3.5 fill-accent text-accent" />
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

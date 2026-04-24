import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Share2, Heart, Check, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { events, formatDateLong, formatPrice, formatTime } from "@/data/events";

const EventDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const event = events.find((e) => e.slug === slug);
  const [selectedTier, setSelectedTier] = useState(0);
  const [qty, setQty] = useState(1);

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <p className="eyebrow mb-4">404</p>
          <h1 className="display text-5xl text-foreground">Event not found</h1>
          <p className="mt-4 text-muted-foreground">The event you're looking for has moved.</p>
          <Button variant="acacia" size="lg" className="mt-8" asChild>
            <Link to="/events">Browse all events</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const tier = event.tiers[selectedTier];
  const subtotal = tier.price * qty;
  // Platform fee is paid by the organizer — buyers see no service fee.
  const total = subtotal;
  const related = events.filter((e) => e.id !== event.id && e.category === event.category).slice(0, 3);

  const goCheckout = () => {
    navigate(`/events/${event.slug}/checkout?tier=${selectedTier}&qty=${qty}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10">
            <img src={event.image} alt="" aria-hidden className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero-overlay)" }} />
          </div>
          <div className="container-px mx-auto max-w-7xl pb-20 pt-12 md:pb-28 md:pt-16">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 text-sm text-white/90 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to browse
            </Link>
            <div className="mt-10 max-w-3xl animate-fade-up">
              <div className="mb-5 flex items-center gap-2">
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                  {event.category}
                </span>
                {event.trending && (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    🔥 Trending
                  </span>
                )}
              </div>
              <h1 className="display text-5xl text-white sm:text-6xl md:text-7xl">{event.title}</h1>
              <p className="script mt-3 text-3xl text-white/90 md:text-4xl">{event.tagline}</p>

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  {formatDateLong(event.date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  {formatTime(event.date)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  {event.venue} · {event.city}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="container-px mx-auto grid max-w-7xl gap-12 py-16 lg:grid-cols-[1fr_420px] lg:py-20">
          <div className="space-y-14">
            <div>
              <p className="eyebrow mb-4">About</p>
              <p className="text-lg leading-relaxed text-foreground/90">{event.description}</p>
            </div>

            {event.lineup && (
              <div>
                <p className="eyebrow mb-4">Lineup</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {event.lineup.map((a) => (
                    <li
                      key={a}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-acacia font-bold text-primary-foreground">
                        {a.charAt(0)}
                      </span>
                      <span className="font-semibold text-foreground">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="eyebrow mb-4">Venue</p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-[16/7] bg-cream-deep grain relative">
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <MapPin className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-3 font-display text-2xl font-bold">{event.venue}</p>
                      <p className="text-sm text-muted-foreground">{event.city}, {event.country}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-4">Organizer</p>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-acacia font-display text-lg font-bold text-primary-foreground">
                    {event.organizer.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{event.organizer.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-primary" /> {event.organizer.tag} organizer
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Follow</Button>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Tickets</p>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Save"><Heart className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Share"><Share2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                {event.tiers.map((t, i) => {
                  const active = i === selectedTier;
                  return (
                    <button
                      key={t.name}
                      onClick={() => { setSelectedTier(i); setQty(1); }}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        active
                          ? "border-primary bg-primary/[0.06]"
                          : "border-border bg-background hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-lg font-bold text-foreground">{t.name}</p>
                        <p className="font-bold text-foreground">{formatPrice(t.price, event.currency)}</p>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {t.perks.map((p) => (
                          <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-primary" /> {p}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                        {t.remaining} remaining
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                <span className="text-sm font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
                  >−</button>
                  <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(tier.remaining, q + 1))}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
                  >+</button>
                </div>
              </div>

              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd className="text-foreground font-medium">{formatPrice(subtotal, event.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <dt className="font-semibold text-foreground">You pay</dt>
                  <dd className="font-display text-xl font-bold text-foreground">{formatPrice(total, event.currency)}</dd>
                </div>
                <p className="rounded-xl bg-primary/10 p-2.5 text-[11px] leading-snug text-primary">
                  No buyer fees — the organizer covers the platform fee.
                </p>
              </dl>

              <Button variant="acacia" size="lg" className="mt-6 w-full" onClick={goCheckout}>
                Get tickets
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                M-Pesa · Card · Apple Pay · Instant delivery
              </p>
            </div>
          </aside>
        </section>

        {related.length > 0 && (
          <section className="border-t border-border bg-cream-deep">
            <div className="container-px mx-auto max-w-7xl py-20">
              <p className="eyebrow mb-3">More like this</p>
              <h2 className="display mb-12 text-4xl text-foreground sm:text-5xl">
                You might also <span className="script font-normal text-primary text-[1.2em]">love</span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default EventDetail;

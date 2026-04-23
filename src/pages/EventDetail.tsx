import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Share2, Heart, Check, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { events, formatDateLong, formatPrice, formatTime } from "@/data/events";

const EventDetail = () => {
  const { slug } = useParams();
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
          <p className="mt-4 text-muted-foreground">The event you’re looking for has moved or is no longer available.</p>
          <Button variant="hero" size="lg" className="mt-8" asChild>
            <Link to="/events">Browse all events</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const tier = event.tiers[selectedTier];
  const subtotal = tier.price * qty;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;
  const related = events.filter((e) => e.id !== event.id && e.category === event.category).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 -z-10">
            <img src={event.image} alt="" aria-hidden className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero-overlay)" }} />
          </div>
          <div className="container-px mx-auto max-w-7xl pb-16 pt-12 md:pb-24 md:pt-16">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to browse
            </Link>
            <div className="mt-10 max-w-3xl animate-fade-up">
              <div className="mb-5 flex items-center gap-2">
                <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider backdrop-blur-md">
                  {event.category}
                </span>
                {event.trending && (
                  <span className="rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    Trending
                  </span>
                )}
              </div>
              <h1 className="display text-5xl font-medium text-foreground sm:text-6xl md:text-7xl">
                {event.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg italic text-muted-foreground">{event.tagline}</p>

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatDateLong(event.date)}
                </span>
                <span className="flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  {formatTime(event.date)}
                </span>
                <span className="flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {event.venue} · {event.city}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="container-px mx-auto grid max-w-7xl gap-12 py-16 lg:grid-cols-[1fr_420px] lg:py-24">
          {/* Left content */}
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
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-display text-sm text-primary">
                        {a.charAt(0)}
                      </span>
                      <span className="font-medium text-foreground">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="eyebrow mb-4">Venue</p>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="aspect-[16/7] bg-navy-deep grain relative">
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <MapPin className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-3 font-display text-2xl">{event.venue}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.city}, {event.country}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-4">Organizer</p>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-amber font-display text-lg text-primary-foreground">
                    {event.organizer.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{event.organizer.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-primary" /> {event.organizer.tag} organizer
                    </p>
                  </div>
                </div>
                <Button variant="glass" size="sm">Follow</Button>
              </div>
            </div>
          </div>

          {/* Right: ticket selector */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft">
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
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-300 ${
                        active
                          ? "border-primary bg-primary/[0.06] shadow-amber"
                          : "border-border bg-background/40 hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-lg font-medium text-foreground">{t.name}</p>
                        <p className="font-medium text-foreground">{formatPrice(t.price, event.currency)}</p>
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

              {/* Qty + total */}
              <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
                <span className="text-sm text-muted-foreground">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
                  >−</button>
                  <span className="w-6 text-center font-medium tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(tier.remaining, q + 1))}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
                  >+</button>
                </div>
              </div>

              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd className="text-foreground">{formatPrice(subtotal, event.currency)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Service fee (5%)</dt>
                  <dd className="text-foreground">{formatPrice(fee, event.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-3">
                  <dt className="text-foreground">Total</dt>
                  <dd className="font-display text-xl text-foreground">{formatPrice(total, event.currency)}</dd>
                </div>
              </dl>

              <Button variant="hero" size="lg" className="mt-6 w-full">
                Continue to checkout
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Secure checkout · Mobile tickets · Instant delivery
              </p>
            </div>
          </aside>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="border-t border-border/60 bg-navy-deep">
            <div className="container-px mx-auto max-w-7xl py-20 md:py-28">
              <p className="eyebrow mb-4">More like this</p>
              <h2 className="display mb-12 text-4xl font-medium text-foreground sm:text-5xl">
                You might also love
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

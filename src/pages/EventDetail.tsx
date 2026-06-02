import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Check, Clock, Heart, Loader2, MapPin, Share2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import {
  fetchEventBySlug,
  fetchOrganizerProfile,
  fetchRelatedEvents,
  fetchTiers,
  formatEventDateLong,
  formatEventTime,
  formatPrice,
  ticketsRemaining,
  type DbEvent,
  type DbEventWithTiers,
  type DbOrganizer,
  type DbTier,
} from "@/lib/eventsApi";

const EventDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<DbEvent | null>(null);
  const [tiers, setTiers] = useState<DbTier[]>([]);
  const [organizer, setOrganizer] = useState<DbOrganizer | null>(null);
  const [related, setRelated] = useState<DbEventWithTiers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const dbEvent = await fetchEventBySlug(slug);
        if (!dbEvent) {
          if (!cancelled) {
            setEvent(null);
            setTiers([]);
          }
          return;
        }
        const [dbTiers, dbOrganizer, dbRelated] = await Promise.all([
          fetchTiers(dbEvent.id),
          fetchOrganizerProfile(dbEvent.organizer_id),
          fetchRelatedEvents(dbEvent.category, dbEvent.id),
        ]);
        if (!cancelled) {
          setEvent(dbEvent);
          setTiers(dbTiers);
          setOrganizer(dbOrganizer);
          setRelated(dbRelated);
          setSelectedTier(0);
          setQty(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const tier = tiers[selectedTier];
  const remaining = tier ? ticketsRemaining(tier) : 0;
  const subtotal = tier ? tier.price_kes * qty : 0;
  const total = subtotal;
  const goCheckout = () => {
    if (!event || !tier || remaining < 1) return;
    navigate(`/events/${event.slug}/checkout?tier=${selectedTier}&qty=${qty}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <p className="eyebrow mb-4">404</p>
          <h1 className="display text-5xl text-foreground">Event not found</h1>
          <p className="mt-4 text-muted-foreground">The event you're looking for has moved or is not published.</p>
          <Button variant="acacia" size="lg" className="mt-8" asChild>
            <Link to="/events">Browse all events</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10">
            {event.cover_image_url ? (
              <img src={event.cover_image_url} alt="" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-cream-deep" />
            )}
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
              {event.category && (
                <div className="mb-5 flex items-center gap-2">
                  <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                    {event.category}
                  </span>
                </div>
              )}
              <h1 className="display text-5xl text-white sm:text-6xl md:text-7xl">{event.title}</h1>
              {event.tagline && <p className="script mt-3 text-3xl text-white/90 md:text-4xl">{event.tagline}</p>}

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  {formatEventDateLong(event.starts_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  {formatEventTime(event.starts_at)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  {event.venue_name ?? "Venue TBA"} {event.city ? `- ${event.city}` : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="container-px mx-auto grid max-w-7xl gap-12 py-16 lg:grid-cols-[1fr_420px] lg:py-20">
          <div className="space-y-14">
            <div>
              <p className="eyebrow mb-4">About</p>
              <p className="text-lg leading-relaxed text-foreground/90">
                {event.description || "Event details will be added by the organizer soon."}
              </p>
            </div>

            <div>
              <p className="eyebrow mb-4">Venue</p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-[16/7] bg-cream-deep">
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <MapPin className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-3 font-display text-2xl font-bold">{event.venue_name ?? "Venue TBA"}</p>
                      <p className="text-sm text-muted-foreground">
                        {[event.city, event.country].filter(Boolean).join(", ") || "Location TBA"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-4">Organizer</p>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  {organizer?.logo_url ? (
                    <img src={organizer.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-acacia font-display text-lg font-bold text-primary-foreground">
                      {(organizer?.org_name ?? "O").charAt(0)}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{organizer?.org_name ?? "Organizer"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-primary" /> Verified organizer
                    </p>
                  </div>
                </div>
                {organizer?.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={organizer.website} target="_blank" rel="noreferrer">Website</a>
                  </Button>
                )}
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

              {tiers.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                  Tickets are not on sale yet.
                </div>
              ) : (
                <>
                  <div className="mt-5 space-y-2.5">
                    {tiers.map((ticketTier, index) => {
                      const active = index === selectedTier;
                      const tierRemaining = ticketsRemaining(ticketTier);
                      return (
                        <button
                          key={ticketTier.id}
                          onClick={() => { setSelectedTier(index); setQty(1); }}
                          disabled={tierRemaining < 1}
                          className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? "border-primary bg-primary/[0.06]"
                              : "border-border bg-background hover:border-foreground/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-display text-lg font-bold text-foreground">{ticketTier.name}</p>
                            <p className="font-bold text-foreground">{formatPrice(ticketTier.price_kes)}</p>
                          </div>
                          {ticketTier.description && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                              <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" /> {ticketTier.description}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                            {tierRemaining} remaining
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                    <span className="text-sm font-medium text-foreground">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQty((current) => Math.max(1, current - 1))}
                        className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
                      >-</button>
                      <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                      <button
                        onClick={() => setQty((current) => Math.min(remaining, current + 1))}
                        disabled={remaining < 1}
                        className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >+</button>
                    </div>
                  </div>

                  <dl className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Subtotal</dt>
                      <dd className="font-medium text-foreground">{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <dt className="font-semibold text-foreground">You pay</dt>
                      <dd className="font-display text-xl font-bold text-foreground">{formatPrice(total)}</dd>
                    </div>
                    <p className="rounded-xl bg-primary/10 p-2.5 text-[11px] leading-snug text-primary">
                      No buyer fees. The organizer covers the platform fee.
                    </p>
                  </dl>

                  <Button variant="acacia" size="lg" className="mt-6 w-full" onClick={goCheckout} disabled={!tier || remaining < 1}>
                    Get tickets
                  </Button>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    M-Pesa checkout. Instant delivery after payment confirmation.
                  </p>
                </>
              )}
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
                {related.map((relatedEvent, index) => (
                  <EventCard key={relatedEvent.id} event={relatedEvent} index={index} />
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

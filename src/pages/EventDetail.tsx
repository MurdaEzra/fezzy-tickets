import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, Check, Circle, Clock, Loader2, MapPin, Share2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { useEventDetail, useEventTiers, useOrganizerProfile, useRelatedEvents } from "@/hooks/useEvents";
import {
  formatEventDateLong,
  formatEventTime,
  formatPrice,
  ticketsRemaining,
} from "@/lib/eventsApi";
import { BUYER_FEE_LABEL, BUYER_FEE_PCT, calculateBuyerFee, calculateBuyerTotal, isEventDue } from "@/lib/pricing";
import { toast } from "sonner";

const EventDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading: eventLoading } = useEventDetail(slug);
  const { data: tiers = [], isLoading: tiersLoading } = useEventTiers(event?.id);
  const { data: organizer } = useOrganizerProfile(event?.organizer_id);
  const { data: related = [] } = useRelatedEvents(event?.category, event?.id);
  const [selectedTier, setSelectedTier] = useState(0);
  const [qty, setQty] = useState(1);

  const loading = eventLoading || tiersLoading;

  const tier = tiers[selectedTier];
  const remaining = tier ? ticketsRemaining(tier) : 0;
  const subtotal = tier ? tier.price_kes * qty : 0;
  const buyerFee = calculateBuyerFee(subtotal);
  const total = calculateBuyerTotal(subtotal);
  const salesClosed = event ? isEventDue(event.starts_at) : false;
  const lineup = Array.isArray(event?.lineup) ? event.lineup.filter(Boolean) : [];
  const lineupLabel = event?.category && ["Conference", "Tech", "Workshop", "Workshops"].includes(event.category) ? "Speakers" : "Artists";
  const goCheckout = () => {
    if (!event || !tier || remaining < 1 || salesClosed) return;
    navigate(`/events/${event.slug}/checkout?tier=${selectedTier}&qty=${qty}`);
  };

  useEffect(() => {
    if (!event || !salesClosed) return;
    toast.info("Ticket Sale Ended");
    navigate("/events", { replace: true });
  }, [event, navigate, salesClosed]);

  if (loading) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <div className="mx-auto max-w-1440 px-5 py-32 text-center lg:px-8">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-ash" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <div className="mx-auto max-w-1440 px-5 py-32 text-center lg:px-8">
          <p className="mb-4 font-mono-label text-fezzy-glow">404</p>
          <h1 className="font-display text-5xl text-cream">Event not found</h1>
          <p className="mt-4 text-cream-dim">The event you're looking for has moved or is not published.</p>
          <Link to="/events" className="btn-ember mt-8 inline-flex">Browse all events</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-cream/10">
          <div className="absolute inset-0 -z-10">
            {event.poster_url || event.cover_image_url ? (
              <img src={event.poster_url || event.cover_image_url || ""} alt="" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-ink-soft" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.75)_50%,rgba(0,0,0,0.95)_100%)]" />
          </div>
          <div className="mx-auto max-w-1440 px-5 pb-20 pt-12 md:pb-28 md:pt-16 lg:px-8">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 font-mono-label text-cream-dim transition-colors hover:text-cream"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to browse
            </Link>
            <div className="mt-10 max-w-3xl">
              {event.category && (
                <div className="mb-5">
                  <span className="stamp text-fezzy-glow">{event.category}</span>
                </div>
              )}
              <h1 className="font-display text-5xl text-cream sm:text-6xl md:text-7xl">{event.title}</h1>
              {event.tagline && <p className="mt-3 text-lg text-cream-dim md:text-xl">{event.tagline}</p>}

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-cream">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-fezzy" />
                  {formatEventDateLong(event.starts_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-fezzy" />
                  {formatEventTime(event.starts_at)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-fezzy" />
                  {event.venue_name ?? "Venue TBA"} {event.city ? `- ${event.city}` : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-1440 gap-12 px-5 py-16 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-20">
          <div className="space-y-14">
            <div>
              <p className="mb-4 font-mono-label text-fezzy-glow">About</p>
              <p className="text-lg leading-relaxed text-cream-dim">
                {event.description || "Event details will be added by the organizer soon."}
              </p>
            </div>

            {lineup.length > 0 && (
              <div>
                <p className="mb-4 font-mono-label text-fezzy-glow">{lineupLabel}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lineup.map((name) => (
                    <div key={name} className="border border-cream/10 bg-ink-card p-4 font-display text-lg text-cream">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-4 font-mono-label text-fezzy-glow">Venue</p>
              <div className="overflow-hidden border border-cream/10 bg-ink-card">
                <div className="relative aspect-[16/7] bg-ink-soft">
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <MapPin className="mx-auto h-8 w-8 text-fezzy" />
                      <p className="mt-3 font-display text-2xl text-cream">{event.venue_name ?? "Venue TBA"}</p>
                      <p className="text-sm text-cream-dim">
                        {[event.city, event.country].filter(Boolean).join(", ") || "Location TBA"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-4 font-mono-label text-fezzy-glow">Organizer</p>
              <div className="flex items-center justify-between border border-cream/10 bg-ink-card p-5">
                <div className="flex items-center gap-4">
                  {organizer?.logo_url ? (
                    <img src={organizer.logo_url} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center bg-fezzy font-display text-lg text-ink">
                      {(organizer?.org_name ?? "O").charAt(0)}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-cream">{organizer?.org_name ?? "Organizer"}</p>
                    <p className="flex items-center gap-1 text-xs text-cream-dim">
                      <ShieldCheck className="h-3 w-3 text-fezzy" /> Verified organizer
                    </p>
                  </div>
                </div>
                {organizer?.website && (
                  <a href={organizer.website} target="_blank" rel="noreferrer" className="btn-outline-editorial px-4 py-2">
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-cream/10 bg-ink-card p-6">
              <div className="flex items-baseline justify-between">
                <p className="font-mono-label text-fezzy-glow">Tickets</p>
                <button className="border border-cream/20 p-2 text-cream-dim transition-colors hover:border-fezzy hover:text-fezzy" aria-label="Share">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>

              {salesClosed ? (
                <div className="mt-5 border border-dashed border-cream/20 bg-ink-soft p-5 text-sm text-cream-dim">
                  Ticket sales are closed because this event has started.
                </div>
              ) : tiers.length === 0 ? (
                <div className="mt-5 border border-dashed border-cream/20 bg-ink-soft p-5 text-sm text-cream-dim">
                  Tickets are not on sale yet.
                </div>
              ) : (
                <>
                  <div className="mt-5 space-y-2.5">
                    {tiers.map((ticketTier, index) => {
                      const active = index === selectedTier;
                      const tierRemaining = ticketsRemaining(ticketTier);
                      const tierColor = index === 0 ? "#00b060" : index === 1 ? "#d4ff3a" : "#ff4d1a";
                      return (
                        <button
                          key={ticketTier.id}
                          onClick={() => { setSelectedTier(index); setQty(1); }}
                          disabled={tierRemaining < 1}
                          className={`w-full border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? "border-fezzy bg-fezzy/[0.08]"
                              : "border-cream/15 bg-ink hover:border-cream/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="flex items-center gap-2 font-display text-lg text-cream">
                              <Circle className="h-2 w-2 fill-current" style={{ color: tierColor }} />
                              {ticketTier.name}
                            </p>
                            <p className="font-semibold text-cream">{formatPrice(ticketTier.price_kes)}</p>
                          </div>
                          {ticketTier.description && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-cream-dim">
                              <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-fezzy" /> {ticketTier.description}
                            </p>
                          )}
                          <p className="mt-2 font-mono-label text-ash">
                            {tierRemaining} remaining
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex items-center justify-between border border-cream/15 bg-ink px-4 py-3">
                    <span className="text-sm font-medium text-cream">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQty((current) => Math.max(1, current - 1))}
                        className="grid h-8 w-8 place-items-center border border-cream/20 text-cream transition-colors hover:border-fezzy hover:text-fezzy"
                      >-</button>
                      <span className="w-6 text-center font-semibold tabular-nums text-cream">{qty}</span>
                      <button
                        onClick={() => setQty((current) => Math.min(remaining, current + 1))}
                        disabled={remaining < 1}
                        className="grid h-8 w-8 place-items-center border border-cream/20 text-cream transition-colors hover:border-fezzy hover:text-fezzy disabled:cursor-not-allowed disabled:opacity-50"
                      >+</button>
                    </div>
                  </div>

                  <dl className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between text-cream-dim">
                      <dt>Subtotal</dt>
                      <dd className="font-medium text-cream">{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-cream-dim">
                      <dt>{BUYER_FEE_LABEL} ({BUYER_FEE_PCT}%)</dt>
                      <dd className="font-medium text-cream">{formatPrice(buyerFee)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-cream/10 pt-3">
                      <dt className="font-semibold text-cream">You pay</dt>
                      <dd className="font-display text-xl text-cream">{formatPrice(total)}</dd>
                    </div>
                    <p className="border border-fezzy/20 bg-fezzy/10 p-2.5 font-mono-label text-fezzy">
                      A {BUYER_FEE_PCT}% buyer service fee is added at checkout.
                    </p>
                  </dl>

                  <button
                    className="btn-ember mt-6 w-full justify-center"
                    onClick={goCheckout}
                    disabled={!tier || remaining < 1 || salesClosed}
                  >
                    Get tickets <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="mt-3 text-center font-mono-label text-ash">
                    M-Pesa checkout. Instant delivery after payment confirmation.
                  </p>
                </>
              )}
            </div>
          </aside>
        </section>

        {related.length > 0 && (
          <section className="border-t border-cream/10 bg-ink-soft">
            <div className="mx-auto max-w-1440 px-5 py-20 lg:px-8">
              <p className="mb-4 font-mono-label text-fezzy-glow">More like this</p>
              <h2 className="mb-12 font-display text-5xl text-cream lg:text-7xl">
                You might also love
              </h2>
              <div className="grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-3">
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

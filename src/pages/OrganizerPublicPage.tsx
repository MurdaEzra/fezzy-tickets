// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Calendar, Globe, Loader2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useOrganizerProfile } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import { DbEvent, formatEventDateLong, formatEventTime, formatKES } from "@/lib/eventsApi";
import { FEZZY_LOGO_URL } from "@/lib/brand";


const OrganizerPublicPage = () => {
  const { id } = useParams();
  const { data: profile, isLoading: profileLoading } = useOrganizerProfile(id);
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!id || !profile) {
      if (!profileLoading) setEventsLoading(false);
      return;
    }
    (async () => {
      const { data: evts } = await supabase
        .from("events")
        .select("*")
        .eq("organizer_id", id)
        .eq("status", "published")
        .order("starts_at", { ascending: true });
      setEvents((evts ?? []) as DbEvent[]);
      setEventsLoading(false);
    })();
  }, [id, profile, profileLoading]);

  const loading = profileLoading || eventsLoading;

  if (loading) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <main className="mx-auto max-w-1440 px-5 py-24 lg:px-8">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-ash" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <main className="mx-auto max-w-1440 px-5 py-28 text-center lg:px-8">
          <p className="mb-4 font-mono-label text-fezzy-glow">Organizer</p>
          <h1 className="font-display text-5xl text-cream">Public page not found</h1>
          <Link to="/events" className="btn-ember mt-8 inline-flex">Browse events</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 py-14 md:py-20 lg:px-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 flex items-center gap-4">
                  <div className="grid h-20 w-20 place-items-center overflow-hidden border border-cream/10 bg-ink-card">
                    <img src={profile.logo_url || FEZZY_LOGO_URL} alt={`${profile.org_name} logo`} className="h-full w-full object-contain p-2" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 border border-cream/20 px-3 py-1 font-mono-label text-fezzy">
                    <ShieldCheck className="h-3 w-3" /> Verified organizer
                  </span>
                </div>
                <h1 className="font-display text-5xl text-cream sm:text-6xl md:text-7xl">{profile.org_name}</h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream-dim md:text-lg">
                  {profile.bio || "Explore upcoming events, streams, and ticket drops from this Fezzy Tickets organizer."}
                </p>
              </div>
              <div className="border border-cream/10 bg-ink-card p-5 md:min-w-72">
                <p className="mb-3 font-mono-label text-fezzy-glow">Contact</p>
                <div className="space-y-2 text-sm text-cream-dim">
                  {profile.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-fezzy" /> {profile.contact_email}</p>}
                  {profile.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-fezzy" /> {profile.contact_phone}</p>}
                  {profile.website && <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-fezzy" /> {profile.website}</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-1440 px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-4 font-mono-label text-fezzy-glow">Public events</p>
              <h2 className="font-display text-3xl text-cream">Upcoming from {profile.org_name}</h2>
            </div>
            <Link to="/events" className="btn-outline-editorial">All events <ArrowRight className="h-4 w-4" /></Link>
          </div>

          {events.length === 0 ? (
            <div className="border border-dashed border-cream/20 bg-ink-card p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-ash" />
              <p className="mt-4 font-display text-xl text-cream">No published events yet</p>
            </div>
          ) : (
            <div className="grid gap-px bg-cream/10 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Link key={event.id} to={`/events/${event.slug}`} className="group bg-ink transition-colors hover:bg-ink-card">
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink-soft">
                    {event.cover_image_url ? (
                      <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover img-zoom" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-ash"><Calendar className="h-8 w-8" /></div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.82)_100%)]" />
                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="mb-2 font-mono-label text-fezzy-glow">{event.category || "Event"}</div>
                      <h3 className="font-display text-3xl leading-none text-cream transition-colors group-hover:text-fezzy-glow">{event.title}</h3>
                    </div>
                  </div>
                  <div className="grid min-h-[120px] grid-cols-[1fr_auto] gap-4 p-5">
                    <div className="space-y-1.5 text-xs text-cream-dim">
                      <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-fezzy" /> {formatEventDateLong(event.starts_at)} · {formatEventTime(event.starts_at)}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-fezzy" /> {event.venue_name || "Venue TBA"}, {event.city || "Kenya"}</p>
                      <p className="mt-2 text-sm text-cream-dim">From <span className="font-semibold text-cream">{formatKES(0)}</span></p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center border border-cream/20 text-fezzy transition-colors group-hover:border-fezzy group-hover:bg-fezzy group-hover:text-ink">
                      <ArrowUpRight className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="h-1 bg-fezzy" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default OrganizerPublicPage;

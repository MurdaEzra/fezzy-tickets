import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, Globe, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
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
    return <div className="min-h-screen bg-background"><Navbar /><main className="container-px mx-auto max-w-7xl py-24">Loading organizer...</main></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-px mx-auto max-w-3xl py-28 text-center">
          <p className="eyebrow mb-3">Organizer</p>
          <h1 className="display text-5xl text-foreground">Public page not found</h1>
          <Button variant="acacia" className="mt-8" asChild><Link to="/events">Browse events</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="border-b border-border bg-mesh">
          <div className="container-px mx-auto max-w-7xl py-14 md:py-20">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 flex items-center gap-4">
                  <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft">
                    <img src={profile.logo_url || FEZZY_LOGO_URL} alt={`${profile.org_name} logo`} className="h-full w-full object-contain p-2" />
                  </div>
                  <span className="chip"><ShieldCheck className="h-3 w-3 text-primary" /> Verified organizer</span>
                </div>
                <h1 className="display text-5xl text-foreground sm:text-6xl md:text-7xl">{profile.org_name}</h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                  {profile.bio || "Explore upcoming events, streams, and ticket drops from this Fezzy Tickets organizer."}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card-soft md:min-w-72">
                <p className="eyebrow mb-3">Contact</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {profile.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {profile.contact_email}</p>}
                  {profile.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {profile.contact_phone}</p>}
                  {profile.website && <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> {profile.website}</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl py-14 md:py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Public events</p>
              <h2 className="font-display text-3xl font-bold text-foreground">Upcoming from {profile.org_name}</h2>
            </div>
            <Button variant="outline" asChild><Link to="/events">All events</Link></Button>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-display text-xl font-bold text-foreground">No published events yet</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <article key={event.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft">
                  <div className="aspect-[16/10] bg-secondary">
                    {event.cover_image_url ? <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-muted-foreground"><Calendar className="h-8 w-8" /></div>}
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{event.category || "Event"}</p>
                    <h3 className="mt-1 font-display text-xl font-bold leading-tight text-foreground">{event.title}</h3>
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatEventDateLong(event.starts_at)} · {formatEventTime(event.starts_at)}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.venue_name || "Venue TBA"}, {event.city || "Kenya"}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="text-xs font-semibold text-muted-foreground">Tickets from {formatKES(0)}</span>
                      <Button size="sm" variant="acacia" asChild><Link to={`/events/${event.slug}`}>View</Link></Button>
                    </div>
                  </div>
                </article>
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

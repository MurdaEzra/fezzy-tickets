import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Radio, Sparkles, Tv } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { fetchPublishedEvents, formatEventDate, formatEventTime, type DbEvent } from "@/lib/eventsApi";

const Streams = () => {
  const [streams, setStreams] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublishedEvents({ stream: true })
      .then(setStreams)
      .catch(() => setStreams([]))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const live = streams.filter((s) => {
    const start = new Date(s.starts_at).getTime();
    const end = s.ends_at ? new Date(s.ends_at).getTime() : start + 3 * 3600_000;
    return now >= start && now <= end;
  });
  const upcoming = streams.filter((s) => new Date(s.starts_at).getTime() > now);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="border-b border-border bg-mesh">
          <div className="container-px mx-auto max-w-7xl py-16 text-center md:py-24">
            <span className="chip"><Sparkles className="h-3 w-3 text-primary" />Watch from anywhere</span>
            <h1 className="display mx-auto mt-5 max-w-3xl text-5xl text-foreground sm:text-6xl md:text-7xl">
              Live <span className="script font-normal text-primary text-[1.2em]">streams</span>, world stages.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Buy a stream pass, get a private link in your email, and tune in from anywhere.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="container-px mx-auto max-w-7xl py-16 text-center text-muted-foreground">Loading streams…</div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="container-px mx-auto max-w-7xl py-12 md:py-16">
                <p className="eyebrow mb-3 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                  Live now
                </p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {live.map((s) => <StreamCard key={s.id} s={s} live />)}
                </div>
              </section>
            )}

            <section className="container-px mx-auto max-w-7xl py-12 md:py-16">
              <p className="eyebrow mb-3">Coming up</p>
              <h2 className="display mb-10 text-4xl text-foreground sm:text-5xl">
                Upcoming <span className="script font-normal text-primary text-[1.2em]">broadcasts</span>
              </h2>
              {upcoming.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <Tv className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-display text-lg">No upcoming streams yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Check back soon — organizers add new broadcasts daily.</p>
                  <Button variant="acacia" className="mt-6" asChild><Link to="/events">Browse all events</Link></Button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((s) => <StreamCard key={s.id} s={s} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

const StreamCard = ({ s, live }: { s: DbEvent; live?: boolean }) => (
  <Link to={`/events/${s.slug}`} className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft transition hover:-translate-y-1 hover:shadow-soft">
    <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
      {s.cover_image_url && (
        <img src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      )}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${live ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"}`}>
          <Radio className="h-3 w-3" /> {live ? "Live" : "Stream"}
        </span>
      </div>
    </div>
    <div className="p-5">
      <p className="text-xs text-muted-foreground">{formatEventDate(s.starts_at)} · {formatEventTime(s.starts_at)}</p>
      <h3 className="mt-1 font-display text-lg font-bold leading-tight text-foreground">{s.title}</h3>
      {s.tagline && <p className="script mt-1 text-xl text-primary">{s.tagline}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" /> {s.venue_name ?? "Online"}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Get pass <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </div>
  </Link>
);

export default Streams;

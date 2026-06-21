import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Radio, Tv } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 py-16 text-center md:py-24 lg:px-8">
            <p className="mb-4 font-mono-label text-fezzy-glow">Broadcast</p>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-5xl text-cream sm:text-6xl md:text-7xl">
              Live streams, world stages.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-cream-dim md:text-lg">
              Buy a stream pass, get a private link in your email, and tune in from anywhere.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="mx-auto max-w-1440 px-5 py-16 text-center text-cream-dim lg:px-8">Loading streams…</div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="mx-auto max-w-1440 px-5 py-12 md:py-16 lg:px-8">
                <p className="mb-4 flex items-center gap-2 font-mono-label text-ember">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-ember opacity-75" />
                    <span className="relative inline-flex h-2 w-2 bg-ember" />
                  </span>
                  Live now
                </p>
                <div className="grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-3">
                  {live.map((s) => <StreamCard key={s.id} s={s} live />)}
                </div>
              </section>
            )}

            <section className="mx-auto max-w-1440 px-5 py-12 md:py-16 lg:px-8">
              <p className="mb-4 font-mono-label text-fezzy-glow">Coming up</p>
              <h2 className="mb-10 font-display text-4xl text-cream sm:text-5xl">
                Upcoming broadcasts
              </h2>
              {upcoming.length === 0 ? (
                <div className="border border-dashed border-cream/20 bg-ink-card p-12 text-center">
                  <Tv className="mx-auto h-10 w-10 text-ash" />
                  <p className="mt-4 font-display text-lg text-cream">No upcoming streams yet</p>
                  <p className="mt-1 text-sm text-cream-dim">Check back soon — organizers add new broadcasts daily.</p>
                  <Link to="/events" className="btn-ember mt-6 inline-flex">Browse all events</Link>
                </div>
              ) : (
                <div className="grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-3">
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
  <Link to={`/events/${s.slug}`} className="group bg-ink transition-colors hover:bg-ink-card">
    <div className="relative aspect-[16/10] overflow-hidden bg-ink-soft">
      {s.cover_image_url && (
        <img src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover img-zoom" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono-label ${live ? "bg-ember text-cream" : "stamp text-fezzy-glow"}`}>
          <Radio className="h-3 w-3" /> {live ? "Live" : "Stream"}
        </span>
      </div>
      <div className="absolute bottom-5 left-5 right-5">
        <div className="mb-2 font-mono-label text-fezzy-glow">{formatEventDate(s.starts_at)} · {formatEventTime(s.starts_at)}</div>
        <h3 className="font-display text-3xl leading-none text-cream transition-colors group-hover:text-fezzy-glow">{s.title}</h3>
      </div>
    </div>
    <div className="grid min-h-[100px] grid-cols-[1fr_auto] gap-4 p-5">
      <div>
        {s.tagline && <p className="text-sm text-cream-dim">{s.tagline}</p>}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-cream-dim">
          <MapPin className="h-3 w-3 text-fezzy" /> {s.venue_name ?? "Online"}
        </p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center border border-cream/20 text-fezzy transition-colors group-hover:border-fezzy group-hover:bg-fezzy group-hover:text-ink">
        <ArrowUpRight className="h-5 w-5" />
      </span>
    </div>
    <div className="h-1 bg-fezzy" />
  </Link>
);

export default Streams;

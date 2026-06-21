import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { useAllEvents, categoriesFromEvents } from "@/hooks/useEvents";

const ALL = "All" as const;

const Events = () => {
  const [params, setParams] = useSearchParams();
  const { data: events = [], isLoading: loading } = useAllEvents();
  const categories = useMemo(() => categoriesFromEvents(events), [events]);
  const [activeCat, setActiveCat] = useState<string>(params.get("cat") ?? ALL);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const catOk = activeCat === ALL ? true : event.category === activeCat;
      const q = query.trim().toLowerCase();
      const qOk = !q
        ? true
        : [event.title, event.tagline, event.venue_name, event.city, event.category]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(q));
      return catOk && qOk;
    });
  }, [activeCat, events, query]);

  const setCat = (category: string) => {
    setActiveCat(category);
    const next = new URLSearchParams(params);
    if (category === ALL) next.delete("cat");
    else next.set("cat", category);
    setParams(next, { replace: true });
  };

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 pb-12 pt-16 md:pb-16 md:pt-24 lg:px-8">
            <p className="mb-4 font-mono-label text-fezzy-glow">Discover</p>
            <h1 className="font-display text-5xl text-cream sm:text-6xl md:text-7xl">
              What's on
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-cream-dim">
              All events across Kenya and the world. Filter by mood, moment, or city.
            </p>

            <div className="mt-10 flex max-w-xl items-center border border-cream/20 bg-ink/80 backdrop-blur-sm transition-colors focus-within:border-fezzy">
              <label className="flex flex-1 items-center py-3 pl-4">
                <Search className="mr-3 h-4 w-4 shrink-0 text-ash" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, venue, city..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-ash"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {[ALL, ...categories].map((category) => {
                const active = category === activeCat;
                return (
                  <button
                    key={category}
                    onClick={() => setCat(category)}
                    className={`border px-3 py-1.5 font-mono-label transition-all ${
                      active
                        ? "border-cream bg-cream text-ink"
                        : "border-cream/20 text-cream-dim hover:border-fezzy hover:text-fezzy"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-1440 px-5 py-12 md:py-16 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm text-cream-dim">
              <span className="font-semibold text-cream">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "event" : "events"}
            </p>
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-ash" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
              <p className="font-display text-2xl text-cream">Nothing here, yet.</p>
              <p className="mt-2 text-sm text-cream-dim">Try a different search or category.</p>
            </div>
          ) : (
            <div className="grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Events;

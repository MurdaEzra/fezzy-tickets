import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { events, categories, type EventCategory } from "@/data/events";

const ALL = "All" as const;

const Events = () => {
  const [params, setParams] = useSearchParams();
  const initialCat = (params.get("cat") as EventCategory | null) ?? ALL;
  const [activeCat, setActiveCat] = useState<EventCategory | typeof ALL>(initialCat);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const catOk = activeCat === ALL ? true : e.category === activeCat;
      const q = query.trim().toLowerCase();
      const qOk = !q
        ? true
        : [e.title, e.tagline, e.venue, e.city, e.category].some((t) =>
            t.toLowerCase().includes(q)
          );
      return catOk && qOk;
    });
  }, [activeCat, query]);

  const setCat = (c: EventCategory | typeof ALL) => {
    setActiveCat(c);
    if (c === ALL) {
      params.delete("cat");
    } else {
      params.set("cat", c);
    }
    setParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Header */}
        <section className="relative isolate overflow-hidden border-b border-border/60">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: "var(--gradient-radial)" }}
          />
          <div className="container-px mx-auto max-w-7xl pb-12 pt-20 md:pb-16 md:pt-28">
            <p className="eyebrow mb-4">Discover</p>
            <h1 className="display text-5xl font-medium text-foreground sm:text-6xl md:text-7xl">
              Browse <span className="italic text-primary">live</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Hand-picked events across the continent and beyond. Filter by mood,
              moment, or city.
            </p>

            {/* Search */}
            <div className="mt-10 flex max-w-xl items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, venue, city…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            {/* Filter chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[ALL, ...categories.map((c) => c.name)].map((c) => {
                const active = c === activeCat;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wider transition-all duration-300 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="container-px mx-auto max-w-7xl py-16 md:py-24">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "event" : "events"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-16 text-center">
              <p className="font-display text-2xl text-foreground">Nothing here, yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or category.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e, i) => (
                <EventCard key={e.id} event={e} index={i} />
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

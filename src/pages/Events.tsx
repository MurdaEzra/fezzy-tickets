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
    if (c === ALL) params.delete("cat");
    else params.set("cat", c);
    setParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border bg-mesh">
          <div className="container-px mx-auto max-w-7xl pb-12 pt-16 md:pb-16 md:pt-24">
            <p className="eyebrow mb-3">Discover</p>
            <h1 className="display text-5xl text-foreground sm:text-6xl md:text-7xl">
              What's <span className="script font-normal text-primary text-[1.2em]">on</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Curated events across Kenya and the world. Filter by mood, moment, or city.
            </p>

            <div className="mt-10 flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, venue, city…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {[ALL, ...categories.map((c) => c.name)].map((c) => {
                const active = c === activeCat;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl py-12 md:py-16">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "event" : "events"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <p className="font-display text-2xl text-foreground">Nothing here, yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a different search or category.</p>
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

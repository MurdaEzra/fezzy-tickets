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
    <div className="tm-page min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <div className="dotgrid absolute inset-0 opacity-40" />
          <div className="container-px mx-auto max-w-7xl pb-12 pt-16 md:pb-16 md:pt-24">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-primary">Discover</p>
            <h1 className="font-display text-5xl font-extrabold text-foreground sm:text-6xl md:text-7xl">
              What's <span className="tm-grad-green">on</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              All events across Kenya and the world. Filter by mood, moment, or city.
            </p>

            <div className="mt-10 flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card-soft transition focus-within:border-primary">
              <Search className="h-4 w-4 text-primary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, venue, city..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {[ALL, ...categories].map((category) => {
                const active = category === activeCat;
                return (
                  <button
                    key={category}
                    onClick={() => setCat(category)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    {category}
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

          {loading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <p className="font-display text-2xl text-foreground">Nothing here, yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a different search or category.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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


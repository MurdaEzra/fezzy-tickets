import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search, MapPin, Ticket, Plane, Palmtree, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { events, formatPrice, formatDate } from "@/data/events";
import hero from "@/assets/hero-festival.jpg";

const tabs = [
  { key: "events", label: "Events", icon: Ticket },
  { key: "streams", label: "Streams", icon: Calendar },
  { key: "experiences", label: "Experiences", icon: Palmtree },
];

const Hero = () => {
  const [tab, setTab] = useState("events");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const navigate = useNavigate();
  const featured = events.find((e) => e.featured) ?? events[0];

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    navigate(`/events?${params.toString()}`);
  };

  return (
    <section className="relative isolate overflow-hidden bg-cream-deep">
      <div className="absolute inset-0 -z-10 opacity-30">
        <img src={hero} alt="" className="h-full w-full object-cover" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-cream-deep/60 via-cream-deep/85 to-cream-deep" />
      </div>

      <div className="container-px mx-auto grid max-w-7xl gap-10 py-12 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Left: Search card */}
        <div className="animate-fade-up">
          <p className="eyebrow mb-3">Find. Book. Vibe.</p>
          <h1 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
            Your next great <span className="script font-normal text-primary text-[1.2em]">night</span> starts here.
          </h1>

          <div className="mt-8 max-w-2xl rounded-3xl border border-border bg-card p-2 shadow-soft">
            <div className="flex gap-1 px-2 pt-2">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={onSearch} className="space-y-2 rounded-2xl bg-background p-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="text"
                  placeholder="Event name, artist or venue…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  type="text"
                  placeholder="City (Nairobi, Mombasa, Kisumu…)"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <Button variant="acacia" size="lg" type="submit" className="w-full rounded-xl font-semibold">
                Find Your Event <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>✓ M-Pesa & Card</span>
            <span>✓ Instant QR delivery</span>
            <span>✓ No buyer fees</span>
          </div>
        </div>

        {/* Right: featured ticket-poster */}
        <div className="relative animate-fade-up" style={{ animationDelay: "120ms" }}>
          <Link to={`/events/${featured.slug}`} className="group block">
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={featured.image} alt={featured.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-card/95 p-4 backdrop-blur-md shadow-card-soft">
                <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Now selling</p>
                <p className="mt-1 font-display text-lg font-bold leading-tight text-foreground">{featured.title}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(featured.date)} · {featured.city}</span>
                  <span className="text-sm font-bold text-foreground">{formatPrice(featured.priceFrom, featured.currency)}</span>
                </div>
              </div>
            </div>
          </Link>
          <div className="absolute -right-3 -top-3 rotate-6 rounded-2xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground shadow-sun">
            🔥 Trending
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

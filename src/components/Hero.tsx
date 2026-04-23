import { Link } from "react-router-dom";
import { ArrowRight, Search, MapPin, Sparkles } from "lucide-react";
import hero from "@/assets/hero-festival.jpg";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative isolate overflow-hidden bg-mesh">
      <div className="container-px mx-auto grid max-w-7xl gap-12 pb-20 pt-16 md:pb-28 md:pt-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-28">
        {/* Left: copy */}
        <div className="animate-fade-up">
          <span className="chip">
            <Sparkles className="h-3 w-3 text-primary" />
            Live in 14 cities · Born in Nairobi
          </span>
          <h1 className="display mt-6 text-5xl text-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            The night is{" "}
            <span className="script font-normal text-primary text-[1.15em] leading-[0.7]">yours</span>
            <br />
            the ticket is{" "}
            <span className="relative inline-block">
              ours.
              <svg className="absolute -bottom-3 left-0 w-full" viewBox="0 0 200 10" fill="none">
                <path d="M2 7C40 2 80 2 120 5C150 7 180 6 198 4" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            From sold-out shows at Carnivore to lakeside festivals in Naivasha and stages
            across the world — discover events you'll talk about for years.
          </p>

          {/* Search */}
          <div className="mt-8 flex max-w-2xl flex-col gap-1 rounded-3xl border border-border bg-card p-1.5 shadow-soft sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search artists, venues, vibes…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="hidden items-center gap-3 border-l border-border px-4 py-3 sm:flex">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                defaultValue="Nairobi"
                className="w-32 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <Button variant="acacia" size="lg" asChild>
              <Link to="/events">
                Find events <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              { k: "1.2M+", v: "Tickets sold" },
              { k: "8,400", v: "Live events" },
              { k: "14", v: "Cities" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-3xl font-bold text-foreground">{s.k}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right: photo collage */}
        <div className="relative animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-border shadow-soft">
            <img
              src={hero}
              alt="Joyful festival crowd at golden hour in Kenya"
              className="h-full w-full object-cover"
              fetchPriority="high"
              width={1920}
              height={1280}
            />
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero-overlay)" }} />
            {/* Floating ticket card */}
            <div className="absolute bottom-6 left-6 right-6 animate-float">
              <div className="rounded-2xl border border-white/30 bg-white/95 p-4 backdrop-blur-md shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Now selling</p>
                    <p className="mt-0.5 font-display text-base font-bold text-foreground">Sol Fest · Naivasha</p>
                    <p className="text-xs text-muted-foreground">Sat · 19 June · from KES 2,500</p>
                  </div>
                  <Button variant="acacia" size="sm" asChild>
                    <Link to="/events">Get tickets</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-3 -top-3 hidden rotate-6 rounded-2xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground shadow-sun md:block">
            🔥 Trending
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

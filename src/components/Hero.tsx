import { Link } from "react-router-dom";
import { ArrowRight, Search, MapPin } from "lucide-react";
import hero from "@/assets/hero-concert.jpg";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-hero-overlay)" }}
        />
        <div className="absolute inset-0 grain" />
      </div>

      <div className="container-px mx-auto max-w-7xl pb-24 pt-20 md:pb-32 md:pt-32 lg:pb-40 lg:pt-40">
        <div className="max-w-4xl animate-fade-up">
          <p className="eyebrow mb-6 flex items-center gap-3">
            <span className="h-px w-10 bg-primary" />
            Fezzy Tickets · Spring 2026
          </p>
          <h1 className="display text-5xl font-medium text-foreground sm:text-6xl md:text-7xl lg:text-[6.25rem]">
            Every event.
            <br />
            <span className="italic text-primary">Every ticket.</span>
            <br />
            One place.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            From intimate jazz cellars to floodlit stadiums, discover the live
            moments that matter — and walk in ready, ticket in hand.
          </p>

          {/* Search bar */}
          <div className="mt-10 flex max-w-2xl flex-col gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 shadow-card-soft backdrop-blur-xl sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search events, artists, venues…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="hidden items-center gap-3 border-l border-border/60 px-4 py-3 sm:flex">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Anywhere"
                className="w-32 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <Button variant="hero" size="lg" className="rounded-xl" asChild>
              <Link to="/events">
                Search <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-8 border-t border-border/60 pt-8">
            {[
              { k: "1.2M+", v: "Tickets sold" },
              { k: "8,400", v: "Live events" },
              { k: "32", v: "Cities" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-3xl font-medium text-foreground">{s.k}</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default Hero;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Search, Sparkles } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { fetchPublishedEvents, formatEventDate, type DbEvent } from "@/lib/eventsApi";

interface Slide {
  id: string;
  title: string;
  tagline: string;
  image: string;
  date: string;
  venue: string;
  city: string;
  href: string;
}

const HeroSlideshow = () => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [emblaRef, embla] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 4500, stopOnInteraction: false })],
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    fetchPublishedEvents({ limit: 6 })
      .then((rows) => {
        setSlides(rows.map((e: DbEvent) => ({
            id: e.id,
            title: e.title,
            tagline: e.tagline ?? "",
            image: e.cover_image_url ?? "",
            date: formatEventDate(e.starts_at),
            venue: e.venue_name ?? "TBA",
            city: e.city ?? "",
            href: `/events/${e.slug}`,
        })));
      })
      .catch(() => setSlides([]));
  }, []);

  useEffect(() => {
    if (!embla) return;
    const onSel = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSel);
    return () => { embla.off("select", onSel); };
  }, [embla]);

  return (
    <section className="relative isolate overflow-hidden bg-mesh">
      <div className="container-px mx-auto max-w-7xl pt-12 md:pt-20">
        {/* Heading + search */}
        <div className="mb-8 max-w-3xl animate-fade-up md:mb-12">
          <h1 className="display mt-5 text-5xl text-foreground sm:text-6xl md:text-7xl">
            The night is{" "}
            <span className="script font-normal text-primary text-[1.15em] leading-[0.7]">yours</span>,
            <br className="hidden sm:block" />
            the ticket is{" "}
            <span className="relative inline-block">
              ours.
              <svg className="absolute -bottom-3 left-0 w-full" viewBox="0 0 200 10" fill="none">
                <path d="M2 7C40 2 80 2 120 5C150 7 180 6 198 4" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Festivals, gigs, derbies, livestreams & discover what's next, anywhere in the world.
          </p>

          <div className="mt-7 flex max-w-2xl flex-col gap-1 rounded-3xl border border-border bg-card p-1.5 shadow-soft sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search artists, venues, vibes…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <Button variant="acacia" size="lg" asChild>
              <Link to="/events">Find events <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>

        {/* Slideshow banner */}
        <div className="relative animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="overflow-hidden rounded-[2rem] border border-border shadow-soft" ref={emblaRef}>
            <div className="flex">
              {slides.length === 0 ? (
                <div className="relative min-w-0 flex-[0_0_100%]">
                  <div className="grid aspect-[16/9] place-items-center bg-cream-deep px-6 text-center sm:aspect-[21/9] md:aspect-[24/9]">
                    <div>
                      <p className="eyebrow mb-3">Events loading</p>
                      <h2 className="display text-3xl text-foreground sm:text-4xl md:text-5xl">No published events yet</h2>
                      <Button variant="acacia" size="lg" className="mt-5" asChild>
                        <Link to="/start-selling">Create the first event</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : slides.map((s) => (
                <div key={s.id} className="relative min-w-0 flex-[0_0_100%]">
                  <Link to={s.href} className="block">
                    <div className="relative aspect-[16/9] sm:aspect-[21/9] md:aspect-[24/9]">
                      {s.image ? (
                        <img
                          src={s.image}
                          alt={s.title}
                          className="h-full w-full object-cover"
                          loading="eager"
                        />
                      ) : (
                        <div className="h-full w-full bg-cream-deep" />
                      )}
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(90deg, rgba(13,27,42,0.85) 0%, rgba(13,27,42,0.45) 50%, rgba(13,27,42,0.15) 100%)" }}
                      />
                      <div className="absolute inset-0 flex items-end p-6 md:items-center md:p-12">
                        <div className="max-w-xl text-white">
                          <span className="chip !border-white/30 !bg-white/15 !text-white backdrop-blur">
                            <Calendar className="h-3 w-3" /> {s.date}
                          </span>
                          <h2 className="display mt-3 text-3xl text-white sm:text-4xl md:text-5xl">{s.title}</h2>
                          {s.tagline && <p className="script mt-1 text-2xl text-accent md:text-3xl">{s.tagline}</p>}
                          <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
                            <MapPin className="h-3.5 w-3.5" /> {s.venue}, {s.city}
                          </p>
                          <Button variant="sun" size="lg" className="mt-5">
                            Get tickets <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => embla?.scrollTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === selected ? "w-8 bg-foreground" : "w-3 bg-foreground/25"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSlideshow;

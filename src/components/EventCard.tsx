import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { type EventItem, formatDate, formatPrice } from "@/data/events";

interface Props {
  event: EventItem;
  index?: number;
}

const EventCard = ({ event, index = 0 }: Props) => {
  return (
    <Link
      to={`/events/${event.slug}`}
      className="group block animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <article className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card-soft transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-amber">
        <div className="relative aspect-[4/5] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/30 to-transparent" />

          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-md">
              {event.category}
            </span>
            {event.trending && (
              <span className="rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Trending
              </span>
            )}
          </div>

          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground opacity-0 backdrop-blur-md transition-all duration-500 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="mb-3 flex items-baseline gap-2 text-xs text-primary">
              <span className="font-semibold uppercase tracking-[0.18em]">{formatDate(event.date)}</span>
            </div>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground text-balance">
              {event.title}
            </h3>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {event.venue}, {event.city}
              </p>
              <p className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground">from </span>
                {formatPrice(event.priceFrom, event.currency)}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default EventCard;

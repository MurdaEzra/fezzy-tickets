import { Link } from "react-router-dom";
import { MapPin, Calendar } from "lucide-react";
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
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-sm">
              {event.category}
            </span>
          </div>
          {event.trending && (
            <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
              🔥 Hot
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[2.75rem] font-display text-base font-bold leading-snug text-foreground">
            {event.title}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 text-primary" />
            {formatDate(event.date)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="truncate">{event.venue}, {event.city}</span>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-sm font-bold text-primary">
              {formatPrice(event.priceFrom, event.currency)}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default EventCard;

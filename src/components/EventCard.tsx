import { Link } from "react-router-dom";
import { ArrowUpRight, Calendar, MapPin } from "lucide-react";
import {
  formatEventDate,
  formatPrice,
  lowestTierPrice,
  type DbEventWithTiers,
} from "@/lib/eventsApi";

interface Props {
  event: DbEventWithTiers;
  index?: number;
}

const EventCard = ({ event, index = 0 }: Props) => {
  const priceFrom = lowestTierPrice(event.ticket_tiers);

  return (
    <Link
      to={`/events/${event.slug}`}
      className="group block animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft transition-all duration-500 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-soft">
        <div className="relative aspect-[4/3] overflow-hidden">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-cream-deep px-6 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{event.title}</p>
            </div>
          )}
          {event.category && (
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-sm">
                {event.category}
              </span>
            </div>
          )}
          <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-foreground opacity-0 shadow-soft transition-all duration-500 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 text-xs text-primary">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Calendar className="h-3 w-3" />
              {formatEventDate(event.starts_at)}
            </span>
          </div>
          <h3 className="mt-3 font-display text-xl font-bold leading-tight tracking-tight text-foreground text-balance">
            {event.title}
          </h3>
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {event.city || event.country || "Location TBA"}
            </p>
            {priceFrom === null ? (
              <p className="text-sm font-bold text-foreground">Sales soon</p>
            ) : (
              <p className="text-sm font-bold text-foreground">
                <span className="font-normal text-muted-foreground">from </span>
                {formatPrice(priceFrom)}
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

export default EventCard;

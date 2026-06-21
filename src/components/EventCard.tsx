import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
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

const statusBadge = (status: string) => {
  const map: Record<string, { label: string }> = {
    draft: { label: "Draft" },
    pending_approval: { label: "Pending" },
    cancelled: { label: "Cancelled" },
    completed: { label: "Completed" },
  };
  return map[status] ?? null;
};

const EventCard = ({ event, index = 0 }: Props) => {
  const priceFrom = lowestTierPrice(event.ticket_tiers);
  const imageUrl = event.poster_url || event.cover_image_url;
  const badge = event.status !== "published" ? statusBadge(event.status) : null;

  return (
    <Link
      to={`/events/${event.slug}`}
      className="group bg-ink transition-colors hover:bg-ink-card"
    >
      <div className="relative h-72 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover img-zoom"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-ink-soft px-6 text-center">
            <p className="font-display text-2xl text-cream">{event.title}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          {event.category && (
            <span className="stamp text-fezzy-glow">{event.category}</span>
          )}
          {badge && (
            <span className="border border-ember bg-ember/80 px-2.5 py-1 font-mono-label text-cream">
              {badge.label}
            </span>
          )}
        </div>
        <div className="absolute bottom-5 left-5 right-5">
          <div className="mb-2 font-mono-label text-fezzy-glow">
            {formatEventDate(event.starts_at)}
          </div>
          <h3 className="font-display text-4xl leading-none text-cream transition-colors group-hover:text-fezzy-glow">
            {event.title}
          </h3>
        </div>
      </div>
      <div className="grid min-h-[132px] grid-cols-[1fr_auto] gap-4 p-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cream-dim">
            <MapPin className="h-4 w-4 text-fezzy" />
            {event.city || event.country || "Location TBA"}
          </p>
          <p className="mt-4 text-sm text-cream-dim">
            {priceFrom === null ? (
              <span className="font-semibold text-cream">Sales soon</span>
            ) : (
              <>
                From{" "}
                <span className="font-semibold text-cream">
                  {formatPrice(priceFrom)}
                </span>
              </>
            )}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center border border-cream/20 text-fezzy transition-colors group-hover:border-fezzy group-hover:bg-fezzy group-hover:text-ink">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
      <div className="h-1 bg-fezzy" />
    </Link>
  );
};

export default EventCard;

import { Calendar, MapPin } from "lucide-react";

interface Props {
  eventTitle: string;
  date: string;
  venue: string;
  city: string;
  tierName: string;
  holderName?: string;
  accent?: string;
  theme?: string;
  pattern?: string;
}

const TicketPreview = ({
  eventTitle, date, venue, city, tierName,
  holderName = "Your name", accent = "#1FAD66",
  theme = "savannah", pattern = "none",
}: Props) => {
  const headerBg =
    theme === "midnight" ? "linear-gradient(135deg,#0d1b2a,#1b263b)" :
    theme === "sunset"   ? "linear-gradient(135deg,#FFC93C,#F97316)" :
    theme === "ocean"    ? "linear-gradient(135deg,#0ea5e9,#1FAD66)" :
                           `linear-gradient(135deg,${accent},#2bd083)`;

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div style={{ background: headerBg }} className="relative p-6 text-white">
        {pattern === "dots" && (
          <div className="absolute inset-0 opacity-20"
               style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
        )}
        {pattern === "stripes" && (
          <div className="absolute inset-0 opacity-15"
               style={{ backgroundImage: "repeating-linear-gradient(45deg,white 0 6px,transparent 6px 18px)" }} />
        )}
        <p className="relative text-[10px] uppercase tracking-[0.25em] opacity-90">Admit one</p>
        <h3 className="relative mt-1 font-display text-2xl font-bold leading-tight">{eventTitle || "Your event"}</h3>
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-95">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date || "Date"}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {venue || "Venue"}, {city || "City"}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 p-5">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Holder</p>
          <p className="font-semibold text-foreground">{holderName}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Tier</p>
          <p className="font-semibold" style={{ color: accent }}>{tierName || "General"}</p>
        </div>
        <div className="grid h-24 w-24 place-items-center rounded-xl border border-border bg-background p-2"
             style={{ backgroundImage: "repeating-linear-gradient(0deg,#0d1b2a 0 2px,#fff 2px 4px), repeating-linear-gradient(90deg,#0d1b2a 0 2px,#fff 2px 4px)", backgroundBlendMode: "multiply" }}>
          <span className="rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">QR</span>
        </div>
      </div>

      <div className="border-t-2 border-dashed border-border" />
      <p className="bg-secondary p-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        Fezzy Tickets · {accent === "#1FAD66" ? "Acacia" : "Custom"}
      </p>
    </div>
  );
};

export default TicketPreview;

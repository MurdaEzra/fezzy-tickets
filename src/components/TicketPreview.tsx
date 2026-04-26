import { Calendar, MapPin, Sparkles } from "lucide-react";
import { FEZZY_LOGO_URL } from "@/lib/brand";

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

const templateStyles: Record<string, { name: string; wrapper: string; header: string; body: string; footer: string; qr: string; mark: string }> = {
  savannah: {
    name: "Acacia Luxe",
    wrapper: "rounded-[2rem]",
    header: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-glow)))",
    body: "bg-card",
    footer: "bg-secondary",
    qr: "rounded-2xl",
    mark: "bg-primary/10 text-primary",
  },
  sunset: {
    name: "Sunset Gold",
    wrapper: "rounded-3xl",
    header: "var(--gradient-sun)",
    body: "bg-card",
    footer: "bg-accent/15",
    qr: "rounded-full",
    mark: "bg-accent/25 text-accent-foreground",
  },
  ocean: {
    name: "Coastal Wave",
    wrapper: "rounded-[1.5rem]",
    header: "linear-gradient(135deg,hsl(var(--primary-glow)),hsl(198 88% 48%))",
    body: "bg-card",
    footer: "bg-primary/10",
    qr: "rounded-2xl rotate-3",
    mark: "bg-primary/10 text-primary",
  },
  midnight: {
    name: "Midnight VIP",
    wrapper: "rounded-2xl",
    header: "linear-gradient(135deg,hsl(var(--foreground)),hsl(215 35% 22%))",
    body: "bg-foreground text-background",
    footer: "bg-foreground text-background/70",
    qr: "rounded-xl",
    mark: "bg-accent text-accent-foreground",
  },
  royal: {
    name: "Royal Gala",
    wrapper: "rounded-[2rem]",
    header: "linear-gradient(135deg,hsl(275 52% 32%),hsl(var(--accent)))",
    body: "bg-card",
    footer: "bg-secondary",
    qr: "rounded-2xl -rotate-2",
    mark: "bg-accent/25 text-accent-foreground",
  },
  neon: {
    name: "Neon Stage",
    wrapper: "rounded-2xl",
    header: "linear-gradient(135deg,hsl(185 88% 42%),hsl(326 78% 55%))",
    body: "bg-foreground text-background",
    footer: "bg-foreground text-background/70",
    qr: "rounded-full",
    mark: "bg-primary-glow/20 text-background",
  },
  heritage: {
    name: "Heritage Print",
    wrapper: "rounded-[1.75rem]",
    header: "linear-gradient(135deg,hsl(var(--terracotta)),hsl(var(--gold-deep)))",
    body: "bg-card",
    footer: "bg-secondary",
    qr: "rounded-xl rotate-1",
    mark: "bg-accent/25 text-accent-foreground",
  },
  minimal: {
    name: "Clean Pass",
    wrapper: "rounded-xl",
    header: "linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)))",
    body: "bg-card",
    footer: "bg-muted",
    qr: "rounded-lg",
    mark: "bg-primary/10 text-primary",
  },
};

export const ticketTemplateOptions = Object.entries(templateStyles).map(([id, value]) => ({ id, label: value.name, header: value.header }));

const TicketPreview = ({
  eventTitle, date, venue, city, tierName,
  holderName = "Your name", accent = "#1FAD66",
  theme = "savannah", pattern = "none",
}: Props) => {
  const style = templateStyles[theme] ?? templateStyles.savannah;
  const isDark = style.body.includes("bg-foreground");
  const textClass = isDark ? "text-background" : "text-foreground";
  const mutedClass = isDark ? "text-background/65" : "text-muted-foreground";
  const headerTextClass = theme === "minimal" ? "text-foreground" : "text-primary-foreground";

  return (
    <div className={`mx-auto w-full max-w-md overflow-hidden border border-border bg-card shadow-soft ${style.wrapper}`}>
      <div style={{ background: style.header }} className={`relative overflow-hidden p-6 ${headerTextClass}`}>
        {pattern === "dots" && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "12px 12px" }} />}
        {pattern === "stripes" && <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "repeating-linear-gradient(45deg,currentColor 0 6px,transparent 6px 18px)" }} />}
        {pattern === "waves" && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%, currentColor 0 1px, transparent 42px), radial-gradient(ellipse at 80% 70%, currentColor 0 1px, transparent 52px)" }} />}
        {pattern === "confetti" && <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(30deg,currentColor 8%,transparent 8%),linear-gradient(120deg,currentColor 6%,transparent 6%)", backgroundSize: "22px 22px" }} />}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-90">Admit one</p>
            <h3 className="mt-1 font-display text-2xl font-bold leading-tight">{eventTitle || "Your event"}</h3>
          </div>
          <img src={FEZZY_LOGO_URL} alt="Fezzy Tickets" className="h-12 w-auto shrink-0 object-contain drop-shadow" />
        </div>
        <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-95">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date || "Date"}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {venue || "Venue"}, {city || "City"}</span>
        </div>
      </div>

      <div className={`flex items-center gap-4 p-5 ${style.body}`}>
        <div className="flex-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${style.mark}`}>
            <Sparkles className="h-3 w-3" /> {style.name}
          </span>
          <p className={`mt-4 text-[10px] uppercase tracking-wider ${mutedClass}`}>Holder</p>
          <p className={`font-semibold ${textClass}`}>{holderName}</p>
          <p className={`mt-3 text-[10px] uppercase tracking-wider ${mutedClass}`}>Tier</p>
          <p className="font-semibold" style={{ color: accent }}>{tierName || "General"}</p>
        </div>
        <div className={`grid h-24 w-24 place-items-center border border-border bg-background p-2 shadow-card-soft ${style.qr}`}
             style={{ backgroundImage: "repeating-linear-gradient(0deg,hsl(var(--foreground)) 0 2px,hsl(var(--background)) 2px 4px), repeating-linear-gradient(90deg,hsl(var(--foreground)) 0 2px,hsl(var(--background)) 2px 4px)", backgroundBlendMode: "multiply" }}>
          <span className="rounded bg-background/95 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-foreground">QR</span>
        </div>
      </div>

      <div className="border-t-2 border-dashed border-border" />
      <p className={`p-3 text-center text-[10px] uppercase tracking-wider ${style.footer}`}>
        Fezzy Tickets · {style.name}
      </p>
    </div>
  );
};

export default TicketPreview;

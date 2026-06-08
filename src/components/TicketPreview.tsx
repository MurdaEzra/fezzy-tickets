import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Calendar, MapPin, Sparkles, Ticket as TicketIcon } from "lucide-react";
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
  /** Signed JWT-style token to embed in the QR (set on real tickets) */
  qrPayload?: string;
  /** Short ticket id displayed under the QR */
  ticketId?: string;
  /** Short event id displayed in the stub */
  eventId?: string;
}

const templateStyles: Record<string, { name: string; wrapper: string; header: string; body: string; footer: string; mark: string; isDark?: boolean }> = {
  savannah: { name: "Acacia Luxe", wrapper: "rounded-[2rem]", header: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-glow)))", body: "bg-card", footer: "bg-secondary", mark: "bg-primary/10 text-primary" },
  sunset:   { name: "Sunset Gold", wrapper: "rounded-3xl",   header: "var(--gradient-sun)", body: "bg-card", footer: "bg-accent/15", mark: "bg-accent/25 text-accent-foreground" },
  ocean:    { name: "Coastal Wave", wrapper: "rounded-[1.5rem]", header: "linear-gradient(135deg,hsl(var(--primary-glow)),hsl(198 88% 48%))", body: "bg-card", footer: "bg-primary/10", mark: "bg-primary/10 text-primary" },
  midnight: { name: "Midnight VIP", wrapper: "rounded-2xl", header: "linear-gradient(135deg,hsl(var(--foreground)),hsl(215 35% 22%))", body: "bg-foreground text-background", footer: "bg-foreground text-background/70", mark: "bg-accent text-accent-foreground", isDark: true },
  royal:    { name: "Royal Gala", wrapper: "rounded-[2rem]", header: "linear-gradient(135deg,hsl(275 52% 32%),hsl(var(--accent)))", body: "bg-card", footer: "bg-secondary", mark: "bg-accent/25 text-accent-foreground" },
  neon:     { name: "Neon Stage", wrapper: "rounded-2xl", header: "linear-gradient(135deg,hsl(185 88% 42%),hsl(326 78% 55%))", body: "bg-foreground text-background", footer: "bg-foreground text-background/70", mark: "bg-primary-glow/20 text-background", isDark: true },
  heritage: { name: "Heritage Print", wrapper: "rounded-[1.75rem]", header: "linear-gradient(135deg,hsl(var(--terracotta)),hsl(var(--gold-deep)))", body: "bg-card", footer: "bg-secondary", mark: "bg-accent/25 text-accent-foreground" },
  minimal:  { name: "Clean Pass", wrapper: "rounded-xl", header: "linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)))", body: "bg-card", footer: "bg-muted", mark: "bg-primary/10 text-primary" },
};

export const ticketTemplateOptions = Object.entries(templateStyles).map(([id, value]) => ({ id, label: value.name, header: value.header }));

const short = (s?: string, n = 8) => (s ? `${s.slice(0, n).toUpperCase()}` : "—");

const TicketPreview = ({
  eventTitle, date, venue, city, tierName,
  holderName = "Your name", accent = "#1FAD66",
  theme = "savannah", pattern = "none",
  qrPayload, ticketId, eventId,
}: Props) => {
  const style = templateStyles[theme] ?? templateStyles.savannah;
  const isDark = !!style.isDark;
  const textClass = isDark ? "text-background" : "text-foreground";
  const mutedClass = isDark ? "text-background/65" : "text-muted-foreground";
  const headerTextClass = theme === "minimal" ? "text-foreground" : "text-primary-foreground";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const data = qrPayload || `FEZZY-PREVIEW-${ticketId || "demo"}`;
    QRCode.toCanvas(canvasRef.current, data, {
      width: 168, margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#0c0c0c", light: "#ffffff00" },
    }).catch(() => {});
  }, [qrPayload, ticketId]);

  return (
    <div className={`mx-auto w-full max-w-md overflow-hidden border border-border shadow-soft ${style.wrapper} ${style.body}`}>
      {/* Header */}
      <div style={{ background: style.header }} className={`relative overflow-hidden p-6 ${headerTextClass}`}>
        {pattern === "dots"     && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "12px 12px" }} />}
        {pattern === "stripes"  && <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "repeating-linear-gradient(45deg,currentColor 0 6px,transparent 6px 18px)" }} />}
        {pattern === "waves"    && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%, currentColor 0 1px, transparent 42px), radial-gradient(ellipse at 80% 70%, currentColor 0 1px, transparent 52px)" }} />}
        {pattern === "confetti" && <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(30deg,currentColor 8%,transparent 8%),linear-gradient(120deg,currentColor 6%,transparent 6%)", backgroundSize: "22px 22px" }} />}

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-90">Admit one</p>
            <h3 className="mt-1 font-display text-2xl font-bold leading-tight">{eventTitle || "Your event"}</h3>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3 w-3" /> {style.name}
            </span>
          </div>
          <img src={FEZZY_LOGO_URL} alt="Fezzy Tickets" className="h-12 w-auto shrink-0 object-contain drop-shadow" />
        </div>
        <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-95">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date || "Date"}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {venue || "Venue"}, {city || "City"}</span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-5 px-5 py-6">
        <div className="space-y-3">
          <div>
            <p className={`text-[9px] uppercase tracking-[0.25em] ${mutedClass}`}>Holder</p>
            <p className={`font-display text-lg font-bold leading-tight ${textClass}`}>{holderName}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <p className={`text-[9px] uppercase tracking-[0.25em] ${mutedClass}`}>Tier</p>
              <p className="font-semibold" style={{ color: accent }}>{tierName || "General"}</p>
            </div>
            <div>
              <p className={`text-[9px] uppercase tracking-[0.25em] ${mutedClass}`}>Seat</p>
              <p className={`font-semibold ${textClass}`}>GA</p>
            </div>
            <div>
              <p className={`text-[9px] uppercase tracking-[0.25em] ${mutedClass}`}>Ticket ID</p>
              <p className={`font-mono text-[11px] ${textClass}`}>{short(ticketId, 12)}</p>
            </div>
            <div>
              <p className={`text-[9px] uppercase tracking-[0.25em] ${mutedClass}`}>Event ID</p>
              <p className={`font-mono text-[11px] ${textClass}`}>{short(eventId, 12)}</p>
            </div>
          </div>
        </div>

        {/* QR — kept clean, no overlays or text on/around the code itself */}
        <div className="rounded-2xl border border-border bg-white p-2.5 shadow-card-soft">
          <canvas ref={canvasRef} className="block h-[168px] w-[168px]" />
        </div>
      </div>

      {/* Perforation */}
      <div className="relative px-3">
        <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-cream-deep" />
        <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-cream-deep" />
        <div className="border-t-2 border-dashed border-border" />
      </div>

      {/* Stub */}
      <div className={`flex items-center justify-between px-5 py-3 text-[10px] ${style.footer}`}>
        <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-[0.2em]">
          <TicketIcon className="h-3 w-3" /> Fezzy Tickets
        </span>
        <span className="font-mono opacity-80">{short(ticketId, 6)} · {short(eventId, 6)}</span>
      </div>
    </div>
  );
};

export default TicketPreview;

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Check, Download, Share2, Calendar, MapPin, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatEventDate, type DbEvent } from "@/lib/eventsApi";
import { FEZZY_LOGO_URL } from "@/lib/brand";

interface Props {
  handle: string;
  orgName: string;
  events: DbEvent[];
}

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

const SharePanel = ({ handle, orgName, events }: Props) => {
  const published = useMemo(() => events.filter((e) => e.status === "published"), [events]);
  const [selectedId, setSelectedId] = useState<string>(published[0]?.id ?? "");
  useEffect(() => { if (!selectedId && published[0]) setSelectedId(published[0].id); }, [published, selectedId]);

  const event = published.find((e) => e.id === selectedId);
  const url = event ? `${origin()}/o/${handle}/${event.slug}` : "";

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (!event || !url) return;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: `Tickets for ${event.title}`, url }); } catch {}
    } else {
      copy();
    }
  };

  // QR (clean, no text overlays)
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!qrRef.current || !url) return;
    QRCode.toCanvas(qrRef.current, url, {
      width: 220, margin: 1, errorCorrectionLevel: "H",
      color: { dark: "#0c0c0c", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  const downloadQR = () => {
    if (!qrRef.current || !event) return;
    const link = document.createElement("a");
    link.href = qrRef.current.toDataURL("image/png");
    link.download = `${event.slug}-qr.png`;
    link.click();
  };

  // Banner generator
  const bannerRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!bannerRef.current || !event) return;
    const c = bannerRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = 1200; c.height = 630;

    // Background gradient
    const g = ctx.createLinearGradient(0, 0, 1200, 630);
    g.addColorStop(0, "#0d3b2e");
    g.addColorStop(1, "#1fad66");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 630);

    // Cover image (right side)
    const drawText = () => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 22px Inter, system-ui, sans-serif";
      ctx.fillText(orgName.toUpperCase(), 64, 110);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 64px 'Playfair Display', serif";
      wrapText(ctx, event.title, 64, 200, 700, 70);

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "500 24px Inter, system-ui, sans-serif";
      ctx.fillText(formatEventDate(event.starts_at), 64, 440);
      ctx.fillText(`${event.venue_name ?? "Venue TBA"} · ${event.city ?? ""}`, 64, 478);

      ctx.fillStyle = "#fcd34d";
      ctx.font = "700 20px Inter, system-ui, sans-serif";
      ctx.fillText("GET TICKETS", 64, 560);
      ctx.fillStyle = "#ffffff";
      ctx.font = "500 22px monospace";
      ctx.fillText(url.replace(/^https?:\/\//, ""), 64, 592);

      // QR on right
      QRCode.toDataURL(url, { width: 280, margin: 1, errorCorrectionLevel: "H" }).then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(840, 175, 296, 296);
          ctx.drawImage(img, 848, 183, 280, 280);
        };
        img.src = dataUrl;
      });
    };

    if (event.cover_image_url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.globalAlpha = 0.18;
        ctx.drawImage(img, 0, 0, 1200, 630);
        ctx.globalAlpha = 1;
        drawText();
      };
      img.onerror = () => drawText();
      img.src = event.cover_image_url;
    } else {
      drawText();
    }
  }, [event, url, orgName]);

  const downloadBanner = () => {
    if (!bannerRef.current || !event) return;
    const link = document.createElement("a");
    link.href = bannerRef.current.toDataURL("image/png");
    link.download = `${event.slug}-banner.png`;
    link.click();
  };

  if (published.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Share & banners</h1>
        <p className="mt-1 text-sm text-muted-foreground">Publish an event first to generate share links, QR codes and banners.</p>
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <Share2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-display text-lg">No published events</p>
          <p className="mt-1 text-sm text-muted-foreground">Once an event is live, your branded link appears here.</p>
          <Button variant="acacia" className="mt-6" asChild>
            <Link to="/dashboard/events/new">Create event <Plus className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Share & banners</h1>
        <p className="mt-1 text-sm text-muted-foreground">Branded link, clean QR code, and a downloadable banner for every published event.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-card-soft">
        <Label>Pick an event</Label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        >
          {published.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {event && (
        <>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
            <p className="eyebrow">Branded share link</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Input readOnly value={url} className="font-mono text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy</Button>
                <Button variant="acacia" onClick={share}><Share2 className="h-4 w-4" /> Share</Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Goes through <span className="font-mono">/o/{handle}/{event.slug}</span> so attendees know it's you.
              <Button variant="link" size="sm" asChild className="px-1.5"><Link to={`/events/${event.slug}`}>Preview <ExternalLink className="h-3 w-3" /></Link></Button>
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
              <p className="eyebrow">Clean QR code</p>
              <p className="mt-1 text-sm text-muted-foreground">No overlay text — prints cleanly on flyers and screens.</p>
              <div className="mt-4 grid place-items-center rounded-2xl bg-white p-6">
                <canvas ref={qrRef} className="h-[220px] w-[220px]" />
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={downloadQR}>
                <Download className="h-4 w-4" /> Download QR (PNG)
              </Button>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
              <p className="eyebrow">Social banner</p>
              <p className="mt-1 text-sm text-muted-foreground">1200×630 — perfect for WhatsApp, X, IG and FB.</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-secondary">
                <canvas ref={bannerRef} className="block h-auto w-full" />
              </div>
              <Button variant="acacia" className="mt-4 w-full" onClick={downloadBanner}>
                <Download className="h-4 w-4" /> Download banner (PNG)
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-6">
            <div className="flex items-center gap-3">
              <img src={FEZZY_LOGO_URL} alt="" className="h-10 w-auto" />
              <div>
                <p className="font-display text-base font-bold text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatEventDate(event.starts_at)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue_name ?? "TBA"}</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, yy);
      line = words[n] + " ";
      yy += lineHeight;
      if (yy > y + lineHeight * 2) { // cap at 3 lines
        ctx.fillText(line.trim() + (n < words.length - 1 ? "…" : ""), x, yy);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}

export default SharePanel;

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, MapPin, Image as ImageIcon, Ticket, Eye, Save, Radio } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MapPicker from "@/components/MapPicker";
import TicketPreview, { ticketTemplateOptions } from "@/components/TicketPreview";
import PosterDesigner from "@/components/PosterDesigner";
import { formatEventDate } from "@/lib/eventsApi";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + Math.random().toString(36).slice(2, 6);

type Tab = "details" | "location" | "tickets" | "design" | "publish";

interface TierDraft { id?: string; name: string; price_kes: number; quantity: number; description: string; }

const EventEditor = () => {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(isNew ? null : id ?? null);

  // Form state
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Music");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("Nairobi");
  const [country, setCountry] = useState("Kenya");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isStream, setIsStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [accent, setAccent] = useState("#1FAD66");
  const [theme, setTheme] = useState("savannah");
  const [pattern, setPattern] = useState("none");
  const [tiers, setTiers] = useState<TierDraft[]>([
    { name: "General", price_kes: 1500, quantity: 100, description: "" },
  ]);
  const [feeWaived, setFeeWaived] = useState(false);
  const [eventsPublishedCount, setEventsPublishedCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?mode=signin&redirect=/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("organizer_profiles")
        .select("id, events_published_count").eq("user_id", user.id).maybeSingle();
      if (!prof) { navigate("/dashboard"); return; }
      setOrganizerId(prof.id);
      setEventsPublishedCount(prof.events_published_count);
      // Default fee_waived for first event
      if (isNew) setFeeWaived(prof.events_published_count === 0);

      if (!isNew && id) {
        const { data: ev, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
        if (error || !ev) { toast.error("Event not found"); navigate("/dashboard"); return; }
        setTitle(ev.title); setTagline(ev.tagline ?? ""); setDescription(ev.description ?? "");
        setCategory(ev.category ?? "Music"); setCoverUrl(ev.cover_image_url); setPosterUrl(ev.poster_url);
        setVenueName(ev.venue_name ?? ""); setVenueAddress(ev.venue_address ?? "");
        setCity(ev.city ?? "Nairobi"); setCountry(ev.country ?? "Kenya");
        setLat(ev.latitude); setLng(ev.longitude);
        setStartsAt(ev.starts_at?.slice(0, 16) ?? ""); setEndsAt(ev.ends_at?.slice(0, 16) ?? "");
        setIsStream(ev.is_stream); setStreamUrl(ev.stream_url ?? "");
        const td = (ev.ticket_design ?? {}) as { accent?: string; theme?: string; pattern?: string };
        setAccent(td.accent ?? "#1FAD66");
        setTheme(td.theme ?? "savannah");
        setPattern(td.pattern ?? "none");
        setFeeWaived(ev.fee_waived);

        const { data: ts } = await supabase.from("ticket_tiers").select("*").eq("event_id", id).order("sort_order");
        if (ts && ts.length) {
          setTiers(ts.map((t) => ({ id: t.id, name: t.name, price_kes: t.price_kes, quantity: t.quantity, description: t.description ?? "" })));
        }
      }
      setLoading(false);
    })();
  }, [user, id, isNew, navigate]);

  const uploadAsset = async (file: File, folder: "covers" | "posters") => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed", { description: error.message }); return null; }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const save = async (publish = false): Promise<string | null> => {
    if (!organizerId) return null;
    if (!title.trim() || !startsAt) {
      toast.error("Title and start date are required"); setTab("details"); return null;
    }
    setSaving(true);
    try {
      const payload = {
        organizer_id: organizerId,
        title, tagline, description, category,
        cover_image_url: coverUrl, poster_url: posterUrl,
        venue_name: venueName, venue_address: venueAddress, city, country,
        latitude: lat, longitude: lng,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_stream: isStream, stream_url: isStream ? streamUrl : null,
        ticket_design: { theme, accent, pattern },
        fee_waived: feeWaived,
        status: publish ? "published" as const : "draft" as const,
      };

      let savedId = eventId;
      if (!savedId) {
        const slug = slugify(title);
        const { data, error } = await supabase.from("events")
          .insert({ ...payload, slug }).select().single();
        if (error) throw error;
        savedId = data.id; setEventId(savedId);
      } else {
        const { error } = await supabase.from("events").update(payload).eq("id", savedId);
        if (error) throw error;
      }

      // Sync tiers
      const { data: existing } = await supabase.from("ticket_tiers").select("id").eq("event_id", savedId);
      const existingIds = new Set((existing ?? []).map((r) => r.id));
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (t.id) {
          await supabase.from("ticket_tiers").update({
            name: t.name, price_kes: t.price_kes, quantity: t.quantity, description: t.description, sort_order: i,
          }).eq("id", t.id);
          existingIds.delete(t.id);
        } else {
          await supabase.from("ticket_tiers").insert({
            event_id: savedId, name: t.name, price_kes: t.price_kes,
            quantity: t.quantity, description: t.description, sort_order: i,
          });
        }
      }
      for (const orphan of existingIds) {
        await supabase.from("ticket_tiers").delete().eq("id", orphan);
      }

      toast.success(publish ? "Event published! 🎉" : "Saved as draft");
      return savedId;
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
      return null;
    } finally { setSaving(false); }
  };

  if (loading || authLoading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="grid place-items-center py-32"><Loader2 className="h-6 w-6 animate-spin" /></div></div>;
  }

  const tabs: { id: Tab; label: string; icon: typeof Plus }[] = [
    { id: "details", label: "Details", icon: ImageIcon },
    { id: "location", label: "Location", icon: MapPin },
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "design", label: "Design", icon: Eye },
    { id: "publish", label: "Publish", icon: ArrowRight },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-px mx-auto max-w-6xl py-8 md:py-12">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="mt-4 flex items-end justify-between gap-4">
          <h1 className="display text-3xl text-foreground sm:text-4xl md:text-5xl">
            {isNew ? "New event" : title || "Untitled event"}
          </h1>
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </Button>
        </div>

        {feeWaived && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent-foreground">
            🎉 First-event bonus active — 0% platform fee on this event
          </div>
        )}

        {/* Tab nav */}
        <div className="mt-8 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}>
                <t.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 space-y-6">
          {tab === "details" && (
            <div className="space-y-6">
              <Card title="Basics">
                <div className="grid gap-4">
                  <Field label="Event title">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sol Fest Naivasha" />
                  </Field>
                  <Field label="Tagline">
                    <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Three days. Lake views. Endless sound." />
                  </Field>
                  <Field label="Description">
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Category">
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {["Music","Festival","Sports","Arts","Tech","Food & Drink","Nightlife","Conference"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Type">
                      <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3">
                        <input type="checkbox" checked={isStream} onChange={(e) => setIsStream(e.target.checked)} />
                        <span className="flex items-center gap-1 text-sm"><Radio className="h-3.5 w-3.5 text-primary" /> Live stream event</span>
                      </label>
                    </Field>
                  </div>
                  {isStream && (
                    <Field label="Stream URL (sent to ticket buyers)">
                      <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://…" />
                    </Field>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Starts at">
                      <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    </Field>
                    <Field label="Ends at (optional)">
                      <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    </Field>
                  </div>
                </div>
              </Card>

              <Card title="Cover image">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="h-32 w-48 overflow-hidden rounded-2xl border border-border bg-secondary">
                    {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> :
                      <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>}
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const url = await uploadAsset(f, "covers"); if (url) setCoverUrl(url);
                    }} />
                    <span className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-foreground/15 px-5 text-sm font-semibold hover:bg-foreground/[0.04]">
                      Upload image
                    </span>
                  </label>
                </div>
              </Card>
            </div>
          )}

          {tab === "location" && (
            <Card title="Where's it happening?">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Venue name"><Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Ngong Racecourse" /></Field>
                <Field label="Address"><Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} /></Field>
                <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                <Field label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
              </div>
              <div className="mt-6">
                <Label>Pin the exact spot</Label>
                <div className="mt-2">
                  <MapPicker lat={lat} lng={lng} onChange={(la, ln, addr) => {
                    setLat(la); setLng(ln);
                    if (addr && !venueAddress) setVenueAddress(addr);
                  }} />
                </div>
              </div>
            </Card>
          )}

          {tab === "tickets" && (
            <Card title="Ticket tiers">
              <div className="space-y-3">
                {tiers.map((t, i) => (
                  <div key={i} className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-[1fr_120px_120px_auto]">
                    <Input value={t.name} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="e.g. Early Bird" />
                    <Input type="number" value={t.price_kes} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, price_kes: Number(e.target.value) } : x))} placeholder="Price KES" />
                    <Input type="number" value={t.quantity} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} placeholder="Qty" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setTiers((arr) => arr.filter((_, j) => j !== i))} disabled={tiers.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setTiers((arr) => [...arr, { name: "", price_kes: 0, quantity: 100, description: "" }])}>
                  <Plus className="h-4 w-4" /> Add tier
                </Button>
              </div>
            </Card>
          )}

          {tab === "design" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Ticket designer">
                <div className="space-y-4">
                  <Field label="Theme">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ticketTemplateOptions.map((th) => (
                        <button key={th.id} type="button" onClick={() => setTheme(th.id)}
                          className={`overflow-hidden rounded-xl border-2 transition ${theme === th.id ? "border-primary scale-105" : "border-transparent"}`}>
                          <div className="h-12 w-full" style={{ background: th.header }} />
                          <p className="bg-card py-1 text-[10px] font-semibold">{th.label}</p>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Accent color">
                    <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-20 rounded border border-border bg-background" />
                  </Field>
                  <Field label="Pattern">
                    <div className="flex gap-2">
                      {["none", "dots", "stripes", "waves", "confetti"].map((p) => (
                        <button key={p} type="button" onClick={() => setPattern(p)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${pattern === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </Card>

              <div>
                <Label className="mb-3 block">Live preview</Label>
                <TicketPreview
                  eventTitle={title || "Your event"}
                  date={startsAt ? formatEventDate(startsAt) : "Sat, 15 Jun"}
                  venue={venueName || "Venue"}
                  city={city}
                  tierName={tiers[0]?.name || "General"}
                  accent={accent}
                  theme={theme}
                  pattern={pattern}
                />
              </div>

              <Card title="Poster studio" className="lg:col-span-2">
                <PosterDesigner
                  title={title}
                  date={startsAt ? formatEventDate(startsAt) : ""}
                  venue={venueName}
                  city={city}
                  imageUrl={posterUrl}
                  accent={accent}
                  onUpload={async (f) => { const url = await uploadAsset(f, "posters"); if (url) setPosterUrl(url); }}
                />
              </Card>
            </div>
          )}

          {tab === "publish" && (
            <Card title="Ready to go live?">
              <ul className="space-y-2 text-sm">
                <Bullet ok={!!title}>Title</Bullet>
                <Bullet ok={!!startsAt}>Start date & time</Bullet>
                <Bullet ok={!!coverUrl}>Cover image (recommended)</Bullet>
                <Bullet ok={lat !== null && lng !== null}>Location pin</Bullet>
                <Bullet ok={tiers.every((t) => t.name && t.price_kes >= 0)}>Ticket tiers</Bullet>
              </ul>
              <div className="mt-6 rounded-2xl bg-primary/[0.07] p-4 text-sm">
                <p className="font-semibold text-foreground">
                  Platform fee on this event: <span className="text-primary">{feeWaived ? "0% (waived)" : "5% of each ticket"}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {feeWaived
                    ? "Your first event is on us — no platform fee."
                    : "Deducted from your payout. Buyers always pay zero service fees."}
                </p>
              </div>
              <Button variant="acacia" size="lg" className="mt-6 w-full" disabled={saving} onClick={async () => {
                const ok = await save(true);
                if (ok) navigate("/dashboard");
              }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Publish event
              </Button>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-7 ${className}`}>
    <h2 className="mb-5 font-display text-xl font-bold">{title}</h2>
    {children}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="mb-1.5 block">{label}</Label>
    {children}
  </div>
);

const Bullet = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className="flex items-center gap-2">
    <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${ok ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{ok ? "✓" : "·"}</span>
    <span className={ok ? "text-foreground" : "text-muted-foreground"}>{children}</span>
  </li>
);

export default EventEditor;

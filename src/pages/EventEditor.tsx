// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, MapPin, Image as ImageIcon, Ticket, Save, Radio, X, CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + Math.random().toString(36).slice(2, 6);

type Tab = "details" | "location" | "tickets" | "design" | "publish";

interface TierDraft { id?: string; name: string; price_kes: number; quantity: number; description: string; valid_dates: string[]; }

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
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [dateDraft, setDateDraft] = useState("");
  const [lineupText, setLineupText] = useState("");
  const [isStream, setIsStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [accent, setAccent] = useState("#1FAD66");
  const [theme, setTheme] = useState("savannah");
  const [pattern, setPattern] = useState("none");
  const [seatLabel, setSeatLabel] = useState("GA");
  const [seatArrangement, setSeatArrangement] = useState<"grid" | "rows" | "circle">("grid");
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [allowResale, setAllowResale] = useState(false);
  const [minResalePercentage, setMinResalePercentage] = useState(80);
  const [maxResalePercentage, setMaxResalePercentage] = useState(120);
  const [resaleFeePercentage, setResaleFeePercentage] = useState(10);
  const [resaleCloseHoursBeforeEvent, setResaleCloseHoursBeforeEvent] = useState(24);
  const [tiers, setTiers] = useState<TierDraft[]>([
    { name: "General", price_kes: 1500, quantity: 100, description: "", valid_dates: [] },
  ]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?mode=signin&redirect=/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("organizer_profiles")
        .select("id").eq("user_id", user.id).maybeSingle();
      if (!prof) { navigate("/dashboard"); return; }
      setOrganizerId(prof.id);
      if (!isNew && id) {
        const { data: ev, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
        if (error || !ev) { toast.error("Event not found"); navigate("/dashboard"); return; }
        setTitle(ev.title); setTagline(ev.tagline ?? ""); setDescription(ev.description ?? "");
        setCategory(ev.category ?? "Music"); setCoverUrl(ev.cover_image_url); setPosterUrl(ev.poster_url);
        setVenueName(ev.venue_name ?? ""); setVenueAddress(ev.venue_address ?? "");
        setCity(ev.city ?? "Nairobi"); setCountry(ev.country ?? "Kenya");
        setLat(ev.latitude); setLng(ev.longitude);
        setStartsAt(ev.starts_at?.slice(0, 10) ?? ""); setEndsAt(ev.ends_at?.slice(0, 10) ?? "");
        setEventDates(Array.isArray(ev.event_dates) ? ev.event_dates as string[] : []);
        setLineupText(Array.isArray(ev.lineup) ? (ev.lineup as string[]).join("\n") : "");
        setIsStream(ev.is_stream); setStreamUrl(ev.stream_url ?? "");
        const td = (ev.ticket_design ?? {}) as { accent?: string; theme?: string; pattern?: string; seatLabel?: string; seatArrangement?: "grid" | "rows" | "circle"; showLogo?: boolean; showQR?: boolean; showDate?: boolean };
        setAccent(td.accent ?? "#1FAD66");
        setTheme(td.theme ?? "savannah");
        setPattern(td.pattern ?? "none");
        setSeatLabel(td.seatLabel ?? "GA");
        setSeatArrangement(td.seatArrangement ?? "grid");
        setShowLogo(td.showLogo ?? true);
        setShowQR(td.showQR ?? true);
        setShowDate(td.showDate ?? true);
        setAllowResale(ev.allow_resale ?? false);
        setMinResalePercentage(ev.min_resale_percentage ?? 80);
        setMaxResalePercentage(ev.max_resale_percentage ?? 120);
        setResaleFeePercentage(ev.resale_fee_percentage ?? 10);
        setResaleCloseHoursBeforeEvent(ev.resale_close_hours_before_event ?? 24);
        const { data: ts } = await supabase.from("ticket_tiers").select("*").eq("event_id", id).order("sort_order");
        if (ts && ts.length) {
          setTiers(ts.map((t) => ({
            id: t.id,
            name: t.name,
            price_kes: t.price_kes,
            quantity: t.quantity,
            description: t.description ?? "",
            valid_dates: Array.isArray(t.valid_dates) ? t.valid_dates as string[] : [],
          })));
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

  const addEventDate = () => {
    if (!dateDraft) return;
    setEventDates((current) => Array.from(new Set([...current, dateDraft])).sort());
    setDateDraft("");
  };

  const toggleTierDate = (index: number, date: string) => {
    setTiers((arr) => arr.map((tier, tierIndex) => {
      if (tierIndex !== index) return tier;
      const valid_dates = tier.valid_dates.includes(date)
        ? tier.valid_dates.filter((d) => d !== date)
        : [...tier.valid_dates, date].sort();
      return { ...tier, valid_dates };
    }));
  };

  const save = async (publish = false): Promise<string | null> => {
    if (!organizerId) return null;
    if (!title.trim() || !startsAt) {
      toast.error("Title and start date are required"); setTab("details"); return null;
    }
    const explicitDates = eventDates.length ? eventDates : [startsAt.slice(0, 10)].filter(Boolean);
    const lineup = lineupText.split("\n").map((item) => item.trim()).filter(Boolean);
    setSaving(true);
    try {
      const payload = {
        organizer_id: organizerId,
        title, tagline, description, category,
        cover_image_url: coverUrl, poster_url: posterUrl,
        venue_name: venueName, venue_address: venueAddress, city, country,
        latitude: lat, longitude: lng,
        starts_at: new Date(`${startsAt}T00:00:00`).toISOString(),
        ends_at: endsAt ? new Date(`${endsAt}T00:00:00`).toISOString() : null,
        event_dates: explicitDates,
        lineup,
        is_stream: isStream, stream_url: isStream ? streamUrl : null,
        ticket_design: { theme, accent, pattern, seatLabel, seatArrangement, showLogo, showQR, showDate },
        fee_waived: false,
        status: publish ? "pending_approval" as const : "draft" as const,
        allow_resale: allowResale,
        min_resale_percentage: minResalePercentage,
        max_resale_percentage: maxResalePercentage,
        resale_fee_percentage: resaleFeePercentage,
        resale_close_hours_before_event: resaleCloseHoursBeforeEvent,
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
            name: t.name, price_kes: t.price_kes, quantity: t.quantity, description: t.description, valid_dates: t.valid_dates, sort_order: i,
          }).eq("id", t.id);
          existingIds.delete(t.id);
        } else {
          await supabase.from("ticket_tiers").insert({
            event_id: savedId, name: t.name, price_kes: t.price_kes,
            quantity: t.quantity, description: t.description, valid_dates: t.valid_dates, sort_order: i,
          });
        }
      }
      for (const orphan of existingIds) {
        await supabase.from("ticket_tiers").delete().eq("id", orphan);
      }

      toast.success(publish ? "Event submitted for approval! 🎉" : "Saved as draft");
      return savedId;
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
      return null;
    } finally { setSaving(false); }
  };

  if (loading || authLoading) {
    return <div className="tm-page min-h-screen bg-background"><Navbar /><div className="grid place-items-center py-32"><Loader2 className="h-6 w-6 animate-spin" /></div></div>;
  }

  const tabs: { id: Tab; label: string; icon: typeof Plus }[] = [
    { id: "details", label: "Details", icon: ImageIcon },
    { id: "location", label: "Location", icon: MapPin },
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "publish", label: "Publish", icon: ArrowRight },
  ];

  return (
    <div className="tm-page min-h-screen bg-background">
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
                  <Field label="Artists / speakers">
                    <Textarea
                      value={lineupText}
                      onChange={(e) => setLineupText(e.target.value)}
                      rows={4}
                      placeholder="Add one artist, speaker, or performer per line"
                    />
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
                    <Field label="Event date">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition hover:bg-accent/30 ${
                              startsAt ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            {startsAt
                              ? new Date(`${startsAt}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
                              : "Pick a date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startsAt ? new Date(`${startsAt}T00:00:00`) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const yyyy = date.getFullYear();
                                const mm = String(date.getMonth() + 1).padStart(2, "0");
                                const dd = String(date.getDate()).padStart(2, "0");
                                setStartsAt(`${yyyy}-${mm}-${dd}`);
                              }
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </Field>
                    <Field label="End date (optional)">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition hover:bg-accent/30 ${
                              endsAt ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            {endsAt
                              ? new Date(`${endsAt}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
                              : "Pick end date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endsAt ? new Date(`${endsAt}T00:00:00`) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const yyyy = date.getFullYear();
                                const mm = String(date.getMonth() + 1).padStart(2, "0");
                                const dd = String(date.getDate()).padStart(2, "0");
                                setEndsAt(`${yyyy}-${mm}-${dd}`);
                              }
                            }}
                            disabled={(date) => {
                              const min = startsAt ? new Date(`${startsAt}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
                              return date < min;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {endsAt && (
                        <button type="button" onClick={() => setEndsAt("")} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                          Clear end date
                        </button>
                      )}
                    </Field>
                  </div>
                  <Field label="Additional event dates (optional — for multi-day events)">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition hover:bg-accent/30"
                        >
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          {dateDraft
                            ? new Date(`${dateDraft}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                            : "Select a date to add"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateDraft ? new Date(`${dateDraft}T00:00:00`) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const yyyy = date.getFullYear();
                              const mm = String(date.getMonth() + 1).padStart(2, "0");
                              const dd = String(date.getDate()).padStart(2, "0");
                              setDateDraft(`${yyyy}-${mm}-${dd}`);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" className="mt-2" onClick={addEventDate} disabled={!dateDraft}>
                      <Plus className="h-4 w-4" /> Add date
                    </Button>
                    {eventDates.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {eventDates.map((date) => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setEventDates((current) => current.filter((d) => d !== date))}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                          >
                            {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
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

              <Card title="Custom poster">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="aspect-[4/5] w-36 overflow-hidden rounded-2xl border border-border bg-secondary">
                    {posterUrl ? <img src={posterUrl} alt="" className="h-full w-full object-cover" /> :
                      <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>}
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const url = await uploadAsset(f, "posters"); if (url) setPosterUrl(url);
                      }} />
                      <span className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-foreground/15 px-5 text-sm font-semibold hover:bg-foreground/[0.04]">
                        Upload poster
                      </span>
                    </label>
                    <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                      Uploaded posters are displayed exactly as provided.
                    </p>
                  </div>
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
            <>
              <Card title="Ticket tiers">
                <div className="space-y-3">
                  {tiers.map((t, i) => (
                    <div key={i} className="space-y-3 rounded-2xl border border-border bg-background p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
                        <Input value={t.name} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="e.g. Early Bird" />
                        <Input type="number" value={t.price_kes} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, price_kes: Number(e.target.value) } : x))} placeholder="Price KES" />
                        <Input type="number" value={t.quantity} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} placeholder="Qty" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setTiers((arr) => arr.filter((_, j) => j !== i))} disabled={tiers.length === 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input value={t.description} onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Tier notes (optional)" />
                      {eventDates.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid dates</p>
                          <div className="flex flex-wrap gap-2">
                            {eventDates.map((date) => {
                              const selected = t.valid_dates.includes(date);
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  onClick={() => toggleTierDate(i, date)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setTiers((arr) => [...arr, { name: "", price_kes: 0, quantity: 100, description: "", valid_dates: [] }])}>
                    <Plus className="h-4 w-4" /> Add tier
                  </Button>
                </div>
              </Card>
              
              <Card title="Resale settings">
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={allowResale} 
                      onChange={(e) => setAllowResale(e.target.checked)} 
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">Allow ticket resale for this event</span>
                  </label>
                  
                  {allowResale && (
                    <div className="grid gap-4 sm:grid-cols-2 mt-4">
                      <div>
                        <Field label="Minimum resale price (%)">
                          <Input 
                            type="number" 
                            value={minResalePercentage} 
                            onChange={(e) => setMinResalePercentage(Number(e.target.value))}
                            min="1"
                            max="100"
                          />
                        </Field>
                      </div>
                      <div>
                        <Field label="Maximum resale price (%)">
                          <Input 
                            type="number" 
                            value={maxResalePercentage} 
                            onChange={(e) => setMaxResalePercentage(Number(e.target.value))}
                            min="1"
                          />
                        </Field>
                      </div>
                      <div>
                        <Field label="Resale platform fee (%)">
                          <Input 
                            type="number" 
                            value={resaleFeePercentage} 
                            onChange={(e) => setResaleFeePercentage(Number(e.target.value))}
                            min="0"
                            max="100"
                          />
                        </Field>
                      </div>
                      <div>
                        <Field label="Close resale (hours before event)">
                          <Input 
                            type="number" 
                            value={resaleCloseHoursBeforeEvent} 
                            onChange={(e) => setResaleCloseHoursBeforeEvent(Number(e.target.value))}
                            min="0"
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {tab === "design" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Design options">
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
                  <Field label="Seat label">
                    <Input value={seatLabel} onChange={(e) => setSeatLabel(e.target.value)} placeholder="GA / VIP / A1" />
                  </Field>
                  <Field label="Seat arrangement">
                    <div className="flex flex-wrap gap-2">
                      {(["grid", "rows", "circle"] as const).map((option) => (
                        <button key={option} type="button" onClick={() => setSeatArrangement(option)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${seatArrangement === option ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Ticket features">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { enabled: showLogo, toggle: () => setShowLogo(!showLogo), label: "Logo" },
                        { enabled: showQR, toggle: () => setShowQR(!showQR), label: "QR code" },
                        { enabled: showDate, toggle: () => setShowDate(!showDate), label: "Date & venue" },
                      ] as Array<{ enabled: boolean; toggle: () => void; label: string }>).map((item) => (
                        <button key={item.label} type="button" onClick={item.toggle} className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${item.enabled ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                          {item.enabled ? "✓" : "•"} {item.label}
                        </button>
                      ))}
                    </div>
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
                  seatLabel={seatLabel}
                  seatArrangement={seatArrangement}
                  showLogo={showLogo}
                  showQR={showQR}
                  showDate={showDate}
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
            <Card title="Ready to submit for review?">
              <ul className="space-y-2 text-sm">
                <Bullet ok={!!title}>Title</Bullet>
                <Bullet ok={!!startsAt}>Start date</Bullet>
                <Bullet ok={!!coverUrl}>Cover image (recommended)</Bullet>
                <Bullet ok={lat !== null && lng !== null}>Location pin</Bullet>
                <Bullet ok={tiers.every((t) => t.name && t.price_kes >= 0)}>Ticket tiers</Bullet>
              </ul>
              <div className="mt-6 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 p-4 text-sm">
                <p className="font-semibold text-foreground">
                  ⏳ Your event will be reviewed by our team before going live.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Events are typically approved within a few hours. You'll see the status update on your dashboard.
                </p>
              </div>
              <div className="mt-4 rounded-2xl bg-primary/[0.07] p-4 text-sm">
                <p className="font-semibold text-foreground">
                  Buyer service fee: <span className="text-primary">3.5% of each ticket order</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Added to the buyer's checkout total and shown before payment.
                </p>
              </div>
              <Button variant="acacia" size="lg" className="mt-6 w-full" disabled={saving} onClick={async () => {
                const ok = await save(true);
                if (ok) navigate("/dashboard");
              }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Submit for approval
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


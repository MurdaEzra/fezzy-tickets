import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Banknote, QrCode, Image as ImageIcon, Settings, Plus,
  ExternalLink, Pencil, Loader2, MapPin, Sparkles, Users, DollarSign, Ticket as TicketIcon,
  Trash2, LogOut, ChevronRight, Copy, Check, Download, Share2, Link as LinkIcon,
  ShieldCheck,
} from "lucide-react";
import QRCode from "qrcode";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, formatEventDate, type DbEvent } from "@/lib/eventsApi";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import PayoutSetup from "./dashboard/PayoutSetup";
import SharePanel from "@/components/dashboard/SharePanel";
import { toast } from "sonner";

interface OrgProfile {
  id: string;
  org_name: string;
  handle: string;
  events_published_count: number;
  contact_email: string | null;
  contact_phone: string | null;
  bio: string | null;
  logo_url: string | null;
  fee_locked_pct: number | null;
  paystack_subaccount_code: string | null;
  mpesa_payout_phone?: string | null;
  till_number?: string | null;
}

type Section = "overview" | "events" | "share" | "payout" | "poster" | "scan" | "team" | "settings";

const MENU: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "events", label: "Events", icon: Calendar },
  { id: "share", label: "Share & banners", icon: Share2 },
  { id: "payout", label: "Payout", icon: Banknote },
  { id: "poster", label: "Poster designer", icon: ImageIcon },
  { id: "scan", label: "Scan tickets", icon: QrCode },
  { id: "team", label: "Team & admins", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

const slugifyHandle = (raw: string) =>
  raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organizer";

const shareOrigin = () => (typeof window !== "undefined" ? window.location.origin : "");
const buildShareUrl = (handle: string, slug: string) => `${shareOrigin()}/o/${handle}/${slug}`;

const OrganizerDashboard = () => {
  const { user, loading: authLoading, deleteAccount, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);

  const plan = (user?.user_metadata?.plan as string | undefined) || "Starter";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signin&redirect=/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      let { data: prof } = await supabase
        .from("organizer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof) {
        const metaOrg = (user.user_metadata?.org_name as string | undefined)?.trim();
        const pending = sessionStorage.getItem("pendingOrgName")?.trim();
        const autoName = metaOrg || pending || (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "My organization";
        const handle = `${slugifyHandle(autoName)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: created, error } = await supabase
          .from("organizer_profiles")
          .insert({ user_id: user.id, org_name: autoName, handle, contact_email: user.email } as never)
          .select()
          .single();
        if (!error && created) {
          prof = created;
          sessionStorage.removeItem("pendingOrgName");
          sessionStorage.removeItem("pendingPlan");
        }
      }

      if (prof) {
        setProfile(prof as OrgProfile);
        const { data: evts } = await supabase
          .from("events")
          .select("*")
          .eq("organizer_id", prof.id)
          .order("created_at", { ascending: false });
        setEvents((evts ?? []) as DbEvent[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim()) return;
    setCreatingProfile(true);
    const handle = `${slugifyHandle(orgName)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("organizer_profiles")
      .insert({ user_id: user.id, org_name: orgName.trim(), handle, contact_email: user.email } as never)
      .select()
      .single();
    setCreatingProfile(false);
    if (error) { toast.error("Could not create organizer profile", { description: error.message }); return; }
    setProfile(data as OrgProfile);
    toast.success("Welcome aboard!", { description: "Let's create your first event." });
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Delete your organizer account permanently? This cannot be undone.");
    if (!confirmed) return;
    try {
      await deleteAccount();
      toast.success("Account deleted");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Could not delete account", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-mesh">
        <main className="container-px mx-auto max-w-2xl py-16">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> First-event fee waived</span>
            <h1 className="display mt-4 text-4xl text-foreground sm:text-5xl">
              Become an <span className="script font-normal text-primary text-[1.2em]">organizer</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Set up your organization to start publishing events. Your first event has 0% platform fee — buyers pay no service fees on any event you run.
            </p>
            <form onSubmit={createProfile} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="orgName">Organization name</Label>
                <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Solstice Collective" required />
              </div>
              <Button type="submit" variant="acacia" size="lg" disabled={creatingProfile} className="w-full">
                {creatingProfile && <Loader2 className="h-4 w-4 animate-spin" />} Create organizer profile
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const initials = profile.org_name.slice(0, 2).toUpperCase();
  const isFirstEvent = profile.events_published_count === 0;
  const feeChip = profile.fee_locked_pct === null
    ? "First event · 0% fee"
    : `${profile.fee_locked_pct}% platform fee`;

  return (
    <div className="min-h-screen bg-cream-deep">
      <div className="flex">
        <aside className={`${mobileMenu ? "fixed inset-y-0 left-0 z-50 w-72 translate-x-0" : "hidden md:flex md:w-72 md:translate-x-0"} flex-col border-r border-border bg-card md:sticky md:top-0 md:h-screen transition-transform`}>
          <div className="flex h-20 items-center gap-3 border-b border-border px-5">
            <Link to="/" className="flex items-center">
              <img src={FEZZY_LOGO_URL} alt="Fezzy" className="h-12 w-auto object-contain" />
            </Link>
          </div>

          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-acacia text-sm font-bold text-primary-foreground shadow-acacia">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{profile.org_name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {plan}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {feeChip}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {MENU.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSection(m.id); setMobileMenu(false); }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  section === m.id
                    ? "bg-gradient-acacia text-primary-foreground shadow-acacia"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <m.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{m.label}</span>
                {section === m.id && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>

        {mobileMenu && <div className="fixed inset-0 z-40 bg-foreground/40 md:hidden" onClick={() => setMobileMenu(false)} />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-8">
            <button onClick={() => setMobileMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-border md:hidden">
              <LayoutDashboard className="h-4 w-4" />
            </button>
            <div className="hidden md:block">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Organizer · {plan} plan</p>
              <p className="font-display text-base font-bold text-foreground">{MENU.find((m) => m.id === section)?.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/organizer/${profile.id}`}>Public page <ExternalLink className="h-3.5 w-3.5" /></Link>
              </Button>
              <Button variant="acacia" size="sm" asChild>
                <Link to="/dashboard/events/new">New event <Plus className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </header>

          <main className="container-px mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
            {section === "overview" && (
              <Overview profile={profile} plan={plan} events={events} isFirstEvent={isFirstEvent} onGoTo={setSection} />
            )}
            {section === "events" && (
              <EventsList events={events} onDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
            )}
            {section === "share" && (
              <SharePanel handle={profile.handle} orgName={profile.org_name} events={events} />
            )}
            {section === "payout" && (
              <PayoutSetup organizerId={profile.id} feeLockedPct={profile.fee_locked_pct} />
            )}
            {section === "poster" && (
              <PosterPanel events={events} />
            )}
            {section === "scan" && (
              <ScanPanel />
            )}
            {section === "team" && (
              <TeamPanel organizerId={profile.id} organizerName={profile.org_name} userId={user?.id ?? ""} />
            )}
            {section === "settings" && (
              <SettingsPanel profile={profile} onDelete={handleDeleteAccount} />
            )}
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
};

const Overview = ({ profile, plan, events, isFirstEvent, onGoTo }: { profile: OrgProfile; plan: string; events: DbEvent[]; isFirstEvent: boolean; onGoTo: (s: Section) => void }) => (
  <div className="space-y-8">
    <div className="rounded-[32px] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 shadow-soft md:p-8">
      <p className="eyebrow">Welcome back · {plan} plan</p>
      <h1 className="display mt-2 text-3xl text-foreground sm:text-4xl">{profile.org_name}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Brighten your events with custom ticket design, unlock faster payouts, and invite trusted admins to help you manage everything.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> Ticket designer</span>
        <span className="chip"><Users className="h-3 w-3 text-primary" /> Admin invites</span>
        <span className="chip"><Banknote className="h-3 w-3 text-primary" /> M-Pesa / till payouts</span>
      </div>
    </div>

    {isFirstEvent && (
      <div className="flex items-center gap-3 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 p-5 shadow-card-soft">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-acacia text-2xl text-primary-foreground shadow-acacia">🎉</div>
        <div className="flex-1">
          <p className="font-display text-base font-bold text-foreground">First event = 0% platform fee</p>
          <p className="text-sm text-muted-foreground">Once you publish, your fee is locked at 10% on every future sale.</p>
        </div>
      </div>
    )}

    {!profile.paystack_subaccount_code && (
      <button onClick={() => onGoTo("payout")} className="text-left w-full flex items-center gap-3 rounded-3xl border border-amber-400/40 bg-amber-50/50 p-5 hover:bg-amber-50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-2xl">💸</div>
        <div className="flex-1">
          <p className="font-display text-base font-bold text-foreground">Connect your payout destination</p>
          <p className="text-sm text-muted-foreground">Money is split instantly to your bank on every sale;  no waiting, no withdrawals.</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>
    )}

    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard icon={TicketIcon} label="Events" value={String(events.length)} accent="from-primary/20 to-primary/5" />
      <StatCard icon={Users} label="Tickets sold" value="0" accent="from-accent/20 to-accent/5" />
      <StatCard icon={DollarSign} label="Revenue" value={formatKES(0)} accent="from-emerald-500/20 to-emerald-500/5" />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <QuickAction title="Payout setup" desc="Money lands in your bank instantly on every sale." icon={Banknote} onClick={() => onGoTo("payout")} />
      <QuickAction title="Design your poster" desc="Create stunning posters in seconds." icon={ImageIcon} onClick={() => onGoTo("poster")} />
    </div>

    <div>
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Recent events</h2>
        <Button variant="ghost" size="sm" onClick={() => onGoTo("events")}>View all <ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="mt-4">
        {events.length === 0 ? <EmptyEvents /> : <EventsGrid events={events.slice(0, 4)} />}
      </div>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, accent }: { icon: typeof TicketIcon; label: string; value: string; accent: string }) => (
  <div className={`relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card-soft`}>
    <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${accent}`} />
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
  </div>
);

const QuickAction = ({ title, desc, icon: Icon, onClick }: { title: string; desc: string; icon: typeof Banknote; onClick: () => void }) => (
  <button onClick={onClick} className="text-left group rounded-3xl border border-border bg-card p-5 shadow-card-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
    <div className="flex items-start gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-display text-base font-bold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </div>
  </button>
);

const EventsList = ({ events, onDeleted }: { events: DbEvent[]; onDeleted: (id: string) => void }) => (
  <div>
    <h1 className="font-display text-2xl font-bold text-foreground">Your events</h1>
    <p className="mt-1 text-sm text-muted-foreground">Edit, view, publish or delete.</p>
    <div className="mt-6">
      {events.length === 0 ? <EmptyEvents /> : <EventsGrid events={events} onDeleted={onDeleted} />}
    </div>
  </div>
);

const EventsGrid = ({ events, onDeleted }: { events: DbEvent[]; onDeleted?: (id: string) => void }) => {
  const handleDelete = async (e: DbEvent) => {
    if (!onDeleted) return;
    const ok = window.confirm(`Delete "${e.title}"? This permanently removes the event, its tiers and any unsold tickets. This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) {
      toast.error("Couldn't delete event", { description: error.message });
      return;
    }
    onDeleted(e.id);
    toast.success("Event deleted");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {events.map((e) => (
        <div key={e.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-0.5 hover:shadow-soft">
          <div className="flex gap-4 p-4">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary">
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground"><Calendar className="h-6 w-6" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-bold leading-tight text-foreground">{e.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  e.status === "published" ? "bg-primary/15 text-primary" :
                  e.status === "draft" ? "bg-secondary text-muted-foreground" :
                  "bg-destructive/15 text-destructive"
                }`}>{e.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatEventDate(e.starts_at)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {e.venue_name ?? "TBA"}
              </p>
              {e.fee_waived && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">🎉 0% fee</span>
              )}
            </div>
          </div>
          <div className="flex border-t border-border">
            <Button variant="ghost" className="flex-1 rounded-none" asChild>
              <Link to={`/dashboard/events/${e.id}`}><Pencil className="h-4 w-4" /> Edit</Link>
            </Button>
            <div className="w-px bg-border" />
            <Button variant="ghost" className="flex-1 rounded-none" asChild>
              <Link to={`/events/${e.slug}`}><ExternalLink className="h-4 w-4" /> View</Link>
            </Button>
            {onDeleted && (
              <>
                <div className="w-px bg-border" />
                <Button variant="ghost" className="flex-1 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(e)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const EmptyEvents = () => (
  <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
    <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
    <p className="mt-4 font-display text-lg">No events yet</p>
    <p className="mt-1 text-sm text-muted-foreground">Create your first event  it's on us.</p>
    <Button variant="acacia" className="mt-6" asChild>
      <Link to="/dashboard/events/new">Create event <Plus className="h-4 w-4" /></Link>
    </Button>
  </div>
);

const PosterPanel = ({ events }: { events: DbEvent[] }) => (
  <div>
    <h1 className="font-display text-2xl font-bold text-foreground">Poster designer</h1>
    <p className="mt-1 text-sm text-muted-foreground">Pick an event to open its full poster designer.</p>
    {events.length === 0 ? <div className="mt-6"><EmptyEvents /></div> : (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link key={e.id} to={`/dashboard/events/${e.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-0.5">
            <div className="aspect-[4/5] bg-secondary">
              {e.poster_url ? (
                <img src={e.poster_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>
              )}
            </div>
            <div className="p-3">
              <p className="truncate font-display text-sm font-bold text-foreground">{e.title}</p>
              <p className="text-xs text-muted-foreground">Open designer →</p>
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
);

const ScanPanel = () => (
  <div>
    <h1 className="font-display text-2xl font-bold text-foreground">Scan tickets</h1>
    <p className="mt-1 text-sm text-muted-foreground">Camera-based door scanner with offline mode and signed-token validation.</p>
    <div className="mt-8 grid place-items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <QrCode className="h-12 w-12 text-primary" />
      <p className="mt-4 font-display text-lg">Open the door scanner</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Sub-500ms HMAC-signed validation. Works offline — check-ins sync when you're back online.</p>
      <Button variant="acacia" className="mt-6" asChild>
        <Link to="/scan">Launch scanner <ChevronRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  </div>
);

const TeamPanel = ({ organizerId, organizerName, userId }: { organizerId: string; organizerName: string; userId: string }) => {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("organizer_admin_invites")
        .select("id, token, invited_email, expires_at, created_at, accepted_by_user_id")
        .eq("organizer_id", organizerId)
        .order("created_at", { ascending: false });
      setInvites(data ?? []);
    })();
  }, [organizerId]);

  const createInvite = async () => {
    if (!email.trim()) {
      toast.error("Add an email address for the invite");
      return;
    }
    setCreating(true);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("organizer_admin_invites")
      .insert({ organizer_id: organizerId, token, invited_email: email.trim(), created_by_user_id: userId, expires_at: expiresAt } as never)
      .select("id, token, invited_email, expires_at, created_at, accepted_by_user_id")
      .single();
    setCreating(false);
    if (error) {
      toast.error("Invite could not be created", { description: error.message });
      return;
    }
    setInvites((prev) => [data, ...prev]);
    setEmail("");
    toast.success("Admin invite created", { description: "Share the link below with your teammate." });
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Team & admins</h1>
        <p className="mt-1 text-sm text-muted-foreground">Invite trusted co-admins to help manage {organizerName}.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8 space-y-4">
        <div>
          <Label htmlFor="invite-email">Invite email</Label>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@yourbrand.com" />
        </div>
        <Button variant="acacia" onClick={createInvite} disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin" />} Create expiring invite link</Button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-foreground">Active invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invite links yet. Create one to add another admin.</p>
        ) : invites.map((invite) => (
          <article key={invite.id} className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{invite.invited_email ?? "Shared invite"}</p>
                <p className="text-xs text-muted-foreground">Expires {new Date(invite.expires_at).toLocaleString()} · {invite.accepted_by_user_id ? "Accepted" : "Pending"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyLink(invite.token)}>Copy link</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

const SettingsPanel = ({ profile, onDelete }: { profile: OrgProfile; onDelete: () => void }) => {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [contactPhone, setContactPhone] = useState(profile.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contact_email ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("organizer_profiles")
      .update({ bio, contact_phone: contactPhone, contact_email: contactEmail })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your organizer profile.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8 space-y-4">
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about your events…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ce">Contact email</Label>
            <Input id="ce" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp">Contact phone</Label>
            <Input id="cp" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <Button variant="acacia" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </div>

      <section className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Delete account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Permanently remove your organizer login.</p>
          </div>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </div>
      </section>
    </div>
  );
};

export default OrganizerDashboard;

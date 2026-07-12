// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Banknote, QrCode, Image as ImageIcon, Settings, Plus,
  ExternalLink, Pencil, Loader2, MapPin, Sparkles, Users, DollarSign, Ticket as TicketIcon,
  Trash2, LogOut, ChevronRight, Copy, Check, Download, Share2, Link as LinkIcon,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, formatEventDate, type DbEvent } from "@/lib/eventsApi";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import { createOrganizerAdminInvite } from "@/lib/organizerInvites";
import PayoutSetup from "./dashboard/PayoutSetup";
import SharePanel from "@/components/dashboard/SharePanel";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PLATFORM_FEE_LABEL, PLATFORM_FEE_PCT, BUYER_FEE_PCT } from "@/lib/pricing";
import { resolveDisplayName } from "@/lib/userProfile";
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

type Section = "overview" | "events" | "share" | "payout" | "poster" | "scan" | "attendees" | "team" | "settings" | "promos";

const MENU: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "events", label: "Events", icon: Calendar },
  { id: "promos", label: "Promo codes", icon: TicketIcon },
  { id: "share", label: "Share & banners", icon: Share2 },
  { id: "payout", label: "Payout", icon: Banknote },
  { id: "poster", label: "Poster designer", icon: ImageIcon },
  { id: "scan", label: "Scan tickets", icon: QrCode },
  { id: "attendees", label: "Attendees", icon: Users },
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
  const [salesSummary, setSalesSummary] = useState({ ticketsSold: 0, revenueKes: 0 });
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  const [isNewOrganizer, setIsNewOrganizer] = useState(false);

  const plan = (user?.user_metadata?.plan as string | undefined) || "Starter";
  const { data: userProfile } = useUserProfile();
  const displayName = resolveDisplayName(user, userProfile);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signin&redirect=/dashboard", { replace: true });
      return;
    }
    if (!user) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roleList = (roles ?? []).map((r) => r.role);
      if (roleList.includes("super_admin") || roleList.includes("admin")) return;

      const access = await getOrganizerAccessStatus(user.id);
      if (access === "pending" || access === "rejected") {
        navigate("/application-pending", { replace: true });
      } else if (access === "none") {
        navigate("/start-selling", { replace: true });
      }
    })();
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
          setIsNewOrganizer(true);
          setWelcomeDialogOpen(true);
        }
      } else {
        // Check if payout isn't set up and show reminder
        if (!prof.paystack_subaccount_code && !prof.mpesa_payout_phone) {
          setWelcomeDialogOpen(true);
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
        const { data: paidOrders } = await supabase
          .from("orders")
          .select("subtotal_kes, platform_fee_kes, total_kes, tickets(id), events!inner(organizer_id)")
          .eq("status", "paid")
          .eq("events.organizer_id", prof.id);
        const summary = ((paidOrders ?? []) as Array<{ subtotal_kes?: number; platform_fee_kes?: number; total_kes?: number; tickets?: unknown[] }>).reduce(
          (acc, order) => ({
            ticketsSold: acc.ticketsSold + (Array.isArray(order.tickets) ? order.tickets.length : 0),
            revenueKes: acc.revenueKes + Math.max(0, (order.subtotal_kes ?? order.total_kes ?? 0) - (order.platform_fee_kes ?? 0)),
          }),
          { ticketsSold: 0, revenueKes: 0 },
        );
        setSalesSummary(summary);
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
              Set up your organization to start publishing events. Buyers pay a 3.5% service fee during checkout.
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

  const isFirstEvent = profile.events_published_count === 0;
  const feeChip = profile.fee_locked_pct === null
    ? `First event free · then ${PLATFORM_FEE_PCT}%`
    : `${profile.fee_locked_pct}% ${PLATFORM_FEE_LABEL.toLowerCase()}`;

  return (
    <div className="tm-page min-h-screen bg-background">
      {/* Welcome / Payout Reminder Dialog */}
      <Dialog open={welcomeDialogOpen} onOpenChange={setWelcomeDialogOpen}>
        <DialogContent className="sm:max-w-[500px] overflow-hidden p-0">
          <div className="relative">
            {/* Google-style colorful header */}
            <div className="h-2 bg-gradient-to-r from-blue-500 via-red-500 via-yellow-500 to-green-500"></div>
            <button
              onClick={() => setWelcomeDialogOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-8">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <img src={FEZZY_LOGO_URL} alt="Fezzy" className="h-12 w-auto object-contain" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold">
                {isNewOrganizer ? "Welcome to Fezzy Tickets!" : "Set up your payout account"}
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                {isNewOrganizer
                  ? "Thank you for choosing Fezzy Tickets to power your events! Let's get you set up so you can receive your funds."
                  : "You haven't set up your payout account yet. Let's fix that so you can get paid!"}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                <Sparkles className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Instant payouts</p>
                  <p className="text-sm text-muted-foreground">Get paid as soon as tickets sell with M-Pesa or Paystack</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                <TicketIcon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Create your first event</p>
                  <p className="text-sm text-muted-foreground">After setting up payouts, you can start selling tickets</p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-8 flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setWelcomeDialogOpen(false)}>
                Do this later
              </Button>
              <Button variant="acacia" className="flex-1" onClick={() => {
                setWelcomeDialogOpen(false);
                setSection("payout");
              }}>
                Set up payouts now
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex">
        <aside className={`${mobileMenu ? "fixed inset-y-0 left-0 z-50 w-72 translate-x-0" : "hidden md:flex md:w-72 md:translate-x-0"} flex-col border-r border-border bg-card md:sticky md:top-0 md:h-screen transition-transform`}>
          <div className="flex h-20 items-center gap-3 border-b border-border px-5">
            <Link to="/" className="flex items-center">
              <img src={FEZZY_LOGO_URL} alt="Fezzy" className="h-12 w-auto object-contain" />
            </Link>
          </div>

          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <UserAvatar className="h-10 w-10 shadow-acacia" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.org_name}</p>
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

          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
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
              <Overview profile={profile} plan={plan} events={events} salesSummary={salesSummary} isFirstEvent={isFirstEvent} onGoTo={setSection} />
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
            {section === "attendees" && (
              <AttendeesPanel organizerId={profile.id} />
            )}
            {section === "promos" && (
              <PromosPanel profile={profile} events={events} />
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

const Overview = ({ profile, plan, events, salesSummary, isFirstEvent, onGoTo }: { profile: OrgProfile; plan: string; events: DbEvent[]; salesSummary: { ticketsSold: number; revenueKes: number }; isFirstEvent: boolean; onGoTo: (s: Section) => void }) => (
  <div className="space-y-8">
    <div className="rounded-[32px] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 shadow-soft md:p-8">
      <p className="eyebrow">Welcome back · {plan} plan</p>
      <h1 className="display mt-2 text-3xl text-foreground sm:text-4xl">{profile.org_name}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Brighten your events with custom ticket design, unlock faster payouts, and invite trusted admins to help you manage everything.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> Custom posters</span>
        <span className="chip"><Users className="h-3 w-3 text-primary" /> Admin invites</span>
        <span className="chip"><Banknote className="h-3 w-3 text-primary" /> M-Pesa / till payouts</span>
      </div>
    </div>

    {isFirstEvent && (
      <div className="flex items-center gap-3 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 p-5 shadow-card-soft">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-acacia text-2xl text-primary-foreground shadow-acacia">🎉</div>
        <div className="flex-1">
          <p className="font-display text-base font-bold text-foreground">Fee structure</p>
          <p className="text-sm text-muted-foreground">
            Buyers pay a {BUYER_FEE_PCT}% service fee at checkout. Platform fee to organizers is {PLATFORM_FEE_PCT}% per sale (waived on your first published event).
          </p>
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
      <StatCard icon={Users} label="Tickets sold" value={salesSummary.ticketsSold.toLocaleString()} accent="from-accent/20 to-accent/5" />
      <StatCard icon={DollarSign} label="Revenue" value={formatKES(salesSummary.revenueKes)} accent="from-emerald-500/20 to-emerald-500/5" />
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
                  e.status === "pending_approval" ? "bg-amber-500/15 text-amber-600" :
                  e.status === "draft" ? "bg-secondary text-muted-foreground" :
                  "bg-destructive/15 text-destructive"
                }`}>{e.status === "pending_approval" ? "Pending approval" : e.status}</span>
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

type AttendeeResult = {
  id: string;
  holder_name: string;
  holder_email: string;
  holder_phone: string | null;
  status: string;
  events: { title: string; starts_at: string } | null;
  ticket_tiers: { name: string } | null;
  orders: { payment_ref: string | null; guest_name: string; guest_email: string; total_kes: number; status: string } | null;
};

const AttendeesPanel = ({ organizerId }: { organizerId: string }) => {
  const [bookingRef, setBookingRef] = useState("");
  const [results, setResults] = useState<AttendeeResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchAttendees = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = bookingRef.trim();
    if (!ref) {
      toast.error("Enter a booking reference");
      return;
    }
    setSearching(true);
    setSearched(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("id, holder_name, holder_email, holder_phone, status, events!inner(title, starts_at, organizer_id), ticket_tiers(name), orders!inner(payment_ref, guest_name, guest_email, total_kes, status)")
      .eq("events.organizer_id", organizerId)
      .eq("orders.status", "paid")
      .ilike("orders.payment_ref", `%${ref}%`);
    setSearching(false);
    if (error) {
      toast.error("Attendee search failed", { description: error.message });
      return;
    }
    setResults((data ?? []) as AttendeeResult[]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Attendees</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search paid attendees by booking reference.</p>
      </div>

      <form onSubmit={searchAttendees} className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        <Label htmlFor="booking-ref">Booking reference</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input id="booking-ref" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="e.g. FZY-12345 or payment ref" />
          <Button type="submit" variant="acacia" disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </form>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        {searching ? (
          <div className="grid min-h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !searched ? (
          <p className="text-sm text-muted-foreground">Enter a booking reference to find the attendee tickets.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid attendee matched that booking reference.</p>
        ) : (
          <div className="space-y-3">
            {results.map((ticket) => (
              <article key={ticket.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-display text-lg font-bold text-foreground">{ticket.holder_name}</p>
                    <p className="text-sm text-muted-foreground">{ticket.holder_email}{ticket.holder_phone ? ` - ${ticket.holder_phone}` : ""}</p>
                    <p className="mt-2 text-sm text-foreground">{ticket.events?.title ?? "Event"} - {ticket.ticket_tiers?.name ?? "Ticket"}</p>
                    <p className="text-xs text-muted-foreground">Booking ref: {ticket.orders?.payment_ref ?? "N/A"}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">{ticket.status}</span>
                    <p className="mt-2 text-sm font-semibold text-foreground">{formatKES(ticket.orders?.total_kes ?? 0)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

type OrganizerInvite = {
  id: string;
  token: string;
  invited_email: string | null;
  expires_at: string;
  created_at: string;
  accepted_by_user_id: string | null;
};

const TeamPanel = ({ organizerId, organizerName, userId }: { organizerId: string; organizerName: string; userId: string }) => {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<OrganizerInvite[]>([]);
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
    const { data, error } = await createOrganizerAdminInvite(supabase, organizerId, email);
    setCreating(false);

    if (error) {
      toast.error("Invite could not be created", { description: error.message });
      return;
    }

    const inviteRecord = data?.[0];
    if (!inviteRecord?.token) {
      toast.error("Invite could not be created", { description: "No invite token was returned." });
      return;
    }

    setInvites((prev) => [
      {
        id: `invite-${inviteRecord.token}`,
        token: inviteRecord.token,
        invited_email: email.trim(),
        expires_at: inviteRecord.expires_at,
        created_at: new Date().toISOString(),
        accepted_by_user_id: null,
      },
      ...prev,
    ]);
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

type PromoCode = {
  id: string;
  event_id: string;
  organizer_id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

const PromosPanel = ({ profile, events }: { profile: OrgProfile; events: DbEvent[] }) => {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [selectedEventId, setSelectedEventId] = useState("");
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [maxUses, setMaxUses] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("organizer_id", profile.id)
        .order("created_at", { ascending: false });
      setPromos((data ?? []) as PromoCode[]);
      setLoading(false);
    })();
  }, [profile.id]);

  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !code.trim()) {
      toast.error("Please select an event and enter a promo code");
      return;
    }
    if (discountPercent < 1 || discountPercent > 100) {
      toast.error("Discount must be between 1 and 100 percent");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert({
          event_id: selectedEventId,
          organizer_id: profile.id,
          code: code.trim(),
          discount_percent: discountPercent,
          max_uses: maxUses.trim() ? parseInt(maxUses) : null,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create promo code", { description: error.message });
        return;
      }

      setPromos([data as PromoCode, ...promos]);
      setCode("");
      setDiscountPercent(10);
      setMaxUses("");
      setStartsAt("");
      setEndsAt("");
      setSelectedEventId("");
      toast.success("Promo code created");
    } finally {
      setCreating(false);
    }
  };

  const deletePromo = async (id: string) => {
    const confirmed = window.confirm("Delete this promo code?");
    if (!confirmed) return;

    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete promo code", { description: error.message });
      return;
    }

    setPromos(promos.filter(p => p.id !== id));
    toast.success("Promo code deleted");
  };

  const copyCode = async (promoCode: string) => {
    await navigator.clipboard.writeText(promoCode);
    toast.success("Promo code copied");
  };

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Promo codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and manage discount codes for your events.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        <h2 className="font-display text-lg font-bold text-foreground">Create new promo</h2>
        <form onSubmit={createPromo} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event">Event</Label>
              <select
                id="event"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Select an event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SUMMER20" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                min="1"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="max-uses">Max uses (optional)</Label>
              <Input
                id="max-uses"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label htmlFor="starts-at">Starts at (optional)</Label>
              <Input id="starts-at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ends-at">Ends at (optional)</Label>
              <Input id="ends-at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <Button type="submit" variant="acacia" disabled={creating} className="w-full sm:w-auto">
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create promo code
          </Button>
        </form>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        <h2 className="font-display text-lg font-bold text-foreground">Your promo codes</h2>
        <div className="mt-4 space-y-3">
          {promos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No promo codes yet.</p>
          ) : (
            promos.map((promo) => {
              const event = events.find(e => e.id === promo.event_id);
              return (
                <div key={promo.id} className="flex items-start justify-between gap-4 p-4 border border-border rounded-2xl bg-background">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{promo.code}</span>
                      <span className="chip">{promo.discount_percent}% OFF</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event?.title || "Unknown event"} · {promo.used_count} / {promo.max_uses || "∞"} uses
                    </p>
                    {(promo.starts_at || promo.ends_at) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {promo.starts_at && `Starts: ${new Date(promo.starts_at).toLocaleString()}`}
                        {promo.starts_at && promo.ends_at && " · "}
                        {promo.ends_at && `Ends: ${new Date(promo.ends_at).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyCode(promo.code)}>Copy</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePromo(promo.id)}>Delete</Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;


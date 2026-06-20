import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2, Shield, Users, Calendar, Ticket, ExternalLink, ClipboardCheck, ScrollText,
  Megaphone, LayoutDashboard, ListChecks, ReceiptText, Building2, FileText, Save,
  LogOut, ChevronRight, X, MapPin, Clock, ArrowLeft, Check, XCircle,
} from "lucide-react";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import { formatKES, formatEventDate, formatEventDateLong, formatEventTime, formatPrice } from "@/lib/eventsApi";
import { PLATFORM_FEE_PCT, BUYER_FEE_PCT } from "@/lib/pricing";
import { logActivity } from "@/lib/activityLog";
import { defaultLiveBarItems, fetchHomepageSettings, updateHomepageSettings } from "@/lib/homepageSettings";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";

interface EventRow {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  status: string;
  slug: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  country: string | null;
  cover_image_url: string | null;
  poster_url: string | null;
  is_stream: boolean;
  stream_url: string | null;
  organizer_id: string;
  created_at: string;
}

interface TierRow {
  id: string;
  name: string;
  price_kes: number;
  quantity: number;
  sold: number;
  description: string | null;
}

interface OrganizerRow {
  id: string;
  org_name: string;
  logo_url: string | null;
  contact_email: string | null;
}

interface OrderRow {
  id: string;
  total_kes: number;
  buyer_fee_kes: number;
  platform_fee_kes: number;
  organizer_fee_kes: number;
  status: string;
  payment_method: string;
  created_at: string;
  guest_name: string;
}

interface LogRow {
  id: string;
  level: string;
  action: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ApprovalRow {
  id: string;
  org_name: string;
  full_name: string | null;
  email: string;
  country: string;
  status: string;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [view, setView] = useState<"overview" | "homepage" | "approvals" | "events" | "orders" | "organizers" | "logs">("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [organizers, setOrganizers] = useState<{ id: string; org_name: string; events_published_count: number; contact_email: string | null; fee_locked_pct: number | null; paystack_subaccount_code: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [savingHomepage, setSavingHomepage] = useState(false);
  const [liveBarText, setLiveBarText] = useState(defaultLiveBarItems.join("\n"));
  const [headlinerEventId, setHeadlinerEventId] = useState<string>("");

  // Event detail panel state
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [selectedEventTiers, setSelectedEventTiers] = useState<TierRow[]>([]);
  const [selectedEventOrganizer, setSelectedEventOrganizer] = useState<OrganizerRow | null>(null);
  const [loadingEventDetail, setLoadingEventDetail] = useState(false);
  const [approvingEvent, setApprovingEvent] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?mode=signin&redirect=/admin", { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role);
      const ok = roles.includes("super_admin") || roles.includes("admin");
      setAuthorized(ok);
      if (!ok) return;
      const [{ data: evts }, { data: ords }, { data: orgs }, { data: pending }, { data: logRows }, settings] = await Promise.all([
        supabase.from("events").select("id, title, tagline, description, category, status, slug, starts_at, ends_at, venue_name, venue_address, city, country, cover_image_url, poster_url, is_stream, stream_url, organizer_id, created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("orders").select("id, total_kes, buyer_fee_kes, platform_fee_kes, organizer_fee_kes, status, payment_method, created_at, guest_name").eq("status", "paid").order("created_at", { ascending: false }).limit(50),
        supabase.from("organizer_profiles").select("id, org_name, events_published_count, contact_email, fee_locked_pct, paystack_subaccount_code").order("created_at", { ascending: false }),
        supabase.from("organizer_approval_requests").select("id, org_name, full_name, email, country, status, created_at").order("created_at", { ascending: false }),
        supabase.from("platform_logs").select("id, level, action, message, metadata, created_at").order("created_at", { ascending: false }).limit(200),
        fetchHomepageSettings(),
      ]);
      setEvents((evts ?? []) as EventRow[]);
      setOrders((ords ?? []) as OrderRow[]);
      setOrganizers((orgs ?? []) as typeof organizers);
      setApprovals((pending ?? []) as ApprovalRow[]);
      setLogs((logRows ?? []) as LogRow[]);
      setLiveBarText(settings.live_bar_items.join("\n"));
      setHeadlinerEventId(settings.headliner_event_id ?? "");
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const openEventDetail = async (event: EventRow) => {
    setSelectedEvent(event);
    setLoadingEventDetail(true);
    setSelectedEventTiers([]);
    setSelectedEventOrganizer(null);

    const [{ data: tiers }, { data: org }] = await Promise.all([
      supabase.from("ticket_tiers").select("id, name, price_kes, quantity, sold, description").eq("event_id", event.id).order("sort_order"),
      supabase.from("organizer_profiles").select("id, org_name, logo_url, contact_email").eq("id", event.organizer_id).maybeSingle(),
    ]);
    setSelectedEventTiers((tiers ?? []) as TierRow[]);
    setSelectedEventOrganizer(org as OrganizerRow | null);
    setLoadingEventDetail(false);
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
    setSelectedEventTiers([]);
    setSelectedEventOrganizer(null);
  };

  const approveEvent = async (id: string) => {
    setApprovingEvent(true);
    const { error } = await supabase.from("events").update({ status: "published" as const }).eq("id", id);
    if (error) { toast.error(error.message); setApprovingEvent(false); return; }
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status: "published" } : e)));
    if (selectedEvent?.id === id) setSelectedEvent((prev) => prev ? { ...prev, status: "published" } : null);
    await logActivity("admin.event.approve", { message: "Event approved and published", metadata: { eventId: id }, userId: user?.id });
    toast.success("Event approved and published! 🎉");
    setApprovingEvent(false);
  };

  const rejectEvent = async (id: string) => {
    setApprovingEvent(true);
    const { error } = await supabase.from("events").update({ status: "draft" as const }).eq("id", id);
    if (error) { toast.error(error.message); setApprovingEvent(false); return; }
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status: "draft" } : e)));
    if (selectedEvent?.id === id) setSelectedEvent((prev) => prev ? { ...prev, status: "draft" } : null);
    await logActivity("admin.event.reject", { level: "warn", message: "Event rejected — returned to draft", metadata: { eventId: id }, userId: user?.id });
    toast.success("Event rejected — returned to draft");
    setApprovingEvent(false);
  };

  const updateEventStatus = async (id: string, status: "published" | "draft") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status } : e)));
    if (selectedEvent?.id === id) setSelectedEvent((prev) => prev ? { ...prev, status } : null);
    await logActivity("admin.event.status", { message: `Event ${status}`, metadata: { eventId: id, status }, userId: user?.id });
    toast.success(`Event ${status}`);
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEvents((es) => es.filter((e) => e.id !== id));
    if (selectedEvent?.id === id) closeEventDetail();
    await logActivity("admin.event.delete", { level: "warn", message: "Event deleted", metadata: { eventId: id }, userId: user?.id });
    toast.success("Event deleted");
  };

  const reviewApproval = async (requestId: string, action: "approve" | "reject") => {
    setReviewingId(requestId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-organizer-request", {
        body: { requestId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setApprovals((rows) =>
        rows.map((r) => (r.id === requestId ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r))
      );
      if (action === "approve") {
        const { data: orgs } = await supabase
          .from("organizer_profiles")
          .select("id, org_name, events_published_count, contact_email, fee_locked_pct, paystack_subaccount_code")
          .order("created_at", { ascending: false });
        setOrganizers((orgs ?? []) as typeof organizers);
      }
      toast.success(action === "approve" ? "Organizer approved — access email sent" : "Application rejected");
      await logActivity(`admin.organizer.${action}`, {
        message: action === "approve" ? "Organizer approved" : "Organizer rejected",
        metadata: { requestId },
        userId: user?.id,
        level: action === "reject" ? "warn" : "info",
      });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Review failed");
    } finally {
      setReviewingId(null);
    }
  };

  const saveHomepageSettings = async () => {
    setSavingHomepage(true);
    try {
      const live_bar_items = liveBarText.split("\n").map((item) => item.trim()).filter(Boolean);
      if (live_bar_items.length === 0) {
        toast.error("Add at least one live bar message.");
        return;
      }
      await updateHomepageSettings({
        live_bar_items,
        headliner_event_id: headlinerEventId || null,
        updated_by: user?.id,
      });
      queryClient.invalidateQueries({ queryKey: ["homepage-settings"] });
      await logActivity("admin.homepage.update", {
        message: "Homepage settings updated",
        metadata: { liveBarCount: live_bar_items.length, headlinerEventId: headlinerEventId || null },
        userId: user?.id,
      });
      toast.success("Homepage settings saved");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Could not save homepage settings");
    } finally {
      setSavingHomepage(false);
    }
  };

  const pendingOrgCount = approvals.filter((a) => a.status === "pending").length;
  const pendingEventCount = events.filter((e) => e.status === "pending_approval").length;
  const errorCount = logs.filter((l) => l.level === "error").length;
  const totalPlatformRev = orders.reduce((s, o) => s + (o.platform_fee_kes ?? o.organizer_fee_kes ?? 0), 0);
  const totalBuyerFees = orders.reduce((s, o) => s + (o.buyer_fee_kes ?? 0), 0);

  if (authLoading || authorized === null) {
    return <div className="grid min-h-screen place-items-center bg-[#06070a]"><Loader2 className="h-6 w-6 animate-spin text-[#10ff8a]" /></div>;
  }

  if (!authorized) {
    return (
      <div className="tm-page min-h-screen bg-[#06070a] text-white">
        <main className="container-px mx-auto max-w-md py-24 text-center">
          <Shield className="mx-auto h-12 w-12 text-[#8a8fa3]" />
          <h1 className="display mt-4 text-3xl text-white">Access denied</h1>
          <p className="mt-2 text-[#8a8fa3]">You don't have super admin permissions.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "published": return "bg-primary/15 text-primary";
      case "pending_approval": return "bg-amber-500/15 text-amber-500";
      case "draft": return "bg-secondary text-muted-foreground";
      case "cancelled": return "bg-destructive/15 text-destructive";
      case "completed": return "bg-zinc-500/15 text-zinc-400";
      default: return "bg-secondary text-muted-foreground";
    }
  };
  const statusLabel = (status: string) => status === "pending_approval" ? "Pending approval" : status;

  return (
    <div className="tm-page min-h-screen bg-[#06070a] text-white">
      <div className="flex">
        <aside className={`${mobileMenu ? "fixed inset-y-0 left-0 z-50 w-72 translate-x-0" : "hidden md:flex md:w-72 md:translate-x-0"} flex-col border-r border-border bg-card transition-transform md:sticky md:top-0 md:h-screen`}>
          <div className="flex h-20 items-center justify-between gap-3 border-b border-border px-5">
            <Link to="/" className="flex items-center">
              <img src={FEZZY_LOGO_URL} alt="Fezzy" className="h-12 w-auto object-contain" />
            </Link>
            <button
              onClick={() => setMobileMenu(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <UserAvatar className="h-10 w-10 shadow-acacia" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">Super admin</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Platform control
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {([
              ["overview", LayoutDashboard, "Overview", null],
              ["homepage", Megaphone, "Homepage", null],
              ["approvals", ListChecks, "Approvals", pendingOrgCount],
              ["events", Calendar, "Events", pendingEventCount],
              ["orders", ReceiptText, "Orders", null],
              ["organizers", Building2, "Organizers", null],
              ["logs", FileText, "Logs", errorCount],
            ] as const).map(([key, Icon, label, count]) => (
              <button
                key={key}
                onClick={() => {
                  setView(key);
                  setMobileMenu(false);
                  if (key !== "events") closeEventDetail();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${view === key ? "bg-gradient-acacia text-primary-foreground shadow-acacia" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {!!count && count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${view === key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"}`}>
                    {count}
                  </span>
                )}
                {view === key && <ChevronRight className="h-3.5 w-3.5" />}
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
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Super admin</p>
              <p className="font-display text-base font-bold text-foreground">
                {view === "homepage" ? "Homepage" : view === "approvals" ? "Approvals" : view.charAt(0).toUpperCase() + view.slice(1)}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">View site <ExternalLink className="h-3.5 w-3.5" /></Link>
            </Button>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10ff8a] text-[#04130a] shadow-[0_18px_50px_-18px_rgba(16,255,138,.55)]">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#10ff8a]">Super admin</p>
                  <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Platform control</h1>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-4">
                <Stat icon={Calendar} label="Events" value={String(events.length)} />
                <Stat icon={Users} label="Organizers" value={String(organizers.length)} />
                <Stat icon={Ticket} label={`Platform fees (${PLATFORM_FEE_PCT}%)`} value={formatKES(totalPlatformRev)} />
                <Stat icon={ScrollText} label={`Buyer fees (${BUYER_FEE_PCT}%)`} value={formatKES(totalBuyerFees)} />
              </div>
              <p className="mt-3 text-xs text-[#8a8fa3]">
                Platform fee ({PLATFORM_FEE_PCT}%) is charged to organizers per sale. Buyer service fee ({BUYER_FEE_PCT}%) is added at checkout.
              </p>
            </div>

            <section>
              {loading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
                <>
                  {view === "overview" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Pending event approvals card */}
                      {pendingEventCount > 0 && (
                        <div className="lg:col-span-2 rounded-3xl border border-amber-500/30 bg-amber-500/[0.06] p-6 shadow-card-soft">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/20">
                              <Clock className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <h3 className="font-display text-lg font-bold text-foreground">{pendingEventCount} event{pendingEventCount !== 1 ? "s" : ""} awaiting approval</h3>
                              <p className="text-sm text-muted-foreground">Review and approve events submitted by organizers.</p>
                            </div>
                            <Button variant="outline" size="sm" className="ml-auto border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => setView("events")}>
                              Review events <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                        <h3 className="font-display text-lg font-bold">Recent paid orders</h3>
                        <div className="mt-3 space-y-2">
                          {orders.slice(0, 5).map((o) => (
                            <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                              <span className="truncate">{o.guest_name}</span>
                              <span className="font-semibold">{formatKES(o.total_kes)}</span>
                            </div>
                          ))}
                          {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
                        </div>
                      </div>
                      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                        <h3 className="font-display text-lg font-bold">Recent events</h3>
                        <div className="mt-3 space-y-2">
                          {events.slice(0, 5).map((e) => (
                            <button key={e.id} onClick={() => { setView("events"); openEventDetail(e); }} className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-sm text-left transition hover:border-primary/40 hover:bg-primary/[0.03]">
                              <span className="truncate font-semibold">{e.title}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadgeClass(e.status)}`}>
                                {e.status === "pending_approval" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
                                {statusLabel(e.status)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {view === "homepage" && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Live bar</p>
                            <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Announcement messages</h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Add one message per line. These messages appear in the moving live bar above the navbar.
                            </p>
                          </div>
                          <Megaphone className="h-6 w-6 text-primary" />
                        </div>
                        <textarea
                          value={liveBarText}
                          onChange={(event) => setLiveBarText(event.target.value)}
                          rows={7}
                          className="mt-6 w-full rounded-2xl border border-border bg-background p-4 text-sm text-foreground outline-none transition focus:border-primary"
                          placeholder="Write each live bar message on a new line"
                        />
                        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
                          <div className="no-scrollbar flex gap-8 overflow-hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {liveBarText.split("\n").filter(Boolean).map((item, index) => (
                              <span key={`${item}-${index}`} className="flex shrink-0 items-center gap-2">
                                <Megaphone className="h-3.5 w-3.5 text-primary" />
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Headliner</p>
                        <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Featured event</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose the event shown in the homepage hero ticket.
                        </p>
                        <select
                          value={headlinerEventId}
                          onChange={(event) => setHeadlinerEventId(event.target.value)}
                          className="mt-6 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary"
                        >
                          <option value="">Use newest event</option>
                          {events.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.title} ({statusLabel(event.status)})
                            </option>
                          ))}
                        </select>
                        <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background p-4 text-sm">
                          <p className="font-semibold text-foreground">
                            {events.find((event) => event.id === headlinerEventId)?.title ?? "Newest event fallback"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            The homepage falls back automatically if the selected event is unpublished or unavailable.
                          </p>
                        </div>
                        <Button
                          onClick={saveHomepageSettings}
                          disabled={savingHomepage}
                          className="mt-6 w-full bg-[#10ff8a] text-[#04130a] hover:bg-[#5dffaf]"
                        >
                          {savingHomepage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save homepage
                        </Button>
                      </div>
                    </div>
                  )}

                  {view === "approvals" && (
                    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left">Organization</th>
                            <th className="px-4 py-3 text-left">Applicant</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvals.map((a) => (
                            <tr key={a.id} className="border-t border-border">
                              <td className="px-4 py-3 font-semibold">{a.org_name}</td>
                              <td className="px-4 py-3">{a.full_name ?? "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${a.status === "pending" ? "bg-amber-100 text-amber-800" :
                                    a.status === "approved" ? "bg-primary/15 text-primary" :
                                      "bg-destructive/15 text-destructive"
                                  }`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {a.status === "pending" ? (
                                  <div className="inline-flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="acacia"
                                      disabled={reviewingId === a.id}
                                      onClick={() => reviewApproval(a.id, "approve")}
                                    >
                                      {reviewingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={reviewingId === a.id}
                                      onClick={() => reviewApproval(a.id, "reject")}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Reviewed</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {approvals.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No organizer applications yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {view === "events" && !selectedEvent && (
                    <div className="space-y-6">
                      {/* Pending approval section */}
                      {pendingEventCount > 0 && (
                        <div>
                          <div className="mb-4 flex items-center gap-2">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                            <h2 className="font-display text-lg font-bold text-amber-400">Awaiting your approval ({pendingEventCount})</h2>
                          </div>
                          <div className="overflow-hidden rounded-3xl border border-amber-500/30 bg-card shadow-card-soft">
                            <table className="w-full text-sm">
                              <thead className="bg-amber-500/[0.06] text-xs uppercase tracking-wider text-amber-400">
                                <tr>
                                  <th className="px-4 py-3 text-left">Event</th>
                                  <th className="px-4 py-3 text-left">Date</th>
                                  <th className="px-4 py-3 text-left">Location</th>
                                  <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {events.filter((e) => e.status === "pending_approval").map((e) => (
                                  <tr key={e.id} className="border-t border-amber-500/20 cursor-pointer transition hover:bg-amber-500/[0.04]" onClick={() => openEventDetail(e)}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
                                          {e.cover_image_url || e.poster_url ? (
                                            <img src={e.poster_url || e.cover_image_url || ""} alt="" className="h-full w-full object-cover" />
                                          ) : (
                                            <div className="grid h-full w-full place-items-center text-muted-foreground"><Calendar className="h-4 w-4" /></div>
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-foreground">{e.title}</p>
                                          {e.category && <p className="text-xs text-muted-foreground">{e.category}</p>}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatEventDate(e.starts_at)}</td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{e.city || e.venue_name || "TBA"}</td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="inline-flex gap-2" onClick={(ev) => ev.stopPropagation()}>
                                        <Button size="sm" variant="acacia" disabled={approvingEvent} onClick={() => approveEvent(e.id)}>
                                          <Check className="h-3 w-3" /> Approve
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={approvingEvent} onClick={() => rejectEvent(e.id)}>
                                          <XCircle className="h-3 w-3" /> Reject
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* All events table */}
                      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left">Event</th>
                              <th className="px-4 py-3 text-left">Status</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {events.map((e) => (
                              <tr key={e.id} className="border-t border-border cursor-pointer transition hover:bg-primary/[0.02]" onClick={() => openEventDetail(e)}>
                                <td className="px-4 py-3 font-semibold text-foreground">{e.title}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadgeClass(e.status)}`}>
                                    {e.status === "pending_approval" && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
                                    {statusLabel(e.status)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex gap-2" onClick={(ev) => ev.stopPropagation()}>
                                    <Button size="sm" variant="outline" asChild>
                                      <Link to={`/events/${e.slug}`}>View <ExternalLink className="h-3 w-3" /></Link>
                                    </Button>
                                    {e.status === "pending_approval" && (
                                      <Button size="sm" variant="acacia" onClick={() => approveEvent(e.id)}>Approve</Button>
                                    )}
                                    {e.status === "published" && (
                                      <Button size="sm" variant="outline" onClick={() => updateEventStatus(e.id, "draft")}>Unpublish</Button>
                                    )}
                                    {e.status === "draft" && (
                                      <Button size="sm" variant="acacia" onClick={() => updateEventStatus(e.id, "published")}>Publish</Button>
                                    )}
                                    <Button size="sm" variant="destructive" onClick={() => deleteEvent(e.id)}>Delete</Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Event detail panel */}
                  {view === "events" && selectedEvent && (
                    <div className="space-y-6 animate-fade-up">
                      <button onClick={closeEventDetail} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to all events
                      </button>

                      {/* Status banner for pending events */}
                      {selectedEvent.status === "pending_approval" && (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-amber-500/30 bg-amber-500/[0.06] p-6">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/20">
                              <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                            </div>
                            <div>
                              <p className="font-display text-base font-bold text-amber-400">Awaiting your approval</p>
                              <p className="text-xs text-muted-foreground">Review the event details below, then approve or reject.</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="acacia" disabled={approvingEvent} onClick={() => approveEvent(selectedEvent.id)}>
                              {approvingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Approve & publish
                            </Button>
                            <Button variant="outline" disabled={approvingEvent} onClick={() => rejectEvent(selectedEvent.id)}>
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}

                      {loadingEventDetail ? (
                        <div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                          {/* Left column - event info */}
                          <div className="space-y-6">
                            {/* Cover image */}
                            {(selectedEvent.poster_url || selectedEvent.cover_image_url) && (
                              <div className="overflow-hidden rounded-3xl border border-border">
                                <img src={selectedEvent.poster_url || selectedEvent.cover_image_url || ""} alt={selectedEvent.title} className="w-full max-h-80 object-cover" />
                              </div>
                            )}

                            {/* Basic info */}
                            <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-3 mb-3">
                                    {selectedEvent.category && (
                                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">{selectedEvent.category}</span>
                                    )}
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(selectedEvent.status)}`}>
                                      {selectedEvent.status === "pending_approval" && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
                                      {statusLabel(selectedEvent.status)}
                                    </span>
                                    {selectedEvent.is_stream && (
                                      <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">Stream</span>
                                    )}
                                  </div>
                                  <h2 className="font-display text-3xl font-bold text-foreground">{selectedEvent.title}</h2>
                                  {selectedEvent.tagline && <p className="mt-2 text-lg text-muted-foreground italic">{selectedEvent.tagline}</p>}
                                </div>
                              </div>

                              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-primary" />
                                  {formatEventDateLong(selectedEvent.starts_at)}
                                </span>
                                <span className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-primary" />
                                  {formatEventTime(selectedEvent.starts_at)}
                                  {selectedEvent.ends_at && ` — ${formatEventTime(selectedEvent.ends_at)}`}
                                </span>
                                {(selectedEvent.venue_name || selectedEvent.city) && (
                                  <span className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    {[selectedEvent.venue_name, selectedEvent.city, selectedEvent.country].filter(Boolean).join(", ")}
                                  </span>
                                )}
                              </div>

                              {selectedEvent.description && (
                                <div className="mt-6 border-t border-border pt-6">
                                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-3">Description</p>
                                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{selectedEvent.description}</p>
                                </div>
                              )}
                            </div>

                            {/* Organizer info */}
                            {selectedEventOrganizer && (
                              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                                <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">Organizer</p>
                                <div className="flex items-center gap-4">
                                  {selectedEventOrganizer.logo_url ? (
                                    <img src={selectedEventOrganizer.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                                  ) : (
                                    <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-acacia font-display text-lg font-bold text-primary-foreground">
                                      {selectedEventOrganizer.org_name.charAt(0)}
                                    </span>
                                  )}
                                  <div>
                                    <p className="font-semibold text-foreground">{selectedEventOrganizer.org_name}</p>
                                    {selectedEventOrganizer.contact_email && (
                                      <p className="text-xs text-muted-foreground">{selectedEventOrganizer.contact_email}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right column - tiers & actions */}
                          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                            {/* Ticket tiers */}
                            <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                              <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">Ticket tiers</p>
                              {selectedEventTiers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No ticket tiers configured.</p>
                              ) : (
                                <div className="space-y-3">
                                  {selectedEventTiers.map((tier) => (
                                    <div key={tier.id} className="rounded-2xl border border-border bg-background p-4">
                                      <div className="flex items-center justify-between">
                                        <p className="font-display text-base font-bold text-foreground">{tier.name}</p>
                                        <p className="font-bold text-foreground">{formatPrice(tier.price_kes)}</p>
                                      </div>
                                      {tier.description && <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>}
                                      <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                                        {tier.sold} sold · {Math.max(0, tier.quantity - tier.sold)} remaining of {tier.quantity}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Admin actions */}
                            <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                              <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">Admin actions</p>
                              <div className="space-y-2">
                                {selectedEvent.status === "pending_approval" && (
                                  <>
                                    <Button variant="acacia" className="w-full" disabled={approvingEvent} onClick={() => approveEvent(selectedEvent.id)}>
                                      {approvingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                      Approve & publish
                                    </Button>
                                    <Button variant="outline" className="w-full" disabled={approvingEvent} onClick={() => rejectEvent(selectedEvent.id)}>
                                      <XCircle className="h-4 w-4" /> Reject — return to draft
                                    </Button>
                                  </>
                                )}
                                {selectedEvent.status === "published" && (
                                  <Button variant="outline" className="w-full" onClick={() => updateEventStatus(selectedEvent.id, "draft")}>Unpublish</Button>
                                )}
                                {selectedEvent.status === "draft" && (
                                  <Button variant="acacia" className="w-full" onClick={() => updateEventStatus(selectedEvent.id, "published")}>Publish</Button>
                                )}
                                <Button variant="outline" className="w-full" asChild>
                                  <Link to={`/events/${selectedEvent.slug}`}>View public page <ExternalLink className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button variant="destructive" className="w-full" onClick={() => deleteEvent(selectedEvent.id)}>Delete event</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {view === "orders" && (
                    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left">Buyer</th>
                            <th className="px-4 py-3 text-left">Method</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Buyer fee ({BUYER_FEE_PCT}%)</th>
                            <th className="px-4 py-3 text-right">Platform fee ({PLATFORM_FEE_PCT}%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id} className="border-t border-border">
                              <td className="px-4 py-3 font-semibold">{o.guest_name}</td>
                              <td className="px-4 py-3 uppercase text-xs">{o.payment_method}</td>
                              <td className="px-4 py-3 text-right font-semibold">{formatKES(o.total_kes)}</td>
                              <td className="px-4 py-3 text-right">{formatKES(o.buyer_fee_kes ?? 0)}</td>
                              <td className="px-4 py-3 text-right text-primary font-semibold">{formatKES(o.platform_fee_kes ?? o.organizer_fee_kes ?? 0)}</td>
                            </tr>
                          ))}
                          {orders.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No paid orders yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {view === "organizers" && (
                    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left">Organization</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Payout</th>
                            <th className="px-4 py-3 text-right">Platform fee</th>
                            <th className="px-4 py-3 text-right">Published</th>
                          </tr>
                        </thead>
                        <tbody>
                          {organizers.map((o) => (
                            <tr key={o.id} className="border-t border-border">
                              <td className="px-4 py-3 font-semibold">
                                <Link to={`/organizer/${o.id}`} className="hover:underline">{o.org_name}</Link>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{o.contact_email ?? "—"}</td>
                              <td className="px-4 py-3 text-xs">
                                {o.paystack_subaccount_code ? <span className="text-primary">Connected</span> : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right">{o.fee_locked_pct ?? PLATFORM_FEE_PCT}%</td>
                              <td className="px-4 py-3 text-right">{o.events_published_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {view === "logs" && (
                    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left">Time</th>
                            <th className="px-4 py-3 text-left">Level</th>
                            <th className="px-4 py-3 text-left">Action</th>
                            <th className="px-4 py-3 text-left">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => (
                            <tr key={log.id} className="border-t border-border">
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${log.level === "error" ? "bg-destructive/15 text-destructive" :
                                    log.level === "warn" ? "bg-amber-100 text-amber-800" :
                                      "bg-primary/15 text-primary"
                                  }`}>
                                  {log.level}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.message ?? "—"}
                                {Object.keys(log.metadata ?? {}).length > 0 && (
                                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80 truncate max-w-md">
                                    {JSON.stringify(log.metadata)}
                                  </p>
                                )}
                              </td>
                            </tr>
                          ))}
                          {logs.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No activity logged yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) => (
  <div className="rounded-3xl border border-border bg-card p-5 shadow-card-soft">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
  </div>
);

export default SuperAdminDashboard;



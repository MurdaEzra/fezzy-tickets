import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Shield, Users, Calendar, Wallet, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatKES } from "@/lib/eventsApi";
import { toast } from "sonner";

interface Withdrawal {
  id: string;
  organizer_id: string;
  amount_kes: number;
  channel: string;
  destination: string;
  status: string;
  payhero_reference: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  status: string;
  slug: string;
  starts_at: string;
  organizer_id: string;
}

const SuperAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [tab, setTab] = useState<"overview" | "events" | "withdrawals" | "organizers">("overview");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [organizers, setOrganizers] = useState<{ id: string; org_name: string; events_published_count: number; contact_email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [{ data: evts }, { data: wds }, { data: orgs }] = await Promise.all([
        supabase.from("events").select("id, title, status, slug, starts_at, organizer_id").order("created_at", { ascending: false }).limit(50),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("organizer_profiles").select("id, org_name, events_published_count, contact_email").order("created_at", { ascending: false }),
      ]);
      setEvents((evts ?? []) as EventRow[]);
      setWithdrawals((wds ?? []) as Withdrawal[]);
      setOrganizers((orgs ?? []) as typeof organizers);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const updateWithdrawal = async (id: string, status: "paid" | "failed" | "cancelled") => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWithdrawals((ws) => ws.map((w) => (w.id === id ? { ...w, status } : w)));
    toast.success(`Marked as ${status}`);
  };

  const updateEventStatus = async (id: string, status: "published" | "draft") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status } : e)));
    toast.success(`Event ${status}`);
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEvents((es) => es.filter((e) => e.id !== id));
    toast.success("Event deleted");
  };

  if (authLoading || authorized === null) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-px mx-auto max-w-md py-24 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="display mt-4 text-3xl text-foreground">Access denied</h1>
          <p className="mt-2 text-muted-foreground">You don't have super admin permissions.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-deep">
      <Navbar />
      <main className="container-px mx-auto max-w-7xl py-10 md:py-14">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="eyebrow">Super admin</p>
            <h1 className="display text-3xl text-foreground sm:text-4xl">Platform control</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat icon={Calendar} label="Events" value={String(events.length)} />
          <Stat icon={Users} label="Organizers" value={String(organizers.length)} />
          <Stat icon={Wallet} label="Withdrawals" value={String(withdrawals.length)} />
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
          {(["overview", "events", "withdrawals", "organizers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-muted-foreground" /> : (
            <>
              {tab === "overview" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                    <h3 className="font-display text-lg font-bold">Pending withdrawals</h3>
                    <div className="mt-3 space-y-2">
                      {withdrawals.filter((w) => w.status === "pending" || w.status === "processing").slice(0, 5).map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                          <span className="font-semibold">{formatKES(w.amount_kes)}</span>
                          <span className="text-xs text-muted-foreground">{w.channel}</span>
                        </div>
                      ))}
                      {withdrawals.filter((w) => w.status === "pending" || w.status === "processing").length === 0 && (
                        <p className="text-sm text-muted-foreground">All clear.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
                    <h3 className="font-display text-lg font-bold">Recent events</h3>
                    <div className="mt-3 space-y-2">
                      {events.slice(0, 5).map((e) => (
                        <div key={e.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                          <span className="truncate font-semibold">{e.title}</span>
                          <span className="text-xs uppercase text-muted-foreground">{e.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "events" && (
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
                        <tr key={e.id} className="border-t border-border">
                          <td className="px-4 py-3 font-semibold text-foreground">{e.title}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase">{e.status}</span></td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/events/${e.slug}`}>View <ExternalLink className="h-3 w-3" /></Link>
                              </Button>
                              {e.status === "published" ? (
                                <Button size="sm" variant="outline" onClick={() => updateEventStatus(e.id, "draft")}>Unpublish</Button>
                              ) : (
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
              )}

              {tab === "withdrawals" && (
                <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Channel</th>
                        <th className="px-4 py-3 text-left">Destination</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="border-t border-border">
                          <td className="px-4 py-3 font-semibold">{formatKES(w.amount_kes)}</td>
                          <td className="px-4 py-3 uppercase text-xs">{w.channel}</td>
                          <td className="px-4 py-3 text-muted-foreground">{w.destination}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                              w.status === "paid" ? "bg-primary/15 text-primary" :
                              w.status === "failed" ? "bg-destructive/15 text-destructive" :
                              "bg-secondary text-muted-foreground"
                            }`}>{w.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(w.status === "pending" || w.status === "processing") && (
                              <div className="inline-flex gap-2">
                                <Button size="sm" variant="acacia" onClick={() => updateWithdrawal(w.id, "paid")}>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateWithdrawal(w.id, "failed")}>
                                  <AlertCircle className="h-3.5 w-3.5" /> Failed
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {withdrawals.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No withdrawals yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "organizers" && (
                <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Organization</th>
                        <th className="px-4 py-3 text-left">Email</th>
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
                          <td className="px-4 py-3 text-right">{o.events_published_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
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

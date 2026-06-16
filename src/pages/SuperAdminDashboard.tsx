import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Shield, Users, Calendar, Ticket, ExternalLink, ClipboardCheck } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatKES } from "@/lib/eventsApi";
import { toast } from "sonner";

interface EventRow {
  id: string;
  title: string;
  status: string;
  slug: string;
  starts_at: string;
  organizer_id: string;
}

interface OrderRow {
  id: string;
  total_kes: number;
  organizer_fee_kes: number;
  status: string;
  payment_method: string;
  created_at: string;
  guest_name: string;
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [tab, setTab] = useState<"overview" | "approvals" | "events" | "orders" | "organizers">("overview");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [organizers, setOrganizers] = useState<{ id: string; org_name: string; events_published_count: number; contact_email: string | null; fee_locked_pct: number | null; paystack_subaccount_code: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
      const [{ data: evts }, { data: ords }, { data: orgs }, { data: pending }] = await Promise.all([
        supabase.from("events").select("id, title, status, slug, starts_at, organizer_id").order("created_at", { ascending: false }).limit(50),
        supabase.from("orders").select("id, total_kes, organizer_fee_kes, status, payment_method, created_at, guest_name").eq("status", "paid").order("created_at", { ascending: false }).limit(50),
        supabase.from("organizer_profiles").select("id, org_name, events_published_count, contact_email, fee_locked_pct, paystack_subaccount_code").order("created_at", { ascending: false }),
        supabase.from("organizer_approval_requests").select("id, org_name, full_name, email, country, status, created_at").order("created_at", { ascending: false }),
      ]);
      setEvents((evts ?? []) as EventRow[]);
      setOrders((ords ?? []) as OrderRow[]);
      setOrganizers((orgs ?? []) as typeof organizers);
      setApprovals((pending ?? []) as ApprovalRow[]);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

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
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Review failed");
    } finally {
      setReviewingId(null);
    }
  };

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

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

  const totalPlatformRev = orders.reduce((s, o) => s + (o.organizer_fee_kes ?? 0), 0);

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

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat icon={Calendar} label="Events" value={String(events.length)} />
          <Stat icon={Users} label="Organizers" value={String(organizers.length)} />
          <Stat icon={Ticket} label="Platform revenue" value={formatKES(totalPlatformRev)} />
        </div>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
          {(["overview", "approvals", "events", "orders", "organizers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "approvals" ? "Approvals" : t}
              {t === "approvals" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {pendingCount}
                </span>
              )}
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
                        <div key={e.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                          <span className="truncate font-semibold">{e.title}</span>
                          <span className="text-xs uppercase text-muted-foreground">{e.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "approvals" && (
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
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                              a.status === "pending" ? "bg-amber-100 text-amber-800" :
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

              {tab === "orders" && (
                <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Buyer</th>
                        <th className="px-4 py-3 text-left">Method</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Platform cut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <td className="px-4 py-3 font-semibold">{o.guest_name}</td>
                          <td className="px-4 py-3 uppercase text-xs">{o.payment_method}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatKES(o.total_kes)}</td>
                          <td className="px-4 py-3 text-right text-primary font-semibold">{formatKES(o.organizer_fee_kes)}</td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No paid orders yet.</td></tr>
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
                        <th className="px-4 py-3 text-left">Payout</th>
                        <th className="px-4 py-3 text-right">Fee</th>
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
                          <td className="px-4 py-3 text-right">{o.fee_locked_pct ?? "0"}%</td>
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

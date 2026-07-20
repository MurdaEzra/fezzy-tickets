import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Calendar, Loader2, MapPin, Ticket, Trash2, Tag, CheckCircle2,
  Store, Settings, ChevronRight, LogOut, LayoutDashboard,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  fetchAccountTickets,
  formatEventDate,
  formatPrice,
  getTicketStatusDisplay,
  type AccountTicket,
} from "@/lib/eventsApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/UserAvatar";
import { FEZZY_LOGO_URL } from "@/lib/brand";

interface Listing {
  id: string;
  ticket_id: string;
  seller_user_id: string;
  resale_price_kes: number;
  status: string;
  listed_at: string;
  payment_expires_at: string | null;
  seller_payout_phone: string | null;
  tickets: {
    id: string;
    holder_name: string;
    holder_email: string;
    ticket_tiers: {
      name: string;
      price_kes: number;
    };
    events: {
      id: string;
      title: string;
      starts_at: string;
      venue_name: string;
      city: string;
      poster_url: string;
      min_resale_percentage: number;
      max_resale_percentage: number;
    };
  };
  resale_transfers?: {
    id: string;
    payout_status: string;
    seller_payout_phone: string | null;
  }[];
}

type AccountView = "tickets" | "listings" | "marketplace" | "settings";

const MENU: { id: AccountView; label: string; icon: typeof Ticket }[] = [
  { id: "tickets", label: "My Tickets", icon: Ticket },
  { id: "listings", label: "My Listings", icon: Tag },
  { id: "marketplace", label: "Resale Marketplace", icon: Store },
  { id: "settings", label: "Settings", icon: Settings },
];

const Account = () => {
  const { user, loading, deleteAccount, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<AccountView>("tickets");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tickets, setTickets] = useState<AccountTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<AccountTicket | null>(null);
  const [resalePrice, setResalePrice] = useState("");
  const [listingPayoutPhone, setListingPayoutPhone] = useState("");
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payoutPhone, setPayoutPhone] = useState("");
  const [submittingPhoneListingId, setSubmittingPhoneListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=signin", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    setTicketsLoading(true);
    fetchAccountTickets(user.email)
      .then((rows) => { if (!cancelled) setTickets(rows); })
      .catch(() => { if (!cancelled) { setTickets([]); toast.error("Could not load tickets"); } })
      .finally(() => { if (!cancelled) setTicketsLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchListings();
  }, [user]);

  const fetchListings = async () => {
    try {
      setListingsLoading(true);
      const { data, error } = await supabase
        .from("ticket_resale_listings")
        .select(`*, tickets(*, ticket_tiers(*), events(*)), resale_transfers(id, payout_status, seller_payout_phone)`)
        .eq("seller_user_id", user!.id)
        .order("listed_at", { ascending: false });
      if (error) throw error;
      setListings((data as unknown as Listing[]) || []);
    } catch (error) {
      console.error("Error fetching listings:", error);
      toast.error("Failed to load your listings");
    } finally {
      setListingsLoading(false);
    }
  };

  if (!user) return null;
  const name = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "there";

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Delete your Fezzy Tickets account permanently? This cannot be undone.");
    if (!confirmed) return;
    try { await deleteAccount(); toast.success("Account deleted"); navigate("/", { replace: true }); }
    catch { toast.error("Could not delete account"); }
  };

  const handleListTicket = (ticket: AccountTicket) => {
    setSelectedTicket(ticket);
    setResalePrice(ticket.ticket_tiers?.price_kes.toString() || "");
    setListingPayoutPhone("");
    setIsListingDialogOpen(true);
  };

  const submitListing = async () => {
    if (!selectedTicket || !resalePrice) return;
    if (!listingPayoutPhone.trim()) {
      toast.error("Enter the M-Pesa payout number for this resale.");
      return;
    }
    setIsListingDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };

  const handleSubmitPayoutPhone = async (listingId: string) => {
    setIsSubmitting(true);
    setSubmittingPhoneListingId(listingId);
    try {
       const transfer = listings.find(l => l.id === listingId)?.resale_transfers?.[0];
       if (!transfer) throw new Error("Transfer not found");
       
       const { error } = await supabase.rpc("update_resale_payout_phone", {
         _transfer_id: transfer.id,
         _phone: payoutPhone
       });
       if (error) throw error;
       
       toast.success("Phone number saved! You will receive your payout soon.");
       setPayoutPhone("");
       fetchListings(); // refetch to update UI
    } catch (err) {
       toast.error((err as Error).message);
    } finally {
       setIsSubmitting(false);
       setSubmittingPhoneListingId(null);
    }
  };

  const confirmListing = async () => {
    if (!selectedTicket || !resalePrice) return;
    try {
      setIsSubmitting(true);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-initiate-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          resalePriceKes: parseInt(resalePrice),
          sellerPayoutPhone: listingPayoutPhone.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to list ticket");
      toast.success("Your ticket is now listed for resale!");
      setListingPayoutPhone("");
      setIsConfirmDialogOpen(false);
      setIsListingDialogOpen(false);
      fetchListings();
      if (user?.email) fetchAccountTickets(user.email).then(setTickets);
    } catch (error) {
      console.error("Error listing ticket:", error);
      toast.error(error instanceof Error ? error.message : "Failed to list ticket");
    } finally { setIsSubmitting(false); }
  };

  const handleCancelListing = async (listingId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-cancel-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ listingId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to cancel listing");
      toast.success("Your listing has been cancelled");
      fetchListings();
      if (user?.email) fetchAccountTickets(user.email).then(setTickets);
    } catch (error) {
      console.error("Error cancelling listing:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel listing");
    }
  };

  return (
    <div className="tm-page min-h-screen bg-background">
      <div className="flex">
        {/* ── Sidebar (matches OrganizerDashboard) ── */}
        <aside className={`${mobileMenu ? "fixed inset-y-0 left-0 z-50 w-72 translate-x-0" : "hidden md:flex md:w-72 md:translate-x-0"} flex-col border-r border-border bg-card md:sticky md:top-0 md:h-screen transition-transform`}>
          <div className="flex h-20 items-center gap-3 border-b border-border px-5">
            <Link to="/" className="flex items-center">
              <img src={FEZZY_LOGO_URL} alt="Fezzy" className="h-12 w-auto object-contain" />
            </Link>
          </div>

          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <UserAvatar className="h-10 w-10 shadow-acacia" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Attendee
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
            {MENU.map((m) => (
              <button
                key={m.id}
                onClick={() => { setView(m.id); setMobileMenu(false); }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  view === m.id
                    ? "bg-gradient-acacia text-primary-foreground shadow-acacia"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <m.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{m.label}</span>
                {view === m.id && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenu && <div className="fixed inset-0 z-40 bg-foreground/40 md:hidden" onClick={() => setMobileMenu(false)} />}

        {/* ── Main Content ── */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-8">
            <button onClick={() => setMobileMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-border md:hidden">
              <LayoutDashboard className="h-4 w-4" />
            </button>
            <div className="hidden md:block">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">My account</p>
              <p className="font-display text-base font-bold text-foreground">{MENU.find((m) => m.id === view)?.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/events">Browse events</Link>
              </Button>
            </div>
          </header>

          <main className="container-px mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
            {/* ──── MY TICKETS ──── */}
            {view === "tickets" && (
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Your tickets</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Tickets purchased under {user.email}.</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/events">Browse more <ChevronRight className="h-4 w-4" /></Link>
                  </Button>
                </div>

                <div className="mt-6">
                  {ticketsLoading ? (
                    <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : tickets.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                      <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-4 font-display text-lg">No tickets yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">When you grab tickets, they'll appear here.</p>
                      <Button variant="acacia" className="mt-6" asChild>
                        <Link to="/events">Find events <ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {tickets.map((ticket) => {
                        const event = ticket.events;
                        const tier = ticket.ticket_tiers;
                        const ticketStatus = getTicketStatusDisplay(ticket.status);
                        const isListed = listings.some(l => l.ticket_id === ticket.id && ["active", "pending", "pending_payment", "pending_approval"].includes(l.status));
                        const listingStatus = listings.find(l => l.ticket_id === ticket.id)?.status;
                        return (
                          <div key={ticket.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-0.5 hover:shadow-soft">
                            <div className="flex gap-4 p-4">
                              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary">
                                {event?.cover_image_url ? (
                                  <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-muted-foreground"><Ticket className="h-6 w-6" /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-display text-lg font-bold leading-tight text-foreground">{event?.title ?? "Event unavailable"}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ticketStatus.className}`}>{ticketStatus.label}</span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{event ? formatEventDate(event.starts_at) : ""}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" /> {event?.venue_name ?? "TBA"}
                                </p>
                                {isListed && (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                    <Tag className="h-3 w-3" /> {listingStatus === "pending" ? "Pending" : "Listed for resale"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex border-t border-border">
                              <div className="flex-1 px-4 py-2.5 text-sm text-muted-foreground">
                                {tier?.name ?? "Ticket"} {ticket.orders ? `· ${formatPrice(ticket.orders.total_kes)}` : ""}
                              </div>
                              {!isListed && (event?.resale_enabled || event?.allow_resale) && ticket.status === "valid" && (
                                <Button variant="ghost" className="rounded-none border-l border-border px-4 text-primary hover:bg-primary/10" onClick={() => handleListTicket(ticket)}>
                                  <Tag className="h-4 w-4" /> List for Resale
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ──── MY LISTINGS ──── */}
            {view === "listings" && (
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Your Resale Listings</h1>
                <p className="mt-1 text-sm text-muted-foreground">Track and manage tickets you've listed for resale.</p>

                <div className="mt-6">
                  {listingsLoading ? (
                    <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : listings.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                      <Tag className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-4 font-display text-lg">No listings yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">List your tickets for resale to get started.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {listings.map((listing) => {
                        const event = listing.tickets.events;
                        const tier = listing.tickets.ticket_tiers;
                        return (
                          <div key={listing.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-0.5 hover:shadow-soft">
                            <div className="flex gap-4 p-4">
                              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary">
                                {event?.poster_url ? (
                                  <img src={event.poster_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-muted-foreground"><Ticket className="h-6 w-6" /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-display text-lg font-bold leading-tight text-foreground">{event?.title ?? "Event unavailable"}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    listing.status === "active" ? "bg-primary/15 text-primary" :
                                    listing.status === "pending" ? "bg-amber-500/15 text-amber-600" :
                                    listing.status === "sold" ? "bg-emerald-500/15 text-emerald-600" :
                                    "bg-secondary text-muted-foreground"
                                  }`}>
                                    {listing.status === "pending"
                                      ? "Pending Verification"
                                      : listing.status === "pending_payment"
                                        ? "Buyer Paying"
                                        : listing.status === "pending_approval"
                                          ? "Admin Review"
                                          : listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{event ? formatEventDate(event.starts_at) : ""}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Tag className="h-3 w-3" /> {tier?.name ?? "Ticket"}
                                </p>
                                {listing.status === "pending_payment" && listing.payment_expires_at && (
                                  <p className="mt-1 text-xs text-amber-600">Buyer reservation expires at {new Date(listing.payment_expires_at).toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex border-t border-border">
                              <div className="flex-1 px-4 py-2.5 font-display text-base font-bold text-primary">
                                {formatPrice(listing.resale_price_kes)}
                              </div>
                              {listing.status === "active" && (
                                <Button variant="ghost" className="rounded-none border-l border-border px-4 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleCancelListing(listing.id)}>
                                  <Trash2 className="h-4 w-4" /> Cancel
                                </Button>
                              )}
                              {listing.status === "pending_approval" && (
                                <div className="border-l border-border px-4 py-2 text-xs text-amber-600">
                                  Payment received. Awaiting fraud review before ticket transfer.
                                </div>
                              )}
                              {listing.status === "sold" && (
                                <div className="flex flex-col gap-2 p-4 pt-2 bg-secondary/50">
                                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold uppercase tracking-wider mb-2">
                                    <CheckCircle2 className="h-4 w-4" /> Sold (Invalidated for you)
                                  </div>
                                  
                                  {listing.resale_transfers?.[0] && (
                                    <>
                                      {listing.resale_transfers[0].payout_status === "paid" ? (
                                        <div className="text-sm font-medium text-emerald-500 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                          Payout completed to: {listing.resale_transfers[0].seller_payout_phone}
                                        </div>
                                      ) : listing.resale_transfers[0].payout_status === "processing" ? (
                                        <div className="text-sm font-medium text-blue-500 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                                          Payout processing to: {listing.resale_transfers[0].seller_payout_phone}
                                        </div>
                                      ) : listing.resale_transfers[0].payout_status === "failed" ? (
                                        <div className="text-sm font-medium text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                          Payout failed. Support will review the destination: {listing.resale_transfers[0].seller_payout_phone}
                                        </div>
                                      ) : listing.resale_transfers[0].seller_payout_phone ? (
                                        <div className="text-sm font-medium text-amber-500 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                                          Payout pending to: {listing.resale_transfers[0].seller_payout_phone}
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-2">
                                          <p className="text-xs text-muted-foreground">Please provide your M-Pesa phone number to receive your payout.</p>
                                          <div className="flex gap-2">
                                            <Input
                                              className="h-8 text-xs bg-background"
                                              placeholder="07XX XXX XXX"
                                              value={submittingPhoneListingId === listing.id ? payoutPhone : undefined}
                                              onChange={(e) => {
                                                if (submittingPhoneListingId !== listing.id) setSubmittingPhoneListingId(listing.id);
                                                setPayoutPhone(e.target.value);
                                              }}
                                            />
                                            <Button 
                                              size="sm" 
                                              variant="acacia" 
                                              className="h-8 text-xs"
                                              onClick={() => handleSubmitPayoutPhone(listing.id)}
                                              disabled={isSubmitting || submittingPhoneListingId !== listing.id || !payoutPhone}
                                            >
                                              {isSubmitting && submittingPhoneListingId === listing.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ──── MARKETPLACE ──── */}
            {view === "marketplace" && (
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Resale Marketplace</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Find tickets from other fans.</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/resale">Full Marketplace <ChevronRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
                <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-display text-lg">Browse resale tickets</p>
                  <p className="mt-1 text-sm text-muted-foreground">Find tickets from other fans in the full marketplace.</p>
                  <Button variant="acacia" className="mt-6" asChild>
                    <Link to="/resale">Go to Marketplace <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            )}

            {/* ──── SETTINGS ──── */}
            {view === "settings" && (
              <div className="space-y-8">
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8 space-y-4">
                  <h2 className="font-display text-lg font-bold text-foreground">Profile</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Name</p>
                      <p className="text-sm text-foreground">{name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Email</p>
                      <p className="text-sm text-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>

                <section className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold text-foreground">Delete account</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Permanently remove your buyer account and sign out.</p>
                    </div>
                    <Button variant="destructive" onClick={handleDeleteAccount}>
                      <Trash2 className="h-4 w-4" /> Delete account
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </main>

          <Footer />
        </div>
      </div>

      {/* ── List for Resale Dialog ── */}
      <Dialog open={isListingDialogOpen} onOpenChange={setIsListingDialogOpen}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">List Ticket for Resale</DialogTitle>
            <DialogDescription className="text-muted-foreground">Set your resale price within the allowed range.</DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-2xl border border-border">
                <p className="font-display text-lg">{selectedTicket.events?.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTicket.ticket_tiers?.name} - Original price: {formatPrice(selectedTicket.ticket_tiers?.price_kes || 0)}
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  Min price: {formatPrice(Math.round((selectedTicket.ticket_tiers?.price_kes || 0) * ((selectedTicket.events?.min_resale_percentage || 80) / 100)))}
                  {' • '}
                  Max price: {formatPrice(Math.round((selectedTicket.ticket_tiers?.price_kes || 0) * ((selectedTicket.events?.max_resale_percentage || 120) / 100)))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resalePrice">Resale Price (KES)</Label>
                <Input id="resalePrice" type="number" value={resalePrice} onChange={(e) => setResalePrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="listingPayoutPhone">M-Pesa payout number</Label>
                <Input
                  id="listingPayoutPhone"
                  inputMode="tel"
                  value={listingPayoutPhone}
                  onChange={(e) => setListingPayoutPhone(e.target.value)}
                  placeholder="0712 345 678"
                />
                <p className="text-xs text-muted-foreground">
                  This is where your seller payout will be sent after admin approval and M-Pesa B2C processing.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsListingDialogOpen(false)}>Cancel</Button>
            <Button variant="acacia" onClick={submitListing} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Listing Dialog ── */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Are you sure?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              By listing your ticket, you're making it available for sale in the Fezzy Tickets resale marketplace.
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="p-4 bg-secondary rounded-2xl border border-border">
              <p className="font-display text-lg">{selectedTicket.events?.title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTicket.ticket_tiers?.name} - Resale price: {formatPrice(parseInt(resalePrice || "0"))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Seller payout number: {listingPayoutPhone}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
            <Button variant="acacia" onClick={confirmListing} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Account;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, Loader2, MapPin, Ticket, Trash2, Tag, X, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  fetchAccountTickets,
  formatEventDate,
  formatPrice,
  type AccountTicket,
} from "@/lib/eventsApi";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Listing {
  id: string;
  ticket_id: string;
  seller_user_id: string;
  resale_price_kes: number;
  status: string;
  listed_at: string;
  payment_expires_at: string | null;
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
}

const Account = () => {
  const { user, loading, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<AccountTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<AccountTicket | null>(null);
  const [resalePrice, setResalePrice] = useState("");
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=signin", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setTicketsLoading(true);
    fetchAccountTickets()
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setTickets([]);
          toast.error("Could not load tickets");
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
        .select(`
          *,
          tickets(*,
            ticket_tiers(*),
            events(*)
          )
        `)
        .eq("seller_user_id", user.id)
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
    try {
      await deleteAccount();
      toast.success("Account deleted");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Could not delete account");
    }
  };

  const handleListTicket = (ticket: AccountTicket) => {
    setSelectedTicket(ticket);
    setResalePrice(ticket.ticket_tiers?.price_kes.toString() || "");
    setIsListingDialogOpen(true);
  };

  const submitListing = async () => {
    if (!selectedTicket || !resalePrice) return;
    setIsListingDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };

  const confirmListing = async () => {
    if (!selectedTicket || !resalePrice) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-initiate-listing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          resalePriceKes: parseInt(resalePrice),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to list ticket");
      }

      toast.success("Your ticket is now listed for resale!");

      setIsConfirmDialogOpen(false);
      setIsListingDialogOpen(false);
      fetchListings();
      fetchAccountTickets().then(setTickets);
    } catch (error) {
      console.error("Error listing ticket:", error);
      toast.error(error instanceof Error ? error.message : "Failed to list ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-cancel-listing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ listingId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to cancel listing");
      }

      toast.success("Your listing has been cancelled");

      fetchListings();
      fetchAccountTickets().then(setTickets);
    } catch (error) {
      console.error("Error cancelling listing:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel listing");
    }
  };

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 py-16 lg:px-8">
            <p className="mb-4 font-mono-label text-fezzy-glow">My account</p>
            <h1 className="font-display text-4xl text-cream sm:text-5xl md:text-6xl">
              Hello, {name}
            </h1>
            <p className="mt-3 text-base text-cream-dim">{user.email}</p>
          </div>
        </section>

        <section className="mx-auto max-w-1440 px-5 py-12 lg:px-8">
          <Tabs defaultValue="tickets" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-ink-card">
              <TabsTrigger value="tickets" className="data-[state=active]:bg-fezzy data-[state=active]:text-white">
                My Tickets
              </TabsTrigger>
              <TabsTrigger value="listings" className="data-[state=active]:bg-fezzy data-[state=active]:text-white">
                My Listings
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="data-[state=active]:bg-fezzy data-[state=active]:text-white">
                Resale Marketplace
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tickets">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="font-display text-2xl text-cream">Your tickets</h2>
                <Link to="/events" className="btn-outline-editorial px-4 py-2">Browse more</Link>
              </div>

              {ticketsLoading ? (
                <div className="grid min-h-48 place-items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-ash" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
                  <Ticket className="mx-auto h-10 w-10 text-ash" />
                  <p className="mt-4 font-display text-2xl text-cream">No tickets yet</p>
                  <p className="mt-1 text-sm text-cream-dim">When you grab tickets, they'll appear here.</p>
                  <Link to="/events" className="btn-ember mt-6 inline-flex">
                    Find events <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="grid gap-px bg-cream/10 md:grid-cols-2">
                  {tickets.map((ticket) => {
                    const event = ticket.events;
                    const tier = ticket.ticket_tiers;
                    const isListed = listings.some(l => l.ticket_id === ticket.id && (l.status === "active" || l.status === "pending"));
                    const listingStatus = listings.find(l => l.ticket_id === ticket.id)?.status;
                    return (
                      <article key={ticket.id} className="flex bg-ink transition-colors hover:bg-ink-card">
                        <div className="relative w-32 flex-shrink-0 bg-ink-soft sm:w-44">
                          {event?.cover_image_url ? (
                            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full min-h-40 place-items-center px-3 text-center">
                              <Ticket className="h-8 w-8 text-fezzy" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-5">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-mono-label text-fezzy">{ticket.status}</p>
                              <h3 className="mt-1 font-display text-lg leading-tight text-cream">
                                {event?.title ?? "Event unavailable"}
                              </h3>
                            </div>
                            {isListed && (
                              <span className="flex items-center gap-1 text-xs text-amber-400">
                                <Tag className="h-3 w-3" /> {listingStatus === "pending" ? "Pending Verification" : "Listed"}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-cream-dim">
                            {event && <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-fezzy" /> {formatEventDate(event.starts_at)}</p>}
                            {event && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-fezzy" /> {event.venue_name ?? "Venue TBA"}, {event.city ?? "Location TBA"}</p>}
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3">
                            <span className="font-display text-sm text-cream">
                              {tier?.name ?? "Ticket"} {ticket.orders ? `- ${formatPrice(ticket.orders.total_kes)}` : ""}
                            </span>
                            {!isListed && (event?.resale_enabled || event?.allow_resale) && ticket.status === "valid" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleListTicket(ticket)}
                                className="bg-fezzy hover:bg-fezzy/90 text-white"
                              >
                                List for Resale
                              </Button>
                            )}
                            {!isListed && (!(event?.resale_enabled || event?.allow_resale) || ticket.status !== "valid") && (
                              <span className="border border-cream/20 px-3 py-1 font-mono-label text-ash">QR emailed</span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="listings">
              <div className="mb-8">
                <h2 className="font-display text-2xl text-cream">Your Resale Listings</h2>
              </div>

              {listingsLoading ? (
                <div className="grid min-h-48 place-items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-ash" />
                </div>
              ) : listings.length === 0 ? (
                <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
                  <Tag className="mx-auto h-10 w-10 text-ash" />
                  <p className="mt-4 font-display text-2xl text-cream">No listings yet</p>
                  <p className="mt-1 text-sm text-cream-dim">List your tickets for resale to get started.</p>
                </div>
              ) : (
                <div className="grid gap-px bg-cream/10 md:grid-cols-2">
                  {listings.map((listing) => {
                    const event = listing.tickets.events;
                    const tier = listing.tickets.ticket_tiers;
                    return (
                      <article key={listing.id} className="flex bg-ink transition-colors hover:bg-ink-card">
                        <div className="relative w-32 flex-shrink-0 bg-ink-soft sm:w-44">
                          {event?.poster_url ? (
                            <img src={event.poster_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full min-h-40 place-items-center px-3 text-center">
                              <Ticket className="h-8 w-8 text-fezzy" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-5">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`font-mono-label ${
                                listing.status === "active" ? "text-green-400" :
                                listing.status === "pending" ? "text-amber-400" :
                                listing.status === "completed" ? "text-blue-400" : "text-gray-400"
                              }`}>
                                {listing.status === "pending" 
                                  ? "Pending Verification" 
                                  : listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                              </p>
                              <h3 className="mt-1 font-display text-lg leading-tight text-cream">
                                {event?.title ?? "Event unavailable"}
                              </h3>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-cream-dim">
                            {event && <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-fezzy" /> {formatEventDate(event.starts_at)}</p>}
                            <p className="flex items-center gap-1.5">
                              <Tag className="h-3 w-3 text-fezzy" /> {tier?.name ?? "Ticket"}
                            </p>
                            {listing.status === "pending_payment" && listing.payment_expires_at && (
                              <p className="text-amber-400">
                                Buyer reservation expires at {new Date(listing.payment_expires_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3">
                            <span className="font-display text-lg text-green-400">
                              {formatPrice(listing.resale_price_kes)}
                            </span>
                            {(listing.status === "active" || listing.status === "pending") && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleCancelListing(listing.id)}
                              >
                                Cancel Listing
                              </Button>
                            )}
                            {listing.status === "completed" && (
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="h-4 w-4" /> Sold
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="marketplace">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="font-display text-2xl text-cream">Resale Marketplace</h2>
                <Link to="/resale" className="btn-outline-editorial px-4 py-2">
                  View Full Marketplace
                </Link>
              </div>
              <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
                <Ticket className="mx-auto h-10 w-10 text-ash" />
                <p className="mt-4 font-display text-2xl text-cream">Browse resale tickets</p>
                <p className="mt-1 text-sm text-cream-dim">Find tickets from other fans in the full marketplace.</p>
                <Link to="/resale" className="btn-ember mt-6 inline-flex">
                  Go to Marketplace <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section className="mx-auto max-w-1440 px-5 pb-12 lg:px-8">
          <div className="border border-ember/30 bg-ember/10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg text-cream">Delete account</h2>
                <p className="mt-1 text-sm text-cream-dim">Permanently remove your buyer account and sign out.</p>
              </div>
              <button onClick={handleDeleteAccount} className="inline-flex items-center gap-2 border border-ember bg-ember px-4 py-2 font-mono-label text-cream transition-colors hover:bg-ember-deep">
                <Trash2 className="h-4 w-4" /> Delete account
              </button>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={isListingDialogOpen} onOpenChange={setIsListingDialogOpen}>
        <DialogContent className="bg-ink text-cream border-cream/20">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">List Ticket for Resale</DialogTitle>
            <DialogDescription className="text-cream-dim">
              Set your resale price within the allowed range.
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="p-4 bg-ink-card rounded-lg border border-cream/10">
                <p className="font-display text-lg">{selectedTicket.events?.title}</p>
                <p className="text-sm text-cream-dim mt-1">
                  {selectedTicket.ticket_tiers?.name} - Original price: {formatPrice(selectedTicket.ticket_tiers?.price_kes || 0)}
                </p>
                <p className="text-xs text-amber-400 mt-2">
                  Min price: {formatPrice(Math.round((selectedTicket.ticket_tiers?.price_kes || 0) * ((selectedTicket.events?.min_resale_percentage || 80) / 100)))}
                  {' • '}
                  Max price: {formatPrice(Math.round((selectedTicket.ticket_tiers?.price_kes || 0) * ((selectedTicket.events?.max_resale_percentage || 120) / 100)))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resalePrice" className="text-cream">Resale Price (KES)</Label>
                <Input
                  id="resalePrice"
                  type="number"
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  className="bg-ink-card border-cream/20 text-cream"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="default"
              onClick={() => setIsListingDialogOpen(false)}
              className="bg-transparent border border-cream/20 hover:bg-ink-card"
            >
              Cancel
            </Button>
            <Button
              onClick={submitListing}
              disabled={isSubmitting}
              className="bg-fezzy hover:bg-fezzy/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="bg-ink text-cream border-cream/20">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Are you sure?</DialogTitle>
            <DialogDescription className="text-cream-dim">
              By listing your ticket, you're making it available for sale in the Fezzy Tickets resale marketplace.
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="p-4 bg-ink-card rounded-lg border border-cream/10">
              <p className="font-display text-lg">{selectedTicket.events?.title}</p>
              <p className="text-sm text-cream-dim mt-1">
                {selectedTicket.ticket_tiers?.name} - Resale price: {formatPrice(parseInt(resalePrice || "0"))}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="default"
              onClick={() => setIsConfirmDialogOpen(false)}
              className="bg-transparent border border-cream/20 hover:bg-ink-card"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmListing}
              disabled={isSubmitting}
              className="bg-fezzy hover:bg-fezzy/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue for Resale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Account;

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatPrice } from "@/lib/eventsApi";
import { Loader2, Search, Ticket, Calendar, MapPin, Phone, CheckCircle2, XCircle } from "lucide-react";

interface PublicListing {
  listing_id: string;
  resale_price_kes: number;
  listed_at: string;
  tier_name: string;
  original_price_kes: number;
  event_id: string;
  event_slug: string | null;
  event_title: string;
  event_starts_at: string | null;
  event_venue_name: string | null;
  event_city: string | null;
  event_poster_url: string | null;
  event_cover_image_url: string | null;
}

type PurchaseStep = "phone" | "waiting" | "success" | "failed";

const BUYER_FEE_RATE = 0.035;

const ResaleMarketplace = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("price_asc");

  // Purchase flow state
  const [selectedListing, setSelectedListing] = useState<PublicListing | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("phone");
  const [submitting, setSubmitting] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_resale_listings");
      if (error) throw error;

      let listingsData = (data as PublicListing[]) ?? [];

      switch (sortBy) {
        case "price_asc":
          listingsData.sort((a, b) => a.resale_price_kes - b.resale_price_kes);
          break;
        case "price_desc":
          listingsData.sort((a, b) => b.resale_price_kes - a.resale_price_kes);
          break;
        case "date_asc":
          listingsData.sort(
            (a, b) => new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime(),
          );
          break;
      }

      setListings(listingsData);
    } catch (error) {
      console.error("Error fetching resale listings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load resale listings",
      );
    } finally {
      setLoading(false);
    }
  };

  const startPollStatus = useCallback((listingId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let attempts = 0;

    pollTimerRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-check-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId }),
          },
        );
        const data = await res.json();
        if (data.finalized) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPurchaseStep("success");
          fetchListings(); // refresh marketplace
        }
      } catch {
        /* ignore network blips */
      }
      if (attempts > 60) {
        // 3 minutes of polling
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setPurchaseStep("failed");
        toast.error("Payment confirmation timed out. Check your M-Pesa messages.");
      }
    }, 3000);
  }, []);

  const openPurchaseDialog = (listing: PublicListing) => {
    if (!user) {
      toast.info("Please sign in to purchase tickets");
      return;
    }
    setSelectedListing(listing);
    setPurchaseStep("phone");
    setPhoneInput("");
    setCustomerMessage("");
  };

  const closePurchaseDialog = () => {
    if (purchaseStep === "waiting") return; // don't close while waiting
    setSelectedListing(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  };

  const handleSubmitPayment = async () => {
    if (!selectedListing || !phoneInput.trim()) {
      toast.error("Enter your M-Pesa phone number");
      return;
    }

    try {
      setSubmitting(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-initiate-purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            listingId: selectedListing.listing_id,
            phone: phoneInput.trim(),
          }),
        },
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Purchase failed");
      }

      setCustomerMessage(result.customer_message || "Check your phone to authorize the M-Pesa payment.");
      setPurchaseStep("waiting");
      startPollStatus(selectedListing.listing_id);
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredListings = listings.filter(
    (listing) =>
      listing.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.event_city ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.tier_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date TBA";
    return new Date(dateString).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedTotal = selectedListing
    ? selectedListing.resale_price_kes + Math.round(selectedListing.resale_price_kes * BUYER_FEE_RATE)
    : 0;
  const selectedFee = selectedListing
    ? Math.round(selectedListing.resale_price_kes * BUYER_FEE_RATE)
    : 0;

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 py-16 lg:px-8">
            <p className="mb-4 font-mono-label text-fezzy-glow">Resale Marketplace</p>
            <h1 className="font-display text-4xl text-cream sm:text-5xl md:text-6xl">
              Ticket Resale
            </h1>
            <p className="mt-3 text-base text-cream-dim">Find and buy tickets from other fans</p>
          </div>
        </section>

        <section className="mx-auto max-w-1440 px-5 py-12 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ash h-4 w-4" />
              <Input
                placeholder="Search by event, city, or ticket type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-ink-card border-cream/20 text-cream"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[200px] bg-ink-card border-cream/20 text-cream">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-ink-card border-cream/20 text-cream">
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="date_asc">Recently Listed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-ash" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
              <Ticket className="mx-auto h-10 w-10 text-ash" />
              <p className="mt-4 font-display text-2xl text-cream">No listings found</p>
              <p className="mt-1 text-sm text-cream-dim">
                {searchQuery ? "Try adjusting your search criteria" : "Check back later for available tickets"}
              </p>
            </div>
          ) : (
            <div className="grid gap-px bg-cream/10 md:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((listing) => {
                const image = listing.event_poster_url ?? listing.event_cover_image_url;
                return (
                  <article key={listing.listing_id} className="flex flex-col bg-ink transition-colors hover:bg-ink-card">
                    {image ? (
                      <div className="relative h-48 w-full flex-shrink-0 bg-ink-soft overflow-hidden">
                        <img
                          src={image}
                          alt={listing.event_title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="grid h-48 w-full place-items-center bg-ink-soft">
                        <Ticket className="h-8 w-8 text-fezzy" />
                      </div>
                    )}
                    <div className="flex-1 p-5">
                      <p className="font-mono-label text-fezzy">{listing.tier_name}</p>
                      <h3 className="mt-1 font-display text-lg leading-tight text-cream">
                        {listing.event_title}
                      </h3>
                      <div className="mt-3 space-y-1 text-xs text-cream-dim">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-fezzy" />
                          {formatDate(listing.event_starts_at)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-fezzy" />
                          {listing.event_venue_name ?? "Venue TBA"}, {listing.event_city ?? "Location TBA"}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-lg text-green-400">
                            {formatPrice(listing.resale_price_kes)}
                          </span>
                          <span className="text-sm text-ash line-through">
                            {formatPrice(listing.original_price_kes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 pt-0">
                      <Button
                        className="btn-ember w-full justify-center"
                        onClick={() => openPurchaseDialog(listing)}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Buy via M-Pesa
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />

      {/* ── M-Pesa Purchase Dialog ── */}
      <Dialog open={!!selectedListing} onOpenChange={(open) => !open && closePurchaseDialog()}>
        <DialogContent className="bg-ink-card border-cream/20 text-cream sm:max-w-md">
          {purchaseStep === "phone" && selectedListing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-cream">
                  Buy via M-Pesa
                </DialogTitle>
                <DialogDescription className="text-cream-dim">
                  {selectedListing.event_title} — {selectedListing.tier_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2 border border-cream/10 bg-ink-soft p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-cream-dim">Ticket price</span>
                    <span className="text-cream">{formatPrice(selectedListing.resale_price_kes)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-cream-dim">Service fee (3.5%)</span>
                    <span className="text-cream">{formatPrice(selectedFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cream/10 pt-2 font-display text-lg">
                    <span className="text-cream">Total</span>
                    <span className="text-fezzy">{formatPrice(selectedTotal)}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-mono-label text-xs text-cream-dim mb-1.5">
                    M-Pesa phone number
                  </label>
                  <Input
                    id="resale-mpesa-phone"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="0712 345 678"
                    className="bg-ink-soft border-cream/15 text-cream placeholder:text-ash"
                  />
                  <p className="mt-1.5 text-[11px] text-ash">
                    We'll send an STK push to this number. Enter your M-Pesa PIN when it pops up.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  className="btn-ember w-full justify-center"
                  disabled={submitting || !phoneInput.trim()}
                  onClick={handleSubmitPayment}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Phone className="h-4 w-4 mr-1" />
                  )}
                  {submitting ? "Sending STK push…" : `Pay ${formatPrice(selectedTotal)}`}
                </Button>
              </DialogFooter>
            </>
          )}

          {purchaseStep === "waiting" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-fezzy" />
              <h3 className="font-display text-2xl text-cream">Check your phone</h3>
              <p className="text-sm text-cream-dim max-w-xs mx-auto">{customerMessage}</p>
              <p className="text-xs text-ash">
                Waiting for M-Pesa confirmation… this will update automatically.
              </p>
            </div>
          )}

          {purchaseStep === "success" && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15 text-green-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-display text-2xl text-cream">Ticket purchased!</h3>
              <p className="text-sm text-cream-dim max-w-xs mx-auto">
                Your resale ticket is now active. The previous QR code has been revoked — open your account to see the new one.
              </p>
              <Button
                className="btn-ember justify-center"
                onClick={() => (window.location.href = "/account")}
              >
                Open my tickets
              </Button>
            </div>
          )}

          {purchaseStep === "failed" && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-400">
                <XCircle className="h-8 w-8" />
              </div>
              <h3 className="font-display text-2xl text-cream">Payment didn't go through</h3>
              <p className="text-sm text-cream-dim max-w-xs mx-auto">
                No worries — the reservation has been released. Would you like to try again?
              </p>
              <Button
                className="btn-ember justify-center"
                onClick={() => setPurchaseStep("phone")}
              >
                Try again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResaleMarketplace;

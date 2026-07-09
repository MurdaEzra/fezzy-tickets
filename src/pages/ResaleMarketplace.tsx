import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatPrice } from "@/lib/eventsApi";
import { Loader2, Search, Ticket, Calendar, MapPin } from "lucide-react";

/**
 * Public marketplace listing shape — matches the ticket_resale_listings_public view.
 * By design this view does NOT expose qr_token, buyer/seller identity, or holder PII.
 * Do not add sensitive fields here without also changing the view definition.
 */
interface PublicListing {
  listing_id: string;
  resale_price_kes: number;
  listed_at: string;
  status: string;
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

const ResaleMarketplace = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("price_asc");

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      let query = supabase
        // Public, PII-safe view. Never query ticket_resale_listings directly from anon UI.
        .from("ticket_resale_listings_public" as never)
        .select("*");

      if (sortBy === "price_asc") {
        query = query.order("resale_price_kes", { ascending: true });
      } else if (sortBy === "price_desc") {
        query = query.order("resale_price_kes", { ascending: false });
      } else if (sortBy === "date_asc") {
        query = query.order("listed_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setListings((data as unknown as PublicListing[]) ?? []);
    } catch (error) {
      console.error("Error fetching resale listings:", error);
      toast.error("Failed to load resale listings");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (listingId: string) => {
    if (!user) {
      toast.info("Please sign in to purchase tickets");
      return;
    }

    try {
      setPurchasingId(listingId);
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-initiate-purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ listingId, paymentMethod: "mpesa", callbackUrl }),
        },
      );

      const result = await response.json();
      if (!response.ok || !result.authorization_url) {
        throw new Error(result.error || "Purchase failed");
      }

      toast.success("Redirecting to secure M-Pesa checkout…");
      window.location.href = result.authorization_url as string;
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
      setPurchasingId(null);
    }
  };

  const filteredListings = listings.filter((listing) =>
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
                        onClick={() => handlePurchase(listing.listing_id)}
                        disabled={purchasingId === listing.listing_id}
                      >
                        {purchasingId === listing.listing_id ? "Reserving..." : "Buy via M-Pesa"}
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
    </div>
  );
};

export default ResaleMarketplace;

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, Smartphone, Wallet, Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchEventBySlug, fetchTiers, formatEventDateLong, formatPrice } from "@/lib/eventsApi";

interface EventLike {
  id: string;
  title: string;
  slug: string;
  image: string;
  date: string;
  venue: string;
  city: string;
  tiers: { id: string; name: string; price: number }[];
}

const Checkout = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [evt, setEvt] = useState<EventLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [calc, setCalc] = useState<{ subtotal: number; fee: number; total: number } | null>(null);

  const params = new URLSearchParams(window.location.search);
  const tierIdx = Number(params.get("tier") ?? 0);
  const qty = Number(params.get("qty") ?? 1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      const dbEvent = await fetchEventBySlug(slug).catch(() => null);
      if (cancelled) return;
      if (dbEvent) {
        const tiers = await fetchTiers(dbEvent.id);
        setEvt({
          id: dbEvent.id,
          title: dbEvent.title,
          slug: dbEvent.slug,
          image: dbEvent.cover_image_url ?? "",
          date: dbEvent.starts_at,
          venue: dbEvent.venue_name ?? "TBA",
          city: dbEvent.city ?? "",
          tiers: tiers.map((t) => ({ id: t.id, name: t.name, price: t.price_kes })),
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (user) {
      setEmail((e) => e || user.email || "");
      const md = user.user_metadata as { full_name?: string } | undefined;
      setName((n) => n || md?.full_name || "");
    }
  }, [user]);

  const tier = evt?.tiers[tierIdx] ?? evt?.tiers[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!evt || !tier?.id) return;
      const { data, error } = await supabase.functions.invoke('calculate-order', {
        body: { eventId: evt.id, tierId: tier.id, quantity: qty },
      });
      if (!cancelled && !error && data) setCalc(data as typeof calc);
    })();
    return () => { cancelled = true; };
  }, [evt, tier?.id, qty]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evt || !tier?.id || !calc) return;
    setProcessing(true);
    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke('paystack-init-transaction', {
        body: { eventId: evt.id, tierId: tier.id, quantity: qty, name, email, phone, callbackUrl },
      });
      const err = (data as { error?: string } | null)?.error ?? error?.message;
      if (err) throw new Error(err);
      const url = (data as { authorization_url: string }).authorization_url;
      window.location.href = url;
    } catch (err) {
      toast.error("Couldn't start payment", { description: (err as Error).message });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (!evt || !tier) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <h1 className="display text-4xl">Event not found</h1>
          <Button variant="acacia" className="mt-6" asChild><Link to="/events">Browse events</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto max-w-6xl py-12 md:py-16">
          <Link to={`/events/${evt.slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to event
          </Link>
          <h1 className="display mt-6 text-4xl text-foreground sm:text-5xl">
            Get your <span className="script font-normal text-primary text-[1.2em]">tickets</span>
          </h1>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
            <form onSubmit={submit} className="space-y-8">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-bold">Where should we send your tickets?</h2>
                <p className="text-sm text-muted-foreground">Tickets with QR codes will be emailed to you instantly after payment.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-bold">Choose how to pay</h2>
                <p className="mt-1 text-sm text-muted-foreground">All methods are processed securely by Paystack on the next screen.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <PayBadge icon={Smartphone} label="M-Pesa" />
                  <PayBadge icon={CreditCard} label="Card" />
                  <PayBadge icon={Wallet} label="Apple Pay" />
                </div>
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-secondary p-4 text-xs text-muted-foreground">
                  <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>Payment is split instantly — the organizer receives their share and the platform fee comes to us. No funds are held.</span>
                </div>
              </div>

              <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={processing || !calc}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {processing ? 'Redirecting to Paystack…' : `Pay ${calc ? formatPrice(calc.total) : '...'}`}
              </Button>
            </form>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <p className="eyebrow">Order summary</p>
                <div className="mt-4 flex gap-3">
                  {evt.image && <img src={evt.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />}
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight text-foreground">{evt.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatEventDateLong(evt.date)}</p>
                    <p className="text-xs text-muted-foreground">{evt.venue}, {evt.city}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-between rounded-2xl bg-background p-4 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{tier.name}</p>
                    <p className="text-xs text-muted-foreground">× {qty}</p>
                  </div>
                  <p className="font-bold text-foreground">{formatPrice(tier.price * qty)}</p>
                </div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Subtotal</dt><dd className="text-foreground">{calc ? formatPrice(calc.subtotal) : '...'}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <dt className="font-semibold text-foreground">You pay</dt>
                    <dd className="font-display text-xl font-bold text-foreground">{calc ? formatPrice(calc.total) : '...'}</dd>
                  </div>
                  <p className="rounded-xl bg-primary/10 p-3 text-xs text-primary">
                    🎉 No service fees on your end — the organizer covers it.
                  </p>
                </dl>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const PayBadge = ({ icon: Icon, label }: { icon: typeof CreditCard; label: string }) => (
  <div className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3 text-sm">
    <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
      <Icon className="h-4 w-4" />
    </span>
    <span className="font-semibold text-foreground">{label}</span>
  </div>
);

export default Checkout;

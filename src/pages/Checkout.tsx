import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Loader2, Smartphone, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { events as fallbackEvents, formatPrice, formatDateLong } from "@/data/events";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchEventBySlug, fetchTiers, type DbEvent, type DbTier } from "@/lib/eventsApi";

interface EventLike {
  id?: string;
  title: string;
  slug: string;
  image: string;
  date: string;
  venue: string;
  city: string;
  currency?: string;
  tiers: { id?: string; name: string; price: number }[];
  isReal: boolean;
}

const Checkout = () => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [evt, setEvt] = useState<EventLike | null>(null);
  const [loading, setLoading] = useState(true);

  const tierIdx = Number(params.get("tier") ?? 0);
  const qty = Number(params.get("qty") ?? 1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"mpesa" | "card">("mpesa");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);

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
          isReal: true,
        });
      } else {
        const m = fallbackEvents.find((e) => e.slug === slug);
        if (m) {
          setEvt({
            title: m.title, slug: m.slug, image: m.image,
            date: m.date, venue: m.venue, city: m.city, currency: m.currency,
            tiers: m.tiers.map((t) => ({ name: t.name, price: t.price })),
            isReal: false,
          });
        }
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
  if (!evt) {
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

  const tier = evt.tiers[tierIdx] ?? evt.tiers[0];
  const subtotal = tier.price * qty;
  // Fee paid by ORGANIZER, not added to buyer total
  const total = subtotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      // Mock M-Pesa STK delay
      if (method === "mpesa") {
        toast.info("STK push sent", { description: `Check ${phone} to authorize.` });
        await new Promise((r) => setTimeout(r, 1300));
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }

      let ref = `FZ-${Date.now().toString().slice(-8)}`;

      if (evt.isReal && evt.id && tier.id) {
        // Real DB write — fee charged to organizer
        const fee = Math.round(subtotal * 0.05);
        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .insert({
            event_id: evt.id,
            user_id: user?.id ?? null,
            guest_name: name,
            guest_email: email,
            guest_phone: phone,
            subtotal_kes: subtotal,
            organizer_fee_kes: fee,
            total_kes: total,
            payment_method: method,
            status: "paid",
            payment_ref: ref,
          })
          .select()
          .single();
        if (orderErr || !order) throw orderErr ?? new Error("Order failed");

        const ticketRows = Array.from({ length: qty }).map(() => ({
          order_id: order.id,
          event_id: evt.id!,
          tier_id: tier.id!,
          holder_name: name,
          holder_email: email,
        }));
        const { error: tixErr } = await supabase.from("tickets").insert(ticketRows);
        if (tixErr) throw tixErr;

        ref = `FZ-${order.id.slice(0, 8).toUpperCase()}`;

        // Trigger ticket email + QR generation (best-effort)
        supabase.functions.invoke("send-ticket-email", { body: { orderId: order.id } })
          .catch((err) => console.warn("ticket email", err));
      }

      setDone({ ref });
      toast.success("Tickets confirmed!", { description: `Sent to ${email}.` });
    } catch (err) {
      console.error(err);
      toast.error("Payment failed", { description: (err as Error).message });
    } finally {
      setProcessing(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-px mx-auto max-w-2xl py-20">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-12">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
              <Check className="h-8 w-8" />
            </div>
            <p className="eyebrow mt-6">Confirmed</p>
            <h1 className="display mt-3 text-4xl font-bold text-foreground sm:text-5xl">
              You're <span className="script font-normal text-primary text-[1.2em]">in</span>!
            </h1>
            <p className="mt-3 text-muted-foreground">
              {qty} × {tier.name} for <span className="text-foreground font-semibold">{evt.title}</span>.
            </p>
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-background p-6 text-left">
              <Row k="Booking ref" v={<span className="font-mono font-bold">{done.ref}</span>} />
              <Row k="Date" v={formatDateLong(evt.date)} />
              <Row k="Total paid" v={<span className="font-bold">{formatPrice(total)}</span>} />
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-2xl bg-secondary p-4 text-left text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>We've emailed your ticket{qty > 1 ? "s" : ""} (with QR code) to <strong>{email}</strong>. Show the QR at the gate — screenshots work too.</span>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {user && <Button variant="acacia" size="lg" asChild><Link to="/account">View my tickets</Link></Button>}
              <Button variant="outline" size="lg" asChild><Link to="/events">Browse more events</Link></Button>
            </div>
          </div>
        </main>
        <Footer />
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
          {!user && (
            <p className="mt-3 text-sm text-muted-foreground">
              No account needed — your ticket goes straight to your email. Want to track all your bookings?{" "}
              <Link to={`/auth?mode=signup&redirect=/events/${evt.slug}/checkout`} className="font-semibold text-primary hover:underline">Create an account</Link>.
            </p>
          )}

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
            <form onSubmit={submit} className="space-y-8">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-bold">Where should we send your tickets?</h2>
                <p className="text-sm text-muted-foreground">Tickets with QR codes will be emailed to you instantly.</p>
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
                    <Label htmlFor="phone">Phone (M-Pesa)</Label>
                    <Input id="phone" placeholder="+254 712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-bold">Payment</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "mpesa" as const, icon: Smartphone, title: "M-Pesa", sub: "STK push to your phone" },
                    { id: "card" as const, icon: CreditCard, title: "Card", sub: "Visa · Mastercard · Amex" },
                  ].map((m) => {
                    const active = method === m.id;
                    return (
                      <button
                        key={m.id} type="button" onClick={() => setMethod(m.id)}
                        className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${active ? "border-primary bg-primary/[0.06]" : "border-border bg-background hover:border-foreground/30"}`}
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background">
                          <m.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Payments aren't live yet — this checkout simulates the full flow so you can preview it.
                </p>
              </div>

              <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                Pay {formatPrice(total)}
              </Button>
            </form>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <p className="eyebrow">Order summary</p>
                <div className="mt-4 flex gap-3">
                  {evt.image && <img src={evt.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />}
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight text-foreground">{evt.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateLong(evt.date)}</p>
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
                    <dt>Subtotal</dt><dd className="text-foreground">{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <dt className="font-semibold text-foreground">You pay</dt>
                    <dd className="font-display text-xl font-bold text-foreground">{formatPrice(total)}</dd>
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

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="mt-2 flex items-center justify-between text-sm first:mt-0">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-foreground">{v}</span>
  </div>
);

export default Checkout;

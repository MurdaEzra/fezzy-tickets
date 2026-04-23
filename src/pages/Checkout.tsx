import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Loader2, Smartphone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { events, formatPrice, formatDateLong } from "@/data/events";
import { useAuth } from "@/hooks/useAuth";

const Checkout = () => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const event = events.find((e) => e.slug === slug);
  const tierIdx = Number(params.get("tier") ?? 0);
  const qty = Number(params.get("qty") ?? 1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"mpesa" | "card">("mpesa");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?mode=signin&redirect=/events/${slug}/checkout`, { replace: true });
  }, [user, authLoading, navigate, slug]);

  useEffect(() => {
    if (user) {
      setEmail(user.email ?? "");
      const md = user.user_metadata as { full_name?: string };
      setName(md?.full_name ?? "");
    }
  }, [user]);

  if (!event) {
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

  const tier = event.tiers[tierIdx] ?? event.tiers[0];
  const subtotal = tier.price * qty;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    // Mock checkout — payments are not enabled yet
    await new Promise((r) => setTimeout(r, 1400));
    if (method === "mpesa") {
      toast.success("STK push sent", { description: `Check ${phone} to authorize the payment.` });
      await new Promise((r) => setTimeout(r, 1200));
    }
    setProcessing(false);
    setDone(true);
    toast.success("Tickets confirmed!", { description: "Sent to your email and added to My Account." });
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
              {qty} × {tier.name} for <span className="text-foreground font-semibold">{event.title}</span>.
            </p>
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-background p-6 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Booking ref</span>
                <span className="font-mono font-bold text-foreground">FZ-{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground">{formatDateLong(event.date)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total paid</span>
                <span className="font-bold text-foreground">{formatPrice(total, event.currency)}</span>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="acacia" size="lg" asChild><Link to="/account">View my tickets</Link></Button>
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
          <Link to={`/events/${event.slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to event
          </Link>
          <h1 className="display mt-6 text-4xl text-foreground sm:text-5xl">
            Get your <span className="script font-normal text-primary text-[1.2em]">tickets</span>
          </h1>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
            <form onSubmit={submit} className="space-y-8">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
                <h2 className="font-display text-xl font-bold">Attendee details</h2>
                <p className="text-sm text-muted-foreground">For your QR ticket and reminders.</p>
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
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                          active ? "border-primary bg-primary/[0.06]" : "border-border bg-background hover:border-foreground/30"
                        }`}
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
                  Payments aren't live yet — this checkout simulates the real flow so you can test the experience end-to-end.
                </p>
              </div>

              <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                Pay {formatPrice(total, event.currency)}
              </Button>
            </form>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <p className="eyebrow">Order summary</p>
                <div className="mt-4 flex gap-3">
                  <img src={event.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight text-foreground">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateLong(event.date)}</p>
                    <p className="text-xs text-muted-foreground">{event.venue}, {event.city}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-between rounded-2xl bg-background p-4 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{tier.name}</p>
                    <p className="text-xs text-muted-foreground">× {qty}</p>
                  </div>
                  <p className="font-bold text-foreground">{formatPrice(tier.price * qty, event.currency)}</p>
                </div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Subtotal</dt><dd className="text-foreground">{formatPrice(subtotal, event.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Service fee</dt><dd className="text-foreground">{formatPrice(fee, event.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <dt className="font-semibold text-foreground">Total</dt>
                    <dd className="font-display text-xl font-bold text-foreground">{formatPrice(total, event.currency)}</dd>
                  </div>
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

export default Checkout;

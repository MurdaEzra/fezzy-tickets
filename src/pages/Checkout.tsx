import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEventDetail, useEventTiers } from "@/hooks/useEvents";
import { logActivity } from "@/lib/activityLog";
import { formatEventDateLong, formatPrice } from "@/lib/eventsApi";
import { BUYER_FEE_LABEL, BUYER_FEE_PCT, isEventDue } from "@/lib/pricing";

type TicketHolder = {
  name: string;
  email: string;
  phone: string;
};

const emptyHolder = (): TicketHolder => ({ name: "", email: "", phone: "" });

const Checkout = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dbEvent, isLoading: eventLoading } = useEventDetail(slug);
  const { data: tiers = [], isLoading: tiersLoading } = useEventTiers(dbEvent?.id);

  const [calc, setCalc] = useState<{ subtotal: number; fee: number; total: number; discount?: number; discountPercent?: number }>({ subtotal: 0, fee: 0, total: 0 });
  const params = new URLSearchParams(window.location.search);
  const tierIdx = Number(params.get("tier") ?? 0);
  const qty = Math.max(1, Number(params.get("qty") ?? 1));

  const [holders, setHolders] = useState<TicketHolder[]>(Array.from({ length: qty }, emptyHolder));
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card" | "apple_pay">("mpesa");
  const [processing, setProcessing] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ id: string; discountPercent: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const evt = useMemo(() => {
    if (!dbEvent) return null;
    return {
      id: dbEvent.id,
      title: dbEvent.title,
      slug: dbEvent.slug,
      image: dbEvent.poster_url ?? dbEvent.cover_image_url ?? "",
      date: dbEvent.starts_at,
      venue: dbEvent.venue_name ?? "TBA",
      city: dbEvent.city ?? "",
      tiers: tiers.map((t) => ({ id: t.id, name: t.name, price: t.price_kes })),
    };
  }, [dbEvent, tiers]);

  useEffect(() => {
    setHolders((prev) => {
      const next = Array.from({ length: qty }, (_, i) => prev[i] ?? emptyHolder());
      return next;
    });
  }, [qty]);

  useEffect(() => {
    if (!user) return;
    const md = user.user_metadata as { full_name?: string } | undefined;
    setHolders((prev) => {
      if (!prev[0]) return prev;
      const first = { ...prev[0] };
      if (!first.email) first.email = user.email ?? "";
      if (!first.name) first.name = md?.full_name ?? "";
      return [first, ...prev.slice(1)];
    });
  }, [user]);

  const tier = evt?.tiers[tierIdx] ?? evt?.tiers[0];
  const salesClosed = evt ? isEventDue(evt.date) : false;
  const loading = eventLoading || tiersLoading;

  const calculateOrder = async () => {
    if (!evt || !tier?.id) return;
    const { data, error } = await supabase.functions.invoke("calculate-order", {
      body: { eventId: evt.id, tierId: tier.id, quantity: qty, promoCode: promoApplied ? promoCode : null },
    });
    if (!error && data) setCalc(data as typeof calc);
    if (error || (data as { error?: string } | null)?.error) {
      toast.error("Checkout unavailable", {
        description: (data as { error?: string } | null)?.error ?? error?.message ?? "Please try again.",
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!evt || !tier?.id) return;
      const { data, error } = await supabase.functions.invoke("calculate-order", {
        body: { eventId: evt.id, tierId: tier.id, quantity: qty, promoCode: promoApplied ? promoCode : null },
      });
      if (!cancelled && !error && data) setCalc(data as typeof calc);
      if (!cancelled && (error || (data as { error?: string } | null)?.error)) {
        toast.error("Checkout unavailable", {
          description: (data as { error?: string } | null)?.error ?? error?.message ?? "Please try again.",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [evt, tier?.id, qty, promoApplied]);

  const applyPromo = async () => {
    if (!promoCode.trim() || !dbEvent?.id) return;
    setPromoLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("id, discount_percent, max_uses, used_count, starts_at, ends_at")
        .eq("event_id", dbEvent.id)
        .eq("code", promoCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        toast.error("Invalid promo code");
        setPromoApplied(null);
        return;
      }

      const now = new Date();
      if (data.starts_at && new Date(data.starts_at) > now) {
        toast.error("Promo code not active yet");
        setPromoApplied(null);
        return;
      }
      if (data.ends_at && new Date(data.ends_at) < now) {
        toast.error("Promo code expired");
        setPromoApplied(null);
        return;
      }
      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("Promo code fully redeemed");
        setPromoApplied(null);
        return;
      }

      setPromoApplied({ id: data.id, discountPercent: data.discount_percent });
      calculateOrder();
      toast.success("Promo code applied");
    } finally {
      setPromoLoading(false);
    }
  };

  const updateHolder = (index: number, field: keyof TicketHolder, value: string) => {
    setHolders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evt || !tier?.id) return;
    if (salesClosed) {
      toast.error("Ticket sales are closed for this event.");
      return;
    }
    if (!agreedTerms) {
      toast.error("Please accept the Terms and Privacy Policy to continue.");
      return;
    }

    const normalized = holders.map((h) => ({
      name: h.name.trim(),
      email: h.email.trim(),
      phone: h.phone.trim(),
    }));

    if (normalized.some((h) => !h.name || !h.email)) {
      toast.error("Enter each ticket holder's name and email.");
      return;
    }
    if (paymentMethod === "mpesa" && !normalized[0]?.phone) {
      toast.error("Enter a phone number for the first ticket holder (used for M-Pesa).");
      return;
    }

    setProcessing(true);
    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("paystack-init-transaction", {
        body: {
          eventId: evt.id,
          tierId: tier.id,
          quantity: qty,
          name: normalized[0].name,
          email: normalized[0].email,
          phone: normalized[0].phone,
          holders: normalized,
          callbackUrl,
          method: paymentMethod,
          marketingOptIn,
          promoCodeId: promoApplied?.id,
        },
      });
      const err = (data as { error?: string } | null)?.error ?? error?.message;
      if (err) {
        await logActivity("checkout.failed", {
          level: "error",
          message: err,
          metadata: { eventId: evt.id, tierId: tier.id, quantity: qty },
          userId: user?.id,
        });
        toast.error("Payment failed", { description: err });
        setProcessing(false);
        return;
      }

      await logActivity("checkout.initiated", {
        message: `Checkout for ${evt.title}`,
        metadata: { eventId: evt.id, quantity: qty, paymentMethod },
        userId: user?.id,
      });

      const url = (data as { authorization_url: string }).authorization_url;
      window.location.href = url;
    } catch (err) {
      const message = (err as Error).message;
      await logActivity("checkout.error", { level: "error", message, userId: user?.id });
      toast.error("Payment failed", { description: message });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <div className="mx-auto max-w-1440 px-5 py-32 text-center lg:px-8">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-ash" />
        </div>
      </div>
    );
  }
  if (!evt || !tier) {
    return (
      <div className="fezzy-editorial min-h-screen bg-ink text-cream">
        <Navbar />
        <div className="mx-auto max-w-1440 px-5 py-32 text-center lg:px-8">
          <h1 className="font-display text-4xl text-cream">Event not found</h1>
          <Link to="/events" className="btn-ember mt-6 inline-flex">Browse events</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto max-w-1440 px-5 py-12 md:py-16 lg:px-8">
          <Link to={`/events/${evt.slug}`} className="inline-flex items-center gap-2 font-mono-label text-cream-dim hover:text-cream">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to event
          </Link>
          <h1 className="mt-6 font-display text-4xl text-cream sm:text-5xl">
            Get your tickets
          </h1>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
            <form onSubmit={submit} className="space-y-8">
              <div className="border border-cream/10 bg-ink-card p-6 md:p-8">
                <h2 className="font-display text-xl text-cream">
                  {qty > 1 ? "Ticket holder details" : "Where should we send your ticket?"}
                </h2>
                <p className="mt-1 text-sm text-cream-dim">
                  {qty > 1
                    ? "Each ticket holder receives their own QR code by email."
                    : "Your ticket with QR code will be emailed instantly after payment."}
                </p>
                <div className="mt-6 space-y-6">
                  {holders.map((holder, index) => (
                    <div key={index} className="border border-cream/10 bg-ink p-4">
                      <p className="mb-3 font-mono-label text-ash">
                        Ticket {index + 1}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block font-mono-label text-cream-dim">Full name</label>
                          <input
                            value={holder.name}
                            onChange={(e) => updateHolder(index, "name", e.target.value)}
                            required
                            className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block font-mono-label text-cream-dim">Email</label>
                          <input
                            type="email"
                            value={holder.email}
                            onChange={(e) => updateHolder(index, "email", e.target.value)}
                            required
                            className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block font-mono-label text-cream-dim">
                            Phone {index === 0 && paymentMethod === "mpesa" ? "(required for M-Pesa)" : "(optional)"}
                          </label>
                          <input
                            placeholder="0712 345 678"
                            value={holder.phone}
                            onChange={(e) => updateHolder(index, "phone", e.target.value)}
                            className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-cream/10 bg-ink-card p-6 md:p-8">
                <h2 className="font-display text-xl text-cream">Choose how to pay</h2>
                <p className="mt-1 text-sm text-cream-dim">Select your preferred checkout method and continue to Paystack to complete payment.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <PayBadge icon={Smartphone} label="M-Pesa" selected={paymentMethod === "mpesa"} onSelect={() => setPaymentMethod("mpesa")} />
                  <PayBadge icon={CreditCard} label="Card" selected={paymentMethod === "card"} onSelect={() => setPaymentMethod("card")} />
                  <PayBadge icon={Wallet} label="Apple" selected={paymentMethod === "apple_pay"} onSelect={() => setPaymentMethod("apple_pay")} />
                </div>
              </div>

              <div className="border border-cream/10 bg-ink-card p-6 md:p-8 space-y-3">
                <label className="flex items-start gap-2 text-sm text-cream-dim">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-fezzy"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" className="font-semibold text-fezzy hover:text-lime">Terms and Conditions</Link>
                    {" "}and{" "}
                    <Link to="/privacy" target="_blank" className="font-semibold text-fezzy hover:text-lime">Privacy Policy</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-cream-dim">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-fezzy"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                  />
                  <span>Keep me posted about this event and similar ones from this organizer (optional).</span>
                </label>
              </div>

              <button type="submit" className="btn-ember w-full justify-center" disabled={processing || !calc || !agreedTerms || salesClosed}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {salesClosed
                  ? "Ticket sales closed"
                  : processing
                    ? "Redirecting to Paystack…"
                    : `Pay ${calc ? formatPrice(calc.total) : "..."} with ${paymentMethod === "mpesa" ? "M-Pesa" : paymentMethod === "apple_pay" ? "Apple Pay" : "Card"}`}
              </button>
            </form>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="border border-cream/10 bg-ink-card p-6">
                <p className="font-mono-label text-fezzy-glow">Order summary</p>
                <div className="mt-4 flex gap-3">
                  {evt.image && <img src={evt.image} alt="" className="h-20 w-20 object-cover" />}
                  <div className="min-w-0">
                    <p className="font-display leading-tight text-cream">{evt.title}</p>
                    <p className="mt-1 font-mono-label text-ash">{formatEventDateLong(evt.date)}</p>
                    <p className="font-mono-label text-ash">{evt.venue}, {evt.city}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-between bg-ink p-4 text-sm">
                  <div>
                    <p className="font-semibold text-cream">{tier.name}</p>
                    <p className="font-mono-label text-ash">× {qty}</p>
                  </div>
                  <p className="font-semibold text-cream">{formatPrice(tier.price * qty)}</p>
                </div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between text-cream-dim">
                    <dt>Subtotal</dt><dd className="text-cream">{calc ? formatPrice(calc.subtotal) : "..."}</dd>
                  </div>
                  {calc.discount && (
                    <div className="flex justify-between text-fezzy">
                      <dt>Discount ({calc.discountPercent}%)</dt><dd>-{formatPrice(calc.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-cream-dim">
                    <dt>{BUYER_FEE_LABEL} ({BUYER_FEE_PCT}%)</dt><dd className="text-cream">{calc ? formatPrice(calc.fee) : "..."}</dd>
                  </div>
                  <div className="flex justify-between border-t border-cream/10 pt-3">
                    <dt className="font-semibold text-cream">You pay</dt>
                    <dd className="font-display text-xl text-cream">{calc ? formatPrice(calc.total) : "..."}</dd>
                  </div>
                </dl>
                
                <div className="mt-5 space-y-3">
                  {!promoApplied ? (
                    <div className="flex gap-2">
                      <input
                        placeholder="Promo code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={promoLoading}
                        className="btn-ember px-4"
                      >
                        {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-fezzy/30 bg-fezzy/10 p-3">
                      <div>
                        <p className="font-mono-label text-fezzy-glow">Promo applied</p>
                        <p className="font-semibold text-cream">{promoCode}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPromoApplied(null);
                          setPromoCode("");
                          calculateOrder();
                        }}
                        className="text-sm text-cream-dim hover:text-cream"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {salesClosed && (
                  <p className="mt-4 border border-ember/30 bg-ember/10 p-3 font-mono-label text-ember">
                    Ticket sales are closed because this event has started.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const PayBadge = ({ icon: Icon, label, selected, onSelect }: { icon: typeof CreditCard; label: string; selected?: boolean; onSelect?: () => void }) => (
  <button type="button" onClick={onSelect} className={`flex items-center gap-2 border p-3 text-sm transition ${selected ? "border-fezzy bg-fezzy/10" : "border-cream/15 bg-ink hover:border-fezzy/60"}`}>
    <span className={`grid h-8 w-8 place-items-center ${selected ? "bg-fezzy text-ink" : "bg-cream/10 text-cream"}`}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="font-semibold text-cream">{label}</span>
  </button>
);

export default Checkout;

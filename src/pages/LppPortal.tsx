// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, Loader2, ShieldCheck, Ticket, WalletCards } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { lppGetPlan, lppPayInstallment, type LppInstallment, type LppPlan } from "@/lib/lpp";
import { formatPrice, formatEventDateLong } from "@/lib/eventsApi";

const LppPortal = () => {
  const [params, setParams] = useSearchParams();
  const initialRef = params.get("ref") ?? "";
  const [refInput, setRefInput] = useState(initialRef);
  const [refNo, setRefNo] = useState(initialRef);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [plan, setPlan] = useState<LppPlan | null>(null);
  const [installments, setInstallments] = useState<LppInstallment[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState(false);

  const loadPlan = async (ref: string) => {
    // Normalize ref by removing any non-alphanumeric characters
    const normalizedRef = ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setLoading(true);
    try {
      const res = await lppGetPlan(normalizedRef);
      setPlan(res.plan ?? null);
      setInstallments(res.installments);
      setEvent(res.event);
      setTier(res.tier);
      setRefNo(normalizedRef);
      setRefInput(normalizedRef);
      setPendingDeposit(Boolean(res.pendingDeposit));
      setParams({ ref: normalizedRef });
    } catch (err) {
      toast.error("Plan not found", { description: (err as Error).message });
      setPlan(null);
      setPendingDeposit(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRef) loadPlan(initialRef.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while awaiting payment
  useEffect(() => {
    if ((!awaitingPayment && !pendingDeposit) || !refNo) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await lppGetPlan(refNo);
        if (res.plan) {
          const paidBefore = plan?.paid_kes ?? 0;
          if ((res.plan.paid_kes ?? 0) > paidBefore) {
            setPlan(res.plan);
            setInstallments(res.installments);
            setAwaitingPayment(false);
            setPendingDeposit(false);
            toast.success("Payment received");
            if (res.plan.status === "completed") {
              toast.success("You're fully paid — ticket on the way!", { duration: 6000 });
            }
          } else {
            setPlan(res.plan);
            setInstallments(res.installments);
            setPendingDeposit(false);
          }
        } else {
          setPendingDeposit(true);
        }
      } catch { /* ignore */ }
      if (attempts > 40) {
        clearInterval(timer);
        setAwaitingPayment(false);
        toast.error("Payment confirmation timed out. Please check your M-Pesa messages or try again later.");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [awaitingPayment, pendingDeposit, refNo, plan?.paid_kes]);

  const pay = async () => {
    if (!refNo || !phone) {
      toast.error("Enter your M-Pesa phone number");
      return;
    }
    setPaying(true);
    try {
      const res = await lppPayInstallment(refNo, phone);
      toast.success(res.customer_message);
      setAwaitingPayment(true);
    } catch (err) {
      toast.error("Payment failed", { description: (err as Error).message });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto max-w-1440 px-5 py-14 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <span className="inline-flex items-center gap-2 border border-fezzy/50 bg-fezzy/10 px-3 py-1 font-mono-label text-fezzy">
              <WalletCards className="h-3.5 w-3.5" /> Lipa Pole Pole
            </span>
            <h1 className="mt-4 font-display text-4xl text-cream sm:text-6xl">
              Pay for your ticket, <span className="text-fezzy">pole pole</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-cream-dim">
              Enter the reference number we sent to your email. You'll top up in installments straight from M-Pesa. Your ticket unlocks the moment the balance hits zero.
            </p>

            {/* Ref no. lookup */}
            <div className="mt-10 border border-cream/10 bg-ink-card p-6 md:p-8">
              <label className="font-mono-label text-cream-dim">Your reference number</label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                  placeholder="FZXXXXXXXX"
                  className="flex-1 border border-cream/15 bg-ink-soft px-4 py-3 font-mono text-lg tracking-widest text-cream outline-none focus:border-fezzy placeholder:text-ash"
                />
                <button
                  className="btn-ember justify-center"
                  onClick={() => refInput.trim() && loadPlan(refInput.trim().toUpperCase())}
                  disabled={loading || !refInput.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Look up plan
                </button>
              </div>
              <p className="mt-3 text-xs text-ash">Check your inbox for your ref no. — it's on the schedule we sent when you started your plan.</p>
            </div>

            {pendingDeposit && !plan && (
              <div className="mt-10 border border-fezzy/20 bg-fezzy/10 p-6 md:p-8">
                <p className="font-mono-label text-fezzy">Deposit payment pending</p>
                <p className="mt-2 text-sm text-cream-dim">
                  The deposit STK push has been sent. Once that payment is confirmed, your LPP plan will be created automatically here.
                </p>
              </div>
            )}

            {/* Plan detail */}
            {plan && (
              <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-6">
                  <div className="border border-cream/10 bg-ink-card p-6 md:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono-label text-ash">Reference</p>
                        <p className="font-mono text-2xl tracking-widest text-fezzy">{plan.ref_no}</p>
                      </div>
                      <StatusPill status={plan.status} />
                    </div>
                    {event && (
                      <div className="mt-6 border-t border-cream/10 pt-6">
                        <p className="font-mono-label text-ash">Event</p>
                        <p className="mt-1 font-display text-2xl text-cream">{event.title}</p>
                        <p className="mt-1 text-sm text-cream-dim">
                          {formatEventDateLong(event.starts_at)} · {event.venue_name ?? "TBA"}
                          {event.city ? `, ${event.city}` : ""}
                        </p>
                        <p className="mt-2 text-sm text-cream-dim">
                          {plan.quantity} × {tier?.name ?? "Ticket"} · {plan.plan_label}
                        </p>
                      </div>
                    )}
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <Stat label="Total" value={formatPrice(plan.total_kes)} />
                      <Stat label="Paid" value={formatPrice(plan.paid_kes)} accent />
                      <Stat label="Balance" value={formatPrice(plan.balance_kes)} />
                    </div>
                    <div className="mt-4 h-2 w-full overflow-hidden bg-ink-soft">
                      <div
                        className="h-full bg-fezzy transition-all"
                        style={{ width: `${Math.min(100, (plan.paid_kes / Math.max(1, plan.total_kes)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="border border-cream/10 bg-ink-card p-6 md:p-8">
                    <h3 className="font-display text-xl text-cream">Your schedule</h3>
                    <p className="mt-1 text-sm text-cream-dim">
                      Each installment has its own ID. We'll clear them in order as your payments come in.
                    </p>
                    <div className="mt-5 space-y-2">
                      {installments.map((i, idx) => {
                        const paid = i.status === "paid";
                        const isNext = !paid && installments.slice(0, idx).every((x) => x.status === "paid");
                        return (
                          <div
                            key={i.id}
                            className={`flex items-center justify-between border px-4 py-3 transition-colors ${
                              paid
                                ? "border-lime/40 bg-lime/5"
                                : isNext
                                  ? "border-fezzy/50 bg-fezzy/5"
                                  : "border-cream/10"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`grid h-8 w-8 place-items-center rounded-full border ${
                                  paid ? "border-lime/50 bg-lime/20 text-lime" : "border-cream/20 text-ash"
                                }`}
                              >
                                {paid ? <CheckCircle2 className="h-4 w-4" /> : <span className="font-mono text-xs">{i.sequence}</span>}
                              </div>
                              <div>
                                <p className="font-mono-label text-cream">
                                  {i.kind === "deposit" ? "Deposit" : `Installment ${i.sequence}`}
                                </p>
                                <p className="text-xs text-ash">
                                  Due {new Date(i.due_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                                  {" · "}<span className="font-mono">{i.id.slice(0, 8).toUpperCase()}</span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-lg text-cream">{formatPrice(i.amount_kes)}</p>
                              {paid && <p className="text-[10px] font-mono uppercase tracking-wider text-lime">Paid</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="border border-cream/10 bg-ink-card p-6">
                    <h3 className="font-display text-xl text-cream">
                      {plan.status === "completed" ? "All paid up!" : "Pay next installment"}
                    </h3>
                    {plan.status === "completed" ? (
                      <div className="mt-4 space-y-3 text-sm text-cream-dim">
                        <p className="flex items-center gap-2 text-lime">
                          <ShieldCheck className="h-4 w-4" /> Your ticket is being issued.
                        </p>
                        <p>Check your email for the QR code. You can also view it in your account.</p>
                        <Link to="/events" className="btn-outline-editorial mt-2 justify-center">
                          Browse more events
                        </Link>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-cream-dim">
                          We'll send an STK push. Enter your M-Pesa PIN when it pops up.
                        </p>
                        <label className="mt-4 block font-mono-label text-cream-dim">M-Pesa phone</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0712 345 678"
                          className="mt-1 w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none focus:border-fezzy placeholder:text-ash"
                        />
                        <button
                          className="btn-ember mt-4 w-full justify-center"
                          disabled={paying || awaitingPayment}
                          onClick={pay}
                        >
                          {paying || awaitingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
                          {awaitingPayment ? "Waiting for M-Pesa…" : "Pay next installment"}
                        </button>
                        {awaitingPayment && (
                          <p className="mt-3 text-xs text-fezzy">
                            Check your phone. This card will refresh automatically when the payment lands.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border border-cream/10 bg-ink-card p-6 text-sm text-cream-dim">
                    <p className="flex items-center gap-2 font-mono-label text-cream">
                      <CalendarClock className="h-4 w-4 text-fezzy" /> Final due
                    </p>
                    <p className="mt-2">
                      {new Date(plan.final_due_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="mt-3 text-xs text-ash">
                      Your ref number won't work at the gate until every installment is paid. Complete the plan before the event starts.
                    </p>
                  </div>

                  <div className="border border-cream/10 bg-ink-card p-6 text-sm text-cream-dim">
                    <p className="flex items-center gap-2 font-mono-label text-cream">
                      <Ticket className="h-4 w-4 text-fezzy" /> How it works
                    </p>
                    <ol className="mt-3 space-y-2 text-xs text-ash">
                      <li>1. Pay the deposit to reserve your seat.</li>
                      <li>2. Chip away at the balance from this page.</li>
                      <li>3. Ticket auto-issues when the balance hits zero.</li>
                    </ol>
                  </div>
                </aside>
              </div>
            )}

            {!plan && !loading && !initialRef && (
              <div className="mt-10 border border-dashed border-cream/15 bg-ink-card/40 p-10 text-center">
                <p className="font-mono-label text-ash">No plan loaded yet</p>
                <p className="mt-2 text-cream-dim">Paste your ref no. above to see your schedule and make a payment.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="border border-cream/10 bg-ink-soft px-4 py-3">
    <p className="font-mono-label text-ash">{label}</p>
    <p className={`mt-1 font-display text-xl ${accent ? "text-fezzy" : "text-cream"}`}>{value}</p>
  </div>
);

const StatusPill = ({ status }: { status: LppPlan["status"] }) => {
  const map = {
    pending: { label: "Awaiting deposit", cls: "border-cream/20 text-cream-dim" },
    reserved: { label: "Reserved", cls: "border-fezzy/50 text-fezzy bg-fezzy/10" },
    completed: { label: "Paid in full", cls: "border-lime/50 text-lime bg-lime/10" },
    cancelled: { label: "Cancelled", cls: "border-cream/20 text-ash" },
    expired: { label: "Expired", cls: "border-cream/20 text-ash" },
  } as const;
  const m = map[status] ?? map.pending;
  return <span className={`inline-flex items-center gap-1.5 border px-3 py-1 font-mono-label ${m.cls}`}>{m.label}</span>;
};

export default LppPortal;

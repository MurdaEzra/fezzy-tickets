import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2, XCircle, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Status = "verifying" | "success" | "failed" | "pending";

const PaymentCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [status, setStatus] = useState<Status>("verifying");
  const [orderId, setOrderId] = useState<string | null>(null);

  const [eventSlug, setEventSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) { setStatus("failed"); return; }
    let attempts = 0;
    let timer: number | null = null;

    const run = async () => {
      attempts++;
      const { data, error } = await supabase.functions.invoke("paystack-verify", {
        body: { reference },
      });
      if (error) {
        if (attempts >= 4) setStatus("failed");
        else timer = window.setTimeout(run, 1500);
        return;
      }
      const d = data as { paymentStatus: Status; orderId?: string };
      if (d.orderId) {
        setOrderId(d.orderId);
        // Get event slug to allow retrying checkout
        const { data: orderData } = await supabase
          .from("orders")
          .select("events(slug)")
          .eq("id", d.orderId)
          .single();
        if (orderData?.events?.slug) {
          setEventSlug(orderData.events.slug);
        }
      }
      if (d.paymentStatus === "success") setStatus("success");
      else if (d.paymentStatus === "failed") setStatus("failed");
      else if (attempts < 8) timer = window.setTimeout(run, 2000);
      else setStatus("pending");
    };

    run();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [reference]);

  const goToCheckout = () => {
    if (eventSlug) {
      navigate(`/events/${eventSlug}#checkout`);
    } else {
      navigate("/events");
    }
  };

  return (
    <div className="tm-page min-h-screen bg-background">
      <Navbar />
      <main className="container-px mx-auto max-w-2xl py-20">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-12">
          {status === "verifying" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <h1 className="display mt-6 text-3xl">Confirming your payment…</h1>
              <p className="mt-2 text-muted-foreground">This usually takes a couple of seconds.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-8 w-8" />
              </div>
              <p className="eyebrow mt-6">Confirmed</p>
              <h1 className="display mt-3 text-4xl font-bold text-foreground sm:text-5xl">
                You're <span className="script font-normal text-primary text-[1.2em]">in</span>!
              </h1>
              <p className="mt-3 text-muted-foreground">Reference <span className="font-mono">{reference}</span></p>
              <div className="mt-6 flex items-start gap-2 rounded-2xl bg-secondary p-4 text-left text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  We've emailed your ticket(s) with QR codes. Show the QR at the gate — screenshots work too.
                </span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="acacia" size="lg" asChild>
                  <Link to="/events">Browse more events</Link>
                </Button>
              </div>
            </>
          )}
          {status === "pending" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <h1 className="display mt-6 text-3xl">Still confirming</h1>
              <p className="mt-2 text-muted-foreground">It's taking longer than usual — we'll email you the moment your tickets are ready.</p>
              <Button variant="outline" className="mt-6" asChild><Link to="/events">Browse events</Link></Button>
            </>
          )}
          {status === "failed" && (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive">
                <XCircle className="h-8 w-8" />
              </div>
              <h1 className="display mt-6 text-3xl">Payment didn't go through</h1>
              <p className="mt-2 text-muted-foreground">No worries — nothing was charged. Would you like to try again?</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="acacia" onClick={goToCheckout}>Try paying again</Button>
                <Button variant="outline" asChild><Link to="/events">Browse events</Link></Button>
              </div>
            </>
          )}
          {orderId && status === "success" && (
            <p className="mt-6 text-[10px] uppercase tracking-wider text-muted-foreground">Order {orderId.slice(0, 8)}</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentCallback;


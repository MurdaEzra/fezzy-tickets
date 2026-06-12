import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ScanLine, Search, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";

type ScanResult = {
  status: "VALID" | "ALREADY_USED" | "INVALID";
  ticket?: {
    id: string;
    holder: string;
    checked_in_at?: string | null;
    event_title?: string;
    tier?: string;
    venue?: string;
  };
  reason?: string;
};

// Tokens checked in during this session — re-scanning shows ALREADY_USED instantly
const sessionCheckedIn = new Set<string>();

const DEBOUNCE_MS = 3000;

const Scan = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning]     = useState(false);
  const [refInput, setRefInput]     = useState("");
  const [refBusy, setRefBusy]       = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  const scannerRef  = useRef<Html5Qrcode | null>(null);
  const busyRef     = useRef(false);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const containerId = "fezzy-qr-reader";

  useEffect(() => {
    if (!authLoading && !user)
      navigate("/auth?mode=signin&redirect=/scan", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => () => { stopScanner(); }, []);

  // ─── Fire both a toast AND update the inline banner ─────────────────────────
  const handleResult = (r: ScanResult, sessionKey: string) => {
    setLastResult(r);
    toast.dismiss("scan-result");

    if (r.status === "VALID") {
      sessionCheckedIn.add(sessionKey);
      toast.success(`✅ Welcome, ${r.ticket?.holder ?? "Guest"}!`, {
        id: "scan-result",
        description: [
          r.ticket?.tier        && `🎟️ ${r.ticket.tier}`,
          r.ticket?.event_title && `📅 ${r.ticket.event_title}`,
        ].filter(Boolean).join("  ·  ") || undefined,
        duration: 6000,
      });

    } else if (r.status === "ALREADY_USED") {
      const time = r.ticket?.checked_in_at
        ? new Date(r.ticket.checked_in_at).toLocaleTimeString("en-GB", {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          })
        : null;
      toast.warning("⚠️ Ticket already used", {
        id: "scan-result",
        description: [
          r.ticket?.holder && `Holder: ${r.ticket.holder}`,
          time             && `Checked in at ${time}`,
        ].filter(Boolean).join("  ·  ") || undefined,
        duration: 6000,
      });

    } else {
      toast.error("❌ Invalid ticket", {
        id: "scan-result",
        description: r.reason ? `Reason: ${r.reason}` : undefined,
        duration: 6000,
      });
    }
  };

  // ─── QR scan handler ────────────────────────────────────────────────────────
  const handleToken = async (token: string) => {
    if (busyRef.current) return;

    const now = Date.now();
    if (lastScanRef.current?.token === token && now - lastScanRef.current.at < DEBOUNCE_MS) return;
    lastScanRef.current = { token, at: now };

    if (sessionCheckedIn.has(token)) {
      setLastResult({ status: "ALREADY_USED", reason: "Scanned earlier this session" });
      toast.warning("⚠️ Ticket already used", {
        id: "scan-result",
        description: "This ticket was checked in earlier.",
        duration: 6000,
      });
      return;
    }

    busyRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("verify-ticket", {
        body: { token },
      });
      if (error) throw new Error(error.message ?? "Edge function error");
      handleResult(data as ScanResult, token);
    } catch (err) {
      console.error("[scan] error:", err);
      setLastResult({ status: "INVALID", reason: "Server unreachable" });
      toast.error("❌ Scan failed", {
        id: "scan-result",
        description: "Could not reach the server. Check your connection.",
        duration: 6000,
      });
    } finally {
      busyRef.current = false;
    }
  };

  // ─── Manual reference lookup ─────────────────────────────────────────────────
  const handleRefLookup = async () => {
    const ref = refInput.trim().toUpperCase();
    if (!ref) return;
    setRefBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-ticket", {
        body: { ref },
      });
      if (error) throw new Error(error.message ?? "Edge function error");
      const r = data as ScanResult;
      handleResult(r, r.ticket?.id ?? ref);
      if (r.status === "VALID") setRefInput("");
    } catch (err) {
      console.error("[scan] ref lookup error:", err);
      setLastResult({ status: "INVALID", reason: "Server unreachable" });
      toast.error("❌ Lookup failed", {
        id: "scan-result",
        description: "Could not reach the server. Check your connection.",
        duration: 6000,
      });
    } finally {
      setRefBusy(false);
    }
  };

  // ─── Camera controls ─────────────────────────────────────────────────────────
  const startScanner = async () => {
    busyRef.current = false;
    lastScanRef.current = null;
    setLastResult(null);
    try {
      const html5 = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => { handleToken(decoded); },
        () => {},
      );
      setScanning(true);
    } catch (err) {
      console.error("[scan] camera error:", err);
      toast.error("Camera error", {
        description: err instanceof Error ? err.message : "Allow camera access and try again.",
      });
    }
  };

  const stopScanner = async () => {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-deep">
      {/* Toaster scoped to this page — positioned top-center for visibility */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontSize: "15px", fontWeight: 600 },
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-px mx-auto flex max-w-3xl items-center py-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="container-px mx-auto max-w-3xl py-6 space-y-4">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Door scanner</h1>
              <p className="text-xs text-muted-foreground">Aim camera at a Fezzy ticket QR. Result appears instantly.</p>
            </div>
          </div>

          {/* Camera viewport */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-black">
            <div id={containerId} style={{ width: "100%", minHeight: "320px" }} />
          </div>

          {/* Camera controls */}
          <div className="mt-4">
            {!scanning ? (
              <Button variant="acacia" className="w-full" onClick={startScanner}>
                Start camera
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={stopScanner}>
                Stop camera
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">or enter booking reference</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Reference input */}
          <div className="mt-4 flex gap-2">
            <Input
              placeholder="e.g. FZ-A1B2C3D4"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && !refBusy && handleRefLookup()}
              className="flex-1 font-mono tracking-widest uppercase"
              maxLength={20}
            />
            <Button
              variant="acacia"
              onClick={handleRefLookup}
              disabled={refBusy || !refInput.trim()}
              className="shrink-0"
            >
              {refBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* ── Inline result banner — always visible regardless of toast position ── */}
        {lastResult && <ResultBanner result={lastResult} onDismiss={() => setLastResult(null)} />}
      </main>

      <Footer />
    </div>
  );
};

// ─── Inline result banner ─────────────────────────────────────────────────────
const ResultBanner = ({
  result,
  onDismiss,
}: {
  result: ScanResult;
  onDismiss: () => void;
}) => {
  const cfg =
    result.status === "VALID"
      ? {
          bg: "bg-emerald-50 border-emerald-300",
          icon: <CheckCircle2 className="h-10 w-10 text-emerald-500 shrink-0" />,
          heading: `✅ Valid — Welcome, ${result.ticket?.holder ?? "Guest"}!`,
          headingColor: "text-emerald-700",
        }
      : result.status === "ALREADY_USED"
      ? {
          bg: "bg-amber-50 border-amber-300",
          icon: <AlertTriangle className="h-10 w-10 text-amber-500 shrink-0" />,
          heading: "⚠️ Ticket already used",
          headingColor: "text-amber-700",
        }
      : {
          bg: "bg-red-50 border-red-300",
          icon: <XCircle className="h-10 w-10 text-red-500 shrink-0" />,
          heading: "❌ Invalid ticket",
          headingColor: "text-red-700",
        };

  const checkedInTime = result.ticket?.checked_in_at
    ? new Date(result.ticket.checked_in_at).toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : null;

  return (
    <div className={`rounded-3xl border-2 ${cfg.bg} p-5 shadow-card-soft`}>
      <div className="flex items-start gap-4">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <p className={`text-lg font-bold font-display ${cfg.headingColor}`}>{cfg.heading}</p>
          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {result.ticket?.tier        && <p>🎟️ {result.ticket.tier}</p>}
            {result.ticket?.event_title && <p>📅 {result.ticket.event_title}</p>}
            {result.ticket?.venue       && <p>📍 {result.ticket.venue}</p>}
            {checkedInTime && result.status === "ALREADY_USED" && (
              <p className="text-amber-600 font-medium">Previously checked in at {checkedInTime}</p>
            )}
            {result.status === "INVALID" && result.reason && (
              <p className="text-red-600">Reason: {result.reason}</p>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-black/5"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default Scan;

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

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

// Tokens checked in during this session — re-scanning one instantly shows ALREADY_USED
// without hitting the server again.
const sessionCheckedIn = new Set<string>();

const DEBOUNCE_MS = 3000; // suppress duplicate reads of the same QR frame

const Scan = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [refBusy, setRefBusy] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef    = useRef(false);                          // sync guard — no useState
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const containerId = "fezzy-qr-reader";

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user)
      navigate("/auth?mode=signin&redirect=/scan", { replace: true });
  }, [user, authLoading, navigate]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => () => { stopScanner(); }, []);

  // ─── Show toast based on result ─────────────────────────────────────────────
  const showToast = (r: ScanResult, token: string) => {
    // Dismiss any previous scan toast so the new one is always visible
    toast.dismiss("scan-result");

    if (r.status === "VALID") {
      const holder = r.ticket?.holder ?? "Guest";
      const description = [
        r.ticket?.tier        && `🎟️ ${r.ticket.tier}`,
        r.ticket?.event_title && `📅 ${r.ticket.event_title}`,
      ].filter(Boolean).join("  ·  ") || undefined;

      toast.success(`✅ Welcome, ${holder}!`, {
        id: "scan-result",
        description,
        duration: 4000,
      });

      // Lock this token for the rest of the session
      sessionCheckedIn.add(token);

    } else if (r.status === "ALREADY_USED") {
      const time = r.ticket?.checked_in_at
        ? new Date(r.ticket.checked_in_at).toLocaleTimeString("en-GB", {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          })
        : null;

      toast.warning("⚠️ Already used", {
        id: "scan-result",
        description: [
          r.ticket?.holder && `Holder: ${r.ticket.holder}`,
          time             && `Checked in at ${time}`,
        ].filter(Boolean).join(" · ") || undefined,
        duration: 4000,
      });

    } else {
      // INVALID
      const reason = r.reason ?? "unknown";
      toast.error("❌ Invalid ticket", {
        id: "scan-result",
        description: `Reason: ${reason}`,
        duration: 4000,
      });
    }
  };

  // ─── Core scan handler ──────────────────────────────────────────────────────
  const handleToken = async (token: string) => {
    // 1. Sync guard — skip if a request is already in-flight
    if (busyRef.current) return;

    // 2. Debounce — same token within DEBOUNCE_MS is ignored (camera reads same frame ~10×/s)
    const now = Date.now();
    if (lastScanRef.current?.token === token && now - lastScanRef.current.at < DEBOUNCE_MS) return;
    lastScanRef.current = { token, at: now };

    // 3. Session cache — token was checked in earlier this session, no server round-trip needed
    if (sessionCheckedIn.has(token)) {
      toast.warning("⚠️ Already used", {
        id: "scan-result",
        description: "This ticket was already checked in.",
        duration: 4000,
      });
      return;
    }

    busyRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("verify-ticket", {
        body: { token },
      });

      if (error) throw new Error(error.message ?? "Edge function error");

      const r = data as ScanResult;
      showToast(r, token);

    } catch (err) {
      console.error("[scan] error:", err);
      toast.error("❌ Scan failed", {
        id: "scan-result",
        description: "Could not reach the server. Check your connection.",
        duration: 4000,
      });
    } finally {
      busyRef.current = false;
    }
  };

  // ─── Booking reference manual lookup ────────────────────────────────────────
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
      // Use the returned qr_token as the session key if available, else the ref
      const sessionKey = r.ticket?.id ?? ref;
      showToast(r, sessionKey);

      if (r.status === "VALID") setRefInput(""); // clear on success
    } catch (err) {
      console.error("[scan] ref lookup error:", err);
      toast.error("❌ Lookup failed", {
        id: "scan-result",
        description: "Could not reach the server. Check your connection.",
        duration: 4000,
      });
    } finally {
      setRefBusy(false);
    }
  };

  // ─── Camera ─────────────────────────────────────────────────────────────────
  const startScanner = async () => {
    busyRef.current   = false;
    lastScanRef.current = null;

    try {
      const html5 = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5;

      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => { handleToken(decoded); },
        () => { /* ignore per-frame "no QR" errors */ },
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
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch { /* noop */ }
    scannerRef.current = null;
    setScanning(false);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-deep">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-px mx-auto flex max-w-3xl items-center justify-between py-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="container-px mx-auto max-w-3xl py-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Door scanner</h1>
              <p className="text-xs text-muted-foreground">
                Aim the camera at a Fezzy ticket QR. Result appears instantly.
              </p>
            </div>
          </div>

          {/* Camera viewport
              IMPORTANT: explicit minHeight so html5-qrcode doesn't render at 0px */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-black">
            <div id={containerId} style={{ width: "100%", minHeight: "320px" }} />
          </div>

          {/* Controls */}
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

          {/* ── Divider ── */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">or enter booking reference</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* ── Booking reference lookup ── */}
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
              {refBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Scan;
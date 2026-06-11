import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ScanLine,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  offline?: boolean;
};

const OFFLINE_QUEUE_KEY = "fezzy_scan_queue_v1";
const SEEN_TOKENS_KEY = "fezzy_seen_tokens_v1";

// ─── How long to suppress re-scans of the same token (ms) ───────────────────
const DEBOUNCE_MS = 3000;

const Scan = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queueLen, setQueueLen] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Tracks in-flight request so we never fire two at once
  const busyRef = useRef(false);
  // Tracks last scanned token + timestamp for debounce
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const containerId = "fezzy-qr-reader";

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user)
      navigate("/auth?mode=signin&redirect=/scan", { replace: true });
  }, [user, authLoading, navigate]);

  // ── Online / offline listeners ─────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ── Init queue length + auto-flush when back online ───────────────────────
  useEffect(() => {
    setQueueLen(loadQueue().length);
  }, []);

  useEffect(() => {
    if (online) flushQueue();
  }, [online]);

  // ── Cleanup scanner on unmount ─────────────────────────────────────────────
  useEffect(() => () => { stop(); }, []);

  // ─── Storage helpers ───────────────────────────────────────────────────────
  const loadQueue = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const saveQueue = (q: string[]) => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
    setQueueLen(q.length);
  };

  const seenTokens = (): Set<string> => {
    try {
      return new Set(
        JSON.parse(localStorage.getItem(SEEN_TOKENS_KEY) || "[]"),
      );
    } catch {
      return new Set();
    }
  };

  const markSeen = (token: string) => {
    const s = seenTokens();
    s.add(token);
    localStorage.setItem(
      SEEN_TOKENS_KEY,
      JSON.stringify([...s].slice(-2000)),
    );
  };

  // ─── Flush offline queue ───────────────────────────────────────────────────
  const flushQueue = async () => {
    const q = loadQueue();
    if (!q.length) return;
    const remaining: string[] = [];
    for (const tok of q) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-ticket",
          { body: { token: tok } },
        );
        if (error) {
          remaining.push(tok);
        } else if ((data as ScanResult).status === "VALID") {
          markSeen(tok);
        }
      } catch {
        remaining.push(tok);
      }
    }
    saveQueue(remaining);
    const synced = q.length - remaining.length;
    if (synced > 0) toast.success(`Synced ${synced} offline check-in${synced > 1 ? "s" : ""}`);
  };

  // ─── Core scan handler ─────────────────────────────────────────────────────
  const handleToken = async (token: string) => {
    // 1. Skip if another request is already in-flight (ref-based, sync)
    if (busyRef.current) return;

    // 2. Debounce: skip if same token scanned within DEBOUNCE_MS
    const now = Date.now();
    if (
      lastScanRef.current?.token === token &&
      now - lastScanRef.current.at < DEBOUNCE_MS
    ) return;

    lastScanRef.current = { token, at: now };
    busyRef.current = true;

    // ── Offline path ─────────────────────────────────────────────────────────
    if (!online) {
      const seen = seenTokens();
      if (seen.has(token)) {
        setResult({ status: "ALREADY_USED", offline: true, reason: "Scanned offline before" });
      } else {
        const q = loadQueue();
        q.push(token);
        saveQueue(q);
        markSeen(token);
        setResult({ status: "VALID", offline: true });
      }
      busyRef.current = false;
      return;
    }

    // ── Online path ───────────────────────────────────────────────────────────
    try {
      const { data, error } = await supabase.functions.invoke("verify-ticket", {
        body: { token },
      });

      if (error) {
        // Edge function returned an HTTP error
        console.error("[scan] function error:", error);
        throw new Error(error.message ?? "Edge function error");
      }

      const r = data as ScanResult;

      if (r.status === "VALID") markSeen(token);

      setResult(r);
    } catch (err) {
      // Network blip → queue for later
      console.warn("[scan] network error, queuing:", err);
      const q = loadQueue();
      q.push(token);
      saveQueue(q);
      markSeen(token);
      setResult({ status: "VALID", offline: true });
    } finally {
      busyRef.current = false;
    }
  };

  // ─── Camera controls ───────────────────────────────────────────────────────
  const start = async () => {
    setResult(null);
    busyRef.current = false;
    lastScanRef.current = null;

    try {
      // The container div MUST exist in the DOM before Html5Qrcode is instantiated
      const html5 = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5;

      await html5.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Fixed pixel box so it always renders regardless of container size
          qrbox: { width: 250, height: 250 },
        },
        (decoded) => {
          handleToken(decoded);
        },
        () => {
          /* ignore per-frame "no QR found" errors */
        },
      );

      setScanning(true);
    } catch (err) {
      console.error("[scan] camera error:", err);
      toast.error("Camera error", {
        description:
          err instanceof Error ? err.message : "Allow camera access and try again.",
      });
    }
  };

  const stop = async () => {
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch {
      /* noop */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-deep">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-px mx-auto flex max-w-3xl items-center justify-between py-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${
                online
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-amber-500/15 text-amber-800"
              }`}
            >
              {online ? (
                "● Online"
              ) : (
                <>
                  <WifiOff className="h-3 w-3" /> Offline
                </>
              )}
            </span>
            {queueLen > 0 && (
              <span className="rounded-full bg-secondary px-2 py-1 font-bold text-foreground">
                {queueLen} queued
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="container-px mx-auto max-w-3xl py-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">
                Door scanner
              </h1>
              <p className="text-xs text-muted-foreground">
                Aim the camera at a Fezzy ticket QR.
              </p>
            </div>
          </div>

          {/* ── Camera viewport ──
               IMPORTANT: Give the container an explicit height.
               html5-qrcode measures the div before starting the stream;
               if it is 0px tall the video element is invisible.          */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-black">
            <div
              id={containerId}
              style={{ width: "100%", minHeight: "320px" }}
            />
          </div>

          {/* Controls */}
          <div className="mt-4 flex gap-2">
            {!scanning ? (
              <Button variant="acacia" className="flex-1" onClick={start}>
                Start camera
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={stop}>
                Stop
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={flushQueue}
              disabled={!online || queueLen === 0}
            >
              Sync now
            </Button>
          </div>
        </div>

        {/* Result card */}
        {result && (
          <ResultCard result={result} onClear={() => setResult(null)} />
        )}
      </main>

      <Footer />
    </div>
  );
};

// ─── Result card ──────────────────────────────────────────────────────────────
const ResultCard = ({
  result,
  onClear,
}: {
  result: ScanResult;
  onClear: () => void;
}) => {
  const palette =
    result.status === "VALID"
      ? {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          text: "text-emerald-700",
          Icon: CheckCircle2,
          label: result.offline ? "Queued · Will sync when online" : "Valid · Checked in ✓",
        }
      : result.status === "ALREADY_USED"
      ? {
          bg: "bg-amber-500/10",
          border: "border-amber-500/40",
          text: "text-amber-800",
          Icon: AlertTriangle,
          label: "Already used",
        }
      : {
          bg: "bg-destructive/10",
          border: "border-destructive/40",
          text: "text-destructive",
          Icon: XCircle,
          label: "Invalid ticket",
        };

  const checkedInTime = result.ticket?.checked_in_at
    ? new Date(result.ticket.checked_in_at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div
      className={`mt-4 rounded-3xl border ${palette.border} ${palette.bg} p-5 shadow-card-soft`}
    >
      <div className="flex items-start gap-3">
        <palette.Icon className={`mt-0.5 h-8 w-8 shrink-0 ${palette.text}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-display text-lg font-bold ${palette.text}`}>
            {palette.label}
          </p>

          {result.ticket?.holder && (
            <p className="mt-1 text-sm font-semibold text-foreground">
              {result.ticket.holder}
            </p>
          )}
          {result.ticket?.tier && (
            <p className="text-xs text-muted-foreground">{result.ticket.tier}</p>
          )}
          {result.ticket?.event_title && (
            <p className="text-xs text-muted-foreground">
              {result.ticket.event_title}
            </p>
          )}
          {result.ticket?.venue && (
            <p className="text-xs text-muted-foreground">{result.ticket.venue}</p>
          )}
          {checkedInTime && result.status === "ALREADY_USED" && (
            <p className="mt-1 text-xs text-amber-700">
              Checked in at {checkedInTime}
            </p>
          )}
          {result.reason && !result.ticket && (
            <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onClear} className="shrink-0">
          Dismiss
        </Button>
      </div>
    </div>
  );
};

export default Scan;
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Loader2, ScanLine, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

type ScanResult = {
  status: "VALID" | "ALREADY_USED" | "INVALID";
  ticket?: { id: string; holder: string; checked_in_at?: string | null; event_title?: string };
  reason?: string;
  offline?: boolean;
};

const OFFLINE_QUEUE_KEY = "fezzy_scan_queue_v1";
const SEEN_TOKENS_KEY = "fezzy_seen_tokens_v1";

const Scan = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queueLen, setQueueLen] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "fezzy-qr-reader";
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?mode=signin&redirect=/scan", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    setQueueLen(loadQueue().length);
  }, []);

  // Auto-flush queue when back online
  useEffect(() => {
    if (online) flushQueue();
  }, [online]);

  const loadQueue = (): string[] => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); } catch { return []; }
  };
  const saveQueue = (q: string[]) => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
    setQueueLen(q.length);
  };
  const seenTokens = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_TOKENS_KEY) || "[]")); } catch { return new Set(); }
  };
  const markSeen = (token: string) => {
    const s = seenTokens(); s.add(token);
    localStorage.setItem(SEEN_TOKENS_KEY, JSON.stringify([...s].slice(-2000)));
  };

  const flushQueue = async () => {
    const q = loadQueue();
    if (!q.length) return;
    const remaining: string[] = [];
    for (const tok of q) {
      try {
        const { data, error } = await supabase.functions.invoke("verify-ticket", { body: { token: tok } });
        if (error) remaining.push(tok);
        else if ((data as ScanResult).status === "VALID") markSeen(tok);
      } catch { remaining.push(tok); }
    }
    saveQueue(remaining);
    if (q.length - remaining.length > 0) {
      toast.success(`Synced ${q.length - remaining.length} offline check-ins`);
    }
  };

  const handleToken = async (token: string) => {
    if (busy) return;
    const now = Date.now();
    if (lastScanRef.current?.token === token && now - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { token, at: now };

    setBusy(true);

    if (!online) {
      const seen = seenTokens();
      if (seen.has(token)) {
        setResult({ status: "ALREADY_USED", offline: true, reason: "offline_seen" });
      } else {
        const q = loadQueue(); q.push(token); saveQueue(q);
        markSeen(token);
        setResult({ status: "VALID", offline: true });
      }
      setBusy(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("verify-ticket", { body: { token } });
      if (error) throw error;
      const r = data as ScanResult;
      if (r.status === "VALID") markSeen(token);
      setResult(r);
    } catch (err) {
      // Network blip: queue
      const q = loadQueue(); q.push(token); saveQueue(q);
      markSeen(token);
      setResult({ status: "VALID", offline: true });
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setResult(null);
    try {
      const html5 = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded) => { handleToken(decoded); },
        () => {/* ignore frame errors */}
      );
      setScanning(true);
    } catch (err) {
      toast.error("Camera error", { description: err instanceof Error ? err.message : "Allow camera access." });
    }
  };

  const stop = async () => {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch { /* noop */ }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => { stop(); }, []);

  if (authLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-cream-deep">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-px mx-auto flex max-w-3xl items-center justify-between py-3">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${online ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-800"}`}>
              {online ? "● Online" : <><WifiOff className="h-3 w-3" /> Offline</>}
            </span>
            {queueLen > 0 && (
              <span className="rounded-full bg-secondary px-2 py-1 font-bold text-foreground">{queueLen} queued</span>
            )}
          </div>
        </div>
      </header>

      <main className="container-px mx-auto max-w-3xl py-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Door scanner</h1>
              <p className="text-xs text-muted-foreground">Aim the camera at a Fezzy ticket QR. Sub-500ms validation.</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-foreground/5">
            <div id={containerId} className="aspect-square w-full" />
          </div>

          <div className="mt-4 flex gap-2">
            {!scanning ? (
              <Button variant="acacia" className="flex-1" onClick={start}>Start camera</Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={stop}>Stop</Button>
            )}
            <Button variant="ghost" onClick={flushQueue} disabled={!online || queueLen === 0}>Sync now</Button>
          </div>
        </div>

        {result && <ResultCard result={result} onClear={() => setResult(null)} />}
      </main>
      <Footer />
    </div>
  );
};

const ResultCard = ({ result, onClear }: { result: ScanResult; onClear: () => void }) => {
  const palette =
    result.status === "VALID" ? { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700", Icon: CheckCircle2, label: "Valid · Checked in" } :
    result.status === "ALREADY_USED" ? { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-800", Icon: AlertTriangle, label: "Already used" } :
    { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", Icon: XCircle, label: "Invalid" };
  return (
    <div className={`mt-4 rounded-3xl border ${palette.border} ${palette.bg} p-5 shadow-card-soft`}>
      <div className="flex items-center gap-3">
        <palette.Icon className={`h-8 w-8 ${palette.text}`} />
        <div className="flex-1">
          <p className={`font-display text-lg font-bold ${palette.text}`}>{palette.label}{result.offline && " (offline)"}</p>
          {result.ticket?.holder && <p className="text-sm text-foreground">{result.ticket.holder}</p>}
          {result.ticket?.event_title && <p className="text-xs text-muted-foreground">{result.ticket.event_title}</p>}
          {result.reason && !result.ticket && <p className="text-xs text-muted-foreground">{result.reason}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onClear}>Dismiss</Button>
      </div>
    </div>
  );
};

export default Scan;

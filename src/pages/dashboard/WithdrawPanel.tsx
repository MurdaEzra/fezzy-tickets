import { useEffect, useState } from "react";
import { Loader2, Wallet, Building2, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatKES } from "@/lib/eventsApi";

type Channel = "mpesa" | "bank";

interface Props {
  organizerId: string;
}

interface Withdrawal {
  id: string;
  amount_kes: number;
  channel: string;
  destination: string;
  status: string;
  created_at: string;
  failure_reason: string | null;
}

export default function WithdrawPanel({ organizerId }: Props) {
  const [channel, setChannel] = useState<Channel>("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Load saved payout details + history
  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: wds }] = await Promise.all([
        supabase
          .from("organizer_profiles")
          .select("mpesa_phone, bank_name, bank_account_number, bank_account_name, preferred_payout_channel")
          .eq("id", organizerId)
          .maybeSingle(),
        supabase
          .from("withdrawals")
          .select("*")
          .eq("organizer_id", organizerId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (prof) {
        setMpesaPhone(prof.mpesa_phone ?? "");
        setBankName(prof.bank_name ?? "");
        setBankAccount(prof.bank_account_number ?? "");
        setBankHolder(prof.bank_account_name ?? "");
        if (prof.preferred_payout_channel === "bank") setChannel("bank");
      }
      setHistory((wds ?? []) as Withdrawal[]);
      setLoadingDetails(false);
    })();
  }, [organizerId]);

  const saveDetails = async () => {
    setSavingDetails(true);
    const { error } = await supabase
      .from("organizer_profiles")
      .update({
        mpesa_phone: mpesaPhone.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account_number: bankAccount.trim() || null,
        bank_account_name: bankHolder.trim() || null,
        preferred_payout_channel: channel,
      })
      .eq("id", organizerId);
    setSavingDetails(false);
    if (error) {
      toast.error("Could not save details", { description: error.message });
    } else {
      toast.success("Payout details saved");
    }
  };

  const submitWithdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100) {
      toast.error("Minimum withdrawal is KES 100");
      return;
    }
    const destination = channel === "mpesa" ? mpesaPhone.trim() : bankAccount.trim();
    if (!destination) {
      toast.error(channel === "mpesa" ? "Add your M-Pesa number first" : "Add your bank account first");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("payhero-withdraw", {
      body: { amount_kes: amt, channel, destination },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast.error("Withdrawal failed", { description: data?.error ?? error?.message });
    } else {
      toast.success("Withdrawal initiated", {
        description: `Reference: ${data?.payhero_reference ?? data?.withdrawal_id}`,
      });
      setAmount("");
      // Refresh history
      const { data: wds } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("organizer_id", organizerId)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((wds ?? []) as Withdrawal[]);
    }
  };

  if (loadingDetails) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground">Withdraw your earnings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Send funds straight to M-Pesa or your bank via PayHero. Funds usually arrive within minutes.</p>
          </div>
        </div>
      </div>

      {/* Payout method selector */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payout method</Label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <ChannelTile
            active={channel === "mpesa"}
            onClick={() => setChannel("mpesa")}
            icon={Smartphone}
            title="M-Pesa"
            subtitle="Instant to your phone"
          />
          <ChannelTile
            active={channel === "bank"}
            onClick={() => setChannel("bank")}
            icon={Building2}
            title="Bank account"
            subtitle="Same-day to most banks"
          />
        </div>
      </div>

      {/* Details form */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        <h3 className="font-display text-lg font-bold text-foreground">Your {channel === "mpesa" ? "M-Pesa" : "bank"} details</h3>
        <p className="mt-1 text-sm text-muted-foreground">We save these so you don't re-enter them every time.</p>
        {channel === "mpesa" ? (
          <div className="mt-5 grid gap-4">
            <div>
              <Label htmlFor="mpesa">M-Pesa phone number</Label>
              <Input id="mpesa" inputMode="tel" placeholder="0712 345 678 or 254712345678" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Use the Safaricom number registered for M-Pesa.</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" placeholder="e.g. Equity Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bankAcc">Account number</Label>
              <Input id="bankAcc" inputMode="numeric" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bankHolder">Account holder name</Label>
              <Input id="bankHolder" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
            </div>
          </div>
        )}
        <Button variant="outline" className="mt-5" onClick={saveDetails} disabled={savingDetails}>
          {savingDetails && <Loader2 className="h-4 w-4 animate-spin" />} Save details
        </Button>
      </div>

      {/* Withdraw form */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8">
        <h3 className="font-display text-lg font-bold text-foreground">Request withdrawal</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="amt">Amount (KES)</Label>
            <Input id="amt" inputMode="numeric" placeholder="2500" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button variant="acacia" size="lg" onClick={submitWithdraw} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Withdraw via PayHero
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Minimum KES 100 · Standard PayHero charges may apply.</p>
      </div>

      {/* History */}
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Recent withdrawals</h3>
        {history.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No withdrawals yet.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            {history.map((w, i) => (
              <div key={w.id} className={`flex items-center justify-between gap-4 p-4 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="flex items-center gap-3">
                  {w.status === "paid" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : w.status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{formatKES(w.amount_kes)}</p>
                    <p className="text-xs text-muted-foreground">{w.channel.toUpperCase()} → {w.destination}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    w.status === "paid" ? "bg-primary/15 text-primary" :
                    w.status === "failed" ? "bg-destructive/15 text-destructive" :
                    "bg-secondary text-muted-foreground"
                  }`}>{w.status}</span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ChannelTile = ({ active, onClick, icon: Icon, title, subtitle }: { active: boolean; onClick: () => void; icon: typeof Wallet; title: string; subtitle: string }) => (
  <button
    onClick={onClick}
    className={`text-left flex items-center gap-3 rounded-2xl border p-4 transition-all ${
      active ? "border-primary bg-primary/[0.07] shadow-card-soft" : "border-border bg-card hover:border-primary/40"
    }`}
  >
    <div className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="font-display font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </button>
);

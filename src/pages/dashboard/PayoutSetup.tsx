import { useEffect, useState } from "react";
import { Loader2, Banknote, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  organizerId: string;
  feeLockedPct: number | null;
}

interface Bank { name: string; code: string; }

export default function PayoutSetup({ organizerId, feeLockedPct }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [connected, setConnected] = useState<{ accountName: string | null; bankCode: string | null; accountNumber: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, banksRes] = await Promise.all([
        supabase
          .from("organizer_profiles")
          .select("org_name, paystack_subaccount_code, paystack_account_name, paystack_bank_code, paystack_account_number")
          .eq("id", organizerId)
          .maybeSingle(),
        supabase.functions.invoke("paystack-list-banks", { method: "GET" }),
      ]);
      if (prof) {
        setBusinessName(prof.org_name ?? "");
        if (prof.paystack_subaccount_code) {
          setConnected({
            accountName: prof.paystack_account_name,
            bankCode: prof.paystack_bank_code,
            accountNumber: prof.paystack_account_number,
          });
        }
        if (prof.paystack_bank_code) setBankCode(prof.paystack_bank_code);
        if (prof.paystack_account_number) setAccountNumber(prof.paystack_account_number);
      }
      const banksData = (banksRes.data as { banks?: Bank[] } | null)?.banks ?? [];
      setBanks(banksData);
      setLoading(false);
    })();
  }, [organizerId]);

  const save = async () => {
    if (!businessName.trim() || !bankCode || !accountNumber.trim()) {
      toast.error("Fill in all fields");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("paystack-create-subaccount", {
      body: {
        businessName: businessName.trim(),
        settlementBank: bankCode,
        accountNumber: accountNumber.trim(),
      },
    });
    setSaving(false);
    const err = (data as { error?: string } | null)?.error ?? error?.message;
    if (err) { toast.error("Could not connect payout", { description: err }); return; }
    setConnected({
      accountName: (data as { account_name?: string }).account_name ?? businessName,
      bankCode,
      accountNumber,
    });
    toast.success("Payout connected", { description: "Your share will land instantly on every sale." });
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const bankName = banks.find((b) => b.code === connected?.bankCode)?.name ?? connected?.bankCode;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-acacia text-primary-foreground shadow-acacia">
            <Banknote className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground">Get paid instantly</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We never hold your money. Every successful ticket sale is split at the moment of payment —
              your share lands in your bank, the platform fee comes to us. No withdrawals, no waiting.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-bold text-primary">
                Platform fee: {feeLockedPct ?? 5}%
              </span>
              {feeLockedPct === null && (
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-bold text-accent-foreground">
                  <Sparkles className="inline h-3 w-3" /> First event: 0%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {connected && (
        <div className="rounded-3xl border border-primary/40 bg-primary/5 p-6 shadow-card-soft">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-display font-bold text-foreground">Connected to Paystack</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {connected.accountName ?? "Account"} · {bankName} · ••••{connected.accountNumber?.slice(-4)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-8 space-y-5">
        <h3 className="font-display text-lg font-bold text-foreground">
          {connected ? "Update payout destination" : "Connect your payout destination"}
        </h3>

        <div>
          <Label htmlFor="biz">Business / account holder name</Label>
          <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div>
            <Label htmlFor="bank">Bank / mobile money provider</Label>
            <select
              id="bank"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {banks.map((b, index) => (
                <option key={`${b.code}-${index}`} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="acc">Account number</Label>
            <Input id="acc" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <Button variant="acacia" size="lg" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {connected ? "Update payout" : "Connect payout"}
        </Button>
      </div>
    </div>
  );
}
